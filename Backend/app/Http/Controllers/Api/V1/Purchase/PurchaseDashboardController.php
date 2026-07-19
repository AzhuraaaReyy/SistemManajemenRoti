<?php

namespace App\Http\Controllers\Api\V1\Purchase;

use App\Enums\PurchaseOrderStatus;
use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\Ingredient;
use App\Models\PurchaseOrder;
use App\Models\StockLedger;
use App\Models\Supplier;
use App\Services\PurchaseService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ringkasan pembelian untuk pemilik usaha.
 *
 * Pertanyaan yang dijawab halaman ini:
 *   Berapa yang saya belanjakan bulan ini?
 *   Pesanan mana yang barangnya belum datang, dan mana yang sudah telat?
 *   Bahan apa yang paling menyedot uang?
 *   Supplier mana yang paling bisa diandalkan?
 *   Apa yang perlu saya beli sekarang?
 */
class PurchaseDashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly PurchaseService $purchases)
    {
    }

    /**
     * GET /api/v1/purchases/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'months' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);

        $bulan = $filters['months'] ?? 6;
        $awalBulanIni = now()->startOfMonth();
        $sejak = now()->subMonths($bulan)->startOfMonth();

        return $this->success([
            'ringkasan' => $this->ringkasan($awalBulanIni),
            'per_status' => $this->perStatus(),
            'tren_bulanan' => $this->trenBulanan($sejak),
            'menunggu_kedatangan' => $this->menungguKedatangan(),
            'bahan_teratas' => $this->bahanTeratas($sejak),
            'supplier_teratas' => $this->supplierTeratas($sejak),
            'perlu_dibeli' => $this->perluDibeli(),
        ], 'Dashboard pembelian berhasil diambil.');
    }

    /**
     * GET /api/v1/purchases/suppliers/{supplier}/performance
     */
    public function supplierPerformance(Request $request, Supplier $supplier): JsonResponse
    {
        $bulan = (int) $request->query('months', 6);

        return $this->success([
            'supplier' => [
                'id' => $supplier->id,
                'code' => $supplier->code,
                'name' => $supplier->name,
                'lead_time_days' => $supplier->lead_time_days,
            ],
            'performance' => $this->purchases->supplierPerformance($supplier, max(1, min(24, $bulan))),
        ], 'Performa supplier berhasil diambil.');
    }

    /* ---------------------------------------------------------------------- */

    /**
     * @return array<string, mixed>
     */
    private function ringkasan(\Carbon\Carbon $awalBulanIni): array
    {
        $bulanIni = PurchaseOrder::whereDate('order_date', '>=', $awalBulanIni)
            ->whereNot('status', PurchaseOrderStatus::CANCELLED->value);

        $bulanLalu = PurchaseOrder::whereBetween('order_date', [
            $awalBulanIni->copy()->subMonth(),
            $awalBulanIni->copy()->subDay(),
        ])->whereNot('status', PurchaseOrderStatus::CANCELLED->value);

        $belanjaBulanIni = (float) (clone $bulanIni)->sum('total');
        $belanjaBulanLalu = (float) (clone $bulanLalu)->sum('total');

        return [
            'belanja_bulan_ini' => round($belanjaBulanIni, 2),
            'belanja_bulan_lalu' => round($belanjaBulanLalu, 2),
            // Persentase perubahan; null bila bulan lalu nol agar tidak
            // menampilkan kenaikan tak berhingga.
            'perubahan_persen' => $belanjaBulanLalu > 0
                ? round((($belanjaBulanIni - $belanjaBulanLalu) / $belanjaBulanLalu) * 100, 2)
                : null,
            'jumlah_po_bulan_ini' => (clone $bulanIni)->count(),
            'menunggu_barang' => PurchaseOrder::outstanding()->count(),
            'terlambat' => PurchaseOrder::outstanding()
                ->whereNotNull('expected_date')
                ->whereDate('expected_date', '<', now())
                ->count(),
            'nilai_belum_datang' => round((float) PurchaseOrder::outstanding()->sum('total'), 2),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function perStatus(): array
    {
        $hitung = PurchaseOrder::select('status', DB::raw('COUNT(*) as jumlah'), DB::raw('SUM(total) as nilai'))
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        return collect(PurchaseOrderStatus::cases())->map(fn (PurchaseOrderStatus $s) => [
            'status' => $s->value,
            'label' => $s->label(),
            'tone' => $s->tone(),
            'jumlah' => (int) ($hitung[$s->value]->jumlah ?? 0),
            'nilai' => round((float) ($hitung[$s->value]->nilai ?? 0), 2),
        ])->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function trenBulanan(\Carbon\Carbon $sejak): array
    {
        $baris = PurchaseOrder::select(
            DB::raw("DATE_FORMAT(order_date, '%Y-%m') as bulan"),
            DB::raw('COUNT(*) as jumlah'),
            DB::raw('SUM(total) as nilai'),
        )
            ->where('order_date', '>=', $sejak)
            ->whereNot('status', PurchaseOrderStatus::CANCELLED->value)
            ->groupBy('bulan')
            ->orderBy('bulan')
            ->get()
            ->keyBy('bulan');

        // Bulan tanpa pembelian tetap ditampilkan sebagai nol, supaya grafik
        // tidak menyembunyikan periode kosong dan terlihat lebih ramai.
        $hasil = [];
        $kursor = $sejak->copy();

        while ($kursor <= now()) {
            $kunci = $kursor->format('Y-m');

            $hasil[] = [
                'bulan' => $kunci,
                'label' => $kursor->translatedFormat('M Y'),
                'jumlah' => (int) ($baris[$kunci]->jumlah ?? 0),
                'nilai' => round((float) ($baris[$kunci]->nilai ?? 0), 2),
            ];

            $kursor->addMonth();
        }

        return $hasil;
    }

    /**
     * @return array<int, mixed>
     */
    private function menungguKedatangan(): array
    {
        $orders = PurchaseOrder::with(['supplier:id,name', 'items'])
            ->outstanding()
            ->orderByRaw('expected_date IS NULL, expected_date ASC')
            ->limit(10)
            ->get();

        return PurchaseOrderResource::collection($orders)->resolve();
    }

    /**
     * Bahan dengan nilai pembelian terbesar.
     *
     * Diambil dari ledger stok, bukan dari baris pesanan — yang dihitung
     * adalah barang yang benar-benar diterima dan dibayar, bukan yang baru
     * dipesan di atas kertas.
     *
     * @return array<int, array<string, mixed>>
     */
    private function bahanTeratas(\Carbon\Carbon $sejak): array
    {
        $baris = StockLedger::select(
            'item_id',
            DB::raw('SUM(quantity) as total_qty'),
            DB::raw('SUM(quantity * COALESCE(unit_cost, 0)) as total_nilai'),
        )
            ->where('item_type', Ingredient::class)
            ->where('source_type', StockMovementType::PURCHASE->value)
            ->where('created_at', '>=', $sejak)
            ->groupBy('item_id')
            ->orderByDesc('total_nilai')
            ->limit(8)
            ->get();

        $bahan = Ingredient::whereIn('id', $baris->pluck('item_id'))
            ->get(['id', 'name', 'code', 'display_unit', 'conversion_factor'])
            ->keyBy('id');

        return $baris->map(function ($row) use ($bahan) {
            $b = $bahan[$row->item_id] ?? null;
            $faktor = (float) ($b->conversion_factor ?? 1);

            return [
                'ingredient_id' => $row->item_id,
                'name' => $b->name ?? '—',
                'code' => $b->code ?? null,
                'unit' => $b->display_unit ?? '',
                'total_qty' => round((float) $row->total_qty, 4),
                'total_qty_display' => $faktor > 0 ? round((float) $row->total_qty / $faktor, 2) : (float) $row->total_qty,
                'total_nilai' => round((float) $row->total_nilai, 2),
            ];
        })->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function supplierTeratas(\Carbon\Carbon $sejak): array
    {
        return PurchaseOrder::select(
            'supplier_id',
            DB::raw('COUNT(*) as jumlah_po'),
            DB::raw('SUM(total) as total_belanja'),
        )
            ->with('supplier:id,name,code,lead_time_days')
            ->where('order_date', '>=', $sejak)
            ->whereNot('status', PurchaseOrderStatus::CANCELLED->value)
            ->groupBy('supplier_id')
            ->orderByDesc('total_belanja')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'supplier_id' => $row->supplier_id,
                'name' => $row->supplier?->name ?? '—',
                'code' => $row->supplier?->code,
                'lead_time_days' => $row->supplier?->lead_time_days,
                'jumlah_po' => (int) $row->jumlah_po,
                'total_belanja' => round((float) $row->total_belanja, 2),
            ])
            ->all();
    }

    /**
     * Bahan yang stoknya sudah di bawah batas dan belum ada pesanan berjalan.
     *
     * Inilah daftar belanja yang seharusnya segera ditindaklanjuti — dan
     * alasan utama pemilik usaha membuka halaman ini.
     *
     * @return array<int, array<string, mixed>>
     */
    private function perluDibeli(): array
    {
        // Bahan yang sudah ada di pesanan berjalan tidak perlu diingatkan lagi.
        $sedangDipesan = DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereIn('purchase_orders.status', [
                PurchaseOrderStatus::ORDERED->value,
                PurchaseOrderStatus::PARTIAL->value,
            ])
            ->whereNull('purchase_orders.deleted_at')
            ->pluck('purchase_order_items.ingredient_id')
            ->unique();

        return Ingredient::with('defaultSupplier:id,name')
            ->where('is_active', true)
            ->where('min_stock', '>', 0)
            ->whereRaw('current_stock <= min_stock')
            ->whereNotIn('id', $sedangDipesan)
            ->orderByRaw('current_stock / NULLIF(min_stock, 0) ASC')
            ->limit(10)
            ->get()
            ->map(function (Ingredient $b) {
                $faktor = (float) $b->conversion_factor;

                // Saran pesan: isi kembali sampai dua kali batas minimum,
                // agar tidak langsung menipis lagi minggu depan.
                $saranDasar = max(0, ((float) $b->min_stock * 2) - (float) $b->current_stock);

                return [
                    'ingredient_id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                    'unit' => $b->display_unit,
                    'current_stock' => round($b->toDisplayUnit((float) $b->current_stock), 2),
                    'min_stock' => round($b->toDisplayUnit((float) $b->min_stock), 2),
                    'stock_status' => $b->stockStatus()->value,
                    'suggested_qty' => $faktor > 0 ? round($saranDasar / $faktor, 2) : $saranDasar,
                    'estimated_cost' => round($saranDasar * (float) $b->avg_cost, 2),
                    'supplier_id' => $b->default_supplier_id,
                    'supplier_name' => $b->defaultSupplier?->name,
                ];
            })
            ->all();
    }
}
