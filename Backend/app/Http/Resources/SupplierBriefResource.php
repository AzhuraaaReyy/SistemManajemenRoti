<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Supplier
 */
class SupplierBriefResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'phone' => $this->phone,
            'lead_time_days' => $this->lead_time_days,
            'supplier_sku' => $this->whenPivotLoaded('ingredient_supplier', fn () => $this->pivot->supplier_sku),
            'last_price' => $this->whenPivotLoaded('ingredient_supplier', fn () => $this->pivot->last_price !== null
                ? (float) $this->pivot->last_price
                : null),
        ];
    }
}
