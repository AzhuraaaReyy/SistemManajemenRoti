<?php

namespace App\Services;

use App\Enums\ProductionStatus;
use App\Enums\StockMovementType;
use App\Exceptions\InsufficientMaterialsException;
use App\Models\Ingredient;
use App\Models\ProductionBatch;
use App\Models\ProductionBatchMaterial;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Produksi berbasis Bill of Materials.
 *
 * Alur yang dijalankan:
 *
 *   1. Baca resep aktif produk
 *   2. Hitung kebutuhan tiap bahan = takaran per unit × jumlah produksi
 *   3. Periksa stok setiap bahan
 *   4. Bila ada yang kurang  → tolak, sebutkan bahan mana dan berapa selisihnya
 *   5. Bila semua mencukupi  → potong stok, buat batch berstatus Diproses
 *   6. Saat batch diselesaikan → tambah stok produk jadi
 *
 * Seluruh perubahan stok memakai StockService, sehingga tercatat di
 * `stock_ledger` yang sama dengan modul pembelian — tidak ada tabel mutasi baru.
 */
class ProductionService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly RecipeService $recipes,
        private readonly ProductionTrackingService $tracking,
    ) {
    }

    /*
    |--------------------------------------------------------------------------
    | Perhitungan kebutuhan — dipakai pratinjau maupun eksekusi
    |--------------------------------------------------------------------------
    */

    /**
     * Menghitung kebutuhan bahan dan memeriksa kecukupan stok.
     *
     * Tidak mengubah apa pun. Dipakai halaman pratinjau agar pengguna tahu
     * hasilnya sebelum menekan tombol, dan dipakai ulang saat eksekusi agar
     * aturannya tidak ditulis dua kali.
     *
     * @return array<string, mixed>
     */
    public function calculateRequirements(int $productId, float $quantity): array
    {
        if ($quantity <= 0) {
            throw ValidationException::withMessages([
                'quantity' => 'Jumlah produksi harus lebih besar dari nol.',
            ]);
        }

        // Melempar bila produk belum punya resep aktif atau resepnya kosong.
        $recipe = $this->recipes->resolveForProduction($productId);
        $product = Product::findOrFail($productId);

        $yield = (float) $recipe->yield_quantity;

        $baris = [];
        $totalBiaya = 0.0;
        $kurang = [];

        foreach ($recipe->items as $item) {
            /** @var RecipeItem $item */
            $bahan = $item->ingredient;

            if (! $bahan) {
                continue;
            }

            /*
            | Takaran per satu unit produk, sudah termasuk susut.
            |
            | Resep menyatakan takaran untuk satu kali resep penuh (misal 50
            | pcs), jadi dibagi yield dulu baru dikalikan jumlah produksi.
            */
            $perUnit = ((float) $item->quantity * (1 + (float) $item->waste_percent / 100)) / $yield;
            $butuh = round($perUnit * $quantity, 4);

            $tersedia = (float) $bahan->current_stock;
            $faktor = max((float) $bahan->conversion_factor, 0.0001);
            $cukup = $tersedia >= $butuh;

            $biaya = round($butuh * (float) $bahan->avg_cost, 2);
            $totalBiaya += $biaya;

            $entri = [
                'ingredient_id' => $bahan->id,
                'code' => $bahan->code,
                'name' => $bahan->name,
                'base_unit' => $bahan->base_unit->value,
                'unit' => $bahan->display_unit,
                'conversion_factor' => $faktor,

                'qty_per_unit' => round($perUnit, 6),
                'waste_percent' => (float) $item->waste_percent,

                // Dikirim dalam dua satuan: dasar untuk perhitungan,
                // tampilan untuk dibaca manusia.
                'required' => $butuh,
                'required_display' => round($butuh / $faktor, 4),
                'available' => $tersedia,
                'available_display' => round($tersedia / $faktor, 4),
                'shortage' => $cukup ? 0.0 : round($butuh - $tersedia, 4),
                'shortage_display' => $cukup ? 0.0 : round(($butuh - $tersedia) / $faktor, 4),

                'unit_cost' => (float) $bahan->avg_cost,
                'line_cost' => $biaya,

                'sufficient' => $cukup,
                'stock_status' => $bahan->stockStatus()->value,
            ];

            $baris[] = $entri;

            if (! $cukup) {
                $kurang[] = $entri;
            }
        }

        return [
            'product' => [
                'id' => $product->id,
                'code' => $product->code,
                'name' => $product->name,
                'unit' => $product->unit,
                'selling_price' => (float) $product->selling_price,
                'current_stock' => (float) $product->current_stock,
            ],
            'recipe' => [
                'id' => $recipe->id,
                'name' => $recipe->name,
                'version' => $recipe->version,
                'yield_quantity' => $yield,
                'yield_unit' => $recipe->yield_unit,
            ],
            'quantity' => $quantity,
            'factor' => round($quantity / $yield, 6),
            'can_produce' => $kurang === [],
            'materials' => $baris,
            'shortages' => $kurang,
            'material_cost' => round($totalBiaya, 2),
            'cost_per_unit' => $quantity > 0 ? round($totalBiaya / $quantity, 2) : 0.0,
            'max_producible' => $this->maxProducible($recipe),
        ];
    }

    /**
     * Berapa unit maksimal yang masih bisa dibuat dengan stok saat ini.
     *
     * @return array{quantity: int, limiting_ingredient: string|null}
     */
    public function maxProducible(Recipe $recipe): array
    {
        return $recipe->maxProducible();
    }

    /*
    |--------------------------------------------------------------------------
    | Menjalankan produksi
    |--------------------------------------------------------------------------
    */

    /**
     * Membuat batch produksi dan memotong stok bahan.
     *
     * SELURUHNYA ATOMIK. Bila satu bahan gagal dipotong — misalnya produksi
     * lain menyerobot stok di detik yang sama — seluruh transaksi dibatalkan:
     * batch tidak terbuat, dan bahan yang sudah terlanjur dipotong dikembalikan
     * oleh rollback database.
     *
     * @throws InsufficientMaterialsException bila ada bahan yang kurang
     */
    public function execute(
        int $productId,
        float $quantity,
        ?int $operatorId = null,
        ?string $notes = null,
        ?string $idempotencyKey = null,
    ): ProductionBatch {
        /*
        | Idempotensi diperiksa di tingkat BATCH, bukan hanya di ledger.
        |
        | Menjaga ledger saja tidak cukup: permintaan yang terkirim dua kali
        | akan tetap membuat batch kedua lengkap dengan rincian pemakaian bahan
        | dan nilai biayanya, sementara StockService menolak memotong stok lagi.
        | Hasilnya batch hantu — dokumen yang mengaku memakai bahan padahal
        | tidak ada satu pun baris ledger di baliknya.
        |
        | Yang berbahaya, `stock:reconcile` tidak akan menangkapnya: cache stok
        | dan ledger tetap cocok. Batch itu baru ketahuan saat laporan biaya
        | produksi terlihat lebih besar dari pemakaian bahan yang sebenarnya.
        */
        if ($idempotencyKey) {
            $sudahAda = ProductionBatch::where('idempotency_key', $idempotencyKey)->first();

            if ($sudahAda) {
                return $sudahAda->load(['product', 'recipe', 'materials.ingredient', 'operator']);
            }
        }

        // Pemeriksaan awal di luar transaksi, supaya penolakan karena stok
        // kurang tidak perlu membuka transaksi sama sekali.
        $rencana = $this->calculateRequirements($productId, $quantity);

        if (! $rencana['can_produce']) {
            throw new InsufficientMaterialsException(
                shortages: $rencana['shortages'],
                productName: $rencana['product']['name'],
                quantity: $quantity,
            );
        }

        return DB::transaction(function () use ($rencana, $productId, $quantity, $operatorId, $notes, $idempotencyKey) {
            $recipe = Recipe::findOrFail($rencana['recipe']['id']);

            $batch = ProductionBatch::create([
                'batch_number' => ProductionBatch::generateNumber(),
                // Unique constraint di database menjadi penjaga terakhir bila
                // dua permintaan lolos pemeriksaan awal secara bersamaan.
                'idempotency_key' => $idempotencyKey,
                'product_id' => $productId,
                'recipe_id' => $recipe->id,
                'recipe_version' => $recipe->version,
                'target_quantity' => $quantity,
                'reject_quantity' => 0,
                'status' => ProductionStatus::IN_PROGRESS->value,
                'started_at' => now(),
                'operator_id' => $operatorId,
                'notes' => $notes,
            ]);

            /*
            | Bahan diurutkan berdasarkan id sebelum dipotong.
            |
            | Dua produksi yang berjalan bersamaan dan memakai bahan yang sama
            | akan mengunci baris dalam urutan yang identik, sehingga tidak
            | saling menunggu dan menimbulkan deadlock.
            */
            $materials = collect($rencana['materials'])->sortBy('ingredient_id')->values();

            $totalBiaya = 0.0;

            foreach ($materials as $urutan => $m) {
                /** @var Ingredient $bahan */
                $bahan = Ingredient::findOrFail($m['ingredient_id']);

                // Pemotongan stok lewat StockService: tercatat di stock_ledger
                // dengan jenis keluar, sumber produksi, referensi nomor batch.
                // Bila stok ternyata sudah tidak cukup (diserobot produksi
                // lain), StockService melempar dan seluruh transaksi rollback.
                $this->stock->applyMovement(
                    item: $bahan,
                    quantity: $m['required'],
                    direction: 'out',
                    sourceType: StockMovementType::PRODUCTION_CONSUME,
                    sourceId: $batch->batch_number,
                    unitCost: null,
                    note: "Dipakai produksi {$batch->batch_number} — {$rencana['product']['name']}",
                    userId: $operatorId,
                    idempotencyKey: ($idempotencyKey ?? "production:{$batch->id}").":ing:{$bahan->id}",
                );

                $biaya = round($m['required'] * $m['unit_cost'], 2);
                $totalBiaya += $biaya;

                ProductionBatchMaterial::create([
                    'production_batch_id' => $batch->id,
                    'ingredient_id' => $bahan->id,
                    'qty_per_unit' => $m['qty_per_unit'],
                    'qty_required' => $m['required'],
                    'qty_used' => $m['required'],
                    'waste_percent' => $m['waste_percent'],
                    // Harga dibekukan di sini — HPP batch ini tidak akan
                    // berubah walaupun harga bahan naik bulan depan.
                    'unit_cost' => $m['unit_cost'],
                    'line_cost' => $biaya,
                    'stock_before' => $m['available'],
                    'sort_order' => $urutan,
                ]);
            }

            $batch->update([
                'material_cost' => round($totalBiaya, 2),
                'cost_per_unit' => $quantity > 0 ? round($totalBiaya / $quantity, 2) : 0,
            ]);

            // Versi resep dikunci permanen: batch ini sudah merujuk padanya,
            // jadi isinya tidak boleh berubah lagi.
            $this->recipes->markAsUsedInProduction($recipe, $batch->batch_number);

            // Tujuh baris tahapan dibuat di muka (semua `pending`), supaya
            // timeline langsung bisa dirender dan validasi urutan pada modul
            // tracking cukup membaca baris yang sudah ada.
            $this->tracking->createStagesFor($batch);

            return $batch->fresh(['product', 'recipe', 'materials.ingredient', 'operator', 'stages']);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Menyelesaikan produksi
    |--------------------------------------------------------------------------
    */

    /**
     * Menyelesaikan batch dan menambah stok produk jadi.
     *
     * Hasil dipisah menjadi layak jual dan gagal, karena keduanya berbeda
     * artinya: yang layak jual menambah stok, yang gagal hanya menjadi catatan
     * kerugian. Memaksa "hasil = target" akan menyembunyikan roti gosong dari
     * laporan, padahal bahannya sudah terpakai.
     */
    public function complete(
        ProductionBatch $batch,
        float $goodQuantity,
        float $rejectQuantity = 0,
        ?int $userId = null,
        ?string $notes = null,
        ?string $idempotencyKey = null,
    ): ProductionBatch {
        if (! $batch->status->canComplete()) {
            throw ValidationException::withMessages([
                'status' => "Batch {$batch->batch_number} berstatus {$batch->status->label()}, "
                    .'hanya batch Diproses yang bisa diselesaikan.',
            ]);
        }

        if ($goodQuantity < 0 || $rejectQuantity < 0) {
            throw ValidationException::withMessages([
                'good_quantity' => 'Jumlah hasil tidak boleh negatif.',
            ]);
        }

        // Hasil melebihi target sedikit masih wajar (adonan mengembang lebih
        // banyak), tetapi kelebihan ekstrem berarti salah ketik.
        $batasAtas = (float) $batch->target_quantity * 1.2;

        if ($goodQuantity + $rejectQuantity > $batasAtas) {
            throw ValidationException::withMessages([
                'good_quantity' => sprintf(
                    'Total hasil (%s) jauh melebihi target produksi (%s). Periksa kembali angkanya.',
                    rtrim(rtrim(number_format($goodQuantity + $rejectQuantity, 2), '0'), '.'),
                    rtrim(rtrim(number_format((float) $batch->target_quantity, 2), '0'), '.'),
                ),
            ]);
        }

        return DB::transaction(function () use ($batch, $goodQuantity, $rejectQuantity, $userId, $notes, $idempotencyKey) {
            $batch->loadMissing('product');

            if ($goodQuantity > 0) {
                /*
                | HPP per unit dihitung dari seluruh biaya bahan dibagi hasil
                | yang LAYAK JUAL saja.
                |
                | Bahan untuk roti yang gosong tetap keluar uang, jadi biayanya
                | dibebankan ke roti yang berhasil — itulah biaya sebenarnya
                | per potong yang laku dijual.
                */
                $hppPerUnit = round((float) $batch->material_cost / $goodQuantity, 4);

                $this->stock->applyMovement(
                    item: $batch->product,
                    quantity: $goodQuantity,
                    direction: 'in',
                    sourceType: StockMovementType::PRODUCTION_YIELD,
                    sourceId: $batch->batch_number,
                    unitCost: $hppPerUnit,
                    note: "Hasil produksi {$batch->batch_number}",
                    userId: $userId,
                    idempotencyKey: ($idempotencyKey ?? "production-complete:{$batch->id}"),
                );
            }

            $batch->update([
                'good_quantity' => $goodQuantity,
                'reject_quantity' => $rejectQuantity,
                'status' => ProductionStatus::COMPLETED->value,
                'finished_at' => now(),
                'completed_by' => $userId,
                'cost_per_unit' => $goodQuantity > 0
                    ? round((float) $batch->material_cost / $goodQuantity, 2)
                    : null,
                'notes' => $notes !== null && $notes !== ''
                    ? trim(($batch->notes ?? '')."\n".$notes)
                    : $batch->notes,
            ]);

            return $batch->fresh(['product', 'recipe', 'materials.ingredient', 'operator', 'completer']);
        });
    }

    /**
     * Membatalkan batch dan mengembalikan stok bahan.
     *
     * Dipakai ketika produksinya TIDAK JADI dikerjakan — salah input jumlah,
     * atau pesanan pelanggan batal sebelum adonan dibuat.
     *
     * Bila adonan sudah terlanjur dibuat lalu gagal, jangan dibatalkan:
     * selesaikan dengan hasil layak jual 0 agar kerugian bahannya tetap
     * tercatat. Membatalkan berarti bahan kembali ke gudang, dan itu tidak
     * benar bila bahannya sudah tercampur.
     */
    public function cancel(
        ProductionBatch $batch,
        string $reason,
        ?int $userId = null,
    ): ProductionBatch {
        if (! $batch->status->canCancel()) {
            throw ValidationException::withMessages([
                'status' => "Batch {$batch->batch_number} berstatus {$batch->status->label()} "
                    .'dan tidak dapat dibatalkan.',
            ]);
        }

        return DB::transaction(function () use ($batch, $reason, $userId) {
            $batch->loadMissing('materials.ingredient');

            foreach ($batch->materials->sortBy('ingredient_id') as $material) {
                if (! $material->ingredient || (float) $material->qty_used <= 0) {
                    continue;
                }

                $this->stock->applyMovement(
                    item: $material->ingredient,
                    quantity: (float) $material->qty_used,
                    direction: 'in',
                    sourceType: StockMovementType::PRODUCTION_CANCEL,
                    sourceId: $batch->batch_number,
                    // Dikembalikan pada harga yang sama saat dipotong, supaya
                    // harga rata-rata persediaan kembali seperti semula.
                    unitCost: (float) $material->unit_cost,
                    note: "Pengembalian bahan — batch {$batch->batch_number} dibatalkan",
                    userId: $userId,
                    idempotencyKey: "production-cancel:{$batch->id}:ing:{$material->ingredient_id}",
                );
            }

            $batch->update([
                'status' => ProductionStatus::CANCELLED->value,
                'cancelled_by' => $userId,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'finished_at' => now(),
            ]);

            return $batch->fresh(['product', 'recipe', 'materials.ingredient', 'operator', 'canceller']);
        });
    }
}
