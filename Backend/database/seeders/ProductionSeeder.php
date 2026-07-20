<?php

namespace Database\Seeders;

use App\Enums\ProductionStage as StageEnum;
use App\Models\ProductionBatch;
use App\Models\Product;
use App\Models\User;
use App\Services\ProductionService;
use App\Services\ProductionTrackingService;
use Illuminate\Database\Seeder;

/**
 * Contoh batch produksi.
 *
 * Dibuat setelah PurchaseSeeder, karena produksi butuh stok bahan yang cukup —
 * dan stok itu datang dari penerimaan barang pembelian. Urutan seeder mengikuti
 * alur usaha yang sesungguhnya: beli bahan dulu, baru bisa produksi.
 */
class ProductionSeeder extends Seeder
{
    public function __construct(
        private readonly ProductionService $production,
        private readonly ProductionTrackingService $tracking,
    ) {
    }

    public function run(): void
    {
        if (ProductionBatch::exists()) {
            $this->command->info('Data produksi sudah ada, seeder dilewati.');

            return;
        }

        $operator = User::where('email', 'kepalaproduksi@rotimanis.test')->first();
        $operatorId = $operator?->id;

        $rotiManis = Product::where('name', 'like', '%Roti Manis%')->first();

        if (! $rotiManis) {
            $this->command->warn('Produk contoh tidak ditemukan, seeder produksi dilewati.');

            return;
        }

        /*
        | 1. Batch SELESAI — dijalankan melewati SELURUH tujuh tahap.
        |
        |    Tidak memanggil complete() langsung, melainkan menuntaskan tahap
        |    demi tahap seperti pemakaian sesungguhnya. Dengan begitu timeline
        |    batch contoh terisi penuh dan halaman tracking langsung ada isinya.
        */
        $batch1 = $this->coba(fn () => $this->production->execute(
            productId: $rotiManis->id,
            quantity: 20,
            operatorId: $operatorId,
            notes: 'Produksi pagi untuk etalase.',
        ), 'batch pertama');

        if ($batch1) {
            $this->jalankanSeluruhTahap($batch1, $operatorId, goodQuantity: 19, rejectQuantity: 1);
        }

        /*
        | 2. Batch yang MASIH DIPROSES, berhenti di tengah tahapan.
        |
        |    Persiapan dan Mixing selesai, Fermentasi sedang berjalan —
        |    progress 2/7 = 29%. Memberi contoh nyata untuk dashboard dan
        |    tombol aksi tahap.
        */
        $batch2 = $this->coba(fn () => $this->production->execute(
            productId: $rotiManis->id,
            quantity: 10,
            operatorId: $operatorId,
            notes: 'Batch siang, sedang di proofing.',
        ), 'batch kedua');

        if ($batch2) {
            $this->jalankanSampai($batch2, $operatorId, StageEnum::FERMENTASI);
        }

        $this->command->newLine();

        $batches = ProductionBatch::with('product')->get();

        if ($batches->isEmpty()) {
            $this->command->warn('Tidak ada batch produksi yang berhasil dibuat (stok bahan tidak mencukupi).');

            return;
        }

        $this->command->info('Data produksi contoh berhasil dibuat:');
        $this->command->table(
            ['Nomor', 'Produk', 'Target', 'Hasil', 'Status', 'Biaya Bahan'],
            $batches->map(fn (ProductionBatch $b) => [
                $b->batch_number,
                $b->product->name,
                rtrim(rtrim(number_format((float) $b->target_quantity, 2), '0'), '.'),
                $b->good_quantity !== null
                    ? rtrim(rtrim(number_format((float) $b->good_quantity, 2), '0'), '.')
                    : '—',
                $b->status->label(),
                'Rp'.number_format((float) $b->material_cost, 0, ',', '.'),
            ])->all()
        );
    }

    /**
     * Menjalankan pembuatan batch dan melaporkan bila stok tidak mencukupi.
     *
     * Seeder tidak boleh gagal total hanya karena stok contoh kurang — cukup
     * beri tahu, lalu lanjutkan.
     */
    private function coba(callable $aksi, string $label): ?ProductionBatch
    {
        try {
            return $aksi();
        } catch (\Throwable $e) {
            $this->command->warn("Gagal membuat {$label}: ".$e->getMessage());

            return null;
        }
    }

    /**
     * Menuntaskan seluruh tujuh tahap sampai batch selesai.
     *
     * Menyelesaikan tahap Packaging otomatis menutup batch dan menambah stok
     * produk jadi — persis seperti alur di aplikasi.
     */
    private function jalankanSeluruhTahap(
        ProductionBatch $batch,
        ?int $operatorId,
        float $goodQuantity,
        float $rejectQuantity,
    ): void {
        foreach (StageEnum::cases() as $stage) {
            $this->tracking->start($batch->fresh(), $stage, $operatorId);

            $this->tracking->finish(
                batch: $batch->fresh(),
                stage: $stage,
                operatorId: $operatorId,
                notes: $stage->isLast() ? 'Satu roti gosong di oven belakang.' : null,
                goodQuantity: $stage->isLast() ? $goodQuantity : null,
                rejectQuantity: $stage->isLast() ? $rejectQuantity : 0,
            );
        }
    }

    /**
     * Menuntaskan tahap sampai sebelum $berhentiDi, lalu memulai tahap itu
     * tanpa menyelesaikannya — meninggalkan batch dalam keadaan berjalan.
     */
    private function jalankanSampai(ProductionBatch $batch, ?int $operatorId, StageEnum $berhentiDi): void
    {
        foreach (StageEnum::cases() as $stage) {
            if ($stage->sequence() > $berhentiDi->sequence()) {
                break;
            }

            $this->tracking->start($batch->fresh(), $stage, $operatorId);

            if ($stage->sequence() < $berhentiDi->sequence()) {
                $this->tracking->finish($batch->fresh(), $stage, $operatorId);
            }
        }
    }
}
