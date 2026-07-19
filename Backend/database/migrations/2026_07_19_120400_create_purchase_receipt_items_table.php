<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rincian barang pada satu kali penerimaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_receipt_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('purchase_receipt_id')->constrained('purchase_receipts')->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->constrained('purchase_order_items')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->restrictOnDelete();

            // Dalam satuan dasar, sama seperti seluruh sistem.
            $table->decimal('quantity', 16, 4);

            /*
            | Harga saat barang ini benar-benar diterima.
            |
            | Kadang berbeda dari harga pesanan — supplier menaikkan harga
            | sepihak, atau memberi potongan mendadak. Yang dipakai menghitung
            | harga rata-rata persediaan adalah harga penerimaan ini, bukan
            | harga pesanan.
            */
            $table->decimal('unit_price', 16, 6);

            // Untuk pemantauan kedaluwarsa (Modul 8).
            $table->date('expiry_date')->nullable();
            $table->string('batch_number', 60)->nullable();

            $table->string('note', 255)->nullable();

            $table->timestamps();

            $table->index('purchase_order_item_id');
            $table->index(['ingredient_id', 'expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipt_items');
    }
};
