<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->string('code', 20)->unique();   // PRD-0001
            $table->string('name', 150);

            $table->foreignId('category_id')->nullable()
                ->constrained('categories')->nullOnDelete();

            // Produk jadi selalu dihitung per buah.
            $table->string('unit', 20)->default('pcs');

            $table->decimal('selling_price', 14, 2)->default(0);

            // Sama seperti bahan baku: hanya modul persediaan yang boleh mengubah.
            $table->decimal('current_stock', 16, 4)->default(0);
            $table->decimal('min_stock', 16, 4)->default(0);

            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->boolean('is_active')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->index(['is_active', 'name']);
            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
