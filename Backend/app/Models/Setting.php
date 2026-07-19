<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Setting extends Model
{
    protected $fillable = ['key', 'value', 'type', 'group', 'label', 'description', 'updated_by'];

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Nilai dalam bentuk aslinya.
     *
     * Seluruh nilai disimpan sebagai teks di basis data. Tanpa pengubahan
     * bentuk ini, "false" akan terbaca sebagai string tidak kosong — yang
     * bernilai benar di PHP — dan pajak akan aktif selamanya.
     */
    public function typedValue(): string|int|float|bool|null
    {
        if ($this->value === null) {
            return null;
        }

        return match ($this->type) {
            'integer' => (int) $this->value,
            'decimal' => (float) $this->value,
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            default => $this->value,
        };
    }
}
