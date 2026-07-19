<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();

            $table->string('code', 20)->unique();   // SUP-0001
            $table->string('name', 150);
            $table->string('contact_person', 100)->nullable();
            $table->string('phone', 25)->nullable();
            $table->string('email', 150)->nullable();
            $table->text('address')->nullable();

            // Rata-rata hari antara pemesanan dan barang tiba. Dipakai Modul 9
            // untuk menghitung titik pesan ulang (lihat §3.2 dokumen perancangan).
            $table->unsignedSmallInteger('lead_time_days')->default(3);

            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->index(['is_active', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
