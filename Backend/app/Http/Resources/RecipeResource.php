<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Recipe
 */
class RecipeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $itemsDimuat = $this->relationLoaded('items');

        $totalBiaya = $itemsDimuat ? $this->totalCost() : null;
        $biayaSatuan = $itemsDimuat ? $this->costPerUnit() : null;
        $kapasitas = $itemsDimuat ? $this->maxProducible() : null;

        $hargaJual = (float) ($this->product?->selling_price ?? 0);

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->whenLoaded('product', fn () => $this->product?->name),
            'product_code' => $this->whenLoaded('product', fn () => $this->product?->code),

            'version' => $this->version,
            'name' => $this->name,

            'yield_quantity' => (float) $this->yield_quantity,
            'yield_unit' => $this->yield_unit,

            'description' => $this->description,
            'instructions' => $this->instructions,
            'is_active' => $this->is_active,

            // Status penguncian — frontend memakainya untuk menonaktifkan
            // tombol Ubah dan menyarankan "Buat Versi Baru" sebagai gantinya.
            'is_locked' => $this->isLocked(),
            'lock_label' => $this->lockLabel(),
            'locked_at' => $this->locked_at?->toIso8601String(),
            'production_count' => (int) ($this->production_count ?? 0),

            'items_count' => $this->when(
                isset($this->items_count),
                fn () => (int) $this->items_count,
            ),

            'items' => RecipeItemResource::collection($this->whenLoaded('items')),

            // Ringkasan biaya — hanya terisi bila daftar bahan sudah dimuat.
            'total_cost' => $totalBiaya !== null ? round($totalBiaya, 2) : null,
            'cost_per_unit' => $biayaSatuan !== null ? round($biayaSatuan, 2) : null,
            'selling_price' => $hargaJual > 0 ? $hargaJual : null,
            'margin_per_unit' => $biayaSatuan !== null && $hargaJual > 0
                ? round($hargaJual - $biayaSatuan, 2)
                : null,
            'margin_percent' => $biayaSatuan !== null && $hargaJual > 0 && $biayaSatuan > 0
                ? round((($hargaJual - $biayaSatuan) / $hargaJual) * 100, 2)
                : null,

            // Kapasitas produksi berdasarkan stok bahan saat ini.
            'max_producible' => $kapasitas['quantity'] ?? null,
            'limiting_ingredient' => $kapasitas['limiting_ingredient'] ?? null,

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
