<?php

namespace App\Http\Controllers\Api\V1\Production;

use App\Enums\ProductionStage as StageEnum;
use App\Enums\StageStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Production\FinishStageRequest;
use App\Http\Resources\ProductionBatchResource;
use App\Http\Resources\ProductionStageResource;
use App\Models\ActivityLog;
use App\Models\ProductionBatch;
use App\Services\ProductionTrackingService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductionTrackingController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ProductionTrackingService $tracking)
    {
    }

    /**
     * GET /api/v1/production/stages
     *
     * Daftar ketujuh tahap beserta urutannya — dipakai UI untuk menyusun
     * timeline tanpa menuliskan urutannya sendiri.
     */
    public function definitions(): JsonResponse
    {
        return $this->success([
            'stages' => StageEnum::options(),
            'statuses' => StageStatus::options(),
            'total' => StageEnum::total(),
        ], 'Daftar tahapan produksi berhasil diambil.');
    }

    /**
     * GET /api/v1/production/batches/{batch}/stages
     *
     * Detail tracking satu batch: keadaan tiap tahap, riwayat percobaan,
     * dan ringkasan progress.
     */
    public function index(ProductionBatch $batch): JsonResponse
    {
        return $this->success([
            'batch' => new ProductionBatchResource($this->muatBatch($batch)),
            'stages' => ProductionStageResource::collection($this->tracking->currentStages($batch)),
            // Riwayat memuat seluruh percobaan, termasuk tahap yang diulang.
            'history' => ProductionStageResource::collection($this->tracking->history($batch)),
            'summary' => $this->tracking->summary($batch),
        ], 'Detail tracking produksi berhasil diambil.');
    }

    /**
     * POST /api/v1/production/batches/{batch}/stages/{stage}/start
     */
    public function start(Request $request, ProductionBatch $batch, string $stage): JsonResponse
    {
        $tahap = $this->parseStage($stage);

        $baris = $this->tracking->start($batch, $tahap, $request->user()?->id);

        ActivityLog::record(
            'tahap_dimulai',
            "Memulai tahap {$tahap->label()} pada batch {$batch->batch_number}",
            $request->user(), $baris, $request
        );

        return $this->success(
            $this->payload($batch, $baris),
            "Tahap {$tahap->label()} dimulai."
        );
    }

    /**
     * POST /api/v1/production/batches/{batch}/stages/{stage}/finish
     *
     * Menyelesaikan tahap. Bila tahap terakhir, batch ikut ditutup dan stok
     * produk jadi bertambah lewat ProductionService::complete().
     */
    public function finish(FinishStageRequest $request, ProductionBatch $batch, string $stage): JsonResponse
    {
        $tahap = $this->parseStage($stage);

        $baris = $this->tracking->finish(
            batch: $batch,
            stage: $tahap,
            operatorId: $request->user()?->id,
            notes: $request->input('notes'),
            goodQuantity: $request->has('good_quantity') ? (float) $request->input('good_quantity') : null,
            rejectQuantity: (float) $request->input('reject_quantity', 0),
            idempotencyKey: $request->input('idempotency_key'),
        );

        $segar = $batch->fresh();

        ActivityLog::record(
            'tahap_selesai',
            "Menyelesaikan tahap {$tahap->label()} pada batch {$segar->batch_number}",
            $request->user(), $baris, $request
        );

        $pesan = $tahap->isLast()
            ? "Tahap Packaging selesai. Produksi {$segar->batch_number} ditutup dan stok produk jadi telah bertambah."
            : "Tahap {$tahap->label()} selesai. Lanjut ke {$tahap->next()?->label()}.";

        return $this->success($this->payload($segar, $baris), $pesan);
    }

    /**
     * POST /api/v1/production/batches/{batch}/stages/{stage}/repeat
     */
    public function repeat(Request $request, ProductionBatch $batch, string $stage): JsonResponse
    {
        $tahap = $this->parseStage($stage);

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
        ], [
            'reason.required' => 'Alasan pengulangan wajib diisi agar riwayat tetap bisa ditelusuri.',
            'reason.min' => 'Alasan pengulangan terlalu singkat.',
        ]);

        $baris = $this->tracking->repeat($batch, $tahap, $data['reason'], $request->user()?->id);

        ActivityLog::record(
            'tahap_diulang',
            "Mengulang tahap {$tahap->label()} pada batch {$batch->batch_number}: {$data['reason']}",
            $request->user(), $baris, $request
        );

        return $this->success(
            $this->payload($batch->fresh(), $baris),
            "Tahap {$tahap->label()} diulang (percobaan ke-{$baris->attempt}). Progress mundur satu tahap."
        );
    }

    /* ---------------------------------------------------------------------- */

    /**
     * Payload seragam untuk seluruh aksi tahap.
     *
     * Selalu mengembalikan keadaan terbaru batch dan seluruh tahapnya,
     * sehingga frontend cukup mengganti state tanpa memuat ulang halaman.
     *
     * @return array<string, mixed>
     */
    private function payload(ProductionBatch $batch, $baris): array
    {
        return [
            'stage' => new ProductionStageResource($baris),
            'batch' => new ProductionBatchResource($this->muatBatch($batch)),
            'stages' => ProductionStageResource::collection($this->tracking->currentStages($batch)),
            'history' => ProductionStageResource::collection($this->tracking->history($batch)),
            'summary' => $this->tracking->summary($batch),
        ];
    }

    private function parseStage(string $stage): StageEnum
    {
        $tahap = StageEnum::tryFrom($stage);

        if (! $tahap) {
            abort(404, "Tahap \"{$stage}\" tidak dikenali.");
        }

        return $tahap;
    }

    private function muatBatch(ProductionBatch $batch): ProductionBatch
    {
        return $batch->load([
            'product:id,name,code,unit,selling_price,current_stock',
            'recipe:id,name,version,yield_quantity,yield_unit',
            'materials.ingredient:id,name,code,base_unit,display_unit,conversion_factor,current_stock',
            'operator:id,name',
            'completer:id,name',
            'canceller:id,name',
            'stages',
        ])->loadCount('materials');
    }
}
