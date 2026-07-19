<?php

namespace App\Http\Resources;

use App\Models\ProductionBatchMaterial;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\ProductionBatch
 */
class ProductionBatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_number' => $this->batch_number,

            'product_id' => $this->product_id,
            'product_name' => $this->whenLoaded('product', fn () => $this->product?->name),
            'product_code' => $this->whenLoaded('product', fn () => $this->product?->code),
            'product_unit' => $this->whenLoaded('product', fn () => $this->product?->unit ?? 'pcs'),

            'recipe_id' => $this->recipe_id,
            'recipe_name' => $this->whenLoaded('recipe', fn () => $this->recipe?->name),
            'recipe_version' => $this->recipe_version,

            'target_quantity' => (float) $this->target_quantity,
            'good_quantity' => $this->good_quantity !== null ? (float) $this->good_quantity : null,
            'reject_quantity' => (float) $this->reject_quantity,
            'yield_rate' => $this->yieldRate(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),

            // Kemampuan aksi ditentukan server agar tombol di layar selalu
            // sama dengan yang benar-benar diizinkan.
            //
            // `can_complete` sengaja tidak ada lagi: sejak modul Tracking,
            // batch hanya bisa ditutup dengan menyelesaikan tahap Packaging.
            'can_cancel' => $this->status->canCancel(),

            /*
            | Progress tahapan — hanya terisi bila relasi `stages` dimuat.
            |
            | Dibiarkan null (bukan 0) ketika belum dimuat, supaya frontend
            | bisa membedakan "belum diambil datanya" dari "benar-benar 0%".
            */
            'progress_percent' => $this->when(
                $this->relationLoaded('stages'),
                fn () => $this->progressPercent(),
            ),
            'completed_stages' => $this->when(
                $this->relationLoaded('stages'),
                fn () => $this->completedStagesCount(),
            ),
            'total_stages' => \App\Enums\ProductionStage::total(),
            'current_stage' => $this->when(
                $this->relationLoaded('stages'),
                fn () => $this->currentStage()?->stage->value,
            ),
            'current_stage_label' => $this->when(
                $this->relationLoaded('stages'),
                fn () => $this->currentStage()?->stage->label(),
            ),
            'current_stage_status' => $this->when(
                $this->relationLoaded('stages'),
                fn () => $this->currentStage()?->status->value,
            ),

            'material_cost' => (float) $this->material_cost,
            'cost_per_unit' => $this->cost_per_unit !== null ? (float) $this->cost_per_unit : null,
            'reject_cost' => round($this->rejectCost(), 2),

            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'duration_minutes' => $this->durationMinutes(),

            'operator_name' => $this->whenLoaded('operator', fn () => $this->operator?->name),
            'completed_by_name' => $this->whenLoaded('completer', fn () => $this->completer?->name),
            'cancelled_by_name' => $this->whenLoaded('canceller', fn () => $this->canceller?->name),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,

            'notes' => $this->notes,

            'materials_count' => $this->when(
                isset($this->materials_count),
                fn () => (int) $this->materials_count,
            ),

            'materials' => $this->whenLoaded('materials', fn () => $this->materials->map(
                function (ProductionBatchMaterial $m) {
                    $faktor = max((float) ($m->ingredient?->conversion_factor ?? 1), 0.0001);

                    return [
                        'id' => $m->id,
                        'ingredient_id' => $m->ingredient_id,
                        'ingredient_name' => $m->ingredient?->name,
                        'ingredient_code' => $m->ingredient?->code,
                        'base_unit' => $m->ingredient?->base_unit->value,
                        'unit' => $m->ingredient?->display_unit,

                        'qty_per_unit' => (float) $m->qty_per_unit,
                        'qty_required' => (float) $m->qty_required,
                        'qty_required_display' => round((float) $m->qty_required / $faktor, 4),
                        'qty_used' => (float) $m->qty_used,
                        'qty_used_display' => round((float) $m->qty_used / $faktor, 4),

                        'waste_percent' => (float) $m->waste_percent,
                        'unit_cost' => (float) $m->unit_cost,
                        'line_cost' => (float) $m->line_cost,

                        'stock_before' => (float) $m->stock_before,
                        'stock_before_display' => round((float) $m->stock_before / $faktor, 4),
                        'stock_after' => $m->stockAfter(),
                        'stock_after_display' => round($m->stockAfter() / $faktor, 4),

                        'note' => $m->note,
                    ];
                }
            )),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
