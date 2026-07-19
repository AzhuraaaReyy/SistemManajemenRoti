<?php

namespace App\Http\Resources;

use App\Models\PurchaseReceiptItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\PurchaseReceipt
 */
class PurchaseReceiptResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'receipt_number' => $this->receipt_number,
            'purchase_order_id' => $this->purchase_order_id,
            'po_number' => $this->whenLoaded('purchaseOrder', fn () => $this->purchaseOrder?->po_number),

            'receipt_date' => $this->receipt_date?->toDateString(),
            'delivery_note_number' => $this->delivery_note_number,
            'notes' => $this->notes,

            'received_by_name' => $this->whenLoaded('receiver', fn () => $this->receiver?->name),

            'total_value' => $this->relationLoaded('items') ? round($this->totalValue(), 2) : null,

            'items' => $this->whenLoaded('items', fn () => $this->items->map(function (PurchaseReceiptItem $item) {
                $faktor = (float) ($item->orderItem?->unit_factor ?? 1);
                $satuan = $item->orderItem?->order_unit ?? $item->ingredient?->display_unit ?? '';

                return [
                    'id' => $item->id,
                    'ingredient_id' => $item->ingredient_id,
                    'ingredient_name' => $item->ingredient?->name,
                    'quantity' => (float) $item->quantity,
                    'quantity_display' => $faktor > 0 ? round((float) $item->quantity / $faktor, 4) : (float) $item->quantity,
                    'unit' => $satuan,
                    'unit_price' => (float) $item->unit_price,
                    'unit_price_display' => round((float) $item->unit_price * $faktor, 2),
                    'subtotal' => $item->subtotal(),
                    'expiry_date' => $item->expiry_date?->toDateString(),
                    'batch_number' => $item->batch_number,
                    'note' => $item->note,
                ];
            })),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
