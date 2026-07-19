<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\ProductionStage
 */
class ProductionStageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_id' => $this->production_batch_id,

            'stage' => $this->stage->value,
            'stage_label' => $this->stage->label(),
            'stage_description' => $this->stage->description(),
            'sequence' => $this->sequence,
            'is_last' => $this->stage->isLast(),

            'attempt' => $this->attempt,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),

            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),

            // Tahap yang masih berjalan dihitung sampai sekarang, sehingga UI
            // bisa menampilkan "sudah berjalan 8 menit" tanpa menghitung sendiri.
            'duration_minutes' => $this->durationMinutes(),
            'typical_minutes' => $this->stage->typicalMinutes(),
            'is_overdue' => $this->isOverdue(),

            'operator_id' => $this->operator_id,
            'operator_name' => $this->whenLoaded('operator', fn () => $this->operator?->name),

            'notes' => $this->notes,

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
