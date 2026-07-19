<?php

namespace App\Services;

use App\Enums\ProductionStage as StageEnum;
use App\Enums\ProductionStatus;
use App\Enums\StageStatus;
use App\Models\ProductionBatch;
use App\Models\ProductionStage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * State machine tahapan produksi.
 *
 *   Persiapan → Mixing → Fermentasi → Pembentukan →
 *   Pemanggangan → Pendinginan → Packaging → [batch Selesai]
 *
 * Aturan pokok: sebuah tahap hanya boleh dimulai bila tahap sebelumnya sudah
 * selesai. Tidak ada lompatan.
 *
 * Modul ini TIDAK menulis stok sendiri. Ketika Packaging selesai, ia memanggil
 * ProductionService::complete() yang sudah ada — di situlah stok produk jadi
 * bertambah dan tercatat di stock_ledger.
 */
class ProductionTrackingService
{
    /*
    | ProductionService TIDAK disuntikkan lewat konstruktor.
    |
    | Keduanya saling membutuhkan: ProductionService memanggil
    | createStagesFor() setiap batch dibuat, sementara service ini memanggil
    | ProductionService::complete() saat tahap terakhir selesai. Menyuntikkan
    | keduanya lewat konstruktor membuat container Laravel berputar tanpa henti.
    |
    | Lingkaran diputus di titik yang paling jarang dipanggil: complete() hanya
    | terjadi sekali di ujung batch, sedangkan createStagesFor() terjadi pada
    | setiap pembuatan batch.
    */
    private function production(): ProductionService
    {
        return app(ProductionService::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Penyiapan
    |--------------------------------------------------------------------------
    */

    /**
     * Membuat ketujuh baris tahap saat batch dibuat.
     *
     * Dibuat di muka, semuanya berstatus `pending`. Dengan begitu timeline
     * langsung bisa dirender penuh, dan validasi urutan cukup membaca baris
     * yang sudah ada alih-alih menebak tahap mana yang seharusnya menyusul.
     */
    public function createStagesFor(ProductionBatch $batch): void
    {
        if ($batch->stages()->exists()) {
            return;
        }

        $baris = array_map(fn (StageEnum $stage) => [
            'production_batch_id' => $batch->id,
            'stage' => $stage->value,
            'sequence' => $stage->sequence(),
            'attempt' => 1,
            'status' => StageStatus::PENDING->value,
            'created_at' => now(),
            'updated_at' => now(),
        ], StageEnum::cases());

        ProductionStage::insert($baris);
    }

    /*
    |--------------------------------------------------------------------------
    | Aksi tahap
    |--------------------------------------------------------------------------
    */

    /** Memulai sebuah tahap. */
    public function start(ProductionBatch $batch, StageEnum $stage, ?int $operatorId = null): ProductionStage
    {
        $this->pastikanBatchBerjalan($batch);

        return DB::transaction(function () use ($batch, $stage, $operatorId) {
            $baris = $this->currentRow($batch, $stage);

            if ($baris->status === StageStatus::IN_PROGRESS) {
                throw ValidationException::withMessages([
                    'stage' => "Tahap {$stage->label()} memang sudah berjalan sejak "
                        .$baris->started_at?->format('H:i').'.',
                ]);
            }

            if ($baris->status === StageStatus::COMPLETED) {
                throw ValidationException::withMessages([
                    'stage' => "Tahap {$stage->label()} sudah selesai. "
                        .'Gunakan "Ulangi Tahap" bila perlu dikerjakan ulang.',
                ]);
            }

            $this->pastikanTahapSebelumnyaSelesai($batch, $stage);

            $baris->update([
                'status' => StageStatus::IN_PROGRESS->value,
                'started_at' => now(),
                'operator_id' => $operatorId,
            ]);

            return $baris->fresh('operator');
        });
    }

    /**
     * Menyelesaikan sebuah tahap.
     *
     * Bila tahap terakhir (Packaging) yang diselesaikan, batch ikut ditutup
     * dan stok produk jadi bertambah — lewat ProductionService::complete().
     *
     * @param  float|null  $goodQuantity   wajib saat tahap terakhir
     * @param  float  $rejectQuantity      produk gagal, hanya saat tahap terakhir
     */
    public function finish(
        ProductionBatch $batch,
        StageEnum $stage,
        ?int $operatorId = null,
        ?string $notes = null,
        ?float $goodQuantity = null,
        float $rejectQuantity = 0,
        ?string $idempotencyKey = null,
    ): ProductionStage {
        $this->pastikanBatchBerjalan($batch);

        if ($stage->isLast() && $goodQuantity === null) {
            throw ValidationException::withMessages([
                'good_quantity' => 'Menyelesaikan tahap Packaging berarti produksi selesai, '
                    .'jadi jumlah hasil layak jual wajib diisi. Isi 0 bila seluruhnya gagal.',
            ]);
        }

        return DB::transaction(function () use (
            $batch, $stage, $operatorId, $notes, $goodQuantity, $rejectQuantity, $idempotencyKey
        ) {
            $baris = $this->currentRow($batch, $stage);

            if ($baris->status === StageStatus::PENDING) {
                throw ValidationException::withMessages([
                    'stage' => "Tahap {$stage->label()} belum dimulai, jadi belum bisa diselesaikan.",
                ]);
            }

            if ($baris->status === StageStatus::COMPLETED) {
                throw ValidationException::withMessages([
                    'stage' => "Tahap {$stage->label()} sudah selesai sebelumnya.",
                ]);
            }

            $baris->update([
                'status' => StageStatus::COMPLETED->value,
                'finished_at' => now(),
                'operator_id' => $operatorId ?? $baris->operator_id,
                'notes' => $notes ?? $baris->notes,
            ]);

            /*
            | Tahap terakhir selesai → batch selesai.
            |
            | Logika penambahan stok TIDAK ditulis ulang di sini. Modul Produksi
            | sudah memilikinya lengkap dengan perhitungan HPP, pembekuan biaya,
            | dan pencatatan ledger — modul ini hanya memanggilnya.
            */
            if ($stage->isLast()) {
                $this->production()->complete(
                    batch: $batch,
                    goodQuantity: $goodQuantity ?? 0,
                    rejectQuantity: $rejectQuantity,
                    userId: $operatorId,
                    notes: null,
                    idempotencyKey: $idempotencyKey,
                );
            }

            return $baris->fresh('operator');
        });
    }

    /**
     * Mengulang tahap yang baru saja selesai.
     *
     * Hanya tahap terakhir yang selesai yang boleh diulang — mundur dua tahap
     * berarti tahap di antaranya menjadi tidak konsisten.
     *
     * Baris lama TIDAK ditimpa. Percobaan baru dibuat dengan attempt+1,
     * sehingga waktu percobaan pertama tetap tersimpan sebagai riwayat.
     */
    public function repeat(
        ProductionBatch $batch,
        StageEnum $stage,
        string $reason,
        ?int $operatorId = null,
    ): ProductionStage {
        $this->pastikanBatchBerjalan($batch);

        return DB::transaction(function () use ($batch, $stage, $reason, $operatorId) {
            $baris = $this->currentRow($batch, $stage);

            if ($baris->status !== StageStatus::COMPLETED) {
                throw ValidationException::withMessages([
                    'stage' => "Tahap {$stage->label()} belum selesai, jadi tidak ada yang perlu diulang.",
                ]);
            }

            $terakhirSelesai = $this->lastCompletedStage($batch);

            if ($terakhirSelesai?->value !== $stage->value) {
                throw ValidationException::withMessages([
                    'stage' => sprintf(
                        'Hanya tahap yang terakhir selesai (%s) yang boleh diulang. '
                        .'Mengulang %s berarti melompat mundur dan membuat tahap sesudahnya '
                        .'menjadi tidak konsisten.',
                        $terakhirSelesai?->label() ?? '—',
                        $stage->label(),
                    ),
                ]);
            }

            // Catat alasan pada percobaan yang gagal, supaya riwayatnya jelas.
            $baris->update([
                'notes' => trim(($baris->notes ? $baris->notes.' · ' : '').'Diulang: '.$reason),
            ]);

            $this->kembalikanTahapSesudahnya($batch, $stage, $reason);

            return ProductionStage::create([
                'production_batch_id' => $batch->id,
                'stage' => $stage->value,
                'sequence' => $stage->sequence(),
                'attempt' => $baris->attempt + 1,
                'status' => StageStatus::IN_PROGRESS->value,
                'started_at' => now(),
                'operator_id' => $operatorId,
                'notes' => 'Pengulangan: '.$reason,
            ])->fresh('operator');
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Pembacaan
    |--------------------------------------------------------------------------
    */

    /**
     * Keadaan tiap tahap saat ini — satu baris per tahap, percobaan terakhir.
     *
     * @return Collection<int, ProductionStage>
     */
    public function currentStages(ProductionBatch $batch): Collection
    {
        return $batch->stages()
            ->with('operator:id,name')
            ->get()
            ->groupBy(fn (ProductionStage $s) => $s->stage->value)
            ->map(fn (Collection $percobaan) => $percobaan->sortByDesc('attempt')->first())
            ->sortBy(fn (ProductionStage $s) => $s->sequence)
            ->values();
    }

    /** Seluruh baris termasuk percobaan lama, untuk tabel riwayat. */
    public function history(ProductionBatch $batch): Collection
    {
        return $batch->stages()
            ->with('operator:id,name')
            ->orderBy('sequence')
            ->orderBy('attempt')
            ->get();
    }

    /**
     * Progress = (jumlah tahap selesai / total tahap) × 100.
     *
     * Rumus persis seperti spesifikasi. Tahap yang sedang berjalan belum
     * dihitung — baru masuk hitungan setelah benar-benar selesai.
     */
    public function progressPercent(ProductionBatch $batch): float
    {
        $selesai = $this->currentStages($batch)
            ->filter(fn (ProductionStage $s) => $s->isCompleted())
            ->count();

        return round(($selesai / StageEnum::total()) * 100, 2);
    }

    /**
     * Tahap yang sedang dikerjakan, atau tahap berikutnya yang menunggu.
     *
     * Mengembalikan null bila seluruh tahap sudah selesai.
     */
    public function currentStage(ProductionBatch $batch): ?ProductionStage
    {
        $stages = $this->currentStages($batch);

        return $stages->firstWhere(fn (ProductionStage $s) => $s->isRunning())
            ?? $stages->first(fn (ProductionStage $s) => $s->status === StageStatus::PENDING);
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(ProductionBatch $batch): array
    {
        $stages = $this->currentStages($batch);
        $selesai = $stages->filter(fn (ProductionStage $s) => $s->isCompleted())->count();
        $berjalan = $stages->firstWhere(fn (ProductionStage $s) => $s->isRunning());
        $saatIni = $this->currentStage($batch);

        return [
            'total_stages' => StageEnum::total(),
            'completed_stages' => $selesai,
            'progress_percent' => round(($selesai / StageEnum::total()) * 100, 2),
            'current_stage' => $saatIni?->stage->value,
            'current_stage_label' => $saatIni?->stage->label(),
            'current_stage_status' => $saatIni?->status->value,
            'is_running' => $berjalan !== null,
            'running_since' => $berjalan?->started_at?->toIso8601String(),
            'running_minutes' => $berjalan?->durationMinutes(),
            'is_overdue' => $berjalan?->isOverdue() ?? false,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Pembantu
    |--------------------------------------------------------------------------
    */

    /** Baris percobaan terakhir untuk satu tahap. */
    private function currentRow(ProductionBatch $batch, StageEnum $stage): ProductionStage
    {
        $baris = ProductionStage::where('production_batch_id', $batch->id)
            ->where('stage', $stage->value)
            ->orderByDesc('attempt')
            ->lockForUpdate()
            ->first();

        if (! $baris) {
            throw ValidationException::withMessages([
                'stage' => "Tahap {$stage->label()} tidak ditemukan pada batch {$batch->batch_number}.",
            ]);
        }

        return $baris;
    }

    private function pastikanBatchBerjalan(ProductionBatch $batch): void
    {
        if ($batch->status !== ProductionStatus::IN_PROGRESS) {
            throw ValidationException::withMessages([
                'status' => "Batch {$batch->batch_number} berstatus {$batch->status->label()}, "
                    .'tahapannya tidak dapat diubah lagi.',
            ]);
        }
    }

    /**
     * Inti aturan "tidak boleh melompat".
     *
     * Pesannya menyebut tahap mana yang harus dituntaskan lebih dulu, bukan
     * sekadar "tidak boleh" — supaya pengguna tahu harus mengerjakan apa.
     */
    private function pastikanTahapSebelumnyaSelesai(ProductionBatch $batch, StageEnum $stage): void
    {
        $sebelumnya = $stage->previous();

        if (! $sebelumnya) {
            return;
        }

        $barisSebelumnya = $this->currentRow($batch, $sebelumnya);

        if ($barisSebelumnya->status !== StageStatus::COMPLETED) {
            throw ValidationException::withMessages([
                'stage' => sprintf(
                    'Tahap %s belum bisa dimulai karena tahap %s %s. '
                    .'Tuntaskan %s terlebih dahulu.',
                    $stage->label(),
                    $sebelumnya->label(),
                    $barisSebelumnya->status === StageStatus::IN_PROGRESS
                        ? 'masih berjalan'
                        : 'belum dimulai',
                    $sebelumnya->label(),
                ),
            ]);
        }
    }

    /**
     * Mengembalikan tahap SESUDAH $stage yang terlanjur berjalan ke antrean.
     *
     * Tanpa ini sistem bisa punya dua tahap berjalan sekaligus. Contohnya:
     * Fermentasi selesai, Pembentukan sudah dimulai, lalu operator sadar
     * adonannya kurang mengembang dan mengulang Fermentasi. Fermentasi kembali
     * berjalan, sementara Pembentukan juga masih berjalan — padahal adonan
     * yang dibentuk itu justru yang sedang difermentasi ulang.
     *
     * Tahap sesudahnya pasti belum selesai (yang boleh diulang hanya tahap
     * terakhir yang selesai), jadi yang hilang hanya waktu mulainya — dan itu
     * pun tetap dicatat di kolom notes agar jejaknya tidak lenyap.
     */
    private function kembalikanTahapSesudahnya(
        ProductionBatch $batch,
        StageEnum $stage,
        string $reason,
    ): void {
        $sesudahnya = ProductionStage::where('production_batch_id', $batch->id)
            ->where('sequence', '>', $stage->sequence())
            ->where('status', StageStatus::IN_PROGRESS->value)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($sesudahnya as $baris) {
            $jejak = sprintf(
                'Dibatalkan (mulai %s) karena tahap %s diulang: %s',
                $baris->started_at?->format('d/m H:i') ?? '—',
                $stage->label(),
                $reason,
            );

            $baris->update([
                'status' => StageStatus::PENDING->value,
                'started_at' => null,
                'finished_at' => null,
                'notes' => trim(($baris->notes ? $baris->notes.' · ' : '').$jejak),
            ]);
        }
    }

    /** Tahap terakhir yang berstatus selesai. */
    private function lastCompletedStage(ProductionBatch $batch): ?StageEnum
    {
        $terakhir = $this->currentStages($batch)
            ->filter(fn (ProductionStage $s) => $s->isCompleted())
            ->sortByDesc('sequence')
            ->first();

        return $terakhir?->stage;
    }
}
