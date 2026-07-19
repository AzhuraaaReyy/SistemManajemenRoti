<?php

namespace App\Models;

use App\Enums\StockStatus;
use App\Traits\GeneratesCode;
use App\Traits\HasStockLedger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use GeneratesCode, HasFactory, HasStockLedger, SoftDeletes;

    /** `current_stock` tidak fillable — hanya StockService yang boleh menulisnya. */
    protected $fillable = [
        'code',
        'name',
        'category_id',
        'unit',
        'selling_price',
        'min_stock',
        'description',
        'image',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'selling_price' => 'decimal:2',
            'avg_cost' => 'decimal:4',
            'current_stock' => 'decimal:4',
            'min_stock' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    protected static function codePrefix(): string
    {
        return 'PRD';
    }

    /*
    |--------------------------------------------------------------------------
    | Relasi
    |--------------------------------------------------------------------------
    */

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** Seluruh versi resep, termasuk yang sudah tidak aktif. */
    public function recipes(): HasMany
    {
        return $this->hasMany(Recipe::class)->orderByDesc('version');
    }

    /** Versi resep yang sedang berlaku. */
    public function activeRecipe(): HasOne
    {
        return $this->hasOne(Recipe::class)->where('is_active', true);
    }

    /*
    |--------------------------------------------------------------------------
    | Turunan
    |--------------------------------------------------------------------------
    */

    /**
     * Biaya bahan per satu buah produk menurut resep aktif — HPP TEORETIS.
     *
     * Dihitung dari harga bahan hari ini. Berbeda dari `avg_cost` yang berisi
     * HPP NYATA hasil rata-rata tertimbang produksi yang benar-benar terjadi.
     * Selisih keduanya menunjukkan seberapa jauh biaya sesungguhnya menyimpang
     * dari perhitungan resep.
     */
    public function unitCost(): float
    {
        $recipe = $this->relationLoaded('activeRecipe')
            ? $this->activeRecipe
            : $this->activeRecipe()->with('items.ingredient')->first();

        return $recipe ? $recipe->costPerUnit() : 0.0;
    }

    /**
     * Margin kotor per buah, dalam persen.
     *
     * Nilai negatif berarti produk dijual di bawah biaya bahannya — belum
     * termasuk tenaga kerja dan gas, jadi kerugian sesungguhnya lebih besar.
     */
    public function marginPercent(): ?float
    {
        $harga = (float) $this->selling_price;
        $hpp = $this->unitCost();

        if ($harga <= 0 || $hpp <= 0) {
            return null;
        }

        return round((($harga - $hpp) / $harga) * 100, 2);
    }

    /** Status stok — aturannya di StockStatus::classify(), sama dengan Ingredient. */
    public function stockStatus(): StockStatus
    {
        return StockStatus::classify((float) $this->current_stock, (float) $this->min_stock);
    }

    /** Nilai persediaan produk ini = stok × HPP rata-rata. */
    public function stockValue(): float
    {
        return (float) $this->current_stock * (float) $this->avg_cost;
    }

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('code', 'like', "%{$term}%")
                ->orWhere('description', 'like', "%{$term}%");
        });
    }
}
