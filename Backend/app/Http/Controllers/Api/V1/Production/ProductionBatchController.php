<?php

namespace App\Http\Controllers\Api\V1\Production;

use App\Enums\ProductionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Production\StoreProductionBatchRequest;
use App\Http\Resources\ProductionBatchResource;
use App\Models\ActivityLog;
use App\Models\ProductionBatch;
use App\Services\ProductionService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductionBatchController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ProductionService $production)
    {
    }

    /**
     * POST /api/v1/production/preview
     *
     * Menghitung kebutuhan bahan tanpa mengubah apa pun.
     *
     * Dipakai form produksi untuk menampilkan tabel kebutuhan dan status stok
     * SEBELUM pengguna menekan tombol — supaya penolakan karena stok kurang
     * tidak baru ketahuan setelah submit.
     */
    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'quantity' => ['required', 'numeric', 'min:0.01', 'max:1000000'],
        ], [
            'product_id.required' => 'Produk wajib dipilih.',
            'quantity.required' => 'Jumlah produksi wajib diisi.',
            'quantity.min' => 'Jumlah produksi harus lebih besar dari nol.',
        ]);

        $hasil = $this->production->calculateRequirements(
            (int) $data['product_id'],
            (float) $data['quantity'],
        );

        return $this->success(
            $hasil,
            $hasil['can_produce']
                ? 'Seluruh bahan mencukupi. Produksi dapat dijalankan.'
                : count($hasil['shortages']).' bahan tidak mencukupi untuk jumlah produksi ini.'
        );
    }

    /**
     * GET /api/v1/production/batches
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(ProductionStatus::values())],
            'product_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'sort_by' => ['nullable', Rule::in(['batch_number', 'started_at', 'target_quantity', 'material_cost'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $batches = ProductionBatch::query()
            // `stages` ikut dimuat agar progress bisa dihitung tanpa query
            // tambahan per baris (N+1).
            ->with(['product:id,name,code,unit', 'recipe:id,name,version', 'operator:id,name', 'stages'])
            ->withCount('materials')
            ->search($filters['search'] ?? null)
            ->status($filters['status'] ?? null)
            ->betweenDates($filters['date_from'] ?? null, $filters['date_to'] ?? null)
            ->when($filters['product_id'] ?? null, fn ($q, $id) => $q->where('product_id', $id))
            ->orderBy($filters['sort_by'] ?? 'started_at', $filters['sort_dir'] ?? 'desc')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $batches,
            ProductionBatchResource::collection($batches->items()),
            'Daftar batch produksi berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/production/batches/{batch}
     */
    public function show(ProductionBatch $batch): JsonResponse
    {
        return $this->success(
            ['batch' => new ProductionBatchResource($this->muatLengkap($batch))],
            'Detail batch produksi berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/production/batches
     *
     * Menjalankan produksi: memotong stok bahan dan membuat batch.
     * Menolak dengan rincian per bahan bila ada stok yang kurang.
     */
    public function store(StoreProductionBatchRequest $request): JsonResponse
    {
        $batch = $this->production->execute(
            productId: $request->integer('product_id'),
            quantity: (float) $request->input('quantity'),
            operatorId: $request->user()?->id,
            notes: $request->input('notes'),
            idempotencyKey: $request->input('idempotency_key'),
        );

        ActivityLog::record(
            'produksi_dimulai',
            "Memulai produksi {$batch->batch_number}: {$batch->target_quantity} {$batch->product->unit} {$batch->product->name}",
            $request->user(), $batch, $request
        );

        return $this->success(
            ['batch' => new ProductionBatchResource($this->muatLengkap($batch))],
            "Produksi {$batch->batch_number} dimulai. Stok bahan telah dipotong sesuai resep.",
            201
        );
    }

    /*
    | Endpoint `complete` dihapus sejak Modul 5 (Tracking Produksi).
    |
    | Batch kini hanya bisa ditutup dengan menyelesaikan tahap Packaging lewat
    | POST /batches/{batch}/stages/packaging/finish. Menyediakan jalan pintas
    | akan menghasilkan batch berstatus "Selesai" dengan timeline kosong —
    | laporan durasi per tahap jadi tidak lengkap tanpa ada yang menyadarinya.
    |
    | Logika penambahan stoknya sendiri tetap di ProductionService::complete(),
    | dan dipanggil ProductionTrackingService saat tahap terakhir selesai.
    */

    /**
     * POST /api/v1/production/batches/{batch}/cancel
     */
    public function cancel(Request $request, ProductionBatch $batch): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
        ], [
            'reason.required' => 'Alasan pembatalan wajib diisi agar riwayat tetap bisa ditelusuri.',
            'reason.min' => 'Alasan pembatalan terlalu singkat.',
        ]);

        $dibatalkan = $this->production->cancel($batch, $data['reason'], $request->user()?->id);

        ActivityLog::record(
            'produksi_dibatalkan',
            "Membatalkan produksi {$dibatalkan->batch_number}: {$data['reason']}",
            $request->user(), $dibatalkan, $request
        );

        return $this->success(
            ['batch' => new ProductionBatchResource($this->muatLengkap($dibatalkan))],
            "Produksi {$dibatalkan->batch_number} dibatalkan. Seluruh bahan telah dikembalikan ke stok."
        );
    }

    /**
     * GET /api/v1/production/statuses
     */
    public function statuses(): JsonResponse
    {
        return $this->success(ProductionStatus::options(), 'Daftar status berhasil diambil.');
    }

    private function muatLengkap(ProductionBatch $batch): ProductionBatch
    {
        return $batch->load([
            'product:id,name,code,unit,selling_price,current_stock',
            'recipe:id,name,version,yield_quantity,yield_unit',
            'materials.ingredient:id,name,code,base_unit,display_unit,conversion_factor,current_stock',
            'operator:id,name',
            'completer:id,name',
            'canceller:id,name',
            // Dimuat agar Resource bisa menghitung progress tahapan.
            'stages',
        ])->loadCount('materials');
    }
}
