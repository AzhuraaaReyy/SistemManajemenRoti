<?php

namespace App\Enums;

/**
 * Peran pengguna sistem.
 *
 * Nilai enum disimpan apa adanya di kolom `users.role`. Label dan izin
 * didefinisikan di sini agar frontend dan backend tidak pernah berbeda
 * pendapat soal arti sebuah peran.
 *
 * ---------------------------------------------------------------------------
 * Pemisahan Admin Produksi (Juli 2026)
 * ---------------------------------------------------------------------------
 *
 * Peran `admin_produksi` dulu menggabungkan dua pekerjaan yang di lapangan
 * dikerjakan orang berbeda: yang menerima barang dan mengurus supplier, dan
 * yang memasak di dapur. Akibatnya staf gudang bisa mengubah resep, dan staf
 * dapur bisa mengubah data supplier — dua hal yang bukan tanggung jawab mereka
 * dan tidak akan ketahuan siapa yang mengubahnya.
 *
 * Peran itu kini dipecah menjadi ADMIN_GUDANG dan KEPALA_PRODUKSI, sesuai
 * Dokumen Perancangan §1.3.
 */
enum UserRole: string
{
    case OWNER = 'owner';
    case ADMIN_GUDANG = 'admin_gudang';
    case KEPALA_PRODUKSI = 'kepala_produksi';
    case KASIR = 'kasir';

    /**
     * USANG — jangan diberikan ke pengguna baru.
     *
     * Case ini sengaja dipertahankan meski migrasi sudah memindahkan seluruh
     * barisnya ke KEPALA_PRODUKSI. Alasannya: kolom `role` di-cast ke enum ini,
     * jadi satu baris yang entah bagaimana terlewat akan membuat cast melempar
     * galat dan pengguna itu tidak bisa masuk sama sekali — kegagalan yang jauh
     * lebih buruk daripada sekadar peran yang tidak dipakai.
     *
     * Ia dikeluarkan dari `assignable()`, sehingga tidak muncul di formulir
     * pengguna dan tidak lolos validasi saat membuat atau mengubah akun.
     */
    case ADMIN_PRODUKSI = 'admin_produksi';

    public function label(): string
    {
        return match ($this) {
            self::OWNER => 'Owner',
            self::ADMIN_GUDANG => 'Admin Gudang',
            self::KEPALA_PRODUKSI => 'Kepala Produksi',
            self::KASIR => 'Kasir',
            self::ADMIN_PRODUKSI => 'Admin Produksi (usang)',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::OWNER => 'Akses penuh ke seluruh modul, laporan, dan manajemen pengguna.',
            self::ADMIN_GUDANG => 'Mengelola bahan baku, supplier, pembelian, dan persediaan.',
            self::KEPALA_PRODUKSI => 'Mengelola produk, resep, dan menjalankan batch produksi.',
            self::KASIR => 'Mencatat penjualan dan retur produk jadi.',
            self::ADMIN_PRODUKSI => 'Peran lama yang sudah dipecah menjadi Admin Gudang dan Kepala Produksi.',
        };
    }

    /** Peran ini masih boleh diberikan ke pengguna baru? */
    public function isAssignable(): bool
    {
        return $this !== self::ADMIN_PRODUKSI;
    }

