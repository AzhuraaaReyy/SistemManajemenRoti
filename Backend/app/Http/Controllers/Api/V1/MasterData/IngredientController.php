<?php

namespace App\Http\Controllers\Api\V1\MasterData;

use App\Enums\UnitPreset;
use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\IngredientRequest;
use App\Http\Resources\IngredientResource;
use App\Models\ActivityLog;
use App\Models\Ingredient;
use App\Services\StockService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class IngredientController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly StockService $stock)
    {
    }

    /**
     * GET /api/v1/master/ingredients
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'stock_status' => ['nullable', Rule::in(\App\Enums\StockStatus::values())],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'sort_by' => ['nullable', Rule::in(['name', 'code', 'current_stock', 'avg_cost', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $ingredients = Ingredient::query()
            ->with(['category:id,name', 'defaultSupplier:id,name'])
            ->withCount('recipeItems')
            ->search($filters['search'] ?? null)
            ->stockStatus($filters['stock_status'] ?? null)
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when($filters['supplier_id'] ?? null, fn ($q, $id) => $q->where('default_supplier_id', $id))
            ->when(isset($filters['status']), fn ($q) => $q->where('is_active', $filters['status'] === 'aktif'))
            ->orderBy($filters['sort_by'] ?? 'name', $filters['sort_dir'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $ingredients,
            IngredientResource::collection($ingredients->items()),
            'Daftar bahan baku berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/master/ingredients/options
     *
     * Untuk form resep — memuat satuan dan stok agar takaran bisa dikonversi
     * dan kecukupan bahan langsung terlihat tanpa permintaan tambahan.
     */
    public function options(): JsonResponse
    {
        $ingredients = Ingredient::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'base_unit', 'display_unit', 'conversion_factor', 'current_stock', 'avg_cost']);

        return $this->success(
            $ingredients->map(fn (Ingredient $i) => [
                'value' => $i->id,
                'label' => $i->name,
                'code' => $i->code,
                'base_unit' => $i->base_unit->value,
                'display_unit' => $i->display_unit,
                'conversion_factor' => (float) $i->conversion_factor,
                'current_stock' => (float) $i->current_stock,
                'avg_cost' => (float) $i->avg_cost,
                // Satuan yang boleh dipakai menulis takaran bahan ini di resep,
                // misal gram atau kilogram untuk tepung, hanya butir untuk telur.
                'recipe_units' => $i->unitPreset()->recipeUnits(),
            ]),
            'Pilihan bahan baku berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/master/ingredients/units
     *
     * Daftar satuan siap pakai untuk mengisi satu-satunya dropdown satuan di
     * form. Setiap entri sudah membawa satuan dasar dan faktor konversinya,
     * sehingga pengguna tidak pernah perlu menghafal bahwa 1 sak = 25.000 gram.
     */
    public function units(): JsonResponse
    {
        return $this->success(UnitPreset::options(), 'Daftar satuan berhasil diambil.');
    }

    /**
     * GET /api/v1/master/ingredients/{ingredient}/ledger
     *
     * Riwayat pergerakan stok bahan ini. Sekaligus melaporkan apakah cache
     * stok masih cocok dengan jumlah seluruh baris ledger.
     */
    public function ledger(Request $request, Ingredient $ingredient): JsonResponse
    {
        $filters = $request->validate([
            'source_type' => ['nullable', 'string', 'max:40'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $rows = $ingredient->stockLedgers()
            ->ofSource($filters['source_type'] ?? null)
            ->with('user:id,name')
            ->paginate($filters['per_page'] ?? 10);

        return $this->paginated(
            $rows,
            collect($rows->items())->map(fn ($row) => [
                'id' => $row->id,
                'direction' => $row->direction,
                'quantity' => (float) $row->quantity,
                'quantity_display' => round($ingredient->toDisplayUnit((float) $row->quantity), 4),
                'delta' => (float) $row->delta,
                'balance_before' => (float) $row->balance_before,
                'balance_after' => (float) $row->balance_after,
                'source_type' => $row->source_type->value,
                'source_label' => $row->source_type->label(),
                'source_id' => $row->source_id,
                'unit_cost' => $row->unit_cost !== null ? (float) $row->unit_cost : null,
                'note' => $row->note,
                'user_name' => $row->user?->name,
                'created_at' => $row->created_at->toIso8601String(),
            ]),
            'Riwayat stok berhasil diambil.'
        )->withHeaders([
            'X-Stock-Consistent' => $ingredient->verifyStock()['consistent'] ? 'true' : 'false',
        ]);
    }

    /**
     * GET /api/v1/master/ingredients/statistics
     */
    public function statistics(): JsonResponse
    {
        $semua = Ingredient::query()->where('is_active', true)->get(['current_stock', 'min_stock', 'avg_cost']);

        $hitung = ['habis' => 0, 'kritis' => 0, 'menipis' => 0, 'aman' => 0, 'berlebih' => 0];

        foreach ($semua as $bahan) {
            $hitung[$bahan->stockStatus()->value]++;
        }

        return $this->success([
            'total' => Ingredient::count(),
            'aktif' => $semua->count(),
            'nilai_persediaan' => round($semua->sum(fn ($b) => (float) $b->current_stock * (float) $b->avg_cost), 2),
            'per_status' => $hitung,
            'perlu_perhatian' => $hitung['habis'] + $hitung['kritis'] + $hitung['menipis'],
        ], 'Statistik bahan baku berhasil diambil.');
    }

    /**
     * POST /api/v1/master/ingredients
     */
    public function store(IngredientRequest $request): JsonResponse
    {
        $preset = $request->unitPreset();

        $ingredient = DB::transaction(function () use ($request, $preset) {
            $ingredient = new Ingredient([
                ...$request->safe()->except(['supplier_ids', 'unit', 'min_stock', 'avg_cost', 'opening_stock']),
                'is_active' => $request->boolean('is_active', true),
            ]);

            // Tiga kolom teknis diturunkan dari satu pilihan satuan pengguna.
            $ingredient->applyUnitPreset($preset);

            // Angka dari form ditulis dalam satuan pilihan (misal kg);
            // disimpan dalam satuan dasar (gram).
            $ingredient->min_stock = $request->toBase('min_stock');

            // Harga diisi per satuan pilihan, disimpan per satuan dasar.
            $ingredient->avg_cost = $preset->factor() > 0
                ? (float) $request->input('avg_cost', 0) / $preset->factor()
                : 0;

            $ingredient->save();

            if ($request->filled('supplier_ids')) {
                $ingredient->suppliers()->sync($request->input('supplier_ids'));
            }

            // Stok awal dicatat sebagai baris ledger, bukan angka yang
            // langsung ditanam ke kolom. Dengan begitu setiap satuan stok di
            // sistem — termasuk yang paling awal — punya asal-usul.
            $this->stock->recordOpeningBalance(
                item: $ingredient,
                quantity: $request->toBase('opening_stock'),
                unitCost: (float) $ingredient->avg_cost,
                userId: $request->user()?->id,
            );

            return $ingredient->refresh();
        });

        ActivityLog::record(
            'bahan_dibuat',
            "Membuat bahan baku: {$ingredient->name} ({$ingredient->code})",
            $request->user(), $ingredient, $request
        );

        return $this->success(
            ['ingredient' => new IngredientResource($ingredient->load(['category', 'defaultSupplier']))],
            "Bahan baku {$ingredient->name} berhasil ditambahkan.",
            201
        );
    }

    /**
     * GET /api/v1/master/ingredients/{ingredient}
     */
    public function show(Ingredient $ingredient): JsonResponse
    {
        $ingredient->load(['category', 'defaultSupplier', 'suppliers'])->loadCount('recipeItems');

        return $this->success(
            ['ingredient' => new IngredientResource($ingredient)],
            'Detail bahan baku berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/master/ingredients/{ingredient}
     */
    public function update(IngredientRequest $request, Ingredient $ingredient): JsonResponse
    {
        $preset = $request->unitPreset();
        $presetLama = $ingredient->unitPreset();

        // Satuan dasar menentukan arti angka stok dan takaran resep yang sudah
        // tersimpan. Mengubah gram menjadi butir pada bahan berstok 45.000 akan
        // mengubah 45 kg tepung menjadi 45.000 butir tanpa ada yang menyadari.
        //
        // Berpindah antar satuan dengan dasar yang SAMA (gram ↔ kilogram)
        // tetap diizinkan — yang berubah hanya cara menampilkannya, angka
        // tersimpannya tidak bergeser sedikit pun.
        $dasarBerubah = $preset->baseUnit() !== $presetLama->baseUnit();

        if ($dasarBerubah && ((float) $ingredient->current_stock !== 0.0 || $ingredient->isUsedInRecipes())) {
            return $this->error(
                sprintf(
                    'Satuan tidak dapat diubah dari %s ke %s karena keduanya berbeda jenis '
                    .'(%s vs %s), sementara bahan ini sudah memiliki stok atau dipakai dalam resep. '
                    .'Buat data bahan baru bila satuannya memang berbeda.',
                    $presetLama->label(),
                    $preset->label(),
                    $presetLama->baseUnit()->label(),
                    $preset->baseUnit()->label(),
                ),
                422
            );
        }

        DB::transaction(function () use ($request, $ingredient, $preset) {
            $ingredient->fill($request->safe()->except(['supplier_ids', 'unit', 'min_stock', 'avg_cost']));

            $ingredient->applyUnitPreset($preset);
            $ingredient->min_stock = $request->toBase('min_stock');

            if ($request->has('avg_cost')) {
                $ingredient->avg_cost = $preset->factor() > 0
                    ? (float) $request->input('avg_cost', 0) / $preset->factor()
                    : 0;
            }

            $ingredient->save();

            if ($request->has('supplier_ids')) {
                $ingredient->suppliers()->sync($request->input('supplier_ids', []));
            }
        });

        ActivityLog::record(
            'bahan_diperbarui',
            "Memperbarui bahan baku: {$ingredient->name}",
            $request->user(), $ingredient, $request
        );

        return $this->success(
            ['ingredient' => new IngredientResource(
                $ingredient->fresh()->load(['category', 'defaultSupplier', 'suppliers'])->loadCount('recipeItems')
            )],
            "Bahan baku {$ingredient->name} berhasil diperbarui."
        );
    }

    /**
     * DELETE /api/v1/master/ingredients/{ingredient}
     */
    public function destroy(Request $request, Ingredient $ingredient): JsonResponse
    {
        $dipakai = $ingredient->recipeItems()->count();

        if ($dipakai > 0) {
            return $this->error(
                "Bahan baku ini masih dipakai dalam {$dipakai} resep. "
                .'Hapus bahan tersebut dari resepnya terlebih dahulu, '
                .'atau nonaktifkan agar tidak muncul pada resep baru.',
                422
            );
        }

        if ((float) $ingredient->current_stock > 0) {
            return $this->error(
                'Bahan baku ini masih memiliki stok sebanyak '
                .rtrim(rtrim(number_format($ingredient->toDisplayUnit((float) $ingredient->current_stock), 2), '0'), '.')
                .' '.$ingredient->display_unit.'. Habiskan atau buang stoknya melalui modul Persediaan '
                .'agar kerugian tercatat, jangan dihapus begitu saja.',
                422
            );
        }

        $nama = $ingredient->name;

        ActivityLog::record(
            'bahan_dihapus',
            "Menghapus bahan baku: {$nama}",
            $request->user(), $ingredient, $request
        );

        $ingredient->delete();

        return $this->success(null, "Bahan baku {$nama} berhasil dihapus.");
    }
}
