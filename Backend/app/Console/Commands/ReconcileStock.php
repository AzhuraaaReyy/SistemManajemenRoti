<?php

namespace App\Console\Commands;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\StockLedger;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;

/**
 * Membuktikan bahwa cache stok masih sama dengan jumlah seluruh baris ledger.
 *
 * Jalankan terjadwal (harian, malam hari) atau kapan pun ada keraguan soal
 * angka stok. Selama perintah ini bersih, tidak ada satu pun perubahan stok
 * yang terjadi di luar StockService.
 *
 *   php artisan stock:reconcile
 *   php artisan stock:reconcile --fix
 */
class ReconcileStock extends Command
{
    protected $signature = 'stock:reconcile
                            {--fix : Perbaiki cache stok agar sama dengan jumlah ledger}
                            {--quiet-ok : Hanya tampilkan yang bermasalah}';

    protected $description = 'Memeriksa kecocokan cache stok dengan buku besar (ledger) stok';

    public function handle(): int
    {
        $this->info('Memeriksa konsistensi stok terhadap ledger…');
        $this->newLine();

        $masalah = [];
        $diperiksa = 0;

        foreach ([Ingredient::class, Product::class] as $kelas) {
            /** @var class-string<Model> $kelas */
            foreach ($kelas::withTrashed()->cursor() as $item) {
                $diperiksa++;

                $ledger = (float) StockLedger::where('item_type', $kelas)
                    ->where('item_id', $item->getKey())
                    ->sum('delta');

                $cache = (float) $item->current_stock;
                $selisih = round($cache - $ledger, 4);

                if (abs($selisih) < 0.0001) {
                    continue;
                }

                $masalah[] = [
                    class_basename($kelas),
                    $item->code ?? $item->getKey(),
                    $item->name,
                    number_format($cache, 4),
                    number_format($ledger, 4),
                    number_format($selisih, 4),
                ];

                if ($this->option('fix')) {
                    // Ledger adalah kebenaran; cache yang menyesuaikan.
                    // Tidak pernah sebaliknya.
                    $item->current_stock = $ledger;
                    $item->saveQuietly();
                }
            }
        }

        $this->line("Diperiksa: {$diperiksa} barang");
        $this->newLine();

        if ($masalah === []) {
            $this->info('✓ Seluruh cache stok cocok dengan ledger.');

            return self::SUCCESS;
        }

        $this->error('✗ Ditemukan '.count($masalah).' ketidakcocokan:');
        $this->table(['Jenis', 'Kode', 'Nama', 'Cache', 'Ledger', 'Selisih'], $masalah);

        if ($this->option('fix')) {
            $this->newLine();
            $this->warn('Cache sudah disesuaikan mengikuti ledger.');
            $this->warn('Telusuri penyebabnya: ada kode yang menulis current_stock di luar StockService.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->line('Jalankan dengan --fix untuk menyesuaikan cache mengikuti ledger.');

        return self::FAILURE;
    }
}
