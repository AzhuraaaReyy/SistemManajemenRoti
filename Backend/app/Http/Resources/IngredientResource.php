<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Ingredient
 */
class IngredientResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->stockStatus();

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,

            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category?->name),

            'default_supplier_id' => $this->default_supplier_id,
            'default_supplier_name' => $this->whenLoaded('defaultSupplier', fn () => $this->defaultSupplier?->name),

            // Satuan — `unit` adalah satu-satunya nilai yang dipakai form.
            // Tiga kolom teknis di bawahnya ikut dikirim untuk keperluan
            // perhitungan, bukan untuk ditampilkan sebagai isian.
            'unit' => $this->unitPreset()->value,
            'unit_label' => $this->unitPreset()->label(),
            'unit_symbol' => $this->unitPreset()->symbol(),
            'recipe_units' => $this->unitPreset()->recipeUnits(),
            'base_unit' => $this->base_unit->value,
            'display_unit' => $this->display_unit,
            'conversion_factor' => (float) $this->conversion_factor,

            // Stok — dikirim dalam dua satuan sekaligus agar frontend tidak
            // perlu menghitung ulang dan berisiko memakai faktor yang salah.
            'current_stock' => (float) $this->current_stock,
            'current_stock_display' => round($this->toDisplayUnit((float) $this->current_stock), 4),
            'min_stock' => (float) $this->min_stock,
            'min_stock_display' => round($this->toDisplayUnit((float) $this->min_stock), 4),

            'stock_status' => $status->value,
            'stock_status_label' => $status->label(),
            'stock_status_tone' => $status->tone(),

            // avg_cost disimpan per satuan dasar (per gram); yang ditampilkan
            // adalah harga per satuan pilihan pengguna (per kg).
            'avg_cost' => (float) $this->avg_cost,
            'avg_cost_display' => round((float) $this->avg_cost * (float) $this->conversion_factor, 2),
            'stock_value' => round($this->stockValue(), 2),

            'shelf_life_days' => $this->shelf_life_days,
            'notes' => $this->notes,
            'is_active' => $this->is_active,

            'used_in_recipes' => $this->when(
                isset($this->recipe_items_count),
                fn () => (int) $this->recipe_items_count,
            ),

            'suppliers' => SupplierBriefResource::collection($this->whenLoaded('suppliers')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
