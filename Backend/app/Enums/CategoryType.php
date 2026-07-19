<?php

namespace App\Enums;

/**
 * Jenis kategori.
 *
 * Kategori produk dan kategori bahan baku disimpan dalam satu tabel yang sama
 * dan dibedakan oleh kolom `type`. Strukturnya identik (nama, deskripsi, aktif),
 * sehingga dua tabel terpisah hanya akan menggandakan kode CRUD tanpa manfaat.
 */
enum CategoryType: string
{
    case PRODUK = 'produk';
    case BAHAN_BAKU = 'bahan_baku';

    public function label(): string
    {
        return match ($this) {
            self::PRODUK => 'Kategori Produk',
            self::BAHAN_BAKU => 'Kategori Bahan Baku',
        };
    }

    /**
     * @return array<int, array<string, string>>
     */
    public static function options(): array
    {
        return array_map(fn (self $t) => [
            'value' => $t->value,
            'label' => $t->label(),
        ], self::cases());
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
