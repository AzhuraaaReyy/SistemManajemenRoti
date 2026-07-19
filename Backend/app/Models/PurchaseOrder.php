<?php

namespace App\Models;

use App\Enums\PurchaseOrderStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'po_number',
        'supplier_id',
        'order_date',
        'expected_date',
        'completed_date',
        'status',
        'subtotal',
        'discount_amount',
        'shipping_cost',
        'tax_amount',
        'total',
        'notes',
        'created_by',
        'ordered_by',
        'ordered_at',
        'cancelled_by',
        'cancelled_at',
        'cancel_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => PurchaseOrderStatus::class,
            'order_date' => 'date',
            'expected_date' => 'date',
            'completed_date' => 'date',
            'ordered_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'shipping_cost' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Penomoran
    |--------------------------------------------------------------------------
    */

    /**
     * Nomor bernomor per tahun: PO-2026-0001.
     *
     * Nomor tertinggi dicari termasuk yang sudah dihapus, supaya nomor
     * dokumen tidak pernah dipakai ulang.
     */
    public static function generateNumber(?int $year = null): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "PO-{$year}-";

        $terakhir = self::withTrashed()
            ->where('po_number', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(po_number, ?) AS UNSIGNED) DESC', [strlen($prefix) + 1])
            ->value('po_number');

        $nomor = $terakhir ? ((int) substr($terakhir, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $nomor, 4, '0', STR_PAD_LEFT);
    }

    /*
    |--------------------------------------------------------------------------
    | Relasi
    |--------------------------------------------------------------------------
    */

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class)->orderBy('sort_order');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class)->orderBy('receipt_date');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function orderer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ordered_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /*
    |--------------------------------------------------------------------------
    | Turunan
    |--------------------------------------------------------------------------
    */

    /**
     * Persentase barang yang sudah diterima, 0–100.
     *
     * Dihitung berdasarkan NILAI, bukan penjumlahan kuantitas mentah.
     *
     * Menjumlahkan kuantitas lintas satuan menghasilkan angka yang menyesatkan:
     * pesanan berisi 25.000 gram gula dan 200 butir telur, dengan telur baru
     * datang separuh, akan terlihat "99,6% selesai" — karena 100 butir telur
     * yang belum datang tenggelam di antara 25.000 gram gula. Padahal secara
     * nilai baru sekitar 70% yang diterima.
     */
    public function receivedPercent(): float
    {
        $nilaiDipesan = 0.0;
        $nilaiDiterima = 0.0;

        foreach ($this->items as $item) {
            $harga = (float) $item->unit_price;
            $nilaiDipesan += (float) $item->qty_ordered * $harga;
            $nilaiDiterima += (float) $item->qty_received * $harga;
        }

        // Bila seluruh harga nol (pesanan bantuan/sampel), jatuh kembali ke
        // rata-rata kelengkapan per baris agar angkanya tetap bermakna.
        if ($nilaiDipesan <= 0) {
            $baris = $this->items->filter(fn (PurchaseOrderItem $i) => (float) $i->qty_ordered > 0);

            if ($baris->isEmpty()) {
                return 0.0;
            }

            $rata = $baris->avg(
                fn (PurchaseOrderItem $i) => min(1, (float) $i->qty_received / (float) $i->qty_ordered)
            );

            return round($rata * 100, 2);
        }

        return round(min(100, ($nilaiDiterima / $nilaiDipesan) * 100), 2);
    }

    /** Apakah seluruh baris sudah diterima penuh? */
    public function isFullyReceived(): bool
    {
        return $this->items->every(
            fn (PurchaseOrderItem $item) => (float) $item->qty_received >= (float) $item->qty_ordered
        );
    }

    /** Sudah ada barang yang diterima? Menentukan boleh-tidaknya dibatalkan. */
    public function hasAnyReceipt(): bool
    {
        return (float) $this->items->sum('qty_received') > 0;
    }

    /**
     * Terlambat berapa hari dari janji kirim?
     *
     * Nol berarti tepat waktu atau belum jatuh tempo.
     */
    public function daysLate(): int
    {
        if (! $this->expected_date || $this->status->isFinal()) {
            $pembanding = $this->completed_date;
        } else {
            $pembanding = now();
        }

        if (! $this->expected_date || ! $pembanding) {
            return 0;
        }

        return max(0, $this->expected_date->diffInDays($pembanding, false));
    }

    public function isOverdue(): bool
    {
        return $this->status->canReceive()
            && $this->expected_date !== null
            && $this->expected_date->isPast();
    }

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('po_number', 'like', "%{$term}%")
                ->orWhere('notes', 'like', "%{$term}%")
                ->orWhereHas('supplier', fn (Builder $s) => $s->where('name', 'like', "%{$term}%"));
        });
    }

    public function scopeStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('status', $status) : $query;
    }

    /** Pesanan yang masih menunggu barang. */
    public function scopeOutstanding(Builder $query): Builder
    {
        return $query->whereIn('status', [
            PurchaseOrderStatus::ORDERED->value,
            PurchaseOrderStatus::PARTIAL->value,
        ]);
    }

    public function scopeBetweenDates(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q) => $q->whereDate('order_date', '>=', $from))
            ->when($to, fn (Builder $q) => $q->whereDate('order_date', '<=', $to));
    }
}
