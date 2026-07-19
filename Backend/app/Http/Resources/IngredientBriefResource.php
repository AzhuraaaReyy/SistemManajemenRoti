<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk ringkas bahan baku.
 *
 * Dipakai saat bahan muncul sebagai relasi di dalam entitas lain (daftar
 * pasokan supplier, pilihan pada form resep). Memuat versi lengkapnya di sana
 * hanya akan membengkakkan respons tanpa dipakai.
 *
 * @mixin \App\Models\Ingredient
 */
class IngredientBriefResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'base_unit' => $this->base_unit->value,
            'display_unit' => $this->display_unit,
            'conversion_factor' => (float) $this->conversion_factor,
            'current_stock' => (float) $this->current_stock,
            'avg_cost' => (float) $this->avg_cost,
            'is_active' => $this->is_active,
        ];
    }
}
