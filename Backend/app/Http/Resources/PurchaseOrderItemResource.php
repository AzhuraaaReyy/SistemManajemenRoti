<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\PurchaseOrderItem
 */
class PurchaseOrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ingredient_id' => $this->ingredient_id,
            'ingredient_name' => $this->ingredient?->name,
            'ingredient_code' => $this->ingredient?->code,

            // Satuan yang dibekukan saat pesanan dibuat, bukan satuan bahan
            // saat ini — dokumen lama harus terbaca seperti semula.
            'order_unit' => $this->order_unit,
            'unit_factor' => (float) $this->unit_factor,

            // Angka dikirim dalam dua satuan: dasar untuk perhitungan,
            // satuan pesan untuk dibaca manusia.
            'qty_ordered' => (float) $this->qty_ordered,
            'qty_ordered_display' => $this->qtyOrderedDisplay(),
            'qty_received' => (float) $this->qty_received,
            'qty_received_display' => $this->qtyReceivedDisplay(),
            'qty_outstanding' => $this->qtyOutstanding(),
            'qty_outstanding_display' => $this->qtyOutstandingDisplay(),

            'unit_price' => (float) $this->unit_price,
            'unit_price_display' => $this->unitPriceDisplay(),

            'discount_amount' => (float) $this->discount_amount,
            'line_total' => (float) $this->line_total,

            'is_fully_received' => $this->isFullyReceived(),

            'note' => $this->note,
            'sort_order' => $this->sort_order,
        ];
    }
}
