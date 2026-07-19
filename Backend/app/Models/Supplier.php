<?php

namespace App\Models;

use App\Traits\GeneratesCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use GeneratesCode, HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'lead_time_days',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'lead_time_days' => 'integer',
        ];
    }

    protected static function codePrefix(): string
    {
        return 'SUP';
    }

    /** Bahan baku yang dipasok supplier ini. */
    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(Ingredient::class)
            ->withPivot('supplier_sku', 'last_price', 'last_purchased_at')
            ->withTimestamps();
    }

    /** Bahan yang menjadikan supplier ini pilihan utama. */
    public function defaultForIngredients(): HasMany
    {
        return $this->hasMany(Ingredient::class, 'default_supplier_id');
    }

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
                ->orWhere('contact_person', 'like', "%{$term}%")
                ->orWhere('phone', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%");
        });
    }
}
