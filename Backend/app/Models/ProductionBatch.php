<?php

namespace App\Models;

use App\Enums\ProductionStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductionBatch extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'batch_number',
        'idempotency_key',
        'product_id',
        'recipe_id',
        'recipe_version',
        'target_quantity',
        'good_quantity',
        'reject_quantity',
        'status',
        'material_cost',
        'cost_per_unit',
        'started_at',
        'finished_at',
        'operator_id',
        'completed_by',
        'cancelled_by',
        'cancelled_at',
        'cancel_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProductionStatus::class,
            'recipe_version' => 'integer',
            'target_quantity' => 'decimal:2',
            'good_quantity' => 'decimal:2',
            'reject_quantity' => 'decimal:2',
            'material_cost' => 'decimal:2',
            'cost_per_unit' => 'decimal:2',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** Nomor bernomor per tahun: PRO-2026-0001. */
    public static function generateNumber(?int $year = null): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "PRO-{$year}-";

        $terakhir = self::withTrashed()
            ->where('batch_number', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(batch_number, ?) AS UNSIGNED) DESC', [strlen($prefix) + 1])
            ->value('batch_number');

        $nomor = $terakhir ? ((int) substr($terakhir, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $nomor, 4, '0', STR_PAD_LEFT);
    }

    /*
    |--------------------------------------------------------------------------
    | Relasi
    |--------------------------------------------------------------------------
    */

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function materials(): HasMany
    {
        return $this->hasMany(ProductionBatchMaterial::class)->orderBy('sort_order');
    }

    /**
     * Seluruh baris tahapan, termasuk percobaan pengulangan.
     *
     * Untuk keadaan tahap saat ini (satu baris per tahap), pakai
     * ProductionTrackingService::currentStages().
     */
    public function stages(): HasMany
    {
        return $this->hasMany(ProductionStage::class)->orderBy('sequence')->orderBy('attempt');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /*
    |--------------------------------------------------------------------------
    | Turunan
    |--------------------------------------------------------------------------
    */

    /**
     * Rasio hasil: berapa persen dari target yang benar-benar jadi.
     *
     * Angka yang terus-menerus di bawah 100% menandakan takaran susut di resep
     * kurang besar, atau ada masalah di proses produksinya.
     */
    public function yieldRate(): ?float
    {
        $target = (float) $this->target_quantity;

        if ($this->good_quantity === null || $target <= 0) {
            return null;
        }

        return round(((float) $this->good_quantity / $target) * 100, 2);
    }

    /** Nilai bahan yang terbuang pada produk gagal. */
    public function rejectCost(): float
    {
        $total = (float) $this->good_quantity + (float) $this->reject_quantity;

        if ($total <= 0) {
            return 0.0;
        }

        return round(((float) $this->reject_quantity / $total) * (float) $this->material_cost, 2);
    }

    /** Berapa lama produksi berjalan, dalam menit. */
    public function durationMinutes(): ?int
    {
        if (! $this->finished_at) {
            return null;
        }

        return (int) $this->started_at->diffInMinutes($this->finished_at);
    }

    /*
    |--------------------------------------------------------------------------
    | Tracking tahapan
    |--------------------------------------------------------------------------
    |
    | Dihitung dari relasi yang sudah dimuat agar aman dipakai di dalam
    | Resource tanpa memicu query per baris (N+1). Pemanggil wajib
    | ->load('stages') atau ->with('stages') lebih dulu.
    */

    /**
     * Keadaan tiap tahap saat ini — satu baris per tahap, percobaan terakhir.
     *
     * @return \Illuminate\Support\Collection<int, ProductionStage>
     */
    public function currentStages(): \Illuminate\Support\Collection
    {
        return $this->stages
            ->groupBy(fn (ProductionStage $s) => $s->stage->value)
            ->map(fn ($percobaan) => $percobaan->sortByDesc('attempt')->first())
            ->sortBy(fn (ProductionStage $s) => $s->sequence)
            ->values();
    }

    /** (tahap selesai / total tahap) × 100 — rumus sesuai spesifikasi. */
    public function progressPercent(): float
    {
        if (! $this->relationLoaded('stages')) {
            return 0.0;
        }

        $selesai = $this->currentStages()->filter(fn (ProductionStage $s) => $s->isCompleted())->count();

        return round(($selesai / \App\Enums\ProductionStage::total()) * 100, 2);
    }

    /** Tahap yang sedang dikerjakan, atau tahap berikutnya yang menunggu. */
    public function currentStage(): ?ProductionStage
    {
        if (! $this->relationLoaded('stages')) {
            return null;
        }

        $stages = $this->currentStages();

        return $stages->first(fn (ProductionStage $s) => $s->isRunning())
            ?? $stages->first(fn (ProductionStage $s) => $s->status === \App\Enums\StageStatus::PENDING);
    }

    public function completedStagesCount(): int
    {
        if (! $this->relationLoaded('stages')) {
            return 0;
        }

        return $this->currentStages()->filter(fn (ProductionStage $s) => $s->isCompleted())->count();
    }

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('batch_number', 'like', "%{$term}%")
                ->orWhere('notes', 'like', "%{$term}%")
                ->orWhereHas('product', fn (Builder $p) => $p->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%"));
        });
    }

    public function scopeStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('status', $status) : $query;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', ProductionStatus::IN_PROGRESS->value);
    }

    public function scopeBetweenDates(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q) => $q->whereDate('started_at', '>=', $from))
            ->when($to, fn (Builder $q) => $q->whereDate('started_at', '<=', $to));
    }
}
