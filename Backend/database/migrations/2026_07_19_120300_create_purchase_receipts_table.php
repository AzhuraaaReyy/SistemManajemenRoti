<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penerimaan barang — "barang datang".
 *
 * Dibuat sebagai tabel tersendiri, bukan sekadar kolom `qty_received` pada
 * baris pesanan, karena pengiriman sering terpecah:
 *
 *   PO-2026-0001 pesan 25 sak tepung
 *     → 12 Juli datang 15 sak
 *     → 15 Juli datang 10 sak sisanya
 *
 * Tanpa tabel ini, kedua kejadian itu melebur jadi satu angka dan pertanyaan
 * "kapan sebenarnya barang datang?" tidak bisa dijawab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_receipts', function (Blueprint $table) {
            $table->id();

            $table->string('receipt_number', 30)->unique();   // TRM-2026-0001

            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();

            $table->date('receipt_date');

            // Nomor surat jalan dari supplier, untuk pencocokan dokumen.
            $table->string('delivery_note_number', 60)->nullable();

            $table->text('notes')->nullable();

            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['purchase_order_id', 'receipt_date']);
            $table->index('receipt_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipts');
    }
};
