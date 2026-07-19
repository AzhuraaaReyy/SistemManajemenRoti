<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rincian transaksi penjualan — `detail_penjualan` pada spesifikasi.
 *
 * Nama, kode, satuan, dan harga produk DISALIN ke sini, tidak sekadar
 * direlasikan. Alasannya sama dengan pada detail pembelian dan pemakaian bahan
 * produksi: struk yang dicetak ulang tahun depan harus menampilkan harga yang
 * benar-benar dibayar pelanggan hari itu, bukan harga produk hari ini. Produk
 * yang kelak dihapus pun tetap terbaca namanya di riwayat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();

            // --- Salinan beku ---
            $table->string('product_name');
            $table->string('product_code', 30)->nullable();
            $table->string('unit', 20)->default('pcs');
            $table->decimal('unit_price', 15, 2);

            $table->decimal('quantity', 15, 4);
            $table->decimal('line_total', 15, 2);

            // HPP per unit saat terjual. Dibekukan agar laba kotor per baris
            // tetap benar walau harga bahan berubah.
            $table->decimal('unit_cost', 15, 4)->default(0);
            $table->decimal('line_cost', 15, 2)->default(0);

            /*
            | Dari mana angka HPP di atas berasal.
            |
            |   actual  → rata-rata tertimbang dari produksi yang benar-benar
            |             terjadi. Ini yang paling bisa dipercaya.
            |   recipe  → HPP teoretis dari resep aktif, dipakai bila produk
            |             belum pernah diproduksi (stoknya dari saldo awal).
            |   unknown → tidak ada keduanya; laba kotor baris ini terlalu besar.
            |
            | Tanpa kolom ini, laporan laba mencampur angka nyata dan taksiran
            | tanpa ada yang bisa membedakannya.
            */
            $table->enum('cost_source', ['actual', 'recipe', 'unknown'])->default('unknown');

            // Saldo stok sebelum penjualan — memudahkan penelusuran bila kelak
            // ada selisih, tanpa harus menjumlahkan ulang seluruh ledger.
            $table->decimal('stock_before', 15, 4)->default(0);

            $table->timestamps();

            $table->index('sale_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
