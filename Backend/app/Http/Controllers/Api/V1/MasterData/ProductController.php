<?php

namespace App\Http\Controllers\Api\V1\MasterData;

use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Services\StockService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly StockService $stock)
    {
    }

    /**
     * GET /api/v1/master/products
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'has_recipe' => ['nullable', Rule::in(['ya', 'tidak'])],
            'sort_by' => ['nullable', Rule::in(['name', 'code', 'selling_price', 'current_stock', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $products = Product::query()
            // activeRecipe.items.ingredient dimuat sekaligus supaya HPP tiap
            // produk bisa dihitung tanpa memicu query per baris.
            ->with(['category:id,name', 'activeRecipe.items.ingredient:id,avg_cost,name,current_stock,base_unit'])
            ->withCount('recipes')
            ->search($filters['search'] ?? null)
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when(isset($filters['status']), fn ($q) => $q->where('is_active', $filters['status'] === 'aktif'))
            ->when(isset($filters['has_recipe']), fn ($q) => $filters['has_recipe'] === 'ya'
                ? $q->whereHas('recipes', fn ($r) => $r->where('is_active', true))
                : $q->whereDoesntHave('recipes', fn ($r) => $r->where('is_active', true)))
            ->orderBy($filters['sort_by'] ?? 'name', $filters['sort_dir'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $products,
            ProductResource::collection($products->items()),
            'Daftar produk berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/master/products/options
     */
    public function options(Request $request): JsonResponse
    {
        $filters = $request->validate([
            // Untuk form resep: hanya tampilkan produk yang belum punya resep aktif.
            'without_recipe' => ['nullable', 'boolean'],
        ]);

        $products = Product::query()
            ->where('is_active', true)
            ->when(
                $filters['without_recipe'] ?? false,
                fn ($q) => $q->whereDoesntHave('recipes', fn ($r) => $r->where('is_active', true))
            )
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'selling_price', 'unit']);

        return $this->success(
            $products->map(fn (Product $p) => [
                'value' => $p->id,
                'label' => $p->name,
                'code' => $p->code,
                'unit' => $p->unit,
                'selling_price' => (float) $p->selling_price,
            ]),
            'Pilihan produk berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/master/products
     */
    public function store(ProductRequest $request): JsonResponse
    {
        $data = $request->safe()->except(['image', 'opening_stock']);

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        $product = DB::transaction(function () use ($request, $data) {
            $product = Product::create([
                ...$data,
                'unit' => $data['unit'] ?? 'pcs',
                'is_active' => $request->boolean('is_active', true),
            ]);

            // Sama seperti bahan baku: stok awal pun harus punya jejak.
            $this->stock->recordOpeningBalance(
                item: $product,
                quantity: (float) $request->input('opening_stock', 0),
                userId: $request->user()?->id,
            );

            return $product->refresh();
        });

        ActivityLog::record(
            'produk_dibuat',
            "Membuat produk: {$product->name} ({$product->code})",
            $request->user(), $product, $request
        );

        return $this->success(
            ['product' => new ProductResource($product->load('category'))],
            "Produk {$product->name} berhasil ditambahkan.",
            201
        );
    }

    /**
     * GET /api/v1/master/products/{product}
     */
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'activeRecipe.items.ingredient'])->loadCount('recipes');

        return $this->success(
            ['product' => new ProductResource($product)],
            'Detail produk berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/master/products/{product}
     */
    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        $data = $request->safe()->except(['image', 'current_stock']);

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        $product->update($data);

        ActivityLog::record(
            'produk_diperbarui',
            "Memperbarui produk: {$product->name}",
            $request->user(), $product, $request
        );

        return $this->success(
            ['product' => new ProductResource(
                $product->fresh()->load(['category', 'activeRecipe.items.ingredient'])
            )],
            "Produk {$product->name} berhasil diperbarui."
        );
    }

    /**
     * DELETE /api/v1/master/products/{product}
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        if ((float) $product->current_stock > 0) {
            return $this->error(
                'Produk ini masih memiliki stok sebanyak '
                .rtrim(rtrim(number_format((float) $product->current_stock, 2), '0'), '.')
                ." {$product->unit}. Jual atau catat pembuangannya terlebih dahulu.",
                422
            );
        }

        $jumlahResep = $product->recipes()->count();

        if ($jumlahResep > 0) {
            return $this->error(
                "Produk ini memiliki {$jumlahResep} resep. Hapus resepnya terlebih dahulu, "
                .'atau nonaktifkan produk ini agar tidak muncul di menu penjualan.',
                422
            );
        }

        $nama = $product->name;

        ActivityLog::record(
            'produk_dihapus',
            "Menghapus produk: {$nama}",
            $request->user(), $product, $request
        );

        $product->delete();

        return $this->success(null, "Produk {$nama} berhasil dihapus.");
    }
}
