<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Peringatan perubahan status stok.
 *
 * Tabel ini TIDAK menyimpan status stok sebuah barang — status selalu dihitung
 * ulang dari `current_stock` vs `min_stock` setiap kali dibutuhkan. Yang
 * disimpan di sini adalah PERISTIWA perpindahannya: kapan sebuah barang
 * berubah dari Aman menjadi Menipis, dari Menipis menjadi Habis, dan seterusnya.
 *
 * Perbedaan ini yang membuat notifikasi hanya muncul saat status benar-benar
 * berubah, bukan setiap kali daftar stok dibuka. Tanpa catatan peristiwa,
 * satu-satunya cara mengetahui "apakah ini baru berubah?" adalah menyimpan
 * status lama di kolom barang — persis yang tidak boleh dilakukan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_alerts', function (Blueprint $table) {
            $table->id();

            // Polimorfik: satu tabel melayani bahan baku dan produk jadi,
            // sama seperti stock_ledger.
            $table->string('item_type');
            $table->unsignedBigInteger('item_id');

            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);

            // Angka dibekukan saat peringatan dibuat. Kalau stoknya berubah
            // lagi besok, peringatan hari ini tetap menceritakan keadaan yang
            // sebenarnya saat itu.
            $table->decimal('stock_at_alert', 15, 4);
            $table->decimal('min_stock_at_alert', 15, 4);

            // Baris ledger yang memicu perpindahan ini — supaya bisa ditelusuri
            // sampai ke pembelian atau produksi penyebabnya.
            $table->foreignId('stock_ledger_id')->nullable()->constrained('stock_ledger')->nullOnDelete();

            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->foreignId('read_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['item_type', 'item_id'], 'salert_item_idx');
            $table->index(['is_read', 'created_at'], 'salert_unread_idx');
            $table->index('to_status', 'salert_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_alerts');
    }
};
