<?php

namespace App\Models;

use App\Enums\BaseUnit;
use App\Enums\StockStatus;
use App\Enums\UnitPreset;
use App\Traits\GeneratesCode;
use App\Traits\HasStockLedger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ingredient extends Model
{
    use GeneratesCode, HasFactory, HasStockLedger, SoftDeletes;

    /**
     * `current_stock` sengaja TIDAK ada di sini.
     *
     * Kolomnya hanya boleh ditulis StockService lewat saveQuietly(), sehingga
     * mass assignment dari request mana pun tidak akan bisa menyentuhnya —
     * bahkan bila suatu saat ada kode yang lupa menyaring input.
     */
    protected $fillable = [
        'code',
        'name',
        'category_id',
        'default_supplier_id',
        'base_unit',
        'display_unit',
        'conversion_factor',
        'min_stock',
        'avg_cost',
        'shelf_life_days',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_unit' => BaseUnit::class,
            'conversion_factor' => 'decimal:4',
            'current_stock' => 'decimal:4',
            'min_stock' => 'decimal:4',
            'avg_cost' => 'decimal:4',
            'shelf_life_days' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function codePrefix(): string
    {
        return 'BB';
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

    public function defaultSupplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'default_supplier_id');
    }

    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(Supplier::class)
            ->withPivot('supplier_sku', 'last_price', 'last_purchased_at')
            ->withTimestamps();
    }

    public function recipeItems(): HasMany
    {
        return $this->hasMany(RecipeItem::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Konversi satuan
    |--------------------------------------------------------------------------
    */

    /**
     * Preset satuan yang dipilih pengguna, diturunkan dari tiga kolom teknis.
     *
     * Form hanya berurusan dengan nilai ini; base_unit, display_unit, dan
     * conversion_factor adalah rinciannya yang tidak perlu dilihat pengguna.
     */
    public function unitPreset(): UnitPreset
    {
        return UnitPreset::fromColumns(
            $this->base_unit->value,
            $this->display_unit,
            (float) $this->conversion_factor,
        );
    }

    /** Menerapkan preset satuan ke ketiga kolom teknis sekaligus. */
    public function applyUnitPreset(UnitPreset $preset): void
    {
        $this->base_unit = $preset->baseUnit()->value;
        $this->display_unit = $preset->symbol();
        $this->conversion_factor = $preset->factor();
    }

    /** Satuan tampilan → satuan dasar. Misal 2 kg → 2000 g. */
    public function toBaseUnit(float $displayQuantity): float
    {
        return $displayQuantity * (float) $this->conversion_factor;
    }

    /** Satuan dasar → satuan tampilan. Misal 2000 g → 2 kg. */
    public function toDisplayUnit(float $baseQuantity): float
    {
        $faktor = (float) $this->conversion_factor;

        return $faktor > 0 ? $baseQuantity / $faktor : $baseQuantity;
    }

    /*
    |--------------------------------------------------------------------------
    | Status stok — §3.2 DOKUMEN-PERANCANGAN.md
    |--------------------------------------------------------------------------
    */

    /**
     * Status stok — dihitung, tidak pernah disimpan.
     *
     * Aturannya ada di StockStatus::classify(), satu tempat untuk seluruh
     * sistem. Sebelumnya rumus yang sama ditulis ulang di Product dan sempat
     * berbeda isinya: Product tidak mengenal "berlebih".
     */
    public function stockStatus(): StockStatus
    {
        return StockStatus::classify((float) $this->current_stock, (float) $this->min_stock);
    }

    /** Nilai persediaan bahan ini = stok × harga rata-rata. */
    public function stockValue(): float
    {
        return (float) $this->current_stock * (float) $this->avg_cost;
    }

    /** Apakah bahan ini sedang dipakai resep mana pun? */
    public function isUsedInRecipes(): bool
    {
        return $this->recipeItems()->exists();
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
                ->orWhere('notes', 'like', "%{$term}%");
        });
    }

    /**
     * Menyaring berdasarkan status stok.
     *
     * Ambang batasnya harus sama persis dengan stockStatus(); kalau berbeda,
     * jumlah baris pada filter tidak akan cocok dengan lencana yang tampil di
     * setiap barisnya.
     */
    public function scopeStockStatus(Builder $query, ?string $status): Builder
    {
        return match ($status) {
            'habis' => $query->where('current_stock', '<=', 0),

            'kritis' => $query->where('current_stock', '>', 0)
                ->where('min_stock', '>', 0)
                ->whereRaw('current_stock < min_stock * 0.5'),

            'menipis' => $query->where('current_stock', '>', 0)
                ->where('min_stock', '>', 0)
                ->whereRaw('current_stock <= min_stock')
                ->whereRaw('current_stock >= min_stock * 0.5'),

            'berlebih' => $query->where('min_stock', '>', 0)
                ->whereRaw('current_stock > min_stock * 3'),

            // "Aman" tidak mencakup "berlebih". stockStatus() memeriksa berlebih
            // lebih dahulu, jadi batas atasnya harus ikut disebut di sini —
            // kalau tidak, jumlah pada filter tidak akan cocok dengan statistik.
            'aman' => $query->where('current_stock', '>', 0)
                ->where(fn (Builder $q) => $q->where('min_stock', '<=', 0)
                    ->orWhere(fn (Builder $r) => $r->whereRaw('current_stock > min_stock')
                        ->whereRaw('current_stock <= min_stock * 3'))),

            default => $query,
        };
    }
}
