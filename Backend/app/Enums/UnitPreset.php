<?php

namespace App\Enums;

/**
 * Satuan siap pakai.
 *
 * Pengguna hanya memilih SATU satuan dari daftar ini. Tiga kolom teknis di
 * database (base_unit, display_unit, conversion_factor) diturunkan otomatis
 * dari pilihan tersebut — istilah "faktor konversi" tidak pernah muncul di
 * layar.
 *
 * Alasan satuan dasar tetap gram/mililiter, bukan kilogram:
 *
 *   Resep roti memakai takaran kecil — cokelat 15 g, ragi 2 g, garam 3 g.
 *   Bila disimpan sebagai kilogram, angkanya menjadi 0,015 / 0,002 / 0,003.
 *   Desimal sekecil itu menumpuk galat pembulatan ketika dikalikan ratusan
 *   batch produksi, dan 0,015 sangat mudah tertukar dengan 0,15.
 *
 *   Menyimpan bilangan bulat dalam gram menghilangkan seluruh kelas masalah
 *   itu, sementara pengguna tetap melihat dan mengetik dalam kilogram.
 */
enum UnitPreset: string
{
    case KILOGRAM = 'kg';
    case GRAM = 'gram';
    case LITER = 'liter';
    case MILILITER = 'ml';
    case BUTIR = 'butir';
    case SAK_25KG = 'sak_25kg';

    public function label(): string
    {
        return match ($this) {
            self::KILOGRAM => 'Kilogram (kg)',
            self::GRAM => 'Gram (g)',
            self::LITER => 'Liter (L)',
            self::MILILITER => 'Mililiter (ml)',
            self::BUTIR => 'Butir / Pcs',
            self::SAK_25KG => 'Sak 25 kg',
        };
    }

    /** Simbol yang tampil di sebelah angka, misal "20 kg". */
    public function symbol(): string
    {
        return match ($this) {
            self::KILOGRAM => 'kg',
            self::GRAM => 'g',
            self::LITER => 'L',
            self::MILILITER => 'ml',
            self::BUTIR => 'pcs',
            self::SAK_25KG => 'sak',
        };
    }

    public function baseUnit(): BaseUnit
    {
        return match ($this) {
            self::KILOGRAM, self::GRAM, self::SAK_25KG => BaseUnit::GRAM,
            self::LITER, self::MILILITER => BaseUnit::MILILITER,
            self::BUTIR => BaseUnit::PCS,
        };
    }

    /** 1 satuan ini sama dengan berapa satuan dasar. */
    public function factor(): float
    {
        return match ($this) {
            self::KILOGRAM => 1000,
            self::GRAM => 1,
            self::LITER => 1000,
            self::MILILITER => 1,
            self::BUTIR => 1,
            self::SAK_25KG => 25000,
        };
    }

    /**
     * Satuan yang boleh dipakai saat menulis takaran resep untuk bahan ini.
     *
     * Tepung bersatuan kg boleh ditakar "250 g" agar tidak perlu menulis
     * 0,25 kg. Telur hanya boleh butir — tidak ada gram di sana.
     *
     * @return array<int, array<string, mixed>>
     */
    public function recipeUnits(): array
    {
        return match ($this->baseUnit()) {
            BaseUnit::GRAM => [
                ['unit' => 'g', 'label' => 'gram', 'factor' => 1],
                ['unit' => 'kg', 'label' => 'kilogram', 'factor' => 1000],
            ],
            BaseUnit::MILILITER => [
                ['unit' => 'ml', 'label' => 'mililiter', 'factor' => 1],
                ['unit' => 'L', 'label' => 'liter', 'factor' => 1000],
            ],
            BaseUnit::PCS => [
                ['unit' => 'pcs', 'label' => 'butir', 'factor' => 1],
            ],
        };
    }

    /**
     * Mencari preset dari kombinasi kolom yang tersimpan di database.
     *
     * Dipakai saat menampilkan data lama supaya form tetap bisa memilih
     * satuan yang benar tanpa menambah kolom baru di tabel.
     */
    public static function fromColumns(string $baseUnit, string $displayUnit, float $factor): self
    {
        foreach (self::cases() as $preset) {
            if (
                $preset->baseUnit()->value === $baseUnit
                && $preset->symbol() === $displayUnit
                && abs($preset->factor() - $factor) < 0.0001
            ) {
                return $preset;
            }
        }

        // Data lama dengan kombinasi tak dikenal jatuh ke satuan dasarnya,
        // supaya form tetap terbuka alih-alih melempar error.
        return match ($baseUnit) {
            'ml' => self::MILILITER,
            'pcs' => self::BUTIR,
            default => self::GRAM,
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $p) => [
            'value' => $p->value,
            'label' => $p->label(),
            'symbol' => $p->symbol(),
            'base_unit' => $p->baseUnit()->value,
            'factor' => $p->factor(),
            'recipe_units' => $p->recipeUnits(),
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
