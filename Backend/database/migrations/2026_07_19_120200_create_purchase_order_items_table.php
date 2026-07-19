<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Baris barang pada pesanan pembelian.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->restrictOnDelete();

            /*
            | Satuan dibekukan di sini, tidak dibaca ulang dari master bahan.
            |
            | Bila bulan depan satuan tampilan tepung diubah dari kg ke sak,
            | dokumen pembelian bulan lalu harus tetap terbaca "20 kg" seperti
            | saat disetujui — bukan berubah menjadi "0,8 sak".
            */
            $table->string('order_unit', 20);            // kg, L, pcs — saat dipesan
            $table->decimal('unit_factor', 12, 4);       // 1 order_unit = ? satuan dasar

            // Kuantitas SELALU dalam satuan dasar (gram/ml/pcs).
            $table->decimal('qty_ordered', 16, 4);
            $table->decimal('qty_received', 16, 4)->default(0);

            // Harga per satuan dasar. Harga per satuan pesan = unit_price × unit_factor.
            $table->decimal('unit_price', 16, 6);

            $table->decimal('discount_amount', 16, 2)->default(0);
            $table->decimal('line_total', 16, 2);

            $table->string('note', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();

            // Satu bahan cukup sekali per pesanan; kalau perlu lebih, tambah
            // kuantitasnya — bukan menambah baris kedua yang membingungkan
            // saat penerimaan barang.
            $table->unique(['purchase_order_id', 'ingredient_id']);
            $table->index('ingredient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
    }
};
