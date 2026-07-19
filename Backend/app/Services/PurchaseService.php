<?php

namespace App\Services;

use App\Enums\PurchaseOrderStatus;
use App\Enums\StockMovementType;
use App\Models\Ingredient;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReceipt;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Aturan pembelian bahan baku.
 *
 * Alur yang dijaga:
 *
 *   Supplier → Input Pembelian → Barang Datang → Tambah Stok → Riwayat
 *
 * Penambahan stok TIDAK dilakukan di sini secara langsung. Service ini
 * memanggil StockService, sehingga setiap kilogram tepung yang masuk gudang
 * punya baris ledger dan ikut terhitung dalam harga rata-rata persediaan.
 */
class PurchaseService
{
    /**
     * Toleransi kelebihan kirim.
     *
     * Supplier kerap mengirim sedikit lebih dari pesanan — sak tepung tidak
     * pernah persis 25.000 gram. Menolak selisih 200 gram hanya akan memaksa
     * petugas gudang memalsukan angka agar bisa lanjut. Di atas 5%, penerimaan
     * ditolak karena itu bukan lagi selisih timbangan.
     */
    private const TOLERANSI_KELEBIHAN = 1.05;

    public function __construct(private readonly StockService $stock)
    {
    }

    /*
    |--------------------------------------------------------------------------
    | Menyusun pesanan
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $items
     */
    public function create(array $data, array $items, ?int $userId = null): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            $po = PurchaseOrder::create([
                'po_number' => PurchaseOrder::generateNumber(),
                'supplier_id' => $data['supplier_id'],
                'order_date' => $data['order_date'],
                'expected_date' => $data['expected_date'] ?? null,
                'status' => PurchaseOrderStatus::DRAFT->value,
                'discount_amount' => $data['discount_amount'] ?? 0,
                'shipping_cost' => $data['shipping_cost'] ?? 0,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            $this->tulisItems($po, $items);
            $this->hitungUlangTotal($po);

            return $po->fresh(['items.ingredient', 'supplier']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $items
     */
    public function update(PurchaseOrder $po, array $data, array $items): PurchaseOrder
    {
        $this->pastikanBisaDiubah($po);

        return DB::transaction(function () use ($po, $data, $items) {
            $po->update([
                'supplier_id' => $data['supplier_id'],
                'order_date' => $data['order_date'],
                'expected_date' => $data['expected_date'] ?? null,
                'discount_amount' => $data['discount_amount'] ?? 0,
                'shipping_cost' => $data['shipping_cost'] ?? 0,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
            ]);

            // Aman menulis ulang seluruh baris: pastikanBisaDiubah() menjamin
            // pesanan masih draft, jadi belum ada penerimaan yang merujuk ke sini.
            $po->items()->delete();
            $this->tulisItems($po, $items);
            $this->hitungUlangTotal($po);

            return $po->fresh(['items.ingredient', 'supplier']);
        });
    }

    /** Draft → Dipesan. Setelah ini isi pesanan tidak bisa diubah lagi. */
    public function confirm(PurchaseOrder $po, ?int $userId = null): PurchaseOrder
    {
        if ($po->status !== PurchaseOrderStatus::DRAFT) {
            throw ValidationException::withMessages([
                'status' => "Pesanan ini berstatus {$po->status->label()}, hanya draft yang bisa dikonfirmasi.",
            ]);
        }

        if ($po->items()->count() === 0) {
            throw ValidationException::withMessages([
                'items' => 'Pesanan tanpa barang tidak dapat dikonfirmasi.',
            ]);
        }

        $po->update([
            'status' => PurchaseOrderStatus::ORDERED->value,
            'ordered_by' => $userId,
            'ordered_at' => now(),
        ]);

        return $po->fresh(['items.ingredient', 'supplier']);
    }

    /*
    |--------------------------------------------------------------------------
    | Barang datang
    |--------------------------------------------------------------------------
    */

    /**
     * Mencatat kedatangan barang dan menambah stok.
     *
     * Inilah satu-satunya titik di modul ini yang menyentuh stok, dan ia
     * melakukannya lewat StockService — bukan dengan menulis current_stock.
     *
     * @param  array<int, array<string, mixed>>  $rows
     *         [{ purchase_order_item_id, quantity (satuan pesan), unit_price?,
     *            expiry_date?, batch_number?, note? }]
     */
    public function receive(
        PurchaseOrder $po,
        array $rows,
        string $receiptDate,
        ?string $deliveryNote = null,
        ?string $notes = null,
        ?int $userId = null,
        ?string $idempotencyKey = null,
    ): PurchaseReceipt {
        if (! $po->status->canReceive()) {
            throw ValidationException::withMessages([
                'status' => "Pesanan berstatus {$po->status->label()} tidak dapat menerima barang. "
                    .'Hanya pesanan Dipesan atau Diterima Sebagian yang bisa.',
            ]);
        }

        $rows = array_values(array_filter($rows, fn ($r) => (float) ($r['quantity'] ?? 0) > 0));

        if ($rows === []) {
            throw ValidationException::withMessages([
                'items' => 'Tidak ada barang yang dicatat diterima. Isi minimal satu jumlah.',
            ]);
        }

        return DB::transaction(function () use ($po, $rows, $receiptDate, $deliveryNote, $notes, $userId, $idempotencyKey) {
            $receipt = PurchaseReceipt::create([
                'receipt_number' => PurchaseReceipt::generateNumber(),
                'purchase_order_id' => $po->id,
                'receipt_date' => $receiptDate,
                'delivery_note_number' => $deliveryNote,
                'notes' => $notes,
                'received_by' => $userId,
            ]);

            foreach ($rows as $row) {
                $item = $po->items()
                    ->with('ingredient')
                    ->lockForUpdate()
                    ->findOrFail($row['purchase_order_item_id']);

                $faktor = (float) $item->unit_factor;

                // Jumlah diisi dalam satuan pesan (kg); disimpan dan
                // dipindahkan ke stok dalam satuan dasar (gram).
                $qtyDasar = (float) $row['quantity'] * $faktor;

                $this->pastikanTidakKelebihan($item, $qtyDasar);

                // Harga penerimaan boleh berbeda dari harga pesanan. Yang
                // dipakai menghitung harga rata-rata adalah harga nyata ini.
                $hargaSatuanDasar = isset($row['unit_price']) && $row['unit_price'] !== null
                    ? (float) $row['unit_price'] / max($faktor, 0.0001)
                    : (float) $item->unit_price;

                $receipt->items()->create([
                    'purchase_order_item_id' => $item->id,
                    'ingredient_id' => $item->ingredient_id,
                    'quantity' => $qtyDasar,
                    'unit_price' => $hargaSatuanDasar,
                    'expiry_date' => $row['expiry_date'] ?? null,
                    'batch_number' => $row['batch_number'] ?? null,
                    'note' => $row['note'] ?? null,
                ]);

                $item->increment('qty_received', $qtyDasar);

                // Stok bertambah, harga rata-rata diperbarui, ledger tercatat —
                // semuanya oleh StockService dalam transaksi yang sama.
                $this->stock->applyMovement(
                    item: $item->ingredient,
                    quantity: $qtyDasar,
                    direction: 'in',
                    sourceType: StockMovementType::PURCHASE,
                    sourceId: $po->po_number,
                    unitCost: $hargaSatuanDasar,
                    note: "Penerimaan {$receipt->receipt_number} dari {$po->supplier->name}",
                    userId: $userId,
                    // Kunci mengandung id baris penerimaan, sehingga permintaan
                    // yang terkirim dua kali tidak menambah stok dua kali.
                    idempotencyKey: ($idempotencyKey ?? "receipt:{$receipt->id}").":item:{$item->id}",
                );

                $this->perbaruiHargaSupplier($item->ingredient, $po->supplier_id, $hargaSatuanDasar, $receiptDate);
            }

            $this->segarkanStatus($po);

            return $receipt->fresh(['items.ingredient', 'receiver']);
        });
    }

    /**
     * Menerima seluruh sisa pesanan sekaligus, sesuai jumlah dan harga pesanan.
     *
     * Jalan pintas untuk kasus paling umum: barang datang lengkap seperti yang
     * dipesan. Dipakai endpoint ubah-status, sehingga petugas cukup menandai
     * "barang diterima" tanpa membuka form penerimaan rinci.
     *
     * Mengembalikan null bila tidak ada lagi yang tersisa — ini yang membuat
     * pengubahan status berulang aman: panggilan kedua tidak menambah stok
     * karena memang tidak ada sisa untuk diterima.
     */
    public function receiveAllInFull(
        PurchaseOrder $po,
        ?string $receiptDate = null,
        ?int $userId = null,
        ?string $idempotencyKey = null,
        ?string $notes = null,
    ): ?PurchaseReceipt {
        $po->loadMissing('items');

        $rows = $po->items
            ->filter(fn (PurchaseOrderItem $item) => $item->qtyOutstanding() > 0.0001)
            ->map(fn (PurchaseOrderItem $item) => [
                'purchase_order_item_id' => $item->id,
                'quantity' => $item->qtyOutstandingDisplay(),
            ])
            ->values()
            ->all();

        if ($rows === []) {
            return null;
        }

        return $this->receive(
            po: $po,
            rows: $rows,
            receiptDate: $receiptDate ?? now()->toDateString(),
            deliveryNote: null,
            notes: $notes ?? 'Barang diterima lengkap sesuai pesanan.',
            userId: $userId,
            idempotencyKey: $idempotencyKey,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Pembatalan dan penutupan
    |--------------------------------------------------------------------------
    */

    public function cancel(PurchaseOrder $po, string $reason, ?int $userId = null): PurchaseOrder
    {
        $po->loadMissing('items');

        if (! $po->status->canCancel()) {
            throw ValidationException::withMessages([
                'status' => "Pesanan berstatus {$po->status->label()} tidak dapat dibatalkan.",
            ]);
        }

        // Pertahanan berlapis: status ORDERED masih boleh dibatalkan, tetapi
        // bila ternyata sudah ada barang masuk, pembatalan akan menyisakan
        // stok tanpa dokumen pendukung.
        if ($po->hasAnyReceipt()) {
            throw ValidationException::withMessages([
                'status' => 'Pesanan ini sudah menerima sebagian barang, jadi tidak dapat dibatalkan. '
                    .'Gunakan "Tutup Pesanan" untuk menghentikan sisa yang tidak jadi dikirim.',
            ]);
        }

        $po->update([
            'status' => PurchaseOrderStatus::CANCELLED->value,
            'cancelled_by' => $userId,
            'cancelled_at' => now(),
            'cancel_reason' => $reason,
        ]);

        return $po->fresh();
    }

    /**
     * Menutup pesanan yang tidak akan dikirim lengkap.
     *
     * Sisa yang belum datang dianggap batal, tetapi barang yang sudah diterima
     * tetap tercatat. Ini kejadian sehari-hari: supplier kehabisan stok dan
     * hanya mengirim sebagian.
     */
    public function close(PurchaseOrder $po, ?string $reason = null): PurchaseOrder
    {
        $po->loadMissing('items');

        if ($po->status !== PurchaseOrderStatus::PARTIAL) {
            throw ValidationException::withMessages([
                'status' => 'Hanya pesanan berstatus Diterima Sebagian yang dapat ditutup.',
            ]);
        }

        $po->update([
            'status' => PurchaseOrderStatus::COMPLETED->value,
            'completed_date' => now()->toDateString(),
            'notes' => trim(($po->notes ?? '')."\n[Ditutup] ".($reason ?? 'Sisa pesanan tidak jadi dikirim.')),
        ]);

        return $po->fresh();
    }

    public function delete(PurchaseOrder $po): void
    {
        $this->pastikanBisaDiubah($po, 'dihapus');

        DB::transaction(function () use ($po) {
            $po->items()->delete();
            $po->delete();
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Performa supplier — §3.5 DOKUMEN-PERANCANGAN.md
    |--------------------------------------------------------------------------
    */

    /**
     * @return array<string, mixed>
     */
    public function supplierPerformance(Supplier $supplier, int $months = 6): array
    {
        $sejak = now()->subMonths($months)->startOfDay();

        $selesai = PurchaseOrder::with('items')
            ->where('supplier_id', $supplier->id)
            ->where('status', PurchaseOrderStatus::COMPLETED->value)
            ->where('order_date', '>=', $sejak)
            ->get();

        if ($selesai->isEmpty()) {
            return [
                'orders_count' => 0,
                'on_time_percent' => null,
                'completeness_percent' => null,
                'score' => null,
                'total_spend' => 0,
                'avg_days_late' => null,
                'note' => 'Belum ada pesanan selesai dalam '.$months.' bulan terakhir.',
            ];
        }

        $tepatWaktu = 0;
        $totalTelat = 0;
        $adaJanji = 0;
        $totalDipesan = 0.0;
        $totalDiterima = 0.0;

        foreach ($selesai as $po) {
            if ($po->expected_date && $po->completed_date) {
                $adaJanji++;
                $telat = max(0, $po->expected_date->diffInDays($po->completed_date, false));
                $totalTelat += $telat;

                if ($telat === 0) {
                    $tepatWaktu++;
                }
            }

            $totalDipesan += (float) $po->items->sum('qty_ordered');
            $totalDiterima += (float) $po->items->sum('qty_received');
        }

        $ketepatan = $adaJanji > 0 ? round(($tepatWaktu / $adaJanji) * 100, 2) : null;
        $kelengkapan = $totalDipesan > 0 ? round(min(100, ($totalDiterima / $totalDipesan) * 100), 2) : null;

        // Bobot mengikuti §3.5 dokumen perancangan. Kestabilan harga belum
        // disertakan karena butuh riwayat lebih panjang untuk bermakna.
        $skor = $ketepatan !== null && $kelengkapan !== null
            ? round(0.55 * $ketepatan + 0.45 * $kelengkapan, 2)
            : null;

        return [
            'orders_count' => $selesai->count(),
            'on_time_percent' => $ketepatan,
            'completeness_percent' => $kelengkapan,
            'score' => $skor,
            'total_spend' => round((float) $selesai->sum('total'), 2),
            'avg_days_late' => $adaJanji > 0 ? round($totalTelat / $adaJanji, 1) : null,
            'note' => null,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Pembantu
    |--------------------------------------------------------------------------
    */

    private function pastikanBisaDiubah(PurchaseOrder $po, string $tindakan = 'diubah'): void
    {
        if (! $po->status->isEditable()) {
            throw ValidationException::withMessages([
                'status' => "Pesanan berstatus {$po->status->label()} tidak dapat {$tindakan}. "
                    .'Hanya draft yang masih bisa disunting — pesanan yang sudah dikonfirmasi '
                    .'adalah dokumen yang mungkin sudah dikirim ke supplier.',
            ]);
        }
    }

    private function pastikanTidakKelebihan(PurchaseOrderItem $item, float $qtyDasar): void
    {
        $sisa = $item->qtyOutstanding();
        $batas = $sisa * self::TOLERANSI_KELEBIHAN;

        if ($qtyDasar > $batas + 0.0001) {
            $f = max((float) $item->unit_factor, 0.0001);

            throw ValidationException::withMessages([
                'items' => sprintf(
                    'Jumlah terima %s untuk %s melebihi sisa pesanan (%s %s). '
                    .'Toleransi kelebihan kirim hanya 5%%. Bila supplier memang mengirim lebih banyak, '
                    .'buat pesanan baru untuk selisihnya agar tercatat.',
                    rtrim(rtrim(number_format($qtyDasar / $f, 2), '0'), '.').' '.$item->order_unit,
                    $item->ingredient?->name ?? 'bahan ini',
                    rtrim(rtrim(number_format($sisa / $f, 2), '0'), '.'),
                    $item->order_unit,
                ),
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function tulisItems(PurchaseOrder $po, array $items): void
    {
        foreach (array_values($items) as $urutan => $row) {
            /** @var Ingredient $bahan */
            $bahan = Ingredient::findOrFail($row['ingredient_id']);

            // Satuan dan faktornya dibekukan di baris pesanan. Bila master
            // bahan diubah nanti, dokumen ini tetap terbaca seperti semula.
            $faktor = (float) $bahan->conversion_factor;
            $qtyPesan = (float) $row['quantity'];
            $hargaPerSatuanPesan = (float) $row['unit_price'];
            $diskon = (float) ($row['discount_amount'] ?? 0);

            $po->items()->create([
                'ingredient_id' => $bahan->id,
                'order_unit' => $bahan->display_unit,
                'unit_factor' => $faktor,
                'qty_ordered' => $qtyPesan * $faktor,
                'qty_received' => 0,
                'unit_price' => $faktor > 0 ? $hargaPerSatuanPesan / $faktor : $hargaPerSatuanPesan,
                'discount_amount' => $diskon,
                'line_total' => round(($qtyPesan * $hargaPerSatuanPesan) - $diskon, 2),
                'note' => $row['note'] ?? null,
                'sort_order' => $urutan,
            ]);
        }
    }

    private function hitungUlangTotal(PurchaseOrder $po): void
    {
        $subtotal = (float) $po->items()->sum('line_total');

        $po->update([
            'subtotal' => $subtotal,
            'total' => round(
                $subtotal
                - (float) $po->discount_amount
                + (float) $po->shipping_cost
                + (float) $po->tax_amount,
                2
            ),
        ]);
    }

    /** Menentukan status pesanan berdasarkan kelengkapan penerimaan. */
    private function segarkanStatus(PurchaseOrder $po): void
    {
        $po->load('items');

        if ($po->isFullyReceived()) {
            $po->update([
                'status' => PurchaseOrderStatus::COMPLETED->value,
                'completed_date' => now()->toDateString(),
            ]);

            return;
        }

        $po->update(['status' => PurchaseOrderStatus::PARTIAL->value]);
    }

    /** Menyimpan harga terakhir per supplier, untuk perbandingan penawaran. */
    private function perbaruiHargaSupplier(
        Ingredient $bahan,
        int $supplierId,
        float $hargaSatuanDasar,
        string $tanggal,
    ): void {
        $bahan->suppliers()->syncWithoutDetaching([
            $supplierId => [
                'last_price' => $hargaSatuanDasar,
                'last_purchased_at' => $tanggal,
            ],
        ]);
    }
}
