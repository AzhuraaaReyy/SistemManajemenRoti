<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Recipe extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'product_id',
        'version',
        'name',
        'yield_quantity',
        'yield_unit',
        'description',
        'instructions',
        'is_active',
        'locked_at',
        'lock_reason',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'yield_quantity' => 'decimal:2',
            'is_active' => 'boolean',
            'locked_at' => 'datetime',
            'production_count' => 'integer',
        ];
    }

    /**
     * Apakah resep ini sudah tidak boleh diubah lagi?
     *
     * Dua sebab: sudah dipakai produksi (permanen), atau sudah diarsipkan
     * sebagai versi lama (catatan sejarah).
     */
    public function isLocked(): bool
    {
        return $this->locked_at !== null || ! $this->is_active;
    }

    public function lockLabel(): ?string
    {
        if ($this->locked_at !== null) {
            return "Terkunci — sudah dipakai {$this->production_count} batch produksi";
        }

        if (! $this->is_active) {
            return 'Terkunci — versi arsip';
        }

        return null;
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecipeItem::class)->orderBy('sort_order');
    }

    /*
    |--------------------------------------------------------------------------
    | Perhitungan — §3.3 DOKUMEN-PERANCANGAN.md
    |--------------------------------------------------------------------------
    */

    /**
     * Menghitung kebutuhan bahan untuk sejumlah target produksi.
     *
     * Faktor pengali = target / yield. Resep yang menghasilkan 50 pcs, dipakai
     * untuk membuat 200 pcs, berarti setiap takaran dikalikan 4.
     *
     * @return array<int, array<string, mixed>>
     */
    public function explode(float $targetQuantity): array
    {
        $yield = (float) $this->yield_quantity;

        if ($yield <= 0) {
            return [];
        }

        $faktor = $targetQuantity / $yield;

        return $this->items->map(function (RecipeItem $item) use ($faktor) {
            $dasar = (float) $item->quantity * $faktor;
            $denganSusut = $dasar * (1 + (float) $item->waste_percent / 100);

            return [
                'ingredient_id' => $item->ingredient_id,
                'ingredient_name' => $item->ingredient?->name,
                'base_unit' => $item->ingredient?->base_unit->value,
                'required_base' => round($denganSusut, 4),
                'available_base' => (float) ($item->ingredient?->current_stock ?? 0),
                'sufficient' => (float) ($item->ingredient?->current_stock ?? 0) >= $denganSusut,
            ];
        })->all();
    }

    /** Total biaya bahan untuk satu kali resep penuh. */
    public function totalCost(): float
    {
        return $this->items->sum(function (RecipeItem $item) {
            $qty = (float) $item->quantity * (1 + (float) $item->waste_percent / 100);

            return $qty * (float) ($item->ingredient?->avg_cost ?? 0);
        });
    }

    /** Biaya bahan per satu buah produk. */
    public function costPerUnit(): float
    {
        $yield = (float) $this->yield_quantity;

        return $yield > 0 ? round($this->totalCost() / $yield, 2) : 0.0;
    }

    /**
     * Berapa banyak produk yang masih bisa dibuat dengan stok bahan saat ini.
     *
     * Hasilnya ditentukan oleh bahan yang paling cepat habis — itulah bahan
     * pembatas yang perlu segera dibeli.
     *
     * @return array{quantity: int, limiting_ingredient: string|null}
     */
    public function maxProducible(): array
    {
        $yield = (float) $this->yield_quantity;

        if ($yield <= 0 || $this->items->isEmpty()) {
            return ['quantity' => 0, 'limiting_ingredient' => null];
        }

        $batas = null;
        $pembatas = null;

        foreach ($this->items as $item) {
            $perUnit = ((float) $item->quantity * (1 + (float) $item->waste_percent / 100)) / $yield;

            if ($perUnit <= 0) {
                continue;
            }

            $mampu = (int) floor((float) ($item->ingredient?->current_stock ?? 0) / $perUnit);

            if ($batas === null || $mampu < $batas) {
                $batas = $mampu;
                $pembatas = $item->ingredient?->name;
            }
        }

        return [
            'quantity' => max(0, $batas ?? 0),
            'limiting_ingredient' => $pembatas,
        ];
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('description', 'like', "%{$term}%")
                ->orWhereHas('product', fn (Builder $p) => $p->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%"));
        });
    }
}
