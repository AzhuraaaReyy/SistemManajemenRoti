<?php

namespace App\Traits;

use App\Models\StockLedger;
use App\Services\StockService;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Dipakai model yang punya stok (Ingredient dan Product).
 *
 * Menyediakan akses baca ke riwayat pergerakan. Perubahan stok tetap hanya
 * boleh lewat StockService — trait ini sengaja tidak menyediakan jalan pintas
 * untuk menulis.
 */
trait HasStockLedger
{
    public function stockLedgers(): MorphMany
    {
        return $this->morphMany(StockLedger::class, 'item')->latest();
    }

    /** Apakah cache stok masih cocok dengan jumlah seluruh baris ledger? */
    public function verifyStock(): array
    {
        return app(StockService::class)->verify($this);
    }

    /** Total stok yang pernah masuk, dari jenis pergerakan tertentu atau semua. */
    public function totalStockIn(?string $sourceType = null): float
    {
        return (float) $this->stockLedgers()
            ->where('direction', 'in')
            ->when($sourceType, fn ($q) => $q->where('source_type', $sourceType))
            ->sum('quantity');
    }

    public function totalStockOut(?string $sourceType = null): float
    {
        return (float) $this->stockLedgers()
            ->where('direction', 'out')
            ->when($sourceType, fn ($q) => $q->where('source_type', $sourceType))
            ->sum('quantity');
    }

    /**
     * Rata-rata pemakaian per hari selama N hari terakhir.
     *
     * Dipakai untuk menghitung "stok cukup untuk berapa hari lagi" dan,
     * nanti, titik pesan ulang dinamis (§3.2 DOKUMEN-PERANCANGAN.md).
     */
    public function averageDailyUsage(int $days = 30): float
    {
        $total = (float) $this->stockLedgers()
            ->where('direction', 'out')
            ->whereIn('source_type', ['production_consume', 'sale'])
            ->where('created_at', '>=', now()->subDays($days))
            ->sum('quantity');

        return $days > 0 ? round($total / $days, 4) : 0.0;
    }
}
