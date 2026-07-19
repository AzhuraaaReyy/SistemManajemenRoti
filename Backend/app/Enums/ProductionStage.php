<?php

namespace App\Enums;

/**
 * Tahapan dalam satu batch produksi roti.
 *
 * State machine BERURUTAN — sebuah tahap hanya boleh dimulai bila tahap
 * sebelumnya sudah selesai. Tidak ada lompatan.
 *
 *   Persiapan → Mixing → Fermentasi → Pembentukan →
 *   Pemanggangan → Pendinginan → Packaging → [Produk Jadi]
 *
 * "Produk Jadi" pada spesifikasi bukan tahap yang dikerjakan, melainkan
 * keadaan setelah Packaging selesai. Karena itu ia tidak menjadi case di
 * sini: yang dihitung sebagai tahap kerja hanya tujuh. Di antarmuka, "Produk
 * Jadi" tampil sebagai penanda akhir yang menyala ketika batch selesai.
 */
enum ProductionStage: string
{
    case PERSIAPAN = 'persiapan';
    case MIXING = 'mixing';
    case FERMENTASI = 'fermentasi';
    case PEMBENTUKAN = 'pembentukan';
    case PEMANGGANGAN = 'pemanggangan';
    case PENDINGINAN = 'pendinginan';
    case PACKAGING = 'packaging';

    public function label(): string
    {
        return match ($this) {
            self::PERSIAPAN => 'Persiapan',
            self::MIXING => 'Mixing',
            self::FERMENTASI => 'Fermentasi',
            self::PEMBENTUKAN => 'Pembentukan',
            self::PEMANGGANGAN => 'Pemanggangan',
            self::PENDINGINAN => 'Pendinginan',
            self::PACKAGING => 'Packaging',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::PERSIAPAN => 'Menimbang bahan dan menyiapkan peralatan.',
            self::MIXING => 'Mencampur dan menguleni adonan.',
            self::FERMENTASI => 'Mendiamkan adonan hingga mengembang.',
            self::PEMBENTUKAN => 'Membagi dan membentuk adonan.',
            self::PEMANGGANGAN => 'Memanggang di oven.',
            self::PENDINGINAN => 'Mendinginkan sebelum dikemas.',
            self::PACKAGING => 'Mengemas produk jadi.',
        };
    }

    /** Urutan 1–7. Dipakai untuk sortir dan validasi tahap sebelumnya. */
    public function sequence(): int
    {
        return match ($this) {
            self::PERSIAPAN => 1,
            self::MIXING => 2,
            self::FERMENTASI => 3,
            self::PEMBENTUKAN => 4,
            self::PEMANGGANGAN => 5,
            self::PENDINGINAN => 6,
            self::PACKAGING => 7,
        };
    }

    /** Perkiraan durasi wajar, dipakai UI untuk menandai tahap yang kelamaan. */
    public function typicalMinutes(): int
    {
        return match ($this) {
            self::PERSIAPAN => 15,
            self::MIXING => 20,
            self::FERMENTASI => 90,
            self::PEMBENTUKAN => 30,
            self::PEMANGGANGAN => 25,
            self::PENDINGINAN => 45,
            self::PACKAGING => 20,
        };
    }

    public function previous(): ?self
    {
        return self::fromSequence($this->sequence() - 1);
    }

    public function next(): ?self
    {
        return self::fromSequence($this->sequence() + 1);
    }

    /**
     * Tahap terakhir. Menyelesaikannya memicu penambahan stok produk jadi
     * lewat ProductionService::complete().
     */
    public function isLast(): bool
    {
        return $this === self::PACKAGING;
    }

    public function isFirst(): bool
    {
        return $this === self::PERSIAPAN;
    }

    public static function fromSequence(int $sequence): ?self
    {
        foreach (self::cases() as $stage) {
            if ($stage->sequence() === $sequence) {
                return $stage;
            }
        }

        return null;
    }

    /** Jumlah tahap kerja — pembagi pada perhitungan progress. */
    public static function total(): int
    {
        return count(self::cases());
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
            'sequence' => $s->sequence(),
            'typical_minutes' => $s->typicalMinutes(),
            'is_last' => $s->isLast(),
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
