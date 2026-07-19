<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kunci idempotensi pada batch produksi.
 *
 * Tanpa kolom ini, kunci idempotensi hanya melindungi baris ledger — bukan
 * pembuatan batch. Akibatnya permintaan yang terkirim dua kali menghasilkan
 * BATCH HANTU: dokumen kedua terbuat lengkap dengan rincian pemakaian bahan
 * dan nilai biayanya, tetapi tanpa satu pun baris ledger, karena StockService
 * menolak memotong stok untuk kedua kalinya.
 *
 * Batch semacam itu tidak akan tertangkap `stock:reconcile` — cache stok dan
 * ledger tetap cocok — sehingga bisa bertahan lama tanpa disadari dan membuat
 * laporan biaya produksi menghitung bahan yang sebenarnya tidak pernah keluar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('production_batches', function (Blueprint $table) {
            $table->string('idempotency_key', 191)->nullable()->unique()->after('batch_number');
        });
    }

    public function down(): void
    {
        Schema::table('production_batches', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn('idempotency_key');
        });
    }
};
