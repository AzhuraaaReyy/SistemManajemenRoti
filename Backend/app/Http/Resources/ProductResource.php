<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->stockStatus();

        // Dihitung hanya bila relasi resep memang sudah dimuat, agar daftar
        // produk tidak memicu query tambahan per baris (N+1).
        $adaResep = $this->relationLoaded('activeRecipe') && $this->activeRecipe !== null;
        $hpp = $adaResep ? $this->activeRecipe->costPerUnit() : null;
        $harga = (float) $this->selling_price;

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,

            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category?->name),

            'unit' => $this->unit,
            'selling_price' => $harga,

            'current_stock' => (float) $this->current_stock,
            'min_stock' => (float) $this->min_stock,
            'stock_status' => $status->value,
            'stock_status_label' => $status->label(),
            'stock_status_tone' => $status->tone(),

            'description' => $this->description,
            'image_url' => $this->image ? asset('storage/'.$this->image) : null,
            'is_active' => $this->is_active,

            // Informasi resep
            'has_recipe' => $adaResep,
            'recipe_id' => $adaResep ? $this->activeRecipe->id : null,
            'recipe_version' => $adaResep ? $this->activeRecipe->version : null,
            'unit_cost' => $hpp !== null ? round($hpp, 2) : null,
            'margin' => $hpp !== null && $harga > 0 ? round($harga - $hpp, 2) : null,
            'margin_percent' => $hpp !== null && $harga > 0 && $hpp > 0
                ? round((($harga - $hpp) / $harga) * 100, 2)
                : null,

            'recipes_count' => $this->when(
                isset($this->recipes_count),
                fn () => (int) $this->recipes_count,
            ),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
