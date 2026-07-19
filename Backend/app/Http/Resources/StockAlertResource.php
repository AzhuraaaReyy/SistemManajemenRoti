<?php

namespace App\Http\Resources;

use App\Models\Ingredient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\StockAlert
 */
class StockAlertResource extends JsonResource
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
            'item_id' => $this->item_id,
            'item_name' => $this->item?->name ?? '(barang dihapus)',
            'item_code' => $this->item?->code,

            'from_status' => $this->from_status?->value,
            'from_status_label' => $this->from_status?->label(),
            'to_status' => $this->to_status->value,
            'to_status_label' => $this->to_status->label(),
            'to_status_tone' => $this->to_status->tone(),
            'severity' => $this->to_status->severity(),

            // Angka saat peringatan dibuat, bukan angka sekarang. Peringatan
            // adalah catatan peristiwa — isinya tidak boleh ikut berubah.
            'stock_at_alert' => (float) $this->stock_at_alert,
            'min_stock_at_alert' => (float) $this->min_stock_at_alert,

            'message' => $this->message(),

            'is_read' => $this->is_read,
            'read_at' => $this->read_at?->toIso8601String(),
            'read_by_name' => $this->whenLoaded('reader', fn () => $this->reader?->name),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
