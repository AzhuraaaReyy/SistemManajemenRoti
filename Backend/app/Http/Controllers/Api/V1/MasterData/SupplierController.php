<?php

namespace App\Http\Controllers\Api\V1\MasterData;

use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\SupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\ActivityLog;
use App\Models\Supplier;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/master/suppliers
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'sort_by' => ['nullable', Rule::in(['name', 'code', 'lead_time_days', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $suppliers = Supplier::query()
            ->withCount('ingredients')
            ->search($filters['search'] ?? null)
            ->when(isset($filters['status']), fn ($q) => $q->where('is_active', $filters['status'] === 'aktif'))
            ->orderBy($filters['sort_by'] ?? 'name', $filters['sort_dir'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $suppliers,
            SupplierResource::collection($suppliers->items()),
            'Daftar supplier berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/master/suppliers/options
     */
    public function options(): JsonResponse
    {
        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return $this->success(
            $suppliers->map(fn (Supplier $s) => [
                'value' => $s->id,
                'label' => $s->name,
                'code' => $s->code,
            ]),
            'Pilihan supplier berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/master/suppliers
     */
    public function store(SupplierRequest $request): JsonResponse
    {
        $supplier = DB::transaction(function () use ($request) {
            $supplier = Supplier::create([
                ...$request->safe()->except('ingredient_ids'),
                'is_active' => $request->boolean('is_active', true),
            ]);

            if ($request->filled('ingredient_ids')) {
                $supplier->ingredients()->sync($request->input('ingredient_ids'));
            }

            return $supplier;
        });

        ActivityLog::record(
            'supplier_dibuat',
            "Membuat supplier: {$supplier->name} ({$supplier->code})",
            $request->user(), $supplier, $request
        );

        return $this->success(
            ['supplier' => new SupplierResource($supplier->loadCount('ingredients'))],
            "Supplier {$supplier->name} berhasil ditambahkan.",
            201
        );
    }

    /**
     * GET /api/v1/master/suppliers/{supplier}
     */
    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load('ingredients')->loadCount('ingredients');

        return $this->success(
            ['supplier' => new SupplierResource($supplier)],
            'Detail supplier berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/master/suppliers/{supplier}
     */
    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        DB::transaction(function () use ($request, $supplier) {
            $supplier->update($request->safe()->except('ingredient_ids'));

            if ($request->has('ingredient_ids')) {
                $supplier->ingredients()->sync($request->input('ingredient_ids', []));
            }
        });

        ActivityLog::record(
            'supplier_diperbarui',
            "Memperbarui supplier: {$supplier->name}",
            $request->user(), $supplier, $request
        );

        return $this->success(
            ['supplier' => new SupplierResource($supplier->fresh()->load('ingredients')->loadCount('ingredients'))],
            "Supplier {$supplier->name} berhasil diperbarui."
        );
    }

    /**
     * DELETE /api/v1/master/suppliers/{supplier}
     */
    public function destroy(Request $request, Supplier $supplier): JsonResponse
    {
        // Bahan yang menjadikan supplier ini pilihan utama akan kehilangan
        // rujukannya. Diberitahukan lebih dulu, bukan dibiarkan jadi NULL diam-diam.
        $sebagaiUtama = $supplier->defaultForIngredients()->count();

        if ($sebagaiUtama > 0) {
            return $this->error(
                "Supplier ini masih menjadi supplier utama untuk {$sebagaiUtama} bahan baku. "
                .'Ganti supplier utama bahan tersebut terlebih dahulu, atau nonaktifkan supplier ini.',
                422
            );
        }

        $nama = $supplier->name;

        ActivityLog::record(
            'supplier_dihapus',
            "Menghapus supplier: {$nama}",
            $request->user(), $supplier, $request
        );

        $supplier->delete();

        return $this->success(null, "Supplier {$nama} berhasil dihapus.");
    }
}
