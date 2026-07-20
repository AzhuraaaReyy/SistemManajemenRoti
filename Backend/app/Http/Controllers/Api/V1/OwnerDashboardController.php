<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\OwnerDashboardService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboard Owner — ringkasan tingkat tertinggi.
 *
 * Menggabungkan data penjualan, produksi, persediaan, dan pembelian. Tidak ada
 * tabel baru dan tidak ada angka yang dihitung ulang di sini: seluruhnya
 * agregasi dari tabel yang sudah diisi modul lain.
 *
 * Penjaga `role:owner` dipasang di rute, memakai middleware yang sama dengan
 * seluruh sistem sejak Modul 1.
 */
class OwnerDashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly OwnerDashboardService $dashboard)
    {
    }

    /**
     * GET /api/v1/dashboard/owner
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'days' => ['nullable', 'integer', 'min:7', 'max:90'],
        ], [
            'days.min' => 'Rentang grafik minimal 7 hari.',
            'days.max' => 'Rentang grafik maksimal 90 hari.',
        ]);

        return $this->success(
            $this->dashboard->build($filters['days'] ?? 30),
            'Dashboard owner berhasil diambil.'
        );
    }
}
