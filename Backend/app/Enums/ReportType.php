<?php

namespace App\Enums;

/**
 * Tujuh jenis laporan formal.
 *
 * Setiap jenis mendeklarasikan sendiri: filter apa yang relevan baginya, dan
 * kolom apa yang dimilikinya. Deklarasi itu dipakai bersama oleh tiga hal —
 * tabel pratinjau di layar, berkas Excel, dan berkas PDF.
 *
 * Ini yang membuat modul ini tidak menjadi dua puluh satu potongan kode yang
 * hampir sama (tujuh laporan × tiga keluaran). Menambah kolom cukup di satu
 * tempat, dan ketiganya ikut berubah bersamaan — tidak mungkin lagi tabel di
 * layar menampilkan kolom yang hilang di PDF.
 */
enum ReportType: string
{
    case PENJUALAN = 'penjualan';
    case PRODUKSI = 'produksi';
    case PEMBELIAN = 'pembelian';
    case PERSEDIAAN = 'persediaan';
    case MUTASI_STOK = 'mutasi_stok';
    case SUPPLIER = 'supplier';
    case PRODUK = 'produk';

    public function label(): string
    {
        return match ($this) {
            self::PENJUALAN => 'Laporan Penjualan',
            self::PRODUKSI => 'Laporan Produksi',
            self::PEMBELIAN => 'Laporan Pembelian',
            self::PERSEDIAAN => 'Laporan Persediaan',
            self::MUTASI_STOK => 'Laporan Mutasi Stok',
            self::SUPPLIER => 'Laporan Supplier',
            self::PRODUK => 'Laporan Produk',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::PENJUALAN => 'Rincian setiap transaksi penjualan beserta diskon, pajak, dan laba kotornya.',
            self::PRODUKSI => 'Rincian setiap batch produksi: target, hasil, produk gagal, dan biaya bahan.',
            self::PEMBELIAN => 'Rincian setiap pesanan pembelian beserta nilainya dan status penerimaannya.',
            self::PERSEDIAAN => 'Keadaan stok seluruh barang PADA SATU TANGGAL, disusun ulang dari riwayat mutasi.',
            self::MUTASI_STOK => 'Seluruh pergerakan stok masuk dan keluar, lengkap dengan asal-usulnya.',
            self::SUPPLIER => 'Rekap pembelian per supplier: jumlah pesanan, nilai, dan ketepatan penerimaan.',
            self::PRODUK => 'Performa tiap produk: berapa terjual, berapa diproduksi, dan berapa labanya.',
        };
    }

    /**
     * Filter yang relevan bagi laporan ini.
     *
     * Menampilkan filter supplier pada laporan produksi hanya akan membuat
     * pengguna mengira laporannya bisa disaring begitu — lalu bingung ketika
     * hasilnya tidak berubah.
     *
     * @return array<int, string>
     */
    public function filters(): array
    {
        return match ($this) {
            self::PENJUALAN => ['date_range', 'payment_method', 'cashier_id', 'status_penjualan'],
            self::PRODUKSI => ['date_range', 'product_id', 'status_produksi'],
            self::PEMBELIAN => ['date_range', 'supplier_id', 'status_pembelian'],

            // Snapshot bukan rentang: yang ditanyakan "berapa stok PADA tanggal
            // sekian", bukan "berapa stok antara tanggal A dan B".
            self::PERSEDIAAN => ['as_of', 'kind', 'category_id'],

            self::MUTASI_STOK => ['date_range', 'kind', 'source_type', 'direction'],
            self::SUPPLIER => ['date_range', 'supplier_id'],
            self::PRODUK => ['date_range', 'category_id'],
        };
    }

