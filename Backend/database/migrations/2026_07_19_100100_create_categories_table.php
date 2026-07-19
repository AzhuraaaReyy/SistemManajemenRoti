<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();

            // Membedakan kategori produk dari kategori bahan baku.
            $table->enum('type', ['produk', 'bahan_baku'])->index();

            $table->string('name', 80);
            $table->string('slug', 100);
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);

            $table->softDeletes();
            $table->timestamps();

            // Nama boleh sama antar jenis — "Cokelat" bisa jadi kategori produk
            // sekaligus kategori bahan baku tanpa saling bertabrakan.
            $table->unique(['type', 'slug']);
            $table->index(['type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
