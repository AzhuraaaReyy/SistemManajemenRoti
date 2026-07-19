<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'product_id',
        'product_name',
        'product_code',
        'unit',
        'unit_price',
        'quantity',
        'line_total',
        'unit_cost',
        'line_cost',
        'cost_source',
        'stock_before',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'quantity' => 'decimal:4',
            'line_total' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'line_cost' => 'decimal:2',
            'stock_before' => 'decimal:4',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /** Bisa null bila produknya sudah dihapus — nama dan harganya tetap tersimpan. */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function grossProfit(): float
    {
        return round((float) $this->line_total - (float) $this->line_cost, 2);
    }

    /**
     * Bolehkah laba kotor baris ini dipercaya?
     *
     * Hanya bila HPP-nya berasal dari produksi nyata. Angka dari resep adalah
     * taksiran, dan `unknown` berarti tidak ada dasar sama sekali — laba
     * kotornya terbaca sebesar seluruh nilai jual.
     */
    public function costIsReliable(): bool
    {
        return $this->cost_source === 'actual';
    }

    public function costSourceLabel(): string
    {
        return match ($this->cost_source) {
            'actual' => 'Produksi nyata',
            'recipe' => 'Taksiran resep',
            default => 'Belum diketahui',
        };
    }

    public function stockAfter(): float
    {
        return round((float) $this->stock_before - (float) $this->quantity, 4);
    }
}
