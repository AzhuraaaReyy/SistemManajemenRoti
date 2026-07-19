<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'avatar',
        'is_active',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'role' => UserRole::class,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Kontrak JWT
    |--------------------------------------------------------------------------
    */

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Klaim tambahan yang ikut ditandatangani di dalam token.
     *
     * Peran disertakan agar frontend bisa menyusun menu tanpa memanggil
     * endpoint tambahan. Nilai ini tetap diverifikasi ulang di server pada
     * setiap permintaan — token tidak pernah dipercaya sebagai sumber izin.
     *
     * @return array<string, mixed>
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'role' => $this->role->value,
            'name' => $this->name,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relasi
    |--------------------------------------------------------------------------
    */

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Pemeriksaan peran
    |--------------------------------------------------------------------------
    */

    public function hasRole(UserRole|string ...$roles): bool
    {
        foreach ($roles as $role) {
            $value = $role instanceof UserRole ? $role->value : $role;

            if ($this->role->value === $value) {
                return true;
            }
        }

        return false;
    }

    public function isOwner(): bool
    {
        return $this->role === UserRole::OWNER;
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
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhere('phone', 'like', "%{$term}%");
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Notifikasi
    |--------------------------------------------------------------------------
    */

    /**
     * Tautan reset diarahkan ke halaman React, bukan ke rute Blade bawaan.
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