    /**
     * Definisi kolom.
     *
     *   key    → kunci pada baris data
     *   label  → judul kolom
     *   format → cara menampilkan: text · number · money · percent · date · datetime
     *   align  → left · right · center
     *   total  → ikut dijumlahkan pada baris total
     *
     * @return array<int, array<string, mixed>>
     */
    public function columns(): array
    {
        return match ($this) {
            self::PENJUALAN => [
                ['key' => 'tanggal', 'label' => 'Tanggal', 'format' => 'datetime'],
                ['key' => 'nomor', 'label' => 'No. Transaksi', 'format' => 'text'],
                ['key' => 'kasir', 'label' => 'Kasir', 'format' => 'text'],
                ['key' => 'pelanggan', 'label' => 'Pelanggan', 'format' => 'text'],
                ['key' => 'item', 'label' => 'Item', 'format' => 'number', 'align' => 'right'],
                ['key' => 'metode', 'label' => 'Bayar', 'format' => 'text'],
                ['key' => 'subtotal', 'label' => 'Subtotal', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'diskon', 'label' => 'Diskon', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'pajak', 'label' => 'Pajak', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'total', 'label' => 'Total', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'hpp', 'label' => 'HPP', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'laba', 'label' => 'Laba Kotor', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'status', 'label' => 'Status', 'format' => 'text'],
            ],

            self::PRODUKSI => [
                ['key' => 'tanggal', 'label' => 'Mulai', 'format' => 'datetime'],
                ['key' => 'nomor', 'label' => 'No. Batch', 'format' => 'text'],
                ['key' => 'produk', 'label' => 'Produk', 'format' => 'text'],
                ['key' => 'operator', 'label' => 'Operator', 'format' => 'text'],
                ['key' => 'target', 'label' => 'Target', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'hasil', 'label' => 'Hasil', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'gagal', 'label' => 'Gagal', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'rasio', 'label' => 'Rasio', 'format' => 'percent', 'align' => 'right'],
                ['key' => 'biaya_bahan', 'label' => 'Biaya Bahan', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'hpp_unit', 'label' => 'HPP/Unit', 'format' => 'money', 'align' => 'right'],
                ['key' => 'durasi', 'label' => 'Durasi', 'format' => 'text', 'align' => 'right'],
                ['key' => 'status', 'label' => 'Status', 'format' => 'text'],
            ],

            self::PEMBELIAN => [
                ['key' => 'tanggal', 'label' => 'Tanggal', 'format' => 'date'],
                ['key' => 'nomor', 'label' => 'No. PO', 'format' => 'text'],
                ['key' => 'supplier', 'label' => 'Supplier', 'format' => 'text'],
                ['key' => 'item', 'label' => 'Item', 'format' => 'number', 'align' => 'right'],
                ['key' => 'subtotal', 'label' => 'Subtotal', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'diskon', 'label' => 'Diskon', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'ongkir', 'label' => 'Ongkir', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'pajak', 'label' => 'Pajak', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'total', 'label' => 'Total', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'diterima_persen', 'label' => 'Diterima', 'format' => 'percent', 'align' => 'right'],
                ['key' => 'status', 'label' => 'Status', 'format' => 'text'],
            ],

            self::PERSEDIAAN => [
                ['key' => 'kode', 'label' => 'Kode', 'format' => 'text'],
                ['key' => 'nama', 'label' => 'Nama Barang', 'format' => 'text'],
                ['key' => 'jenis', 'label' => 'Jenis', 'format' => 'text'],
                ['key' => 'kategori', 'label' => 'Kategori', 'format' => 'text'],
                ['key' => 'satuan', 'label' => 'Satuan', 'format' => 'text'],
                ['key' => 'stok', 'label' => 'Stok', 'format' => 'number', 'align' => 'right'],
                ['key' => 'minimum', 'label' => 'Minimum', 'format' => 'number', 'align' => 'right'],
                ['key' => 'status', 'label' => 'Status', 'format' => 'text'],
                ['key' => 'hpp', 'label' => 'HPP/Satuan', 'format' => 'money', 'align' => 'right'],
                ['key' => 'nilai', 'label' => 'Nilai', 'format' => 'money', 'align' => 'right', 'total' => true],
            ],

            self::MUTASI_STOK => [
                ['key' => 'tanggal', 'label' => 'Waktu', 'format' => 'datetime'],
                ['key' => 'kode', 'label' => 'Kode', 'format' => 'text'],
                ['key' => 'barang', 'label' => 'Barang', 'format' => 'text'],
                ['key' => 'jenis', 'label' => 'Jenis', 'format' => 'text'],
                ['key' => 'arah', 'label' => 'Arah', 'format' => 'text'],
                ['key' => 'jumlah', 'label' => 'Jumlah', 'format' => 'number', 'align' => 'right'],
                ['key' => 'saldo_sebelum', 'label' => 'Saldo Awal', 'format' => 'number', 'align' => 'right'],
                ['key' => 'saldo_sesudah', 'label' => 'Saldo Akhir', 'format' => 'number', 'align' => 'right'],
                ['key' => 'sumber', 'label' => 'Sumber', 'format' => 'text'],
                ['key' => 'referensi', 'label' => 'Referensi', 'format' => 'text'],
                ['key' => 'petugas', 'label' => 'Petugas', 'format' => 'text'],
                ['key' => 'catatan', 'label' => 'Catatan', 'format' => 'text'],
            ],

            self::SUPPLIER => [
                ['key' => 'kode', 'label' => 'Kode', 'format' => 'text'],
                ['key' => 'nama', 'label' => 'Supplier', 'format' => 'text'],
                ['key' => 'kontak', 'label' => 'Kontak', 'format' => 'text'],
                ['key' => 'jumlah_po', 'label' => 'Jumlah PO', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'po_selesai', 'label' => 'Selesai', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'po_batal', 'label' => 'Batal', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'total_nilai', 'label' => 'Total Nilai', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'rata2_po', 'label' => 'Rata-rata PO', 'format' => 'money', 'align' => 'right'],
                ['key' => 'nilai_diterima', 'label' => 'Nilai Diterima', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'terakhir', 'label' => 'Order Terakhir', 'format' => 'date'],
            ],

            self::PRODUK => [
                ['key' => 'kode', 'label' => 'Kode', 'format' => 'text'],
                ['key' => 'nama', 'label' => 'Produk', 'format' => 'text'],
                ['key' => 'kategori', 'label' => 'Kategori', 'format' => 'text'],
                ['key' => 'terjual', 'label' => 'Terjual', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'nilai_jual', 'label' => 'Nilai Jual', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'hpp', 'label' => 'HPP', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'laba', 'label' => 'Laba Kotor', 'format' => 'money', 'align' => 'right', 'total' => true],
                ['key' => 'margin', 'label' => 'Margin', 'format' => 'percent', 'align' => 'right'],
                ['key' => 'diproduksi', 'label' => 'Diproduksi', 'format' => 'number', 'align' => 'right', 'total' => true],
                ['key' => 'stok', 'label' => 'Stok Kini', 'format' => 'number', 'align' => 'right'],
            ],
        };
    }

    /** Orientasi kertas PDF — laporan berkolom banyak dicetak mendatar. */
    public function pdfOrientation(): string
    {
        return count($this->columns()) > 8 ? 'landscape' : 'portrait';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $t) => [
            'value' => $t->value,
            'label' => $t->label(),
            'description' => $t->description(),
            'filters' => $t->filters(),
            'columns' => $t->columns(),
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
