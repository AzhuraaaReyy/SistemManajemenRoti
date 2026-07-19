<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\SaleStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sale extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sale_number',
        'cashier_id',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'tax_percent',
        'tax_amount',
        'total',
        'payment_method',
        'paid_amount',
        'change_amount',
        'cost_total',
        'status',
        'customer_name',
        'notes',
        'voided_at',
        'voided_by',
        'void_reason',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'cost_total' => 'decimal:2',
            'payment_method' => PaymentMethod::class,
            'status' => SaleStatus::class,
            'voided_at' => 'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Penomoran
    |--------------------------------------------------------------------------
    */

    /**
     * Nomor bernomor per tahun: TRX-2026-0001.
     *
     * Nomor tertinggi dicari termasuk baris yang sudah dihapus lunak, supaya
     * nomor struk tidak pernah dipakai dua kali — struk yang sudah tercetak
     * dan dipegang pelanggan tidak bisa ditarik kembali.
     */
    public static function generateNumber(): string
    {
        $prefix = 'TRX-'.now()->year.'-';

        $terakhir = static::withTrashed()
            ->where('sale_number', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(sale_number, ?) AS UNSIGNED) DESC', [strlen($prefix) + 1])
            ->value('sale_number');

        $nomor = $terakhir ? ((int) substr($terakhir, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $nomor, 4, '0', STR_PAD_LEFT);
    }

    /*
    |--------------------------------------------------------------------------
    | Relasi
    |--------------------------------------------------------------------------
    */

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    /*
    |--------------------------------------------------------------------------
    | Turunan
    |--------------------------------------------------------------------------
    */

    /** Laba kotor = total sebelum pajak dikurangi harga pokok. */
    public function grossProfit(): float
    {
        return round(($this->total - $this->tax_amount) - $this->cost_total, 2);
    }

    public function grossMarginPercent(): ?float
    {
        $penjualan = (float) $this->total - (float) $this->tax_amount;

        if ($penjualan <= 0) {
            return null;
        }

        return round(($this->grossProfit() / $penjualan) * 100, 2);
    }

    public function totalQuantity(): float
    {
        return (float) $this->items->sum('quantity');
    }

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    /** Hanya transaksi yang masuk hitungan omzet. */
    public function scopeRevenue(Builder $query): Builder
    {
        return $query->where('status', SaleStatus::COMPLETED->value);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('sale_number', 'like', "%{$term}%")
                ->orWhere('customer_name', 'like', "%{$term}%")
                ->orWhere('notes', 'like', "%{$term}%");
        });
    }

    public function scopeBetweenDates(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($to, fn (Builder $q, $v) => $q->whereDate('created_at', '<=', $v));
    }
}
