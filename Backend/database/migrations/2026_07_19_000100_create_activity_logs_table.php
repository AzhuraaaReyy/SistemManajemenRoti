<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jejak audit (audit trail).
 *
 * Modul autentikasi adalah tempat paling awal untuk mulai mencatat "siapa
 * melakukan apa". Tabel yang sama nantinya dipakai ulang oleh modul stok,
 * produksi, dan penjualan — bukan tabel khusus login.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();

            // Pelaku bisa null jika percobaan login gagal (user belum dikenali).
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            // Contoh: 'login', 'login_gagal', 'logout', 'user_dibuat', 'profil_diperbarui'.
            $table->string('action', 60);
            $table->string('description')->nullable();

            // Penunjuk polimorfik ke objek yang diubah (User, Ingredient, dst).
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['action', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
