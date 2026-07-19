<?php

namespace App\Enums;

/**
 * Status batch produksi.
 *
 *   DIPROSES ──selesai──► SELESAI     (stok produk jadi bertambah)
 *      │
 *      └──batal──► DIBATALKAN         (stok bahan dikembalikan)
 *
 * Perbedaan penting antara BATAL dan SELESAI-dengan-hasil-nol:
 *
 *   Batal   = produksinya tidak jadi dikerjakan (salah input, pesanan
 *             dibatalkan). Bahan belum tersentuh, jadi stoknya dikembalikan.
 *
 *   Selesai = adonan sudah dibuat tetapi gagal (bantat, gosong). Bahan sudah
 *             benar-benar habis, jadi tetap tercatat keluar sebagai kerugian.
 *
 * Membedakan keduanya penting: menyamakan gagal-produksi dengan pembatalan
 * akan menyembunyikan kerugian bahan dari laporan.
 */
enum ProductionStatus: string
{
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::IN_PROGRESS => 'Diproses',
            self::COMPLETED => 'Selesai',
            self::CANCELLED => 'Dibatalkan',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::IN_PROGRESS => 'Bahan sudah dipotong, produk sedang dikerjakan.',
            self::COMPLETED => 'Produksi selesai, stok produk jadi sudah bertambah.',
            self::CANCELLED => 'Produksi dibatalkan, stok bahan telah dikembalikan.',
        };
    }

    public function isFinal(): bool
    {
        return $this !== self::IN_PROGRESS;
    }

    public function canComplete(): bool
    {
        return $this === self::IN_PROGRESS;
    }

    public function canCancel(): bool
    {
        return $this === self::IN_PROGRESS;
    }

    public function tone(): string
    {
        return match ($this) {
            self::IN_PROGRESS => 'warning',
            self::COMPLETED => 'success',
            self::CANCELLED => 'danger',
        };
    }

    /**
     * @return array<int, array<string, string>>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
            'tone' => $s->tone(),
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
