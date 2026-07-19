<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Controller;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Services\SaleService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ringkasan penjualan.
 *
 * Sengaja ringkas — laporan lengkap (laba rugi, tren tahunan, perbandingan
 * periode) adalah modul tersendiri. Yang dijawab di sini hanya pertanyaan yang
 * muncul di depan meja kasir dan saat tutup toko.
 */
class SalesDashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly SaleService $sales)
    {
    }

    /**
     * GET /api/v1/sales/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        $tanggal = $filters['date'] ?? today()->format('Y-m-d');

        // Kasir hanya melihat angkanya sendiri — tutup kasir adalah tanggung
        // jawab pribadi.
        $kasirId = $request->user()?->role->value === 'kasir' ? $request->user()->id : null;

        $hariIni = $this->sales->dailySummary($tanggal, $kasirId);
        $kemarin = $this->sales->dailySummary(
            \Carbon\Carbon::parse($tanggal)->subDay()->format('Y-m-d'),
            $kasirId,
        );

        $bulan = \Carbon\Carbon::parse($tanggal);

        return $this->success([
            'hari_ini' => $hariIni,
            'kemarin' => [
                'omzet' => $kemarin['omzet'],
                'transaksi' => $kemarin['transaksi'],
            ],
            // Perbandingan disajikan sebagai selisih persen agar tidak perlu
            // dihitung ulang di layar dengan risiko pembagian nol.
            'perbandingan' => [
                'omzet_persen' => $kemarin['omzet'] > 0
                    ? round((($hariIni['omzet'] - $kemarin['omzet']) / $kemarin['omzet']) * 100, 1)
                    : null,
                'transaksi_selisih' => $hariIni['transaksi'] - $kemarin['transaksi'],
            ],
            'bulan_ini' => $this->sales->monthlySummary($bulan->year, $bulan->month, $kasirId),
            'transaksi_terakhir' => $this->transaksiTerakhir($kasirId),
        ], 'Dashboard penjualan berhasil diambil.');
    }

    /**
     * GET /api/v1/sales/summary/daily
     */
    public function daily(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date' => ['nullable', 'date'],
            'cashier_id' => ['nullable', 'integer'],
        ]);

        $kasirId = $request->user()?->role->value === 'kasir'
            ? $request->user()->id
            : ($filters['cashier_id'] ?? null);

        return $this->success(
            $this->sales->dailySummary($filters['date'] ?? null, $kasirId),
            'Ringkasan harian berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/sales/summary/monthly
     */
    public function monthly(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'cashier_id' => ['nullable', 'integer'],
        ]);

        $kasirId = $request->user()?->role->value === 'kasir'
            ? $request->user()->id
            : ($filters['cashier_id'] ?? null);

        return $this->success(
            $this->sales->monthlySummary(
                $filters['year'] ?? (int) now()->year,
                $filters['month'] ?? (int) now()->month,
                $kasirId,
            ),
            'Ringkasan bulanan berhasil diambil.'
        );
    }

    /* ---------------------------------------------------------------------- */

    /**
     * @return array<int, mixed>
     */
    private function transaksiTerakhir(?int $kasirId): array
    {
        $daftar = Sale::with(['cashier:id,name'])
            ->withCount('items')
            ->when($kasirId, fn ($q, $v) => $q->where('cashier_id', $v))
            ->latest('id')
            ->limit(8)
            ->get();

        return SaleResource::collection($daftar)->resolve();
    }
}
