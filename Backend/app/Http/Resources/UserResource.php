<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'allowed_menus' => $this->role->allowedMenus(),
            'phone' => $this->phone,
            'avatar_url' => $this->avatar ? asset('storage/'.$this->avatar) : null,
            'initials' => self::initialsOf($this->name),
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Inisial untuk avatar teks di frontend, misal "Lilik Sari" -> "LS".
     */
    private static function initialsOf(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $initials = array_map(fn ($part) => mb_strtoupper(mb_substr($part, 0, 1)), array_slice($parts, 0, 2));

        return implode('', $initials) ?: '?';
    }
}
