<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\Request;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'description',
        'subject_type',
        'subject_id',
        'ip_address',
        'user_agent',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Pintu masuk tunggal untuk mencatat aktivitas.
     *
     * Dibuat statis dan ringkas supaya controller mana pun bisa memanggilnya
     * dalam satu baris tanpa alasan untuk melewatkannya.
     */
    public static function record(
        string $action,
        ?string $description = null,
        ?User $user = null,
        ?Model $subject = null,
        ?Request $request = null,
    ): self {
        $request ??= request();

        return self::create([
            'user_id' => $user?->getKey(),
            'action' => $action,
            'description' => $description,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'ip_address' => $request?->ip(),
            'user_agent' => substr((string) $request?->userAgent(), 0, 255) ?: null,
        ]);
    }
}
