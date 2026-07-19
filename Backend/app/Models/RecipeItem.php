<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeItem extends Model
{
    protected $fillable = [
        'recipe_id',
        'ingredient_id',
        'quantity',
        'waste_percent',
        'note',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'waste_percent' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }

    /** Takaran termasuk susut — inilah yang benar-benar dipotong dari stok. */
    public function effectiveQuantity(): float
    {
        return (float) $this->quantity * (1 + (float) $this->waste_percent / 100);
    }

    /** Biaya baris ini menurut harga rata-rata bahan saat ini. */
    public function cost(): float
    {
        return $this->effectiveQuantity() * (float) ($this->ingredient?->avg_cost ?? 0);
    }
}
