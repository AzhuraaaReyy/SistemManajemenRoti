<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReceiptItem extends Model
{
    protected $fillable = [
        'purchase_receipt_id',
        'purchase_order_item_id',
        'ingredient_id',
        'quantity',
        'unit_price',
        'expiry_date',
        'batch_number',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:6',
            'expiry_date' => 'date',
        ];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class, 'purchase_order_item_id');
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function subtotal(): float
    {
        return round((float) $this->quantity * (float) $this->unit_price, 2);
    }
}
