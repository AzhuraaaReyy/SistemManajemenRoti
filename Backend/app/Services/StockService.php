<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Enums\StockStatus;
use App\Exceptions\InsufficientStockException;
use App\Models\Ingredient;
use App\Models\StockLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Satu-satunya pintu perubahan stok.
 *
 * ATURAN MUTLAK: tidak ada kode lain di seluruh sistem yang boleh menulis
 * kolom `current_stock` secara langsung. Semua lewat applyMovement().
 *
 * Alasannya bukan kerapian, melainkan kebenaran data:
 *
 *   - Setiap perubahan otomatis punya jejak audit.
 *   - Stok tidak bisa berubah tanpa alasan yang tercatat.
 *   - Rekonsiliasi bisa membuktikan cache stok masih benar.
 *   - Aturan "tidak boleh minus" ditegakkan di satu tempat, bukan tersebar.
 *
 * Implementasi algoritma A1, §3.1 DOKUMEN-PERANCANGAN.md.
 */
class StockService
{
    /**
     * Menerapkan satu pergerakan stok.
     *
     * @param  Model  $item        Ingredient atau Product
     * @param  float  $quantity    Selalu positif; arah ditentukan $direction
     * @param  string $direction   'in' atau 'out'
     * @param  string|null $idempotencyKey  Bila diisi dan sudah pernah dipakai,
     *                                      pergerakan tidak diulang.
     *
     * @throws InsufficientStockException bila stok tidak mencukupi
     */
    public function applyMovement(
        Model $item,
        float $quantity,
        string $direction,
        StockMovementType $sourceType,
        ?string $sourceId = null,
        ?float $unitCost = null,
        ?string $note = null,
        ?int $userId = null,
        ?string $idempotencyKey = null,
    ): StockLedger {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Jumlah pergerakan stok harus lebih besar dari nol.');
        }

        if (! in_array($direction, ['in', 'out'], true)) {
            throw new \InvalidArgumentException("Arah pergerakan tidak valid: {$direction}");
        }

        $key = $idempotencyKey ?: (string) Str::uuid();

        // Pemeriksaan cepat di luar transaksi. Pemeriksaan sesungguhnya tetap
        // dilakukan oleh unique constraint di dalam transaksi — dua permintaan
        // bersamaan bisa lolos tahap ini bersama-sama.
        $sudahAda = StockLedger::where('idempotency_key', $key)->first();

        if ($sudahAda) {
            return $sudahAda;
        }

        // Status DIHITUNG sebelum stok bergerak. Inilah satu-satunya cara
        // mengetahui apakah pergerakan ini menyebabkan perpindahan status —
        // tanpa menyimpan status lama di kolom barang.
        $statusSebelum = StockStatus::classify(
            (float) $item->current_stock,
            (float) $item->min_stock,
        );

        $ledger = DB::transaction(function () use (
            $item, $quantity, $direction, $sourceType, $sourceId, $unitCost, $note, $userId, $key
        ) {
            // Kunci baris barang sampai transaksi selesai. Tanpa ini, dua
            // produksi bersamaan bisa sama-sama membaca stok 100, sama-sama
            // memotong 80, dan menyisakan 20 — padahal seharusnya ditolak.
            /** @var Ingredient $terkunci */
            $terkunci = $item->newQuery()->lockForUpdate()->findOrFail($item->getKey());

            $saldoAwal = (float) $terkunci->current_stock;
            $delta = $direction === 'in' ? $quantity : -$quantity;
            $saldoAkhir = $saldoAwal + $delta;

            if ($saldoAkhir < 0 && ! $sourceType->allowsNegative()) {
                throw new InsufficientStockException(
                    itemName: $terkunci->name,
                    available: $saldoAwal,
                    requested: $quantity,
                    unit: $this->satuanDasar($terkunci),
                );
            }

            // Harga rata-rata tertimbang hanya diperbarui saat barang masuk
            // dengan harga yang diketahui — §3.7 DOKUMEN-PERANCANGAN.md.
            //
            // Keberadaan kolom diperiksa lebih dulu supaya model bertok yang
            // memang tidak melacak harga tidak membuat pergerakan stok gagal.
            $melacakHarga = $direction === 'in'
                && $unitCost !== null
                && $unitCost >= 0
                && $this->punyaKolomHarga($terkunci);

            if ($melacakHarga) {
                $terkunci->avg_cost = $this->hitungHargaRataRata(
                    stokLama: $saldoAwal,
                    hargaLama: (float) $terkunci->avg_cost,
                    stokMasuk: $quantity,
                    hargaMasuk: $unitCost,
                );
            }

            $ledger = StockLedger::create([
                'item_type' => $terkunci::class,
                'item_id' => $terkunci->getKey(),
                'direction' => $direction,
                'quantity' => $quantity,
                'delta' => $delta,
                'balance_before' => $saldoAwal,
                'balance_after' => $saldoAkhir,
                'source_type' => $sourceType->value,
                'source_id' => $sourceId,
                'unit_cost' => $unitCost,
                'note' => $note,
                'user_id' => $userId,
                'idempotency_key' => $key,
            ]);

            // Cache stok diperbarui di dalam transaksi yang sama dengan
            // penulisan ledger — keduanya berhasil bersama atau gagal bersama.
            $terkunci->current_stock = $saldoAkhir;
            $terkunci->saveQuietly();

            return $ledger;
        });

