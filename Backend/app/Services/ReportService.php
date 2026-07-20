<?php

namespace App\Services;

use App\Enums\ProductionStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReportType;
use App\Enums\SaleStatus;
use App\Enums\StockStatus;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\PurchaseOrder;
use App\Models\Sale;
use App\Models\StockLedger;
use App\Models\Supplier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Pusat pelaporan formal.
 *
 * MURNI MEMBACA. Tidak ada tabel baru — seluruh laporannya disusun dari tabel
 * yang sudah diisi modul Pembelian, Produksi, Persediaan, dan Penjualan.
 *
 * Setiap laporan mengembalikan bentuk yang sama:
 *
 *   [
 *     'rows'    => baris data, kuncinya cocok dengan ReportType::columns()
 *     'summary' => angka ringkasan untuk kepala laporan
 *     'total'   => baris total, hanya untuk kolom bertanda 'total' => true
 *   ]
 *
 * Keseragaman itu yang membuat satu eksportir Excel dan satu templat PDF bisa
 * melayani ketujuh laporan tanpa bercabang.
 */
class ReportService
{
    /** Baris per halaman pada pratinjau. */
    private const PER_HALAMAN = 10;

    /**
     * Menyusun sebuah laporan.
     *
     * @param  array<string, mixed>  $filters
     * @param  int|null  $page  nomor halaman pratinjau; null berarti SELURUH baris
     *                          (dipakai ekspor PDF dan Excel)
     * @return array<string, mixed>
     */
    public function build(ReportType $type, array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        $hasil = match ($type) {
            ReportType::PENJUALAN => $this->penjualan($filters),
            ReportType::PRODUKSI => $this->produksi($filters),
            ReportType::PEMBELIAN => $this->pembelian($filters),
            ReportType::PERSEDIAAN => $this->persediaan($filters),
            ReportType::MUTASI_STOK => $this->mutasiStok($filters),
            ReportType::SUPPLIER => $this->supplier($filters),
            ReportType::PRODUK => $this->produk($filters),
        };

        /*
        | URUTAN DI SINI PENTING.
        |
        | Ringkasan dan baris TOTAL dihitung dari SELURUH baris — dihitung
        | SEBELUM pemotongan halaman. Menghitungnya setelah dipotong akan
        | menghasilkan laporan yang totalnya berubah setiap kali pengguna
        | menekan "Berikutnya": halaman 1 melaporkan omzet sepuluh transaksi
        | pertama sebagai omzet seluruh periode.
        |
        | Kesalahan yang sangat mudah dibuat dan sangat sulit disadari, karena
        | angkanya tetap terlihat masuk akal.
        */
        $seluruhBaris = $hasil['rows'];
        $total = $this->hitungTotal($type, $seluruhBaris);
        $meta = $this->potongHalaman($seluruhBaris, $page, $perPage);

        return [
            'type' => $type->value,
            'title' => $type->label(),
            'description' => $type->description(),
            'columns' => $type->columns(),
            'rows' => $meta['rows'],
            'summary' => $hasil['summary'],

            /*
            | Dicor menjadi objek supaya bentuknya SELALU sama di JSON.
            |
            | Array PHP kosong berubah menjadi `[]` saat dijadikan JSON,
            | sedangkan array berisi menjadi `{}`. Laporan Mutasi Stok memang
            | tidak punya kolom yang bisa dijumlahkan — jumlah gram dan jumlah
            | buah tidak boleh ditambahkan — sehingga hanya laporan itu yang
            | mengirim bentuk berbeda, dan frontend akan tersandung tepat di
            | satu laporan saja. Jenis kesalahan yang paling lama dicari.
            */
            'total' => (object) $total,

            // Jumlah SELURUH baris laporan, bukan baris yang sedang tampil.
            // Inilah angka yang dipakai kalimat "… dari 340 data".
            'row_count' => count($seluruhBaris),
            'meta' => $meta['meta'],
            'periode' => $this->labelPeriode($type, $filters),
            'filters' => $filters,
            'catatan' => $hasil['catatan'] ?? null,
            'dibuat_pada' => now()->toIso8601String(),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 1. Penjualan
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function penjualan(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        $baris = Sale::with(['cashier:id,name'])
            ->withCount('items')
            ->whereDate('created_at', '>=', $dari)
            ->whereDate('created_at', '<=', $sampai)
            ->when($filters['payment_method'] ?? null, fn ($q, $v) => $q->where('payment_method', $v))
            ->when($filters['cashier_id'] ?? null, fn ($q, $v) => $q->where('cashier_id', $v))
            ->when(
                $filters['status'] ?? null,
                fn ($q, $v) => $q->where('status', $v),
                // Tanpa filter status, transaksi batal TETAP ditampilkan tetapi
                // nilainya nol pada kolom uang — laporan formal harus
                // memperlihatkan bahwa pembatalan itu ada, bukan
                // menghilangkannya diam-diam.
                fn ($q) => $q,
            )
            ->orderBy('created_at')
            ->get();

        $rows = $baris->map(function (Sale $s) {
            $batal = $s->status === SaleStatus::VOIDED;

            return [
                'tanggal' => $s->created_at?->toIso8601String(),
                'nomor' => $s->sale_number,
                'kasir' => $s->cashier?->name ?? '—',
                'pelanggan' => $s->customer_name ?? '—',
                'item' => (int) $s->items_count,
                'metode' => $s->payment_method->label(),

                // Transaksi batal dinolkan di kolom uang supaya baris total
                // laporan langsung sama dengan omzet sesungguhnya.
                'subtotal' => $batal ? 0 : (float) $s->subtotal,
                'diskon' => $batal ? 0 : (float) $s->discount_amount,
                'pajak' => $batal ? 0 : (float) $s->tax_amount,
                'total' => $batal ? 0 : (float) $s->total,
                'hpp' => $batal ? 0 : (float) $s->cost_total,
                'laba' => $batal ? 0 : $s->grossProfit(),

                'status' => $s->status->label(),
            ];
        })->all();

        $sah = $baris->where('status', SaleStatus::COMPLETED);

        return [
            'rows' => $rows,
            'summary' => [
                'Transaksi' => $sah->count(),
                'Dibatalkan' => $baris->count() - $sah->count(),
                'Omzet' => round((float) $sah->sum('total'), 2),
                'Diskon' => round((float) $sah->sum('discount_amount'), 2),
                'Pajak' => round((float) $sah->sum('tax_amount'), 2),
                'HPP' => round((float) $sah->sum('cost_total'), 2),
                'Laba Kotor' => round($sah->sum(fn (Sale $s) => $s->grossProfit()), 2),
            ],
            'catatan' => 'Transaksi yang dibatalkan tetap ditampilkan sebagai baris, '
                .'tetapi nilainya nol agar tidak ikut terhitung sebagai omzet.',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Produksi
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function produksi(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        $baris = ProductionBatch::with(['product:id,name,unit', 'operator:id,name'])
            ->whereDate('started_at', '>=', $dari)
            ->whereDate('started_at', '<=', $sampai)
            ->when($filters['product_id'] ?? null, fn ($q, $v) => $q->where('product_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->orderBy('started_at')
            ->get();

        $rows = $baris->map(function (ProductionBatch $b) {
            $menit = $b->durationMinutes();

            return [
                'tanggal' => $b->started_at?->toIso8601String(),
                'nomor' => $b->batch_number,
                'produk' => $b->product?->name ?? '—',
                'operator' => $b->operator?->name ?? '—',
                'target' => (float) $b->target_quantity,
                'hasil' => $b->good_quantity !== null ? (float) $b->good_quantity : 0,
                'gagal' => (float) $b->reject_quantity,
                'rasio' => $b->yieldRate(),
                'biaya_bahan' => (float) $b->material_cost,
                'hpp_unit' => $b->cost_per_unit !== null ? (float) $b->cost_per_unit : 0,
                'durasi' => $menit === null
                    ? '—'
                    : ($menit < 60 ? $menit.' mnt' : intdiv($menit, 60).'j '.($menit % 60).'m'),
                'status' => $b->status->label(),
            ];
        })->all();

        $selesai = $baris->where('status', ProductionStatus::COMPLETED);

        return [
            'rows' => $rows,
            'summary' => [
                'Total Batch' => $baris->count(),
                'Selesai' => $selesai->count(),
                'Dibatalkan' => $baris->where('status', ProductionStatus::CANCELLED)->count(),
                'Unit Layak Jual' => round((float) $selesai->sum('good_quantity'), 2),
                'Unit Gagal' => round((float) $selesai->sum('reject_quantity'), 2),
                'Biaya Bahan' => round((float) $baris->whereNotIn('status', [ProductionStatus::CANCELLED])->sum('material_cost'), 2),
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Pembelian
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function pembelian(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        $baris = PurchaseOrder::with(['supplier:id,name', 'items'])
            ->whereDate('order_date', '>=', $dari)
            ->whereDate('order_date', '<=', $sampai)
            ->when($filters['supplier_id'] ?? null, fn ($q, $v) => $q->where('supplier_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->orderBy('order_date')
            ->get();

        $rows = $baris->map(fn (PurchaseOrder $p) => [
            'tanggal' => $p->order_date?->format('Y-m-d'),
            'nomor' => $p->po_number,
            'supplier' => $p->supplier?->name ?? '—',
            'item' => $p->items->count(),
            'subtotal' => (float) $p->subtotal,
            'diskon' => (float) $p->discount_amount,
            'ongkir' => (float) $p->shipping_cost,
            'pajak' => (float) $p->tax_amount,
            'total' => (float) $p->total,
            'diterima_persen' => round($p->receivedPercent(), 2),
            'status' => $p->status->label(),
        ])->all();

        $aktif = $baris->whereNotIn('status', [PurchaseOrderStatus::CANCELLED]);

        return [
            'rows' => $rows,
            'summary' => [
                'Jumlah PO' => $baris->count(),
                'Selesai' => $baris->where('status', PurchaseOrderStatus::COMPLETED)->count(),
                'Dibatalkan' => $baris->where('status', PurchaseOrderStatus::CANCELLED)->count(),
                'Nilai Pesanan' => round((float) $aktif->sum('total'), 2),
                'Rata-rata PO' => $aktif->count() > 0
                    ? round((float) $aktif->sum('total') / $aktif->count(), 2)
                    : 0,
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Persediaan — snapshot pada satu tanggal
    |--------------------------------------------------------------------------
    */

    /**
     * Keadaan stok PADA SATU TANGGAL, disusun ulang dari riwayat mutasi.
     *
     * Ini satu-satunya laporan yang TIDAK boleh membaca kolom `current_stock`.
     * Kolom itu berisi keadaan hari ini; menanyakan "berapa stok tanggal 1
     * bulan lalu" berarti harus menjumlahkan ulang seluruh pergerakan sampai
     * tanggal itu saja.
     *
     * Harga pokoknya pun disusun ulang: rata-rata tertimbang dihitung ulang
     * dari pergerakan masuk sampai tanggal tersebut, bukan memakai `avg_cost`
     * hari ini. Tanpa itu, nilai persediaan bulan lalu akan berubah setiap kali
     * ada pembelian baru minggu ini — laporan yang angkanya berubah sendiri
     * setelah dicetak tidak bisa dipakai untuk apa pun.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function persediaan(array $filters): array
    {
        $tanggal = Carbon::parse($filters['as_of'] ?? today())->endOfDay();

        // Seluruh mutasi sampai tanggal tersebut, dikelompokkan per barang.
        // Diambil sekali untuk semua barang, bukan satu query per barang.
        $mutasi = StockLedger::query()
            ->where('created_at', '<=', $tanggal)
            ->orderBy('id')
            ->get(['item_type', 'item_id', 'direction', 'quantity', 'delta', 'unit_cost'])
            ->groupBy(fn (StockLedger $l) => $l->item_type.':'.$l->item_id);

        $rows = [];

        foreach ([Ingredient::class, Product::class] as $kelas) {
            $bahan = $kelas === Ingredient::class;

            $items = $kelas::with('category:id,name')
                ->when(
                    $filters['kind'] ?? null,
                    fn ($q, $v) => $v === ($bahan ? 'ingredient' : 'product') ? $q : $q->whereRaw('1 = 0')
                )
                ->when($filters['category_id'] ?? null, fn ($q, $v) => $q->where('category_id', $v))
                ->orderBy('name')
                ->get();

            foreach ($items as $item) {
                $riwayat = $mutasi[$kelas.':'.$item->getKey()] ?? collect();

                $hitung = $this->hitungSaldoDanHarga($riwayat);
                $faktor = $bahan ? max((float) $item->conversion_factor, 0.0001) : 1.0;

                // Barang yang belum ada sama sekali pada tanggal itu (dibuat
                // setelahnya) dilewati — memunculkannya dengan stok nol akan
                // menyiratkan barangnya sudah ada dan kebetulan habis.
                if ($riwayat->isEmpty()) {
                    continue;
                }

                $stokDasar = $hitung['saldo'];
                $min = (float) $item->min_stock;
                $status = StockStatus::classify($stokDasar, $min);

                $rows[] = [
                    'kode' => $item->code,
                    'nama' => $item->name,
                    'jenis' => $bahan ? 'Bahan Baku' : 'Produk Jadi',
                    'kategori' => $item->category?->name ?? '—',
                    'satuan' => $bahan ? $item->display_unit : ($item->unit ?? 'pcs'),
                    'stok' => round($stokDasar / $faktor, 4),
                    'minimum' => round($min / $faktor, 4),
                    'status' => $status->label(),
                    'hpp' => round($hitung['harga'] * $faktor, 2),
                    'nilai' => round($stokDasar * $hitung['harga'], 2),
                ];
            }
        }

        $nilai = array_sum(array_column($rows, 'nilai'));

        $perStatus = [];
        foreach ($rows as $r) {
            $perStatus[$r['status']] = ($perStatus[$r['status']] ?? 0) + 1;
        }

        return [
            'rows' => $rows,
            'summary' => array_merge([
                'Per Tanggal' => $tanggal->format('d/m/Y'),
                'Jumlah Barang' => count($rows),
                'Nilai Persediaan' => round($nilai, 2),
            ], $perStatus),
            'catatan' => 'Stok dan harga pokok disusun ulang dari riwayat mutasi sampai '
                .$tanggal->format('d/m/Y').', bukan diambil dari stok hari ini. '
                .'Angkanya tidak akan berubah walaupun laporan ini dibuka ulang bulan depan.',
        ];
    }

    /**
     * Saldo dan harga rata-rata tertimbang dari serangkaian mutasi.
     *
     * Rumus WAC-nya sama persis dengan StockService::hitungHargaRataRata() —
     * memang harus sama, karena inilah yang membuktikan angka historisnya
     * konsisten dengan angka berjalan.
     *
     * @param  \Illuminate\Support\Collection<int, StockLedger>  $riwayat
     * @return array{saldo: float, harga: float}
     */
    private function hitungSaldoDanHarga($riwayat): array
    {
        $saldo = 0.0;
        $harga = 0.0;

        foreach ($riwayat as $l) {
            $jumlah = (float) $l->quantity;

            if ($l->direction === 'in') {
                $biaya = $l->unit_cost !== null ? (float) $l->unit_cost : null;

                if ($biaya !== null && $biaya >= 0) {
                    $totalBaru = $saldo + $jumlah;

                    $harga = $totalBaru > 0 && $saldo >= 0
                        ? (($saldo * $harga) + ($jumlah * $biaya)) / $totalBaru
                        : $biaya;
                }

                $saldo += $jumlah;
            } else {
                // Barang keluar tidak mengubah harga rata-rata — hanya
                // mengurangi jumlahnya.
                $saldo -= $jumlah;
            }
        }

        return ['saldo' => round($saldo, 4), 'harga' => round($harga, 4)];
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Mutasi Stok
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function mutasiStok(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        $baris = StockLedger::with(['item:id,name,code', 'user:id,name'])
            ->whereDate('created_at', '>=', $dari)
            ->whereDate('created_at', '<=', $sampai)
            ->when($filters['direction'] ?? null, fn ($q, $v) => $q->where('direction', $v))
            ->when($filters['source_type'] ?? null, fn ($q, $v) => $q->where('source_type', $v))
            ->when(
                $filters['kind'] ?? null,
                fn ($q, $v) => $q->where('item_type', $v === 'ingredient' ? Ingredient::class : Product::class)
            )
            ->orderBy('id')
            ->get();

        $rows = $baris->map(fn (StockLedger $l) => [
            'tanggal' => $l->created_at?->toIso8601String(),
            'kode' => $l->item?->code ?? '—',
            'barang' => $l->item?->name ?? '(barang dihapus)',
            'jenis' => $l->item_type === Ingredient::class ? 'Bahan Baku' : 'Produk Jadi',
            'arah' => $l->direction === 'in' ? 'Masuk' : 'Keluar',
            'jumlah' => (float) $l->quantity,
            'saldo_sebelum' => (float) $l->balance_before,
            'saldo_sesudah' => (float) $l->balance_after,
            'sumber' => $l->source_type->label(),
            'referensi' => $l->source_id ?? '—',
            'petugas' => $l->user?->name ?? 'Sistem',
            'catatan' => $l->note ?? '—',
        ])->all();

        return [
            'rows' => $rows,
            'summary' => [
                'Jumlah Mutasi' => $baris->count(),
                'Mutasi Masuk' => $baris->where('direction', 'in')->count(),
                'Mutasi Keluar' => $baris->where('direction', 'out')->count(),
                'Barang Terlibat' => $baris->unique(fn (StockLedger $l) => $l->item_type.':'.$l->item_id)->count(),
            ],
            'catatan' => 'Jumlah ditampilkan dalam satuan dasar (gram, mililiter, atau buah) '
                .'karena satu laporan memuat bahan baku dan produk jadi sekaligus.',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Supplier
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function supplier(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        $suppliers = Supplier::query()
            ->when($filters['supplier_id'] ?? null, fn ($q, $v) => $q->where('id', $v))
            ->orderBy('name')
            ->get();

        $rows = [];

        foreach ($suppliers as $s) {
            $po = PurchaseOrder::with('items')
                ->where('supplier_id', $s->id)
                ->whereDate('order_date', '>=', $dari)
                ->whereDate('order_date', '<=', $sampai)
                ->get();

            // Supplier tanpa transaksi pada periode ini dilewati — daftar yang
            // penuh baris nol menyembunyikan supplier yang benar-benar dipakai.
            if ($po->isEmpty()) {
                continue;
            }

            $aktif = $po->whereNotIn('status', [PurchaseOrderStatus::CANCELLED]);

            $nilaiDiterima = $aktif->sum(
                fn (PurchaseOrder $p) => (float) $p->total * ($p->receivedPercent() / 100)
            );

            $rows[] = [
                'kode' => $s->code,
                'nama' => $s->name,
                'kontak' => $s->contact_person ?: ($s->phone ?: '—'),
                'jumlah_po' => $po->count(),
                'po_selesai' => $po->where('status', PurchaseOrderStatus::COMPLETED)->count(),
                'po_batal' => $po->where('status', PurchaseOrderStatus::CANCELLED)->count(),
                'total_nilai' => round((float) $aktif->sum('total'), 2),
                'rata2_po' => $aktif->count() > 0
                    ? round((float) $aktif->sum('total') / $aktif->count(), 2)
                    : 0,
                'nilai_diterima' => round($nilaiDiterima, 2),
                'terakhir' => $po->max('order_date')?->format('Y-m-d'),
            ];
        }

        // Terurut dari nilai terbesar — pertanyaan pertama Owner adalah
        // "ke siapa uang saya paling banyak pergi?"
        usort($rows, fn ($a, $b) => $b['total_nilai'] <=> $a['total_nilai']);

        return [
            'rows' => $rows,
            'summary' => [
                'Supplier Aktif' => count($rows),
                'Total PO' => array_sum(array_column($rows, 'jumlah_po')),
                'Nilai Pembelian' => round(array_sum(array_column($rows, 'total_nilai')), 2),
                'Nilai Diterima' => round(array_sum(array_column($rows, 'nilai_diterima')), 2),
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | 7. Produk
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function produk(array $filters): array
    {
        [$dari, $sampai] = $this->rentang($filters);

        // Penjualan per produk — sekali query, bukan satu per produk.
        $terjual = DB::table('sale_items as i')
            ->join('sales as s', 's.id', '=', 'i.sale_id')
            ->select(
                'i.product_id',
                DB::raw('SUM(i.quantity) as qty'),
                DB::raw('SUM(i.line_total) as nilai'),
                DB::raw('SUM(i.line_cost) as hpp'),
            )
            ->where('s.status', SaleStatus::COMPLETED->value)
            ->whereNull('s.deleted_at')
            ->whereDate('s.created_at', '>=', $dari)
            ->whereDate('s.created_at', '<=', $sampai)
            ->groupBy('i.product_id')
            ->get()
            ->keyBy('product_id');

        $diproduksi = ProductionBatch::query()
            ->select('product_id', DB::raw('SUM(good_quantity) as unit'))
            ->where('status', ProductionStatus::COMPLETED->value)
            ->whereDate('finished_at', '>=', $dari)
            ->whereDate('finished_at', '<=', $sampai)
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $rows = Product::with('category:id,name')
            ->when($filters['category_id'] ?? null, fn ($q, $v) => $q->where('category_id', $v))
            ->orderBy('name')
            ->get()
            ->map(function (Product $p) use ($terjual, $diproduksi) {
                $jual = $terjual[$p->id] ?? null;

                $nilai = round((float) ($jual->nilai ?? 0), 2);
                $hpp = round((float) ($jual->hpp ?? 0), 2);
                $laba = round($nilai - $hpp, 2);

                return [
                    'kode' => $p->code,
                    'nama' => $p->name,
                    'kategori' => $p->category?->name ?? '—',
                    'terjual' => round((float) ($jual->qty ?? 0), 2),
                    'nilai_jual' => $nilai,
                    'hpp' => $hpp,
                    'laba' => $laba,
                    'margin' => $nilai > 0 ? round(($laba / $nilai) * 100, 2) : null,
                    'diproduksi' => round((float) ($diproduksi[$p->id]->unit ?? 0), 2),
                    'stok' => (float) $p->current_stock,
                ];
            })
            ->sortByDesc('nilai_jual')
            ->values()
            ->all();

        return [
            'rows' => $rows,
            'summary' => [
                'Jumlah Produk' => count($rows),
                'Unit Terjual' => round(array_sum(array_column($rows, 'terjual')), 2),
                'Nilai Penjualan' => round(array_sum(array_column($rows, 'nilai_jual')), 2),
                'Laba Kotor' => round(array_sum(array_column($rows, 'laba')), 2),
                'Unit Diproduksi' => round(array_sum(array_column($rows, 'diproduksi')), 2),
            ],
            /*
            | Peringatan yang wajib ada.
            |
            | Laba di sini dihitung per baris penjualan (nilai jual dikurangi
            | HPP), SEBELUM diskon tingkat transaksi. Diskon diberikan atas
            | keseluruhan belanja dan tidak bisa dibagi ke produk tertentu
            | tanpa mengarang — jadi angkanya sengaja tidak dibagi.
            |
            | Akibatnya Laba Kotor di laporan ini lebih besar daripada di
            | Laporan Penjualan, persis sebesar total diskon yang diberikan.
            | Dua laporan yang menampilkan "Laba Kotor" berbeda tanpa penjelasan
            | adalah cara tercepat membuat seluruh modul laporan tidak
            | dipercaya — jadi selisihnya disebutkan terus terang di sini.
            */
            'catatan' => 'Laba kotor dihitung per baris produk, SEBELUM diskon tingkat transaksi — '
                .'diskon diberikan atas keseluruhan belanja dan tidak dapat dibebankan ke produk '
                .'tertentu. Karena itu totalnya lebih besar daripada Laporan Penjualan sebesar '
                .'diskon yang diberikan. · Kolom "Stok Kini" menunjukkan stok HARI INI, bukan stok '
                .'pada akhir periode laporan; untuk itu gunakan Laporan Persediaan.',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Pembantu
    |--------------------------------------------------------------------------
    */

    /**
     * Rentang tanggal yang berlaku.
     *
     * Bila tidak diisi, bawaan awal bulan ini sampai hari ini. Laporan tanpa
     * batas waktu pada sistem yang sudah berjalan setahun akan menarik seluruh
     * riwayat dan membuat halaman menggantung.
     *
     * @param  array<string, mixed>  $filters
     * @return array{0: string, 1: string}
     */
    private function rentang(array $filters): array
    {
        // Filter bulan/tahun diterjemahkan menjadi rentang tanggal, sehingga
        // seluruh laporan hanya perlu mengenal satu bentuk saja.
        if (! empty($filters['year'])) {
            $tahun = (int) $filters['year'];

            if (! empty($filters['month'])) {
                $awal = Carbon::create($tahun, (int) $filters['month'], 1)->startOfMonth();

                return [$awal->format('Y-m-d'), $awal->copy()->endOfMonth()->format('Y-m-d')];
            }

            return [
                Carbon::create($tahun, 1, 1)->format('Y-m-d'),
                Carbon::create($tahun, 12, 31)->format('Y-m-d'),
            ];
        }

        return [
            $filters['date_from'] ?? today()->startOfMonth()->format('Y-m-d'),
            $filters['date_to'] ?? today()->format('Y-m-d'),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function labelPeriode(ReportType $type, array $filters): string
    {
        if ($type === ReportType::PERSEDIAAN) {
            return 'Per '.Carbon::parse($filters['as_of'] ?? today())->translatedFormat('d F Y');
        }

        [$dari, $sampai] = $this->rentang($filters);

        return Carbon::parse($dari)->translatedFormat('d F Y')
            .' – '.Carbon::parse($sampai)->translatedFormat('d F Y');
    }

    /**
     * Memotong baris menjadi satu halaman.
     *
     * Bila $page null, seluruh baris dikembalikan tanpa meta — itulah yang
     * dipakai ekspor PDF dan Excel. Berkas yang diunduh harus memuat seluruh
     * laporan; memotongnya menjadi sepuluh baris pertama akan menghasilkan
     * berkas yang terlihat lengkap dan diam-diam kehilangan isinya.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{rows: array<int, array<string, mixed>>, meta: array<string, int>|null}
     */
    private function potongHalaman(array $rows, ?int $page, ?int $perPage): array
    {
        if ($page === null) {
            return ['rows' => $rows, 'meta' => null];
        }

        $total = count($rows);
        $perHalaman = max(1, $perPage ?? self::PER_HALAMAN);
        $halamanTerakhir = max(1, (int) ceil($total / $perHalaman));

        // Halaman yang melampaui batas dijepit ke halaman terakhir. Pengguna
        // yang berada di halaman 30 lalu mempersempit filternya tidak boleh
        // mendapat tabel kosong tanpa penjelasan.
        $halaman = min(max(1, $page), $halamanTerakhir);
        $awal = ($halaman - 1) * $perHalaman;
        $potongan = array_slice($rows, $awal, $perHalaman);

        return [
            'rows' => $potongan,
            'meta' => [
                'current_page' => $halaman,
                'per_page' => $perHalaman,
                'total' => $total,
                'last_page' => $halamanTerakhir,
                'from' => $total > 0 ? $awal + 1 : 0,
                'to' => $awal + count($potongan),
            ],
        ];
    }

    /**
     * Baris total, hanya untuk kolom yang memang bisa dijumlahkan.
     *
     * Menjumlahkan kolom persentase atau tanggal menghasilkan angka yang
     * terlihat resmi dan tidak berarti apa-apa — karena itu kolom penjumlah
     * ditandai eksplisit di ReportType::columns().
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<string, float>
     */
    private function hitungTotal(ReportType $type, array $rows): array
    {
        $total = [];

        foreach ($type->columns() as $kolom) {
            if (empty($kolom['total'])) {
                continue;
            }

            $total[$kolom['key']] = round(
                array_sum(array_map(fn ($r) => (float) ($r[$kolom['key']] ?? 0), $rows)),
                2
            );
        }

        return $total;
    }
}
