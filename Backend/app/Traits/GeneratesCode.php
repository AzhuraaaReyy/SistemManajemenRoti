<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;

/**
 * Membuat kode berurutan otomatis, misal BB-0001, PRD-0007, SUP-0012.
 *
 * Nomor diambil dari kode tertinggi yang pernah ada — termasuk baris yang sudah
 * di-soft-delete — supaya kode tidak pernah dipakai ulang. Kode yang didaur
 * ulang akan membuat dokumen lama menunjuk ke barang yang berbeda.
 */
trait GeneratesCode
{
    protected static function bootGeneratesCode(): void
    {
        static::creating(function (Model $model) {
            if (blank($model->code)) {
                $model->code = static::generateCode();
            }
        });
    }

    public static function generateCode(): string
    {
        $prefix = static::codePrefix();

        $terakhir = static::withTrashed()
            ->where('code', 'like', $prefix.'-%')
            ->orderByRaw('CAST(SUBSTRING(code, ?) AS UNSIGNED) DESC', [strlen($prefix) + 2])
            ->value('code');

        $nomor = $terakhir
            ? ((int) substr($terakhir, strlen($prefix) + 1)) + 1
            : 1;

        return sprintf('%s-%04d', $prefix, $nomor);
    }

    /** Awalan kode, misal 'BB' untuk bahan baku. */
    abstract protected static function codePrefix(): string;
}