        /*
        | Peringatan dibuat DI LUAR transaksi, setelah stok benar-benar tersimpan.
        |
        | Dua alasan. Pertama, kegagalan membuat pemberitahuan tidak boleh
        | membatalkan pembelian atau produksi yang sudah sah — itu sebabnya
        | dipakai evaluateSafely(). Kedua, di dalam transaksi angka stoknya
        | belum tentu final bila pemanggilnya membungkus beberapa pergerakan
        | sekaligus.
        |
        | $item disegarkan karena baris yang diperbarui adalah salinan terkunci
        | di dalam transaksi, bukan objek yang dipegang pemanggil.
        */
        $segar = $item->fresh();

        if ($segar) {
            app(StockAlertService::class)->evaluateSafely($segar, $statusSebelum, $ledger);
        }

        return $ledger;
    }

    /**
     * Mencatat saldo pembukaan saat barang baru dibuat.
     *
     * Bahkan stok awal pun tidak boleh menjadi angka tanpa asal-usul. Kalau
     * suatu saat ditanya "kenapa tepungnya 20 kg?", jawabannya harus ada di
     * ledger, bukan "sudah begitu dari dulu".
     */
    public function recordOpeningBalance(
        Model $item,
        float $quantity,
        ?float $unitCost = null,
        ?int $userId = null,
        ?string $note = null,
    ): ?StockLedger {
        if ($quantity <= 0) {
            return null;
        }

        return $this->applyMovement(
            item: $item,
            quantity: $quantity,
            direction: 'in',
            sourceType: StockMovementType::OPENING,
            sourceId: 'OPENING-'.class_basename($item).'-'.$item->getKey(),
            unitCost: $unitCost,
            note: $note ?? 'Saldo awal saat data dibuat',
            userId: $userId,
            idempotencyKey: 'opening:'.$item::class.':'.$item->getKey(),
        );
    }

    /**
     * Penyesuaian ke jumlah hasil hitungan fisik (stock opname).
     *
     * Selisihnya dicatat sebagai satu baris ledger bertipe ADJUSTMENT
     * lengkap dengan alasannya — bukan menimpa angka stok diam-diam.
     */
    public function adjustToCount(
        Model $item,
        float $physicalCount,
        string $reason,
        ?int $userId = null,
        ?string $idempotencyKey = null,
    ): ?StockLedger {
        $sekarang = (float) $item->current_stock;
        $selisih = $physicalCount - $sekarang;

        if (abs($selisih) < 0.0001) {
            return null;
        }

        return $this->applyMovement(
            item: $item,
            quantity: abs($selisih),
            direction: $selisih > 0 ? 'in' : 'out',
            sourceType: StockMovementType::ADJUSTMENT,
            sourceId: null,
            unitCost: null,
            note: $reason,
            userId: $userId,
            idempotencyKey: $idempotencyKey,
        );
    }

    /**
     * Memeriksa apakah cache stok masih cocok dengan jumlah ledger.
     *
     * @return array{consistent: bool, cached: float, ledger: float, difference: float}
     */
    public function verify(Model $item): array
    {
        $ledger = (float) StockLedger::where('item_type', $item::class)
            ->where('item_id', $item->getKey())
            ->sum('delta');

        $cache = (float) $item->current_stock;
        $selisih = round($cache - $ledger, 4);

        return [
            'consistent' => abs($selisih) < 0.0001,
            'cached' => $cache,
            'ledger' => $ledger,
            'difference' => $selisih,
        ];
    }

    /**
     * Harga rata-rata tertimbang (Weighted Average Cost).
     *
     * Contoh: 10 kg @ Rp12.000 lalu beli 20 kg @ Rp15.000
     *         → (120.000 + 300.000) / 30 = Rp14.000/kg
     */
    private function hitungHargaRataRata(
        float $stokLama,
        float $hargaLama,
        float $stokMasuk,
        float $hargaMasuk,
    ): float {
        $totalQty = $stokLama + $stokMasuk;

        if ($totalQty <= 0) {
            return $hargaMasuk;
        }

        // Stok negatif (akibat penyesuaian) membuat rata-rata tertimbang tidak
        // bermakna — pakai harga pembelian terbaru saja.
        if ($stokLama < 0) {
            return $hargaMasuk;
        }

        return round((($stokLama * $hargaLama) + ($stokMasuk * $hargaMasuk)) / $totalQty, 4);
    }

    private function satuanDasar(Model $item): string
    {
        return $item instanceof Ingredient
            ? $item->base_unit->value
            : ($item->unit ?? 'pcs');
    }

    /**
     * Apakah model ini melacak harga pokok rata-rata?
     *
     * Ingredient dan Product punya kolom `avg_cost`. Bila kelak ada barang
     * bertok yang tidak melacaknya, pergerakan stoknya tetap boleh jalan —
     * bagian harganya saja yang dilewati, bukan seluruh transaksi yang gagal.
     */
    private function punyaKolomHarga(Model $item): bool
    {
        return array_key_exists('avg_cost', $item->getAttributes())
            || in_array('avg_cost', $item->getFillable(), true);
    }
}
