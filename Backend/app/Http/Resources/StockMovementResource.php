<?php

namespace App\Http\Resources;

use App\Models\Ingredient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu baris riwayat mutasi stok.
 *
 * @mixin \App\Models\StockLedger
 */
class StockMovementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $bahan = $this->item_type === Ingredient::class;

        return [
            'id' => $this->id,

            'kind' => $bahan ? 'ingredient' : 'product',
            'kind_label' => $bahan ? 'Bahan Baku' : 'Produk Jadi',
            'item_id' => $this->item_id,
            // Barang yang sudah dihapus tetap punya baris ledger — riwayatnya
            // tidak ikut hilang, hanya namanya yang tidak bisa ditampilkan lagi.
            'item_name' => $this->item?->name ?? '(barang dihapus)',
            'item_code' => $this->item?->code,

            'direction' => $this->direction,
            'direction_label' => $this->direction === 'in' ? 'Masuk' : 'Keluar',

            'quantity' => (float) $this->quantity,
            'delta' => (float) $this->delta,
            'balance_before' => (float) $this->balance_before,
            'balance_after' => (float) $this->balance_after,

            'source_type' => $this->source_type->value,
            'source_label' => $this->source_type->label(),
            'source_id' => $this->source_id,

            'unit_cost' => $this->unit_cost !== null ? (float) $this->unit_cost : null,
            'total_cost' => $this->unit_cost !== null
                ? round((float) $this->unit_cost * (float) $this->quantity, 2)
                : null,

            'note' => $this->note,

            'user_id' => $this->user_id,
            // Pergerakan dari seeder atau proses otomatis tidak punya pengguna.
            'user_name' => $this->user?->name ?? 'Sistem',

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