    /**
     * Menu yang boleh dibuka oleh peran ini.
     *
     * Dipakai frontend untuk menyusun sidebar. Ini hanya untuk tampilan —
     * penegakan hak akses yang sesungguhnya tetap di middleware `role`.
     *
     * Sejak pemisahan peran, kuncinya berbutir sampai tingkat sub-menu
     * (`master.supplier`, bukan sekadar `master`). Tanpa itu Admin Gudang dan
     * Kepala Produksi akan sama-sama melihat kelima sub-menu Master Data,
     * termasuk yang ujungnya 403 — menu yang menjanjikan sesuatu lalu menolak
     * lebih membingungkan daripada menu yang tidak ada.
     *
     * Kunci induk (`master`, `persediaan`, …) tetap ikut dikirim, diturunkan
     * otomatis dari kunci anaknya. Dengan begitu pemeriksaan kasar semacam
     * `canAccess('persediaan')` tetap berfungsi tanpa perlu didaftar dua kali.
     *
     * @return array<int, string>
     */
    public function allowedMenus(): array
    {
        $daun = match ($this) {
            self::OWNER => [
                'dashboard',
                'master.kategori', 'master.supplier', 'master.bahan-baku',
                'master.produk', 'master.resep',
                'persediaan.dashboard', 'persediaan.stok', 'persediaan.mutasi',
                'produksi.dashboard', 'produksi.batch',
                'pembelian.dashboard', 'pembelian.pesanan', 'pembelian.penerimaan',
                'penjualan.kasir', 'penjualan.riwayat', 'penjualan.dashboard',
                'laporan', 'pengguna', 'pengaturan',
            ],

            /*
            | Gudang: barang masuk dan angka stok.
            |
            | Ia bisa MEMBACA produk lewat API (persediaan memuat produk jadi
            | juga), tapi halaman Master Produk sengaja tidak ditampilkan —
            | tombol Tambah/Ubah di sana bukan haknya dan hanya akan 403.
            */
            self::ADMIN_GUDANG => [
                'dashboard',
                'master.kategori', 'master.supplier', 'master.bahan-baku',
                'persediaan.dashboard', 'persediaan.stok', 'persediaan.mutasi',
                'pembelian.dashboard', 'pembelian.pesanan', 'pembelian.penerimaan',
            ],

            /*
            | Dapur: apa yang dibuat dan bagaimana membuatnya.
            |
            | Persediaan ikut dibuka — kepala produksi yang tidak bisa melihat
            | stok tepung tidak bisa merencanakan batch, dan hanya akan tahu
            | bahannya kurang setelah pembuatan batch ditolak.
            */
            self::KEPALA_PRODUKSI => [
                'dashboard',
                'master.kategori', 'master.produk', 'master.resep',
                'persediaan.dashboard', 'persediaan.stok', 'persediaan.mutasi',
                'produksi.dashboard', 'produksi.batch',
            ],

            self::KASIR => [
                'dashboard',
                'penjualan.kasir', 'penjualan.riwayat', 'penjualan.dashboard',
            ],

            /*
            | Peran usang tidak punya rute apa pun lagi. Menunya dikosongkan
            | sampai Dashboard saja — memberi menu yang seluruh tautannya 403
            | hanya membuat pengguna mengira sistemnya rusak.
            */
            self::ADMIN_PRODUKSI => ['dashboard'],
        };

        return self::denganInduk($daun);
    }

    /**
     * Menambahkan kunci induk dari setiap kunci bertitik.
     *
     * `master.supplier` menghasilkan `master`. Diturunkan, bukan didaftar
     * manual, supaya induk dan anak tidak mungkin berbeda pendapat.
     *
     * @param  array<int, string>  $daun
     * @return array<int, string>
     */
    private static function denganInduk(array $daun): array
    {
        $induk = [];

        foreach ($daun as $kunci) {
            if (str_contains($kunci, '.')) {
                $induk[] = strstr($kunci, '.', true);
            }
        }

        return array_values(array_unique([...$induk, ...$daun]));
    }

    /**
     * Peran yang masih boleh dipilih saat membuat atau mengubah pengguna.
     *
     * @return array<int, self>
     */
    public static function assignable(): array
    {
        return array_values(array_filter(self::cases(), fn (self $role) => $role->isAssignable()));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $role) => [
            'value' => $role->value,
            'label' => $role->label(),
            'description' => $role->description(),
        ], self::assignable());
    }

    /**
     * Seluruh nilai, termasuk yang usang.
     *
     * Dipakai untuk MEMBACA — misalnya filter daftar pengguna, yang harus tetap
     * bisa menemukan akun berperan lama kalau ada.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Nilai yang boleh DITULIS ke kolom `role`.
     *
     * @return array<int, string>
     */
    public static function assignableValues(): array
    {
        return array_column(self::assignable(), 'value');
    }
}
