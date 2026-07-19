<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Supplier
 */
class SupplierResource extends JsonResource
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
            'contact_person' => $this->contact_person,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'lead_time_days' => $this->lead_time_days,
            'notes' => $this->notes,
            'is_active' => $this->is_active,

            'ingredients_count' => $this->when(
                isset($this->ingredients_count),
                fn () => (int) $this->ingredients_count,
            ),

            'ingredients' => IngredientBriefResource::collection(
                $this->whenLoaded('ingredients')
            ),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
