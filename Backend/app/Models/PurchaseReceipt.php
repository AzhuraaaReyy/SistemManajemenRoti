<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseReceipt extends Model
{
    protected $fillable = [
        'receipt_number',
        'purchase_order_id',
        'receipt_date',
        'delivery_note_number',
        'notes',
        'received_by',
    ];

    protected function casts(): array
    {
        return [
            'receipt_date' => 'date',
        ];
    }

    /** Nomor bernomor per tahun: TRM-2026-0001. */
    public static function generateNumber(?int $year = null): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "TRM-{$year}-";

        $terakhir = self::where('receipt_number', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(receipt_number, ?) AS UNSIGNED) DESC', [strlen($prefix) + 1])
            ->value('receipt_number');

        $nomor = $terakhir ? ((int) substr($terakhir, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $nomor, 4, '0', STR_PAD_LEFT);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseReceiptItem::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /** Nilai barang yang diterima pada kesempatan ini. */
    public function totalValue(): float
    {
        return $this->items->sum(
            fn (PurchaseReceiptItem $i) => (float) $i->quantity * (float) $i->unit_price
        );
    }
}
