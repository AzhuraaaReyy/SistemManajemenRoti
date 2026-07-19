<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penguncian versi resep.
 *
 * Sebuah versi resep menjadi permanen begitu dipakai memproduksi barang.
 * Alasannya fatal bila dilanggar:
 *
 *   Batch produksi #B091 mencatat "memakai Resep Roti Coklat versi 1" beserta
 *   HPP Rp4.798. Bila isi versi 1 kemudian diubah — misalnya takaran cokelat
 *   dinaikkan — maka laporan laba bulan lalu ikut berubah tanpa ada satu pun
 *   transaksi baru. Angka historis yang sudah dilaporkan ke pemilik usaha
 *   berubah sendiri.
 *
 * Karena itu: versi yang sudah dipakai produksi dikunci selamanya. Perubahan
 * dilakukan dengan membuat versi baru, bukan menyunting yang lama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Diisi saat batch produksi pertama memakai versi ini.
            $table->timestamp('locked_at')->nullable()->after('is_active');
            $table->string('lock_reason', 255)->nullable()->after('locked_at');

            // Berapa kali versi ini dipakai produksi. Dinaikkan modul Produksi
            // (M5); disimpan di sini agar UI bisa memberi tahu pengguna kenapa
            // sebuah versi tidak dapat diubah.
            $table->unsignedInteger('production_count')->default(0)->after('lock_reason');

            $table->index('locked_at');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropIndex(['locked_at']);
            $table->dropColumn(['locked_at', 'lock_reason', 'production_count']);
        });
    }
};
