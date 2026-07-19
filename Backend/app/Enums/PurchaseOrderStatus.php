<?php

namespace App\Enums;

/**
 * Status pesanan pembelian.
 *
 * Alur normal:
 *   DRAFT ──konfirmasi──► DIPESAN ──barang datang──► SEBAGIAN ──lengkap──► SELESAI
 *     │                      │                          │
 *     └──batal──► BATAL ◄────┘                          └──tutup paksa──► SELESAI
 *
 * Begitu ada barang yang diterima, pesanan tidak bisa dibatalkan lagi —
 * stoknya sudah bertambah dan uangnya sudah keluar. Yang tersisa hanyalah
 * menutup sisa yang tidak jadi dikirim.
 */
enum PurchaseOrderStatus: string
{
    case DRAFT = 'draft';
    case ORDERED = 'ordered';
    case PARTIAL = 'partial';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Draft',
            self::ORDERED => 'Dipesan',
            self::PARTIAL => 'Diterima Sebagian',
            self::COMPLETED => 'Selesai',
            self::CANCELLED => 'Dibatalkan',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::DRAFT => 'Masih disusun, belum dikirim ke supplier.',
            self::ORDERED => 'Sudah dipesan, menunggu barang datang.',
            self::PARTIAL => 'Sebagian barang sudah diterima.',
            self::COMPLETED => 'Seluruh barang sudah diterima.',
            self::CANCELLED => 'Pesanan dibatalkan.',
        };
    }

    /** Isi pesanan hanya boleh diubah selagi masih draft. */
    public function isEditable(): bool
    {
        return $this === self::DRAFT;
    }

    /** Bolehkah pesanan ini menerima barang? */
    public function canReceive(): bool
    {
        return in_array($this, [self::ORDERED, self::PARTIAL], true);
    }

    /**
     * Bolehkah dibatalkan?
     *
     * Pesanan yang sudah menerima barang tidak bisa dibatalkan — stok terlanjur
     * bertambah. Membatalkannya akan membuat stok sistem menggantung tanpa
     * dokumen pendukung.
     */
    public function canCancel(): bool
    {
        return in_array($this, [self::DRAFT, self::ORDERED], true);
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::COMPLETED, self::CANCELLED], true);
    }

    /** Warna lencana di antarmuka. */
    public function tone(): string
    {
        return match ($this) {
            self::DRAFT => 'neutral',
            self::ORDERED => 'info',
            self::PARTIAL => 'warning',
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
