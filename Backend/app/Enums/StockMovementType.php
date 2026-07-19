<?php

namespace App\Enums;

/**
 * Sumber pergerakan stok.
 *
 * Setiap baris ledger wajib menyebut asal-usulnya. Tidak ada kategori
 * "lain-lain" yang bisa dipakai untuk menyembunyikan perubahan tanpa alasan —
 * bila stok berubah, harus jelas karena apa.
 */
enum StockMovementType: string
{
    /** Saldo pembukaan saat data barang pertama kali dibuat. */
    case OPENING = 'opening';

    /** Penerimaan barang dari supplier (Modul Pembelian). */
    case PURCHASE = 'purchase';

    /** Bahan baku terpakai untuk produksi (Modul Produksi). */
    case PRODUCTION_CONSUME = 'production_consume';

    /** Produk jadi dihasilkan produksi (Modul Produksi). */
    case PRODUCTION_YIELD = 'production_yield';

    /**
     * Pengembalian bahan karena batch produksi dibatalkan.
     *
     * Dibuat sebagai jenis tersendiri, bukan memakai ADJUSTMENT, supaya
     * laporan stock opname tidak tercemar koreksi yang sebenarnya berasal
     * dari pembatalan produksi.
     */
    case PRODUCTION_CANCEL = 'production_cancel';

    /** Produk terjual (Modul Penjualan). */
    case SALE = 'sale';

    /**
     * Pengembalian stok karena transaksi penjualan dibatalkan.
     *
     * Dibedakan dari RETURN: yang ini berarti transaksinya memang tidak pernah
     * terjadi (salah ketik kasir), sedangkan RETURN berarti barang benar-benar
     * sempat dibawa pulang pelanggan lalu dikembalikan. Menggabungkan keduanya
     * membuat laporan retur menghitung kesalahan pengetikan sebagai keluhan
     * pelanggan.
     */
    case SALE_VOID = 'sale_void';

    /** Produk dikembalikan pelanggan dan layak jual kembali. */
    case RETURN = 'return';

    /** Koreksi hasil stock opname. */
    case ADJUSTMENT = 'adjustment';

    /** Rusak, tumpah, atau kedaluwarsa. */
    case WASTE = 'waste';

    public function label(): string
    {
        return match ($this) {
            self::OPENING => 'Stok Awal',
            self::PURCHASE => 'Pembelian',
            self::PRODUCTION_CONSUME => 'Dipakai Produksi',
            self::PRODUCTION_YIELD => 'Hasil Produksi',
            self::PRODUCTION_CANCEL => 'Pengembalian Batal Produksi',
            self::SALE => 'Penjualan',
            self::SALE_VOID => 'Pembatalan Penjualan',
            self::RETURN => 'Retur Penjualan',
            self::ADJUSTMENT => 'Penyesuaian',
            self::WASTE => 'Kerugian / Rusak',
        };
    }

    /** Arah alami jenis ini: masuk menambah stok, keluar mengurangi. */
    public function direction(): string
    {
        return match ($this) {
            self::OPENING, self::PURCHASE, self::PRODUCTION_YIELD,
            self::PRODUCTION_CANCEL, self::SALE_VOID, self::RETURN => 'in',
            self::PRODUCTION_CONSUME, self::SALE, self::WASTE => 'out',
            // Penyesuaian bisa dua arah — hasil opname boleh lebih atau kurang.
            self::ADJUSTMENT => 'both',
        };
    }

    /**
     * Bolehkah jenis ini membuat stok menjadi negatif?
     *
     * Hanya penyesuaian opname yang boleh, karena hitungan fisik adalah
     * kebenaran terakhir. Selebihnya harus ditolak: produksi dengan bahan
     * kurang berarti ada yang salah, bukan sesuatu yang perlu dipaksakan.
     */
    public function allowsNegative(): bool
    {
        return $this === self::ADJUSTMENT;
    }

    /**
     * @return array<int, array<string, string>>
     */
    public static function options(): array
    {
        return array_map(fn (self $t) => [
            'value' => $t->value,
            'label' => $t->label(),
            'direction' => $t->direction(),
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
