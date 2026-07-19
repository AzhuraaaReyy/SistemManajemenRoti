<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Resep / Bill of Materials — baris bahan.
 *
 * Contoh untuk "Roti Coklat" (yield 1 pcs):
 *   Tepung  250 g
 *   Gula     20 g
 *   Mentega  30 g
 *   Cokelat  15 g
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('recipe_id')->constrained('recipes')->cascadeOnDelete();

            // Bahan yang masih dipakai resep tidak boleh dihapus — ditegakkan
            // di controller dengan pesan yang jelas, restrictOnDelete di sini
            // menjadi jaring pengaman terakhir di lapisan database.
            $table->foreignId('ingredient_id')->constrained('ingredients')->restrictOnDelete();

            // Takaran dalam satuan dasar bahan (g / ml / pcs).
            $table->decimal('quantity', 16, 4);

            /*
            | Susut.
            |
            | Adonan menempel di wadah, tepung tercecer, sebagian bahan terbuang.
            | Kebutuhan sesungguhnya = quantity × (1 + waste_percent/100).
            | Tanpa kolom ini, stok sistem selalu terlihat lebih banyak daripada
            | kenyataan dan selisihnya baru ketahuan saat stock opname.
            */
            $table->decimal('waste_percent', 5, 2)->default(0);

            $table->string('note', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();

            // Satu bahan hanya boleh muncul sekali dalam satu resep; kalau perlu
            // lebih banyak, ubah takarannya, jangan tambah baris kedua.
            $table->unique(['recipe_id', 'ingredient_id']);
            $table->index('ingredient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_items');
    }
};
