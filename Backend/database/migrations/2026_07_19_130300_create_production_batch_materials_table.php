<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pemakaian bahan pada satu batch produksi.
 *
 * Ini adalah "detail_produksi" pada spesifikasi: rincian bahan apa saja yang
 * terpakai, berapa banyak, dan berapa nilainya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_batch_materials', function (Blueprint $table) {
            $table->id();

            $table->foreignId('production_batch_id')->constrained('production_batches')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->restrictOnDelete();

            /*
            | Takaran resep saat batch dijalankan — dibekukan.
            |
            | qty_per_unit  : takaran per satu produk, sudah termasuk susut
            | qty_required  : kebutuhan total = qty_per_unit × target_quantity
            | qty_used      : yang benar-benar dipotong dari stok
            |
            | qty_required dan qty_used dipisah supaya selisihnya terlihat bila
            | suatu saat ada koreksi manual. Untuk sekarang keduanya sama.
            */
            $table->decimal('qty_per_unit', 16, 6);
            $table->decimal('qty_required', 16, 4);
            $table->decimal('qty_used', 16, 4);

            $table->decimal('waste_percent', 5, 2)->default(0);

            // Harga rata-rata bahan pada saat produksi — dibekukan.
            $table->decimal('unit_cost', 16, 4);
            $table->decimal('line_cost', 16, 2);

            // Stok bahan sesaat sebelum dipotong, untuk penelusuran.
            $table->decimal('stock_before', 16, 4);

            $table->string('note', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();

            // Satu bahan hanya boleh muncul sekali per batch — resep pun
            // sudah menjamin itu lewat unique(recipe_id, ingredient_id).
            //
            // Nama indeks ditulis manual karena nama bawaan Laravel
            // (production_batch_materials_production_batch_id_ingredient_id_unique)
            // melebihi batas 64 karakter untuk identifier MySQL.
            $table->unique(['production_batch_id', 'ingredient_id'], 'pbm_batch_ingredient_unique');
            $table->index('ingredient_id', 'pbm_ingredient_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_batch_materials');
    }
};
