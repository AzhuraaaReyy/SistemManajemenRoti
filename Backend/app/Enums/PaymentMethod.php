<?php

namespace App\Enums;

/**
 * Cara pelanggan membayar.
 *
 * Dibedakan bukan untuk kelengkapan, melainkan karena saat tutup kasir uang
 * tunai di laci harus cocok dengan penjualan tunai saja. Menggabungkan QRIS ke
 * dalamnya membuat selisih laci mustahil ditelusuri.
 */
enum PaymentMethod: string
{
    case CASH = 'cash';
    case QRIS = 'qris';
    case TRANSFER = 'transfer';

    public function label(): string
    {
        return match ($this) {
            self::CASH => 'Tunai',
            self::QRIS => 'QRIS',
            self::TRANSFER => 'Transfer',
        };
    }

    /**
     * Perlukah menghitung kembalian?
     *
     * Hanya tunai. QRIS dan transfer selalu dibayar pas sejumlah tagihan —
     * meminta "uang diterima" untuk keduanya hanya menambah langkah yang
     * memperlambat antrean tanpa memberi informasi apa pun.
     */
    public function needsChange(): bool
    {
        return $this === self::CASH;
    }

    /** Apakah uangnya masuk laci, bukan rekening? */
    public function isCash(): bool
    {
        return $this === self::CASH;
    }

    public function tone(): string
    {
        return match ($this) {
            self::CASH => 'success',
            self::QRIS => 'info',
            self::TRANSFER => 'neutral',
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $m) => [
            'value' => $m->value,
            'label' => $m->label(),
            'needs_change' => $m->needsChange(),
            'tone' => $m->tone(),
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
