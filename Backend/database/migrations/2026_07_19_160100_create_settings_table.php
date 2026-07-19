<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pengaturan aplikasi — identitas toko, pajak, dan struk.
 *
 * Disimpan sebagai pasangan kunci-nilai, bukan satu baris dengan banyak kolom.
 * Alasannya: menambah pengaturan baru nanti (batas diskon, nomor NPWP, jam
 * tutup kasir) cukup menambah baris, tidak perlu migrasi tabel yang sudah
 * dipakai.
 *
 * Kolom `type` menyimpan bentuk aslinya, karena semua nilai tersimpan sebagai
 * teks. Tanpa itu, "false" akan terbaca sebagai string yang bernilai benar dan
 * pajak akan aktif selamanya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();

            $table->string('key', 60)->unique();
            $table->text('value')->nullable();
            $table->enum('type', ['string', 'integer', 'decimal', 'boolean'])->default('string');

            // Pengelompokan untuk halaman pengaturan — 'toko', 'penjualan', 'struk'.
            $table->string('group', 30)->default('umum');
            $table->string('label');
            $table->string('description')->nullable();

            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index('group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
