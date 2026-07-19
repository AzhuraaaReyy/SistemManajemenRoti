<?php

namespace App\Http\Resources;

use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Sale
 */
class SaleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sale_number' => $this->sale_number,

            'subtotal' => (float) $this->subtotal,
            'discount_type' => $this->discount_type,
            'discount_value' => (float) $this->discount_value,
            'discount_amount' => (float) $this->discount_amount,
            'tax_percent' => (float) $this->tax_percent,
            'tax_amount' => (float) $this->tax_amount,
            'total' => (float) $this->total,

            'payment_method' => $this->payment_method->value,
            'payment_label' => $this->payment_method->label(),
            'payment_tone' => $this->payment_method->tone(),
            'paid_amount' => (float) $this->paid_amount,
            'change_amount' => (float) $this->change_amount,

            'cost_total' => (float) $this->cost_total,
            'gross_profit' => $this->grossProfit(),
            'gross_margin_percent' => $this->grossMarginPercent(),

            // Laba kotor hanya bisa dipercaya bila SELURUH barisnya berbiaya
            // nyata. Satu baris bertaksiran resep sudah cukup membuat angkanya
            // perlu diberi catatan di layar.
            'cost_reliable' => $this->when(
                $this->relationLoaded('items'),
                fn () => $this->items->every(fn (SaleItem $i) => $i->costIsReliable()),
            ),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),

            // Ditentukan server agar tombol di layar selalu sama dengan yang
            // benar-benar diizinkan.
            'can_void' => $this->status->canVoid(),

            'customer_name' => $this->customer_name,
            'notes' => $this->notes,

            'cashier_id' => $this->cashier_id,
            'cashier_name' => $this->whenLoaded('cashier', fn () => $this->cashier?->name),

            'voided_at' => $this->voided_at?->toIso8601String(),
            'voided_by_name' => $this->whenLoaded('voider', fn () => $this->voider?->name),
            'void_reason' => $this->void_reason,

            'items_count' => $this->when(
                isset($this->items_count),
                fn () => (int) $this->items_count,
            ),
            'total_quantity' => $this->when(
                $this->relationLoaded('items'),
                fn () => $this->totalQuantity(),
            ),

            'items' => $this->whenLoaded('items', fn () => $this->items->map(
                fn (SaleItem $i) => [
                    'id' => $i->id,
                    'product_id' => $i->product_id,
                    // Nama dan harga berasal dari salinan beku, bukan dari
                    // master produk — struk lama harus tetap benar.
                    'product_name' => $i->product_name,
                    'product_code' => $i->product_code,
                    'unit' => $i->unit,
                    'unit_price' => (float) $i->unit_price,
                    'quantity' => (float) $i->quantity,
                    'line_total' => (float) $i->line_total,
                    'unit_cost' => (float) $i->unit_cost,
                    'line_cost' => (float) $i->line_cost,
                    'cost_source' => $i->cost_source,
                    'cost_source_label' => $i->costSourceLabel(),
                    'cost_reliable' => $i->costIsReliable(),
                    'gross_profit' => $i->grossProfit(),
                    'stock_before' => (float) $i->stock_before,
                    'stock_after' => $i->stockAfter(),
                ]
            )),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
