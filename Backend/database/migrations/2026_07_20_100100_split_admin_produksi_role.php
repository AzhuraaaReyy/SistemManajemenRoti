<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Memecah peran `admin_produksi` menjadi `admin_gudang` dan `kepala_produksi`.
 *
 * Peran lama menggabungkan dua pekerjaan yang di lapangan dipegang orang
 * berbeda: gudang (terima barang, urus supplier) dan dapur (resep, produksi).
 *
 * Murni perubahan lapisan otorisasi — tidak ada data transaksi yang disentuh.
 * Seluruh foreign key ke `users.id` (operator batch, penerima PO, kasir
 * penjualan) tetap utuh karena yang berubah hanya isi kolom `role` dan `email`,
 * bukan baris atau ID-nya.
 */
return new class extends Migration
{
    private const LAMA = ['owner', 'admin_produksi', 'kasir'];

    private const BARU = ['owner', 'admin_gudang', 'kepala_produksi', 'admin_produksi', 'kasir'];

    public function up(): void
    {
        /*
        | `admin_produksi` sengaja TETAP ada di daftar nilai kolom.
        |
        | Kolomnya di-cast ke enum UserRole, jadi satu baris yang terlewat akan
        | membuat cast melempar galat dan pengguna itu tidak bisa masuk sama
        | sekali. Membiarkan nilainya tetap sah jauh lebih murah daripada
        | kegagalan seperti itu; yang menutup pintu adalah
        | UserRole::assignable(), yang tidak lagi menawarkannya di formulir.
        */
        $this->ubahDaftarNilai(self::BARU);

        /*
        | Akun demo Admin Produksi diubah menjadi Kepala Produksi.
        |
        | Email-nya IKUT diganti pada baris yang sama, bukan dibuat akun baru.
        | Kalau email lama dibiarkan lalu seeder menambah kepalaproduksi@,
        | hasilnya dua akun: satu memegang seluruh riwayat batch dan PO, satu
        | lagi kosong tapi bernama benar.
        |
        | Dilewati bila email tujuan sudah dipakai, agar migrasi tetap aman
        | dijalankan pada basis data yang sudah pernah di-seed.
        */
        $tujuanTerpakai = DB::table('users')
            ->where('email', 'kepalaproduksi@rotimanis.test')
            ->exists();

        if (! $tujuanTerpakai) {
            DB::table('users')
                ->where('email', 'produksi@rotimanis.test')
                ->update([
                    'email' => 'kepalaproduksi@rotimanis.test',
                    'name' => 'Budi Santoso',
                    'updated_at' => now(),
                ]);
        }

        // Sisa akun berperan lama dipindahkan ke Kepala Produksi — pekerjaan
        // dapur adalah asal-usul peran itu; urusan gudang menyusul lewat akun
        // tersendiri.
        $dipindah = DB::table('users')
            ->where('role', 'admin_produksi')
            ->update(['role' => 'kepala_produksi', 'updated_at' => now()]);

        if ($dipindah > 0) {
            echo "  {$dipindah} pengguna dipindahkan dari Admin Produksi ke Kepala Produksi.".PHP_EOL;
        }
    }

    public function down(): void
    {
        DB::table('users')
            ->whereIn('role', ['admin_gudang', 'kepala_produksi'])
            ->update(['role' => 'admin_produksi', 'updated_at' => now()]);

        DB::table('users')
            ->where('email', 'kepalaproduksi@rotimanis.test')
            ->update(['email' => 'produksi@rotimanis.test', 'updated_at' => now()]);

        $this->ubahDaftarNilai(self::LAMA);
    }

    /**
     * ALTER mentah dipakai karena mengubah daftar nilai sebuah kolom ENUM
     * tidak bisa diungkapkan lewat Schema builder.
     *
     * @param  array<int, string>  $nilai
     */
    private function ubahDaftarNilai(array $nilai): void
    {
        $daftar = implode(', ', array_map(fn (string $v) => "'{$v}'", $nilai));

        DB::statement(
            "ALTER TABLE `users` MODIFY `role` ENUM({$daftar}) NOT NULL DEFAULT 'kasir'"
        );
    }
};
