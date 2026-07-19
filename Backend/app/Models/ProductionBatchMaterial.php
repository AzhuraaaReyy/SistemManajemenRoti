<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionBatchMaterial extends Model
{
    protected $fillable = [
        'production_batch_id',
        'ingredient_id',
        'qty_per_unit',
        'qty_required',
        'qty_used',
        'waste_percent',
        'unit_cost',
        'line_cost',
        'stock_before',
        'note',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'qty_per_unit' => 'decimal:6',
            'qty_required' => 'decimal:4',
            'qty_used' => 'decimal:4',
            'waste_percent' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'line_cost' => 'decimal:2',
            'stock_before' => 'decimal:4',
            'sort_order' => 'integer',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductionBatch::class, 'production_batch_id');
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }

    /** Sisa stok bahan setelah dipotong batch ini. */
    public function stockAfter(): float
    {
        return (float) $this->stock_before - (float) $this->qty_used;
    }
}
