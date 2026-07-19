<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Resep / Bill of Materials — kepala.
 *
 * Satu produk boleh punya beberapa versi resep, tetapi hanya satu yang aktif.
 * Versi lama disimpan, tidak ditimpa, karena batch produksi yang sudah berjalan
 * merujuk ke versi tertentu. Mengubah resep hari ini tidak boleh mengubah HPP
 * produksi bulan lalu — lihat §4.1 (S5) DOKUMEN-PERANCANGAN.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();

            $table->unsignedSmallInteger('version')->default(1);
            $table->string('name', 150);

            /*
            | Hasil standar resep.
            |
            | "Roti Coklat, 1 resep menghasilkan 50 pcs" — seluruh takaran bahan
            | di recipe_items mengacu pada jumlah ini. Produksi 200 pcs berarti
            | faktor pengali 4.
            */
            $table->decimal('yield_quantity', 12, 2);
            $table->string('yield_unit', 20)->default('pcs');

            $table->text('description')->nullable();
            $table->text('instructions')->nullable();

            // Hanya satu versi aktif per produk (ditegakkan di RecipeService).
            $table->boolean('is_active')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->unique(['product_id', 'version']);
            $table->index(['product_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipes');
    }
};
