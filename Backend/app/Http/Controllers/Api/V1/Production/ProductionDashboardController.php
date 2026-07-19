<?php

namespace App\Http\Controllers\Api\V1\Production;

use App\Enums\ProductionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductionBatchResource;
use App\Models\Ingredient;
use App\Models\ProductionBatch;
use App\Models\Product;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ringkasan produksi.
 *
 * Pertanyaan yang dijawab halaman ini:
 *   Apa yang sedang dikerjakan sekarang?
 *   Berapa banyak yang diproduksi bulan ini, dan berapa biayanya?
 *   Produk mana yang paling sering dibuat?
 *   Seberapa sering hasilnya meleset dari target?
 *   Produk apa yang masih bisa diproduksi dengan stok sekarang?
 */
class ProductionDashboardController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/production/dashboard
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
            'batch_aktif' => $this->batchAktif(),
            'tren_bulanan' => $this->trenBulanan($sejak),
            'produk_teratas' => $this->produkTeratas($sejak),
            'bahan_terpakai' => $this->bahanTerpakai($sejak),
            'kapasitas_produksi' => $this->kapasitasProduksi(),
        ], 'Dashboard produksi berhasil diambil.');
    }

    /* ---------------------------------------------------------------------- */

    /**
     * @return array<string, mixed>
     */
    private function ringkasan(\Carbon\Carbon $awalBulanIni): array
    {
        $bulanIni = ProductionBatch::whereDate('started_at', '>=', $awalBulanIni)
            ->whereNot('status', ProductionStatus::CANCELLED->value);

        $selesaiBulanIni = (clone $bulanIni)->where('status', ProductionStatus::COMPLETED->value);

        $totalTarget = (float) (clone $selesaiBulanIni)->sum('target_quantity');
        $totalBaik = (float) (clone $selesaiBulanIni)->sum('good_quantity');

        return [
            'batch_aktif' => ProductionBatch::active()->count(),
            'batch_bulan_ini' => (clone $bulanIni)->count(),
            'unit_diproduksi' => round($totalBaik, 2),
            'unit_gagal' => round((float) (clone $selesaiBulanIni)->sum('reject_quantity'), 2),
            'biaya_bahan_bulan_ini' => round((float) (clone $bulanIni)->sum('material_cost'), 2),

            // Rata-rata rasio hasil: seberapa dekat hasil nyata dengan target.
            // Konsisten di bawah 100% berarti persentase susut di resep terlalu
            // kecil, atau ada masalah di proses produksinya.
            'yield_rate_rata2' => $totalTarget > 0
                ? round(($totalBaik / $totalTarget) * 100, 2)
                : null,
        ];
    }

    /**
     * @return array<int, mixed>
     */
    private function batchAktif(): array
    {
        // `stages` dimuat supaya kartu batch aktif bisa menampilkan
        // "Sedang Mixing — 14%" tanpa permintaan tambahan.
        $batches = ProductionBatch::with([
            'product:id,name,code,unit', 'recipe:id,name,version', 'operator:id,name', 'stages',
        ])
            ->withCount('materials')
            ->active()
            ->orderBy('started_at')
            ->limit(10)
            ->get();

        return ProductionBatchResource::collection($batches)->resolve();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function trenBulanan(\Carbon\Carbon $sejak): array
    {
        $baris = ProductionBatch::select(
            DB::raw("DATE_FORMAT(started_at, '%Y-%m') as bulan"),
            DB::raw('COUNT(*) as jumlah_batch'),
            DB::raw('SUM(COALESCE(good_quantity, 0)) as unit'),
            DB::raw('SUM(material_cost) as biaya'),
        )
            ->where('started_at', '>=', $sejak)
            ->whereNot('status', ProductionStatus::CANCELLED->value)
            ->groupBy('bulan')
            ->orderBy('bulan')
            ->get()
            ->keyBy('bulan');

        // Bulan tanpa produksi tetap tampil sebagai nol agar grafik tidak
        // menyembunyikan periode kosong.
        $hasil = [];
        $kursor = $sejak->copy();

        while ($kursor <= now()) {
            $kunci = $kursor->format('Y-m');

            $hasil[] = [
                'bulan' => $kunci,
                'label' => $kursor->translatedFormat('M Y'),
                'jumlah_batch' => (int) ($baris[$kunci]->jumlah_batch ?? 0),
                'unit' => round((float) ($baris[$kunci]->unit ?? 0), 2),
                'biaya' => round((float) ($baris[$kunci]->biaya ?? 0), 2),
            ];

            $kursor->addMonth();
        }

        return $hasil;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function produkTeratas(\Carbon\Carbon $sejak): array
    {
        return ProductionBatch::select(
            'product_id',
            DB::raw('COUNT(*) as jumlah_batch'),
            DB::raw('SUM(COALESCE(good_quantity, 0)) as total_unit'),
            DB::raw('SUM(material_cost) as total_biaya'),
        )
            ->with('product:id,name,code,unit,selling_price')
            ->where('started_at', '>=', $sejak)
            ->where('status', ProductionStatus::COMPLETED->value)
            ->groupBy('product_id')
            ->orderByDesc('total_unit')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'name' => $row->product?->name ?? '—',
                'code' => $row->product?->code,
                'unit' => $row->product?->unit ?? 'pcs',
                'jumlah_batch' => (int) $row->jumlah_batch,
                'total_unit' => round((float) $row->total_unit, 2),
                'total_biaya' => round((float) $row->total_biaya, 2),
                'hpp_rata2' => (float) $row->total_unit > 0
                    ? round((float) $row->total_biaya / (float) $row->total_unit, 2)
                    : null,
            ])
            ->all();
    }

    /**
     * Bahan yang paling banyak terpakai produksi.
     *
     * @return array<int, array<string, mixed>>
     */
    private function bahanTerpakai(\Carbon\Carbon $sejak): array
    {
        $baris = DB::table('production_batch_materials as m')
            ->join('production_batches as b', 'b.id', '=', 'm.production_batch_id')
            ->select(
                'm.ingredient_id',
                DB::raw('SUM(m.qty_used) as total_qty'),
                DB::raw('SUM(m.line_cost) as total_biaya'),
            )
            ->where('b.started_at', '>=', $sejak)
            ->whereNot('b.status', ProductionStatus::CANCELLED->value)
            ->whereNull('b.deleted_at')
            ->groupBy('m.ingredient_id')
            ->orderByDesc('total_biaya')
            ->limit(8)
            ->get();

        $bahan = Ingredient::whereIn('id', $baris->pluck('ingredient_id'))
            ->get(['id', 'name', 'code', 'display_unit', 'conversion_factor'])
            ->keyBy('id');

        return $baris->map(function ($row) use ($bahan) {
            $b = $bahan[$row->ingredient_id] ?? null;
            $faktor = max((float) ($b->conversion_factor ?? 1), 0.0001);

            return [
                'ingredient_id' => $row->ingredient_id,
                'name' => $b->name ?? '—',
                'code' => $b->code ?? null,
                'unit' => $b->display_unit ?? '',
                'total_qty' => round((float) $row->total_qty, 4),
                'total_qty_display' => round((float) $row->total_qty / $faktor, 2),
                'total_biaya' => round((float) $row->total_biaya, 2),
            ];
        })->all();
    }

    /**
     * Berapa unit tiap produk yang masih bisa dibuat dengan stok saat ini.
     *
     * Ini pertanyaan pertama Admin Produksi setiap pagi: "hari ini saya masih
     * bisa bikin apa?" Bahan pembatasnya ikut disebut supaya langsung terlihat
     * apa yang perlu dibeli.
     *
     * @return array<int, array<string, mixed>>
     */
    private function kapasitasProduksi(): array
    {
        return Product::with(['activeRecipe.items.ingredient'])
            ->where('is_active', true)
            ->whereHas('recipes', fn ($q) => $q->where('is_active', true))
            ->get()
            ->map(function (Product $p) {
                $recipe = $p->activeRecipe;

                if (! $recipe) {
                    return null;
                }

                $kapasitas = $recipe->maxProducible();

                return [
                    'product_id' => $p->id,
                    'name' => $p->name,
                    'code' => $p->code,
                    'unit' => $p->unit,
                    'current_stock' => (float) $p->current_stock,
                    'max_producible' => $kapasitas['quantity'],
                    'limiting_ingredient' => $kapasitas['limiting_ingredient'],
                    'cost_per_unit' => $recipe->costPerUnit(),
                    'selling_price' => (float) $p->selling_price,
                ];
            })
            ->filter()
            ->sortByDesc('max_producible')
            ->values()
            ->all();
    }
}
