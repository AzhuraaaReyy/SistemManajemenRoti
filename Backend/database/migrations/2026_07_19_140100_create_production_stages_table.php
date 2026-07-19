<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracking tahapan produksi — "tracking_produksi" pada spesifikasi.
 *
 * Satu baris mewakili satu percobaan pengerjaan satu tahap pada satu batch.
 * Ketujuh baris dibuat di muka saat batch dibuat (status `pending`), sehingga
 * timeline langsung bisa dirender dan validasi urutan cukup membaca satu baris
 * — tidak perlu menebak tahap mana yang seharusnya ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_stages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('production_batch_id')
                ->constrained('production_batches')
                ->cascadeOnDelete();

            $table->enum('stage', [
                'persiapan', 'mixing', 'fermentasi', 'pembentukan',
                'pemanggangan', 'pendinginan', 'packaging',
            ]);

            // Salinan ProductionStage::sequence(), disimpan agar pengurutan
            // dan pencarian "tahap sebelumnya" bisa dikerjakan database.
            $table->unsignedTinyInteger('sequence');

            /*
            | Percobaan ke berapa.
            |
            | Mengulang tahap tidak menimpa baris lama, melainkan membuat baris
            | baru dengan attempt+1. Waktu percobaan pertama tetap tersimpan
            | sebagai riwayat — penting untuk menelusuri kenapa satu batch
            | memakan waktu jauh lebih lama dari biasanya.
            */
            $table->unsignedTinyInteger('attempt')->default(1);

            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();

            // Operator bisa berbeda tiap tahap — yang menguleni belum tentu
            // yang memanggang.
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('notes', 255)->nullable();

            $table->timestamps();

            $table->unique(['production_batch_id', 'stage', 'attempt'], 'pstage_batch_stage_attempt_uq');
            $table->index(['production_batch_id', 'sequence'], 'pstage_batch_sequence_idx');
            $table->index(['status', 'started_at'], 'pstage_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_stages');
    }
};
