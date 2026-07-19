<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\PurchaseOrder
 */
class PurchaseOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $itemsDimuat = $this->relationLoaded('items');

        return [
            'id' => $this->id,
            'po_number' => $this->po_number,

            'supplier_id' => $this->supplier_id,
            'supplier_name' => $this->whenLoaded('supplier', fn () => $this->supplier?->name),
            'supplier_phone' => $this->whenLoaded('supplier', fn () => $this->supplier?->phone),
            'supplier_contact' => $this->whenLoaded('supplier', fn () => $this->supplier?->contact_person),

            'order_date' => $this->order_date?->toDateString(),
            'expected_date' => $this->expected_date?->toDateString(),
            'completed_date' => $this->completed_date?->toDateString(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),

            // Kemampuan aksi dihitung server, bukan ditebak frontend — supaya
            // tombol yang tampil selalu sama dengan yang benar-benar diizinkan.
            'can_edit' => $this->status->isEditable(),
            'can_confirm' => $this->status->isEditable(),
            'can_receive' => $this->status->canReceive(),
            'can_cancel' => $this->status->canCancel() && ! ($itemsDimuat && $this->hasAnyReceipt()),
            'can_close' => $this->status->value === 'partial',

            'is_overdue' => $this->isOverdue(),
            'days_late' => $this->daysLate(),

            'subtotal' => (float) $this->subtotal,
            'discount_amount' => (float) $this->discount_amount,
            'shipping_cost' => (float) $this->shipping_cost,
            'tax_amount' => (float) $this->tax_amount,
            'total' => (float) $this->total,

            'notes' => $this->notes,

            'items_count' => $this->when(isset($this->items_count), fn () => (int) $this->items_count),
            'receipts_count' => $this->when(isset($this->receipts_count), fn () => (int) $this->receipts_count),

            'received_percent' => $itemsDimuat ? $this->receivedPercent() : null,

            'items' => PurchaseOrderItemResource::collection($this->whenLoaded('items')),
            'receipts' => PurchaseReceiptResource::collection($this->whenLoaded('receipts')),

            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'ordered_by_name' => $this->whenLoaded('orderer', fn () => $this->orderer?->name),
            'ordered_at' => $this->ordered_at?->toIso8601String(),
            'cancelled_by_name' => $this->whenLoaded('canceller', fn () => $this->canceller?->name),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
