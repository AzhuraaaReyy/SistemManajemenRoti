<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Category
 */
class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_active' => $this->is_active,

            // Berapa produk / bahan yang memakai kategori ini. Ditampilkan di
            // tabel agar pengguna tahu dampaknya sebelum menghapus.
            'usage_count' => $this->when(
                isset($this->products_count) || isset($this->ingredients_count),
                fn () => (int) ($this->products_count ?? $this->ingredients_count ?? 0),
            ),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
