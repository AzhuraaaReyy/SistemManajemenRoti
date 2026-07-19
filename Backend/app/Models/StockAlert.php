<?php

namespace App\Models;

use App\Enums\StockStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Satu peristiwa perpindahan status stok.
 *
 * Dibuat hanya ketika status benar-benar berubah menjadi lebih buruk —
 * bukan setiap kali data stok dibaca.
 */
class StockAlert extends Model
{
    protected $fillable = [
        'item_type',
        'item_id',
        'from_status',
        'to_status',
        'stock_at_alert',
        'min_stock_at_alert',
        'stock_ledger_id',
        'is_read',
        'read_at',
        'read_by',
    ];

    protected function casts(): array
    {
        return [
            'from_status' => StockStatus::class,
            'to_status' => StockStatus::class,
            'stock_at_alert' => 'decimal:4',
            'min_stock_at_alert' => 'decimal:4',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function item(): MorphTo
    {
        return $this->morphTo();
    }

    public function reader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'read_by');
    }

    public function ledger(): BelongsTo
    {
        return $this->belongsTo(StockLedger::class, 'stock_ledger_id');
    }

    /**
     * Kalimat siap tampil: "Gula Pasir turun dari Aman menjadi Menipis".
     *
     * Disusun di sini, bukan di frontend, supaya kata-katanya sama di layar,
     * di email, dan di log — dan hanya perlu diperbaiki di satu tempat.
     */
    public function message(): string
    {
        $nama = $this->item?->name ?? 'Barang';

        if ($this->from_status === null) {
            return "{$nama} berstatus {$this->to_status->label()}.";
        }

        $arah = $this->to_status->severity() > $this->from_status->severity() ? 'turun' : 'naik';

        return sprintf(
            '%s %s dari %s menjadi %s.',
            $nama,
            $arah,
            $this->from_status->label(),
            $this->to_status->label(),
        );
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }

    public function scopeOfStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('to_status', $status) : $query;
    }

    /** Menyaring bahan baku saja atau produk jadi saja. */
    public function scopeOfItemKind(Builder $query, ?string $kind): Builder
    {
        return match ($kind) {
            'ingredient' => $query->where('item_type', Ingredient::class),
            'product' => $query->where('item_type', Product::class),
            default => $query,
        };
    }
}
