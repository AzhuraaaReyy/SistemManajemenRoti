<?php

use App\Enums\ProductionStage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mengisi tahapan untuk batch yang sudah ada sebelum modul tracking dibuat.
 *
 * Tanpa ini, batch lama akan tampil dengan timeline kosong dan progress nol
 * meskipun statusnya "Selesai" — terlihat seperti data rusak.
 *
 * Batch selesai diisi tujuh tahap selesai dengan waktu dibagi rata antara
 * `started_at` dan `finished_at` batch. Itu perkiraan, bukan data asli, dan
 * dicatat di kolom notes supaya siapa pun yang membacanya tahu bedanya.
 */
return new class extends Migration
{
    public function up(): void
    {
        $sekarang = now();
        $stages = ProductionStage::cases();
        $baris = [];

        $batches = DB::table('production_batches')
            ->select('id', 'status', 'started_at', 'finished_at', 'operator_id')
            ->get();

        foreach ($batches as $batch) {
            $selesai = $batch->status === 'completed';

            $mulai = $batch->started_at ? \Carbon\Carbon::parse($batch->started_at) : null;
            $akhir = $batch->finished_at ? \Carbon\Carbon::parse($batch->finished_at) : null;

            // Durasi total dibagi rata ke tujuh tahap. Kasar, tetapi lebih
            // berguna daripada membiarkan waktunya kosong.
            $perTahap = $selesai && $mulai && $akhir
                ? max(1, (int) ($mulai->diffInMinutes($akhir) / count($stages)))
                : 0;

            foreach ($stages as $i => $stage) {
                $mulaiTahap = $selesai && $mulai ? $mulai->copy()->addMinutes($perTahap * $i) : null;
                $selesaiTahap = $selesai && $mulai ? $mulai->copy()->addMinutes($perTahap * ($i + 1)) : null;

                $baris[] = [
                    'production_batch_id' => $batch->id,
                    'stage' => $stage->value,
                    'sequence' => $stage->sequence(),
                    'attempt' => 1,
                    'status' => $selesai ? 'completed' : 'pending',
                    'started_at' => $mulaiTahap,
                    'finished_at' => $selesaiTahap,
                    'operator_id' => $selesai ? $batch->operator_id : null,
                    'notes' => $selesai ? 'Waktu diperkirakan — batch dibuat sebelum modul tracking ada.' : null,
                    'created_at' => $sekarang,
                    'updated_at' => $sekarang,
                ];
            }
        }

        foreach (array_chunk($baris, 200) as $potongan) {
            DB::table('production_stages')->insert($potongan);
        }
    }

    public function down(): void
    {
        DB::table('production_stages')->truncate();
    }
};
