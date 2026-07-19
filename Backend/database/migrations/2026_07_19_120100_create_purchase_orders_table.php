<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pesanan pembelian — kepala dokumen.
 *
 * Satu baris di sini mewakili satu kali pemesanan ke satu supplier.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();

            // Nomor bernomor per tahun: PO-2026-0001
            $table->string('po_number', 30)->unique();

            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();

            $table->date('order_date');
            $table->date('expected_date')->nullable();   // Janji kirim supplier
            $table->date('completed_date')->nullable();  // Saat barang lengkap diterima

            $table->enum('status', ['draft', 'ordered', 'partial', 'completed', 'cancelled'])
                ->default('draft');

            /*
            | Nilai uang.
            |
            | subtotal        : jumlah seluruh baris barang
            | discount_amount : potongan dari supplier
            | shipping_cost   : ongkos kirim
            | tax_amount      : pajak, bila ada
            | total           : subtotal - diskon + ongkir + pajak
            |
            | Disimpan sebagai angka jadi, tidak dihitung ulang saat ditampilkan.
            | Dokumen keuangan harus menunjukkan angka yang sama persis dengan
            | saat disetujui, meskipun harga bahan berubah setelahnya.
            */
            $table->decimal('subtotal', 16, 2)->default(0);
            $table->decimal('discount_amount', 16, 2)->default(0);
            $table->decimal('shipping_cost', 16, 2)->default(0);
            $table->decimal('tax_amount', 16, 2)->default(0);
            $table->decimal('total', 16, 2)->default(0);

            $table->text('notes')->nullable();

            // Jejak siapa melakukan apa
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ordered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('ordered_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 255)->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['status', 'order_date']);
            $table->index(['supplier_id', 'order_date']);
            $table->index('order_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
