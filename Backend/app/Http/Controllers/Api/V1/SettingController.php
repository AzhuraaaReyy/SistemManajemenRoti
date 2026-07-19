<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\SettingService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pengaturan aplikasi.
 *
 * Membaca boleh oleh siapa saja yang sudah masuk — kasir butuh tarif pajak dan
 * identitas toko untuk menyusun struk. Mengubah hanya Owner, dijaga di rute.
 */
class SettingController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly SettingService $settings)
    {
    }

    /**
     * GET /api/v1/settings
     */
    public function index(): JsonResponse
    {
        return $this->success([
            'groups' => $this->settings->grouped(),
            'values' => $this->settings->all(),
        ], 'Pengaturan berhasil diambil.');
    }

    /**
     * GET /api/v1/settings/pos
     *
     * Hanya yang dibutuhkan kasir untuk menyusun struk.
     */
    public function pos(): JsonResponse
    {
        return $this->success($this->settings->forPos(), 'Pengaturan kasir berhasil diambil.');
    }

    /**
     * PUT /api/v1/settings
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_name' => ['nullable', 'string', 'max:100'],
            'store_address' => ['nullable', 'string', 'max:200'],
            'store_phone' => ['nullable', 'string', 'max:30'],

            'tax_enabled' => ['nullable', 'boolean'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'max_discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'receipt_footer' => ['nullable', 'string', 'max:200'],
        ], [
            'tax_percent.max' => 'Persentase pajak tidak masuk akal bila melebihi 100%.',
            'max_discount_percent.max' => 'Batas diskon tidak boleh melebihi 100%.',
        ]);

        // Nilai null berarti isian tidak dikirim, bukan permintaan mengosongkan.
        $bersih = array_filter($data, fn ($v) => $v !== null);

        $this->settings->setMany($bersih, $request->user()?->id);

        ActivityLog::record(
            'pengaturan_diubah',
            'Mengubah pengaturan: '.implode(', ', array_keys($bersih)),
            $request->user(), null, $request
        );

        return $this->success([
            'groups' => $this->settings->grouped(),
            'values' => $this->settings->all(),
        ], 'Pengaturan berhasil disimpan.');
    }
}
