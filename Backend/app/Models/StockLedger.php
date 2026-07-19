<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Satu baris pergerakan stok.
 *
 * Model ini sengaja tidak punya method untuk mengubah atau menghapus baris.
 * Ledger bersifat append-only; koreksi dilakukan dengan menambah baris
 * penyesuaian baru, bukan dengan menyunting riwayat.
 */
class StockLedger extends Model
{
    protected $table = 'stock_ledger';

    protected $fillable = [
        'item_type',
        'item_id',
        'direction',
        'quantity',
        'delta',
        'balance_before',
        'balance_after',
        'source_type',
        'source_id',
        'unit_cost',
        'note',
        'user_id',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'delta' => 'decimal:4',
            'balance_before' => 'decimal:4',
            'balance_after' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'source_type' => StockMovementType::class,
        ];
    }

    protected static function booted(): void
    {
        // Jaring pengaman di lapisan aplikasi: menyunting atau menghapus baris
        // ledger akan membuat rekonsiliasi mustahil dan menghilangkan jejak
        // audit. Kalau ini pernah terpicu, berarti ada kode yang salah arah.
        static::updating(function () {
            throw new \RuntimeException(
                'Baris ledger stok tidak boleh diubah. Buat baris penyesuaian baru sebagai koreksi.'
            );
        });

        static::deleting(function () {
            throw new \RuntimeException(
                'Baris ledger stok tidak boleh dihapus. Buat baris penyesuaian baru sebagai koreksi.'
            );
        });
    }

    public function item(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForItem(Builder $query, Model $item): Builder
    {
        return $query->where('item_type', $item::class)->where('item_id', $item->getKey());
    }

    public function scopeOfSource(Builder $query, ?string $sourceType): Builder
    {
        return $sourceType ? $query->where('source_type', $sourceType) : $query;
    }
}
