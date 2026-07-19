<?php

namespace App\Models;

use App\Enums\ProductionStage as StageEnum;
use App\Enums\StageStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionStage extends Model
{
    protected $fillable = [
        'production_batch_id',
        'stage',
        'sequence',
        'attempt',
        'status',
        'started_at',
        'finished_at',
        'operator_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'stage' => StageEnum::class,
            'status' => StageStatus::class,
            'sequence' => 'integer',
            'attempt' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductionBatch::class, 'production_batch_id');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Turunan
    |--------------------------------------------------------------------------
    */

    /**
     * Lama tahap ini berjalan, dalam menit.
     *
     * Tahap yang masih berjalan dihitung sampai sekarang, sehingga UI bisa
     * menampilkan "sudah 8 menit" secara langsung.
     */
    public function durationMinutes(): ?int
    {
        if (! $this->started_at) {
            return null;
        }

        $akhir = $this->finished_at ?? now();

        return (int) $this->started_at->diffInMinutes($akhir);
    }

    /** Apakah tahap ini berjalan jauh lebih lama dari biasanya? */
    public function isOverdue(): bool
    {
        if ($this->status !== StageStatus::IN_PROGRESS) {
            return false;
        }

        return ($this->durationMinutes() ?? 0) > $this->stage->typicalMinutes() * 1.5;
    }

    public function isCompleted(): bool
    {
        return $this->status === StageStatus::COMPLETED;
    }

    public function isRunning(): bool
    {
        return $this->status === StageStatus::IN_PROGRESS;
    }

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    /**
     * Hanya percobaan terakhir dari tiap tahap.
     *
     * Ketika sebuah tahap diulang, baris lama tetap ada sebagai riwayat.
     * Yang menentukan keadaan tahap saat ini adalah percobaan tertingginya.
     */
    public function scopeLatestAttempt(Builder $query): Builder
    {
        return $query->whereIn('id', function ($sub) {
            $sub->selectRaw('MAX(id)')
                ->from('production_stages')
                ->groupBy('production_batch_id', 'stage');
        });
    }

    public function scopeForBatch(Builder $query, int $batchId): Builder
    {
        return $query->where('production_batch_id', $batchId);
    }
}
