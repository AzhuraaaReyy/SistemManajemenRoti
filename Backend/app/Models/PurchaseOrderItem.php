<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id',
        'ingredient_id',
        'order_unit',
        'unit_factor',
        'qty_ordered',
        'qty_received',
        'unit_price',
        'discount_amount',
        'line_total',
        'note',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'unit_factor' => 'decimal:4',
            'qty_ordered' => 'decimal:4',
            'qty_received' => 'decimal:4',
            'unit_price' => 'decimal:6',
            'discount_amount' => 'decimal:2',
            'line_total' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function receiptItems(): HasMany
    {
        return $this->hasMany(PurchaseReceiptItem::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Konversi ke satuan pesan
    |--------------------------------------------------------------------------
    |
    | Memakai unit_factor yang dibekukan di baris ini, bukan faktor terkini
    | dari master bahan. Dokumen lama harus tetap terbaca sama.
    */

    public function qtyOrderedDisplay(): float
    {
        $f = (float) $this->unit_factor;

        return $f > 0 ? round((float) $this->qty_ordered / $f, 4) : (float) $this->qty_ordered;
    }

    public function qtyReceivedDisplay(): float
    {
        $f = (float) $this->unit_factor;

        return $f > 0 ? round((float) $this->qty_received / $f, 4) : (float) $this->qty_received;
    }

    /** Sisa yang belum diterima, dalam satuan dasar. */
    public function qtyOutstanding(): float
    {
        return max(0, (float) $this->qty_ordered - (float) $this->qty_received);
    }

    public function qtyOutstandingDisplay(): float
    {
        $f = (float) $this->unit_factor;

        return $f > 0 ? round($this->qtyOutstanding() / $f, 4) : $this->qtyOutstanding();
    }

    /** Harga per satuan pesan (per kg), bukan per satuan dasar (per gram). */
    public function unitPriceDisplay(): float
    {
        return round((float) $this->unit_price * (float) $this->unit_factor, 2);
    }

    public function isFullyReceived(): bool
    {
        return (float) $this->qty_received >= (float) $this->qty_ordered;
    }
}
