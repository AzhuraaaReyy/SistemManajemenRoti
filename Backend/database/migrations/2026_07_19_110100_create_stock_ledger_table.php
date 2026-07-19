<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Buku besar stok — sumber kebenaran tunggal.
 *
 * Tabel ini bersifat APPEND-ONLY: baris hanya ditambahkan, tidak pernah
 * diubah atau dihapus. Kolom `current_stock` pada ingredients dan products
 * adalah cache dari penjumlahan tabel ini, bukan sebaliknya.
 *
 * Konsekuensinya:
 *   - Setiap perubahan stok punya jejak: siapa, kapan, karena apa.
 *   - Selisih stok selalu bisa ditelusuri, tidak pernah "tiba-tiba berubah".
 *   - Rekonsiliasi mungkin dilakukan: SUM(delta) harus sama dengan cache.
 *
 * Lihat §3.1 (algoritma A1) DOKUMEN-PERANCANGAN.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_ledger', function (Blueprint $table) {
            $table->id();

            /*
            | Barang yang bergerak — bisa bahan baku atau produk jadi.
            | Dibuat polimorfik agar satu tabel melayani keduanya; memisahkan
            | menjadi dua tabel akan menggandakan seluruh logika stok.
            */
            $table->string('item_type', 40);            // App\Models\Ingredient | Product
            $table->unsignedBigInteger('item_id');

            $table->enum('direction', ['in', 'out']);

            // Selalu positif. Arah ditentukan kolom `direction`.
            $table->decimal('quantity', 16, 4);

            // Nilai bertanda (+/-), disimpan agar rekonsiliasi cukup SUM(delta)
            // tanpa perlu CASE WHEN di setiap query.
            $table->decimal('delta', 16, 4);

            // Saldo sebelum dan sesudah — membuat setiap baris bisa dibaca
            // berdiri sendiri tanpa menjumlahkan ulang seluruh riwayat.
            $table->decimal('balance_before', 16, 4);
            $table->decimal('balance_after', 16, 4);

            $table->enum('source_type', [
                'opening', 'purchase', 'production_consume', 'production_yield',
                'sale', 'return', 'adjustment', 'waste',
            ]);

            // Nomor dokumen asal: id PO, id batch produksi, id nota penjualan.
            $table->string('source_id', 60)->nullable();

            // Harga per satuan dasar saat barang masuk; dipakai menghitung
            // harga rata-rata tertimbang (WAC).
            $table->decimal('unit_cost', 16, 4)->nullable();

            $table->string('note', 500)->nullable();

            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            /*
            | Kunci idempotensi.
            |
            | Mencegah pergerakan yang sama tercatat dua kali ketika permintaan
            | diulang — kasir menekan tombol dua kali, jaringan lambat lalu
            | klien mengirim ulang, atau antrean offline disinkronkan berulang.
            | Lihat §4.1 (S3) DOKUMEN-PERANCANGAN.md.
            */
            $table->string('idempotency_key', 191)->unique();

            $table->timestamps();

            $table->index(['item_type', 'item_id', 'created_at'], 'ledger_item_time_idx');
            $table->index(['source_type', 'source_id'], 'ledger_source_idx');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_ledger');
    }
};
