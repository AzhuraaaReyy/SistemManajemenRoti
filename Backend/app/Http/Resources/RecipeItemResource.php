<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\RecipeItem
 */
class RecipeItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $bahan = $this->ingredient;
        $efektif = $this->effectiveQuantity();

        return [
            'id' => $this->id,
            'ingredient_id' => $this->ingredient_id,
            'ingredient_name' => $bahan?->name,
            'ingredient_code' => $bahan?->code,

            'base_unit' => $bahan?->base_unit->value,
            'display_unit' => $bahan?->display_unit,
            'conversion_factor' => $bahan ? (float) $bahan->conversion_factor : 1.0,

            // Takaran dikirim dalam dua satuan: dasar untuk perhitungan,
            // tampilan untuk dibaca manusia.
            'quantity' => (float) $this->quantity,
            'quantity_display' => $bahan
                ? round($bahan->toDisplayUnit((float) $this->quantity), 4)
                : (float) $this->quantity,

            'waste_percent' => (float) $this->waste_percent,

            // Takaran termasuk susut — inilah yang benar-benar dipotong dari stok.
            'effective_quantity' => round($efektif, 4),

            'unit_cost' => $bahan ? (float) $bahan->avg_cost : 0.0,
            'line_cost' => round($this->cost(), 2),

            'available_stock' => $bahan ? (float) $bahan->current_stock : 0.0,
            'sufficient' => $bahan ? (float) $bahan->current_stock >= $efektif : false,

            'note' => $this->note,
            'sort_order' => $this->sort_order,
        ];
    }
}
