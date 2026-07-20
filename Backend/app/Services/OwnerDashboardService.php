<?php

namespace App\Services;

use App\Enums\ProductionStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\SaleStatus;
use App\Models\ProductionBatch;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReceipt;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Agregasi lintas modul untuk Dashboard Owner.
 *
 * MURNI MEMBACA. Tidak ada tabel baru — seluruh angkanya dijumlahkan dari
 * tabel yang sudah diisi modul Pembelian, Produksi, Persediaan, dan Penjualan.
 *
 * Service ini juga tidak menghitung ulang apa yang sudah dihitung modul lain:
 * ringkasan penjualan memakai SaleService, ringkasan stok memakai
 * InventoryService. Menyalin rumusnya ke sini berarti dua tempat yang harus
 * diperbaiki setiap kali aturannya berubah — dan satu di antaranya pasti
 * terlupa.
 */
class OwnerDashboardService
{
    public function __construct(
        private readonly SaleService $sales,
        private readonly InventoryService $inventory,
    ) {
    }

    /**
     * Seluruh isi dashboard dalam satu panggilan.
     *
     * Sengaja satu endpoint, bukan sepuluh. Dashboard yang menembakkan sepuluh
     * permintaan sekaligus akan menampilkan kartunya satu per satu dengan
     * urutan acak, dan tombol muat ulang tidak pernah selesai bersamaan.
     *
     * @return array<string, mixed>
     */
    public function build(int $days = 30): array
    {
        $hariIni = today();
        $awalBulan = $hariIni->copy()->startOfMonth();
        $sejak = $hariIni->copy()->subDays($days - 1);

        return [
            'penjualan' => $this->penjualan($hariIni, $awalBulan),
            'produksi' => $this->produksi($hariIni, $awalBulan),
            'pendapatan' => $this->pendapatan($hariIni, $awalBulan),

            'produk_terlaris' => $this->sales->produkTerlaris(
                $awalBulan->format('Y-m-d'),
                $hariIni->format('Y-m-d'),
                5,
            ),

            'grafik_penjualan' => $this->grafikPenjualan($sejak, $hariIni),
            'grafik_produksi' => $this->grafikProduksi($sejak, $hariIni),

            'stok' => $this->stok(),
            'batch_aktif' => $this->batchAktif(),
            'supplier_terakhir' => $this->supplierTerakhir(),
            'aktivitas_terkini' => $this->aktivitasTerkini(),

            'periode' => [
                'hari' => $days,
                'dari' => $sejak->format('Y-m-d'),
                'sampai' => $hariIni->format('Y-m-d'),
                'bulan_label' => $hariIni->translatedFormat('F Y'),
            ],
            // Dipakai layar untuk menampilkan "diperbarui pukul …" — tanpa itu
            // pengguna tidak tahu apakah angkanya masih segar.
            'diperbarui_pada' => now()->toIso8601String(),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Kartu ringkasan
    |--------------------------------------------------------------------------
    */

    /**
     * @return array<string, mixed>
     */
    private function penjualan(Carbon $hariIni, Carbon $awalBulan): array
    {
        $bulan = Sale::revenue()->whereDate('created_at', '>=', $awalBulan);
        $hari = Sale::revenue()->whereDate('created_at', $hariIni);

        $unitBulan = (float) SaleItem::whereIn('sale_id', (clone $bulan)->select('id'))->sum('quantity');
        $unitHari = (float) SaleItem::whereIn('sale_id', (clone $hari)->select('id'))->sum('quantity');

        return [
            'transaksi_hari_ini' => (clone $hari)->count(),
            'transaksi_bulan_ini' => (clone $bulan)->count(),
            'unit_hari_ini' => round($unitHari, 2),
            'unit_bulan_ini' => round($unitBulan, 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function produksi(Carbon $hariIni, Carbon $awalBulan): array
    {
        // Batch dihitung menurut kapan ia SELESAI, bukan kapan dimulai.
        // Batch yang mulai kemarin dan selesai hari ini adalah hasil hari ini.
        $selesaiHari = ProductionBatch::where('status', ProductionStatus::COMPLETED->value)
            ->whereDate('finished_at', $hariIni);

        $selesaiBulan = ProductionBatch::where('status', ProductionStatus::COMPLETED->value)
            ->whereDate('finished_at', '>=', $awalBulan);

        return [
            'batch_selesai_hari_ini' => (clone $selesaiHari)->count(),
            'batch_selesai_bulan_ini' => (clone $selesaiBulan)->count(),
            'unit_hari_ini' => round((float) (clone $selesaiHari)->sum('good_quantity'), 2),
            'unit_bulan_ini' => round((float) (clone $selesaiBulan)->sum('good_quantity'), 2),
            'batch_aktif' => ProductionBatch::active()->count(),
            'biaya_bahan_bulan_ini' => round(
                (float) ProductionBatch::whereNot('status', ProductionStatus::CANCELLED->value)
                    ->whereDate('started_at', '>=', $awalBulan)
                    ->sum('material_cost'),
                2
            ),
        ];
    }

    /**
     * Pendapatan dan laba kotor.
     *
     * Angkanya berasal dari SaleService — bukan dijumlahkan ulang di sini —
     * agar aturan "pajak tidak termasuk pendapatan" hanya ditulis di satu tempat.
     *
     * @return array<string, mixed>
     */
    private function pendapatan(Carbon $hariIni, Carbon $awalBulan): array
    {
        $harian = $this->sales->dailySummary($hariIni->format('Y-m-d'));
        $kemarin = $this->sales->dailySummary($hariIni->copy()->subDay()->format('Y-m-d'));
        $bulanan = $this->sales->monthlySummary($hariIni->year, $hariIni->month);

        return [
            'hari_ini' => $harian['omzet'],
            'bulan_ini' => $bulanan['omzet'],
            'laba_kotor_hari_ini' => $harian['laba_kotor'],
            'laba_kotor_bulan_ini' => $bulanan['laba_kotor'],
            'kemarin' => $kemarin['omzet'],

            // Selisih persen dihitung di sini supaya layar tidak perlu menjaga
            // diri dari pembagian nol.
            'perubahan_persen' => $kemarin['omzet'] > 0
                ? round((($harian['omzet'] - $kemarin['omzet']) / $kemarin['omzet']) * 100, 1)
                : null,

            'rata2_transaksi' => $harian['rata2_transaksi'],
            'tunai_di_laci' => $harian['tunai_di_laci'],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Grafik
    |--------------------------------------------------------------------------
    */

    /**
     * Omzet dan jumlah transaksi per hari.
     *
     * Keduanya dikirim dalam satu deret data, tetapi HANYA omzet yang digambar
     * sebagai garis. Jumlah transaksi muncul di tooltip. Menggambar keduanya
     * pada satu bidang menuntut dua sumbu Y dengan skala berbeda — dan
     * penyelarasan dua sumbu itu selalu sembarang, sehingga grafiknya
     * mengarang hubungan yang tidak ada di datanya.
     *
     * @return array<int, array<string, mixed>>
     */
    private function grafikPenjualan(Carbon $sejak, Carbon $sampai): array
    {
        $baris = Sale::revenue()
            ->selectRaw('DATE(created_at) as tanggal, COUNT(*) as transaksi, SUM(total) as omzet, SUM(cost_total) as hpp, SUM(tax_amount) as pajak')
            ->whereDate('created_at', '>=', $sejak)
            ->whereDate('created_at', '<=', $sampai)
            ->groupBy('tanggal')
            ->get()
            ->keyBy('tanggal');

        return $this->deretHarian($sejak, $sampai, function (Carbon $hari, string $kunci) use ($baris) {
            $d = $baris[$kunci] ?? null;
            $omzet = round((float) ($d->omzet ?? 0), 2);
            $pajak = round((float) ($d->pajak ?? 0), 2);
            $hpp = round((float) ($d->hpp ?? 0), 2);

            return [
                'transaksi' => (int) ($d->transaksi ?? 0),
                'omzet' => $omzet,
                'laba_kotor' => round($omzet - $pajak - $hpp, 2),
            ];
        });
    }

    /**
     * Jumlah batch selesai per hari.
     *
     * @return array<int, array<string, mixed>>
     */
    private function grafikProduksi(Carbon $sejak, Carbon $sampai): array
    {
        $baris = ProductionBatch::where('status', ProductionStatus::COMPLETED->value)
            ->selectRaw('DATE(finished_at) as tanggal, COUNT(*) as batch, SUM(good_quantity) as unit, SUM(reject_quantity) as gagal')
            ->whereDate('finished_at', '>=', $sejak)
            ->whereDate('finished_at', '<=', $sampai)
            ->groupBy('tanggal')
            ->get()
            ->keyBy('tanggal');

        return $this->deretHarian($sejak, $sampai, function (Carbon $hari, string $kunci) use ($baris) {
            $d = $baris[$kunci] ?? null;

            return [
                'batch' => (int) ($d->batch ?? 0),
                'unit' => round((float) ($d->unit ?? 0), 2),
                'gagal' => round((float) ($d->gagal ?? 0), 2),
            ];
        });
    }

    /**
     * Menyusun deret harian penuh, termasuk hari tanpa data.
     *
     * Hari kosong tetap muncul sebagai nol. Grafik garis yang melompati hari
     * kosong menyambung langsung dari Senin ke Kamis dan menyembunyikan dua
     * hari yang justru perlu ditanyakan.
     *
     * @return array<int, array<string, mixed>>
     */
    private function deretHarian(Carbon $sejak, Carbon $sampai, callable $isi): array
    {
        $hasil = [];
        $kursor = $sejak->copy();

        while ($kursor <= $sampai) {
            $kunci = $kursor->format('Y-m-d');

            $hasil[] = array_merge([
                'tanggal' => $kunci,
                'label' => $kursor->translatedFormat('d M'),
                'label_penuh' => $kursor->translatedFormat('l, d F Y'),
            ], $isi($kursor, $kunci));

            $kursor->addDay();
        }

        return $hasil;
    }

    /*
    |--------------------------------------------------------------------------
    | Panel
    |--------------------------------------------------------------------------
    */

    /**
     * Ringkasan stok — memakai InventoryService, bukan menghitung ulang.
     *
     * @return array<string, mixed>
     */
    private function stok(): array
    {
        $ringkasan = $this->inventory->summary();

        return [
            'habis' => $ringkasan['habis'],
            'menipis' => $ringkasan['menipis'],
            'aman' => $ringkasan['aman'],
            'total_item' => $ringkasan['total_item'],
            'rinci' => $ringkasan['rinci'],
            'nilai_persediaan' => $ringkasan['nilai_persediaan'],
            'perlu_perhatian' => $this->inventory->needsAttention(5),
        ];
    }

    /**
     * Batch yang belum selesai, beserta progress tahapannya.
     *
     * @return array<int, array<string, mixed>>
     */
    private function batchAktif(): array
    {
        return ProductionBatch::with(['product:id,name,unit', 'operator:id,name', 'stages'])
            ->active()
            ->orderBy('started_at')
            ->limit(6)
            ->get()
            ->map(function (ProductionBatch $b) {
                $tahap = $b->currentStage();

                return [
                    'id' => $b->id,
                    'batch_number' => $b->batch_number,
                    'product_name' => $b->product?->name,
                    'target_quantity' => (float) $b->target_quantity,
                    'unit' => $b->product?->unit ?? 'pcs',
                    'operator_name' => $b->operator?->name,
                    'started_at' => $b->started_at?->toIso8601String(),
                    'progress_percent' => $b->progressPercent(),
                    'completed_stages' => $b->completedStagesCount(),
                    'total_stages' => \App\Enums\ProductionStage::total(),
                    'current_stage_label' => $tahap?->stage->label(),
                    'current_stage_status' => $tahap?->status->value,
                    'is_overdue' => $tahap?->isOverdue() ?? false,
                ];
            })
            ->all();
    }

    /**
     * Penerimaan barang terbaru — "Supplier Terakhir".
     *
     * Yang ditampilkan adalah PENERIMAAN, bukan pemesanan. Pesanan yang baru
     * dibuat belum menjadi pengeluaran dan belum menambah stok; yang menarik
     * bagi Owner adalah barang yang benar-benar sudah datang.
     *
     * @return array<int, array<string, mixed>>
     */
    private function supplierTerakhir(): array
    {
        return PurchaseReceipt::with(['purchaseOrder.supplier:id,name', 'items', 'receiver:id,name'])
            ->latest('receipt_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (PurchaseReceipt $r) => [
                'id' => $r->id,
                'receipt_number' => $r->receipt_number,
                'po_number' => $r->purchaseOrder?->po_number,
                'supplier_name' => $r->purchaseOrder?->supplier?->name ?? '—',
                'receipt_date' => $r->receipt_date?->format('Y-m-d'),
                'items_count' => $r->items->count(),
                'total_value' => round($r->totalValue(), 2),
                'received_by' => $r->receiver?->name,
            ])
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Aktivitas lintas modul
    |--------------------------------------------------------------------------
    */

    /**
     * Kejadian terbaru dari seluruh modul, diurutkan menurut waktu.
     *
     * Disusun dari TABEL SUMBER, bukan dari `activity_logs`.
     *
     * Alasannya: activity_logs mencatat apa yang DIKLIK PENGGUNA, sedangkan
     * yang perlu dilihat Owner adalah apa yang TERJADI PADA USAHANYA. Keduanya
     * sering sama, tetapi tidak selalu — kejadian yang lahir dari seeder,
     * perintah artisan, atau proses otomatis tidak punya baris log sama sekali,
     * dan justru itu yang akan membuat panel ini terlihat kosong padahal
     * usahanya berjalan.
     *
     * @return array<int, array<string, mixed>>
     */
    private function aktivitasTerkini(int $limit = 12): array
    {
        $penjualan = Sale::with('cashier:id,name')
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (Sale $s) => [
                'jenis' => 'penjualan',
                'label' => 'Penjualan',
                'judul' => $s->sale_number,
                'keterangan' => $s->status === SaleStatus::VOIDED
                    ? "Dibatalkan · {$s->void_reason}"
                    : $s->payment_method->label().' · '.($s->customer_name ?? 'Pelanggan umum'),
                'nilai' => (float) $s->total,
                'oleh' => $s->cashier?->name,
                'tone' => $s->status === SaleStatus::VOIDED ? 'danger' : 'success',
                'waktu' => $s->created_at,
                'tautan' => '/penjualan/riwayat',
            ]);

        $produksi = ProductionBatch::with(['product:id,name', 'operator:id,name'])
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (ProductionBatch $b) => [
                'jenis' => 'produksi',
                'label' => 'Produksi',
                'judul' => $b->batch_number,
                'keterangan' => $b->product?->name.' · '.$b->status->label(),
                'nilai' => (float) $b->material_cost,
                'oleh' => $b->operator?->name,
                'tone' => match ($b->status) {
                    ProductionStatus::CANCELLED => 'danger',
                    ProductionStatus::COMPLETED => 'success',
                    default => 'warning',
                },
                'waktu' => $b->created_at,
                'tautan' => '/produksi/batch/'.$b->id,
            ]);

        $pembelian = PurchaseOrder::with('supplier:id,name')
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (PurchaseOrder $p) => [
                'jenis' => 'pembelian',
                'label' => 'Pembelian',
                'judul' => $p->po_number,
                'keterangan' => ($p->supplier?->name ?? '—').' · '.$p->status->label(),
                'nilai' => (float) $p->total,
                'oleh' => null,
                'tone' => $p->status === PurchaseOrderStatus::CANCELLED ? 'danger' : 'info',
                'waktu' => $p->created_at,
                'tautan' => '/pembelian/pesanan',
            ]);

        return $penjualan
            ->concat($produksi)
            ->concat($pembelian)
            ->sortByDesc(fn (array $a) => $a['waktu'])
            ->take($limit)
            ->map(fn (array $a) => [
                ...$a,
                'waktu' => $a['waktu']?->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
