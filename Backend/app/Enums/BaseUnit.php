<?php

namespace App\Enums;

/**
 * Satuan dasar penyimpanan.
 *
 * Seluruh kuantitas di database disimpan dalam satuan dasar ini — gram,
 * mililiter, atau butir/pcs. Satuan tampilan (kg, liter, sak) hanya urusan
 * antarmuka dan dikonversi memakai `conversion_factor` pada masing-masing bahan.
 *
 * Aturan ini berasal dari §3.0 DOKUMEN-PERANCANGAN.md. Tanpa satuan dasar yang
 * seragam, penjumlahan stok lintas pembelian dan produksi akan salah diam-diam
 * ketika satu transaksi memakai kg dan transaksi lain memakai gram.
 */
enum BaseUnit: string
{
    case GRAM = 'g';
    case MILILITER = 'ml';
    case PCS = 'pcs';

    public function label(): string
    {
        return match ($this) {
            self::GRAM => 'Gram (g)',
            self::MILILITER => 'Mililiter (ml)',
            self::PCS => 'Buah / Pcs',
        };
    }

    /**
     * Satuan tampilan yang lazim dipakai untuk satuan dasar ini,
     * beserta faktor konversinya ke satuan dasar.
     *
     * @return array<int, array<string, mixed>>
     */
    public function displayUnits(): array
    {
        return match ($this) {
            self::GRAM => [
                ['unit' => 'g', 'factor' => 1],
                ['unit' => 'kg', 'factor' => 1000],
                ['unit' => 'sak', 'factor' => 25000],
            ],
            self::MILILITER => [
                ['unit' => 'ml', 'factor' => 1],
                ['unit' => 'L', 'factor' => 1000],
            ],
            self::PCS => [
                ['unit' => 'pcs', 'factor' => 1],
                ['unit' => 'lusin', 'factor' => 12],
                ['unit' => 'peti', 'factor' => 100],
            ],
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $u) => [
            'value' => $u->value,
            'label' => $u->label(),
            'display_units' => $u->displayUnits(),
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
