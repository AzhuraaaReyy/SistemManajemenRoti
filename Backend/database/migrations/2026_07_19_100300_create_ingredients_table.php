<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();

            $table->string('code', 20)->unique();   // BB-0001
            $table->string('name', 150);

            $table->foreignId('category_id')->nullable()
                ->constrained('categories')->nullOnDelete();

            $table->foreignId('default_supplier_id')->nullable()
                ->constrained('suppliers')->nullOnDelete();

            /*
            | Satuan
            |
            | base_unit        : satuan penyimpanan internal (g / ml / pcs)
            | display_unit     : satuan yang dilihat pengguna (kg, L, sak)
            | conversion_factor: 1 display_unit = berapa base_unit
            |
            | Contoh: terigu disimpan dalam gram, ditampilkan dalam kg,
            | conversion_factor = 1000.
            */
            $table->enum('base_unit', ['g', 'ml', 'pcs']);
            $table->string('display_unit', 20);
            $table->decimal('conversion_factor', 12, 4)->default(1);

            /*
            | Stok — semua dalam satuan dasar.
            |
            | current_stock TIDAK boleh diubah lewat form master data. Nilainya
            | hanya berubah melalui pergerakan stok (pembelian, produksi,
            | penjualan, penyesuaian) pada modul persediaan. Master data hanya
            | menetapkan stok awal saat bahan pertama kali dibuat.
            */
            $table->decimal('current_stock', 16, 4)->default(0);
            $table->decimal('min_stock', 16, 4)->default(0);

            // Harga rata-rata tertimbang (WAC), lihat §3.7 dokumen perancangan.
            $table->decimal('avg_cost', 16, 4)->default(0);

            // Umur simpan; dipakai Modul 8 untuk peringatan kedaluwarsa.
            $table->unsignedSmallInteger('shelf_life_days')->nullable();

            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->index(['is_active', 'name']);
            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingredients');
    }
};
