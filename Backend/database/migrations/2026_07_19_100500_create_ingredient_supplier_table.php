<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bahan baku ↔ supplier (relasi banyak-ke-banyak).
 *
 * Satu bahan bisa dibeli dari beberapa supplier, dan satu supplier memasok
 * banyak bahan. `ingredients.default_supplier_id` menyimpan pilihan utama;
 * tabel ini menyimpan seluruh alternatifnya beserta harga terakhir, yang
 * dipakai Modul 3 untuk membandingkan penawaran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredient_supplier', function (Blueprint $table) {
            $table->id();

            $table->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();

            // Kode barang menurut supplier — memudahkan saat memesan.
            $table->string('supplier_sku', 60)->nullable();

            // Harga per satuan dasar, agar bisa dibandingkan lintas supplier
            // meskipun satu menjual per sak dan lainnya per kg.
            $table->decimal('last_price', 16, 4)->nullable();
            $table->date('last_purchased_at')->nullable();

            $table->timestamps();

            $table->unique(['ingredient_id', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingredient_supplier');
    }
};
