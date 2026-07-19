<?php

namespace App\Services;

use App\Exceptions\RecipeLockedException;
use App\Models\Recipe;
use Illuminate\Support\Facades\DB;

/**
 * Aturan versi resep, terkumpul di satu tempat.
 *
 * Modul Produksi (M5) nanti hanya perlu memanggil resolveForProduction() dan
 * markAsUsed() — tanpa perlu tahu seluk-beluk versioning. Menaruh aturan ini
 * di controller akan membuat M5 menyalinnya, lalu keduanya berbeda pelan-pelan.
 *
 * Tiga aturan yang dijaga:
 *
 *   1. Satu produk hanya boleh punya SATU versi aktif.
 *   2. Versi yang sudah dipakai produksi TIDAK BOLEH diubah selamanya.
 *   3. Versi yang sudah diarsipkan tidak boleh diubah — itu catatan sejarah.
 */
class RecipeService
{
    /**
     * Membuat versi baru untuk sebuah produk.
     *
     * Nomor versi diambil dari yang tertinggi yang pernah ada, termasuk yang
     * sudah dihapus, supaya nomor tidak pernah dipakai ulang.
     */
    public function nextVersionNumber(int $productId): int
    {
        return (int) (Recipe::withTrashed()->where('product_id', $productId)->max('version') ?? 0) + 1;
    }

    /**
     * Menetapkan satu versi sebagai yang aktif dan menonaktifkan sisanya.
     *
     * Dijalankan dalam satu transaksi agar tidak pernah ada momen di mana
     * sebuah produk punya dua resep aktif — atau tidak punya sama sekali.
     */
    public function makeActive(Recipe $recipe): Recipe
    {
        return DB::transaction(function () use ($recipe) {
            Recipe::where('product_id', $recipe->product_id)
                ->where('id', '!=', $recipe->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $recipe->update(['is_active' => true]);

            return $recipe->fresh();
        });
    }

    /**
     * Menyalin resep menjadi versi baru yang langsung aktif.
     *
     * Versi lama tetap tersimpan lengkap dengan barisnya, sehingga batch
     * produksi yang merujuk ke sana tetap punya rujukan yang utuh.
     */
    public function createNewVersion(Recipe $sumber, ?int $userId = null): Recipe
    {
        return DB::transaction(function () use ($sumber, $userId) {
            $sumber->loadMissing('items');

            $baru = Recipe::create([
                'product_id' => $sumber->product_id,
                'version' => $this->nextVersionNumber($sumber->product_id),
                'name' => $sumber->name,
                'yield_quantity' => $sumber->yield_quantity,
                'yield_unit' => $sumber->yield_unit,
                'description' => $sumber->description,
                'instructions' => $sumber->instructions,
                'is_active' => false, // Diaktifkan lewat makeActive() di bawah.
            ]);

            foreach ($sumber->items as $item) {
                $baru->items()->create([
                    'ingredient_id' => $item->ingredient_id,
                    'quantity' => $item->quantity,
                    'waste_percent' => $item->waste_percent,
                    'note' => $item->note,
                    'sort_order' => $item->sort_order,
                ]);
            }

            $this->makeActive($baru);

            return $baru->fresh();
        });
    }

    /**
     * Menandai versi resep sebagai sudah dipakai produksi.
     *
     * DIPANGGIL MODUL PRODUKSI (M5) setiap kali batch dijalankan. Setelah ini,
     * versi tersebut terkunci permanen.
     */
    public function markAsUsedInProduction(Recipe $recipe, string $batchReference): void
    {
        DB::transaction(function () use ($recipe, $batchReference) {
            $terkunci = Recipe::lockForUpdate()->findOrFail($recipe->id);

            $terkunci->increment('production_count');

            if ($terkunci->locked_at === null) {
                $terkunci->update([
                    'locked_at' => now(),
                    'lock_reason' => "Sudah dipakai produksi batch {$batchReference}",
                ]);
            }
        });
    }

    /**
     * Mengambil resep yang berlaku untuk memproduksi sebuah produk.
     *
     * @throws \RuntimeException bila produk belum punya resep aktif
     */
    public function resolveForProduction(int $productId): Recipe
    {
        $recipe = Recipe::with('items.ingredient')
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->first();

        if (! $recipe) {
            throw new \RuntimeException(
                'Produk ini belum memiliki resep aktif, jadi belum bisa diproduksi. '
                .'Susun resepnya terlebih dahulu di menu Master Data → Resep.'
            );
        }

        if ($recipe->items->isEmpty()) {
            throw new \RuntimeException(
                "Resep aktif produk ini ({$recipe->name} versi {$recipe->version}) tidak memiliki "
                .'satu pun bahan. Lengkapi resepnya terlebih dahulu.'
            );
        }

        return $recipe;
    }

    /**
     * Memastikan sebuah resep boleh disunting; melempar bila tidak.
     *
     * @throws RecipeLockedException
     */
    public function assertEditable(Recipe $recipe): void
    {
        if ($recipe->locked_at !== null) {
            throw new RecipeLockedException(
                recipeName: $recipe->name,
                version: $recipe->version,
                reason: 'sudah dipakai dalam '.$recipe->production_count.' batch produksi',
            );
        }

        if (! $recipe->is_active) {
            throw new RecipeLockedException(
                recipeName: $recipe->name,
                version: $recipe->version,
                reason: 'sudah diarsipkan sebagai versi lama',
            );
        }
    }
}
