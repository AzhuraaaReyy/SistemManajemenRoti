<?php

namespace App\Enums;

/**
 * Keadaan sebuah transaksi penjualan.
 *
 * Hanya dua. Transaksi POS tidak punya tahap "draft" — kasir menekan Bayar dan
 * transaksinya selesai saat itu juga. Menyimpan keranjang yang belum dibayar
 * ke basis data hanya akan meninggalkan sampah setiap kali pelanggan berubah
 * pikiran di depan meja kasir.
 */
enum SaleStatus: string
{
    case COMPLETED = 'completed';

    /**
     * Transaksi dibatalkan setelah tersimpan.
     *
     * BUKAN retur pelanggan. Ini untuk kesalahan kasir — salah ketik jumlah,
     * salah produk, transaksi tercatat dua kali. Stok produk dikembalikan
     * dengan jenis mutasi `sale_void` yang terpisah, supaya laporan penjualan
     * bisa membedakan "barang kembali karena pelanggan komplain" dari
     * "transaksinya memang tidak pernah terjadi".
     *
     * Retur pelanggan yang sesungguhnya adalah modul tersendiri (M7).
     */
    case VOIDED = 'voided';

    public function label(): string
    {
        return match ($this) {
            self::COMPLETED => 'Selesai',
            self::VOIDED => 'Dibatalkan',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::COMPLETED => 'success',
            self::VOIDED => 'danger',
        };
    }

    /** Transaksi yang dibatalkan tidak boleh dibatalkan lagi. */
    public function canVoid(): bool
    {
        return $this === self::COMPLETED;
    }

    /** Hanya transaksi selesai yang masuk hitungan omzet. */
    public function countsAsRevenue(): bool
    {
        return $this === self::COMPLETED;
    }

    /**
     * @return array<int, array<string, string>>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => [
            'value' => $s->value,
            'label' => $s->label(),
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
