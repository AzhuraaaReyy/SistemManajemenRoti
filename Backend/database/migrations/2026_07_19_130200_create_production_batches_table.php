<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Batch produksi — kepala dokumen.
 *
 * Satu baris mewakili satu kali proses produksi: "50 pcs Roti Coklat
 * dikerjakan Budi tanggal 19 Juli".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_batches', function (Blueprint $table) {
            $table->id();

            $table->string('batch_number', 30)->unique();   // PRO-2026-0001

            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();

            /*
            | Resep yang dipakai — DIBEKUKAN.
            |
            | Menyimpan recipe_id saja tidak cukup: isi resep bisa berubah
            | (walau versi terkunci mencegahnya, produk bisa berganti versi
            | aktif). recipe_version dicatat agar laporan lama tetap bisa
            | menjelaskan "batch ini memakai resep versi berapa".
            */
            $table->foreignId('recipe_id')->constrained('recipes')->restrictOnDelete();
            $table->unsignedSmallInteger('recipe_version');

            $table->decimal('target_quantity', 14, 2);       // rencana produksi
            $table->decimal('good_quantity', 14, 2)->nullable();   // hasil layak jual
            $table->decimal('reject_quantity', 14, 2)->default(0); // gagal / rusak

            $table->enum('status', ['in_progress', 'completed', 'cancelled'])->default('in_progress');

            /*
            | Biaya bahan — dibekukan pada harga saat produksi berjalan.
            |
            | Kalau dihitung ulang dari avg_cost terkini, HPP batch bulan lalu
            | akan ikut berubah setiap kali harga bahan naik. Laporan laba
            | periode lampau harus tetap sama angkanya.
            */
            $table->decimal('material_cost', 16, 2)->default(0);
            $table->decimal('cost_per_unit', 16, 2)->nullable();

            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();

            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 255)->nullable();

            $table->text('notes')->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['status', 'started_at']);
            $table->index(['product_id', 'started_at']);
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_batches');
    }
};
