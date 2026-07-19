<?php

namespace App\Http\Controllers\Api\V1\MasterData;

use App\Enums\CategoryType;
use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/master/categories
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(CategoryType::values())],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'sort_by' => ['nullable', Rule::in(['name', 'type', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $query = Category::query()
            ->withCount(['products', 'ingredients'])
            ->ofType($filters['type'] ?? null)
            ->search($filters['search'] ?? null)
            ->when(isset($filters['status']), fn ($q) => $q->where('is_active', $filters['status'] === 'aktif'))
            ->orderBy($filters['sort_by'] ?? 'name', $filters['sort_dir'] ?? 'asc');

        $categories = $query->paginate($filters['per_page'] ?? 10)->withQueryString();

        return $this->paginated(
            $categories,
            CategoryResource::collection($categories->items()),
            'Daftar kategori berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/master/categories/options
     *
     * Daftar ringkas untuk mengisi dropdown pada form produk dan bahan baku.
     * Tidak berhalaman — form butuh seluruh pilihan sekaligus.
     */
    public function options(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(CategoryType::values())],
        ]);

        $categories = Category::query()
            ->where('is_active', true)
            ->ofType($filters['type'] ?? null)
            ->orderBy('name')
            ->get(['id', 'name', 'type']);

        return $this->success(
            $categories->map(fn (Category $c) => [
                'value' => $c->id,
                'label' => $c->name,
                'type' => $c->type->value,
            ]),
            'Pilihan kategori berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/master/categories
     */
    public function store(CategoryRequest $request): JsonResponse
    {
        $category = Category::create([
            ...$request->safe()->except('slug'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        ActivityLog::record(
            'kategori_dibuat',
            "Membuat kategori {$category->type->label()}: {$category->name}",
            $request->user(), $category, $request
        );

        return $this->success(
            ['category' => new CategoryResource($category)],
            "Kategori {$category->name} berhasil ditambahkan.",
            201
        );
    }

    /**
     * GET /api/v1/master/categories/{category}
     */
    public function show(Category $category): JsonResponse
    {
        $category->loadCount(['products', 'ingredients']);

        return $this->success(
            ['category' => new CategoryResource($category)],
            'Detail kategori berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/master/categories/{category}
     */
    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        // Mengubah jenis kategori yang sudah dipakai akan membuat produk
        // bernaung di bawah kategori bahan baku, atau sebaliknya.
        if ($request->input('type') !== $category->type->value && $category->usageCount() > 0) {
            return $this->error(
                'Jenis kategori tidak dapat diubah karena sudah dipakai oleh '
                .$category->usageCount().' data. Buat kategori baru sebagai gantinya.',
                422
            );
        }

        $category->update($request->safe()->except('slug'));

        ActivityLog::record(
            'kategori_diperbarui',
            "Memperbarui kategori: {$category->name}",
            $request->user(), $category, $request
        );

        return $this->success(
            ['category' => new CategoryResource($category->loadCount(['products', 'ingredients']))],
            "Kategori {$category->name} berhasil diperbarui."
        );
    }

    /**
     * DELETE /api/v1/master/categories/{category}
     */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $terpakai = $category->usageCount();

        if ($terpakai > 0) {
            $jenis = $category->type === CategoryType::PRODUK ? 'produk' : 'bahan baku';

            return $this->error(
                "Kategori ini masih dipakai oleh {$terpakai} {$jenis}. "
                .'Pindahkan data tersebut ke kategori lain terlebih dahulu, '
                .'atau nonaktifkan kategori ini agar tidak muncul di pilihan baru.',
                422
            );
        }

        $nama = $category->name;

        ActivityLog::record(
            'kategori_dihapus',
            "Menghapus kategori: {$nama}",
            $request->user(), $category, $request
        );

        $category->delete();

        return $this->success(null, "Kategori {$nama} berhasil dihapus.");
    }
}
