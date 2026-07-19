<?php

namespace App\Http\Controllers\Api\V1\MasterData;

use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\RecipeRequest;
use App\Http\Resources\RecipeResource;
use App\Models\ActivityLog;
use App\Models\Recipe;
use App\Services\RecipeService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RecipeController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RecipeService $recipes)
    {
    }

    /**
     * GET /api/v1/master/recipes
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'product_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'sort_by' => ['nullable', Rule::in(['name', 'version', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $recipes = Recipe::query()
            ->with(['product:id,name,code,selling_price', 'items.ingredient:id,name,code,avg_cost,current_stock,base_unit,display_unit,conversion_factor'])
            ->withCount('items')
            ->search($filters['search'] ?? null)
            ->when($filters['product_id'] ?? null, fn ($q, $id) => $q->where('product_id', $id))
            ->when(isset($filters['status']), fn ($q) => $q->where('is_active', $filters['status'] === 'aktif'))
            ->orderBy($filters['sort_by'] ?? 'created_at', $filters['sort_dir'] ?? 'desc')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $recipes,
            RecipeResource::collection($recipes->items()),
            'Daftar resep berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/master/recipes
     */
    public function store(RecipeRequest $request): JsonResponse
    {
        $recipe = DB::transaction(function () use ($request) {
            $productId = $request->integer('product_id');
            $aktif = $request->boolean('is_active', true);

            // Versi selalu naik, tidak pernah menimpa. Resep lama tetap ada
            // karena batch produksi yang sudah berjalan merujuk ke versinya.
            $recipe = Recipe::create([
                'product_id' => $productId,
                'version' => $this->recipes->nextVersionNumber($productId),
                'name' => $request->input('name'),
                'yield_quantity' => $request->input('yield_quantity'),
                'yield_unit' => $request->input('yield_unit', 'pcs'),
                'description' => $request->input('description'),
                'instructions' => $request->input('instructions'),
                'is_active' => false,
            ]);

            $this->simpanItems($recipe, $request->input('items', []));

            if ($aktif) {
                $this->recipes->makeActive($recipe);
            }

            return $recipe->refresh();
        });

        ActivityLog::record(
            'resep_dibuat',
            "Membuat resep: {$recipe->name} (versi {$recipe->version})",
            $request->user(), $recipe, $request
        );

        return $this->success(
            ['recipe' => new RecipeResource($this->muatLengkap($recipe))],
            "Resep {$recipe->name} versi {$recipe->version} berhasil dibuat.",
            201
        );
    }

    /**
     * GET /api/v1/master/recipes/{recipe}
     */
    public function show(Recipe $recipe): JsonResponse
    {
        return $this->success(
            ['recipe' => new RecipeResource($this->muatLengkap($recipe))],
            'Detail resep berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/master/recipes/{recipe}
     *
     * Memperbarui resep di tempat. Untuk perubahan takaran yang memengaruhi
     * perhitungan HPP, buat versi baru lewat endpoint /new-version agar
     * riwayat produksi lama tidak ikut berubah.
     */
    public function update(RecipeRequest $request, Recipe $recipe): JsonResponse
    {
        if ($request->integer('product_id') !== $recipe->product_id) {
            return $this->error(
                'Produk pada resep tidak dapat dipindahkan. Buat resep baru untuk produk yang dituju.',
                422
            );
        }

        // Versi yang sudah dipakai produksi, atau yang sudah diarsipkan,
        // permanen. Mengubahnya akan menggeser HPP produksi yang sudah
        // dilaporkan — melempar RecipeLockedException dengan saran jalan keluar.
        $this->recipes->assertEditable($recipe);

        DB::transaction(function () use ($request, $recipe) {
            $recipe->update([
                'name' => $request->input('name'),
                'yield_quantity' => $request->input('yield_quantity'),
                'yield_unit' => $request->input('yield_unit', 'pcs'),
                'description' => $request->input('description'),
                'instructions' => $request->input('instructions'),
            ]);

            // Baris lama dihapus lalu ditulis ulang. Aman dilakukan karena
            // assertEditable() di atas menjamin belum ada batch produksi yang
            // merujuk ke versi ini.
            $recipe->items()->delete();
            $this->simpanItems($recipe, $request->input('items', []));
        });

        ActivityLog::record(
            'resep_diperbarui',
            "Memperbarui resep: {$recipe->name} (versi {$recipe->version})",
            $request->user(), $recipe, $request
        );

        return $this->success(
            ['recipe' => new RecipeResource($this->muatLengkap($recipe->fresh()))],
            "Resep {$recipe->name} berhasil diperbarui."
        );
    }

    /**
     * POST /api/v1/master/recipes/{recipe}/new-version
     *
     * Menyalin resep menjadi versi baru yang langsung aktif. Versi lama
     * dinonaktifkan tetapi tetap tersimpan.
     */
    public function newVersion(Request $request, Recipe $recipe): JsonResponse
    {
        $baru = $this->recipes->createNewVersion($recipe, $request->user()?->id);

        ActivityLog::record(
            'resep_versi_baru',
            "Membuat versi {$baru->version} dari resep {$baru->name}",
            $request->user(), $baru, $request
        );

        return $this->success(
            ['recipe' => new RecipeResource($this->muatLengkap($baru))],
            "Versi {$baru->version} berhasil dibuat dan kini menjadi resep aktif.",
            201
        );
    }

    /**
     * PATCH /api/v1/master/recipes/{recipe}/activate
     */
    public function activate(Request $request, Recipe $recipe): JsonResponse
    {
        if ($recipe->is_active) {
            return $this->error('Resep ini memang sudah menjadi versi aktif.', 422);
        }

        if ($recipe->items()->count() === 0) {
            return $this->error(
                'Resep ini tidak memiliki satu pun bahan, jadi tidak dapat diaktifkan. '
                .'Produk akan gagal diproduksi bila resep kosong dijadikan acuan.',
                422
            );
        }

        $this->recipes->makeActive($recipe);

        ActivityLog::record(
            'resep_diaktifkan',
            "Mengaktifkan resep {$recipe->name} versi {$recipe->version}",
            $request->user(), $recipe, $request
        );

        return $this->success(
            ['recipe' => new RecipeResource($this->muatLengkap($recipe->fresh()))],
            "Versi {$recipe->version} kini menjadi resep aktif."
        );
    }

    /**
     * POST /api/v1/master/recipes/{recipe}/simulate
     *
     * "Kalau saya produksi N buah, bahan apa saja yang dibutuhkan dan cukup
     * atau tidak?" — algoritma A3 pada §3.3 DOKUMEN-PERANCANGAN.md.
     */
    public function simulate(Request $request, Recipe $recipe): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'min:0.01', 'max:1000000'],
        ]);

        $recipe = $this->muatLengkap($recipe);
        $kebutuhan = $recipe->explode((float) $data['quantity']);
        $kurang = array_values(array_filter($kebutuhan, fn ($k) => ! $k['sufficient']));

        return $this->success([
            'quantity' => (float) $data['quantity'],
            'yield_quantity' => (float) $recipe->yield_quantity,
            'factor' => round((float) $data['quantity'] / (float) $recipe->yield_quantity, 4),
            'can_produce' => $kurang === [],
            'requirements' => $kebutuhan,
            'shortages' => $kurang,
            'estimated_cost' => round($recipe->costPerUnit() * (float) $data['quantity'], 2),
        ], $kurang === []
            ? 'Bahan mencukupi untuk jumlah produksi ini.'
            : 'Terdapat '.count($kurang).' bahan yang tidak mencukupi.');
    }

    /**
     * DELETE /api/v1/master/recipes/{recipe}
     */
    public function destroy(Request $request, Recipe $recipe): JsonResponse
    {
        // Versi yang sudah dipakai produksi tidak boleh hilang. Batch yang
        // merujuk ke sana akan kehilangan dasar perhitungan HPP-nya, dan
        // laporan laba periode itu menjadi tidak dapat dipertanggungjawabkan.
        if ($recipe->locked_at !== null) {
            return $this->error(
                sprintf(
                    'Resep "%s" versi %d tidak dapat dihapus karena sudah dipakai dalam %d batch '
                    .'produksi. Riwayat produksi tersebut membutuhkannya sebagai dasar perhitungan HPP. '
                    .'Nonaktifkan saja bila sudah tidak dipakai lagi.',
                    $recipe->name,
                    $recipe->version,
                    $recipe->production_count,
                ),
                422
            );
        }

        // Menghapus satu-satunya resep aktif membuat produk tidak bisa
        // diproduksi sama sekali — beri tahu, jangan biarkan diam-diam.
        if ($recipe->is_active) {
            $adaVersiLain = Recipe::where('product_id', $recipe->product_id)
                ->where('id', '!=', $recipe->id)
                ->exists();

            if (! $adaVersiLain) {
                return $this->error(
                    'Ini satu-satunya resep untuk produk tersebut. Menghapusnya membuat produk '
                    .'tidak dapat diproduksi. Nonaktifkan produknya bila memang sudah tidak dijual.',
                    422
                );
            }
        }

        $nama = $recipe->name;
        $versi = $recipe->version;

        ActivityLog::record(
            'resep_dihapus',
            "Menghapus resep: {$nama} versi {$versi}",
            $request->user(), $recipe, $request
        );

        $recipe->delete();

        return $this->success(null, "Resep {$nama} versi {$versi} berhasil dihapus.");
    }

    /*
    |--------------------------------------------------------------------------
    | Pembantu
    |--------------------------------------------------------------------------
    */

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function simpanItems(Recipe $recipe, array $items): void
    {
        foreach (array_values($items) as $urutan => $item) {
            $recipe->items()->create([
                'ingredient_id' => $item['ingredient_id'],
                'quantity' => $item['quantity'],
                'waste_percent' => $item['waste_percent'] ?? 0,
                'note' => $item['note'] ?? null,
                'sort_order' => $urutan,
            ]);
        }
    }

    private function muatLengkap(Recipe $recipe): Recipe
    {
        return $recipe->load([
            'product:id,name,code,selling_price,unit',
            'items.ingredient',
        ])->loadCount('items');
    }
}
