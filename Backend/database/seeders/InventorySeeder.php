<?php

namespace Database\Seeders;

use App\Models\StockAlert;
use App\Services\InventoryService;
use App\Services\StockAlertService;
use Illuminate\Database\Seeder;

/**
 * Modul 6 — Inventory Management.
 *
 * Seeder ini tidak membuat data stok apa pun. Stoknya sudah ada, dibentuk
 * pembelian dan produksi pada seeder sebelumnya — modul persediaan memang
 * hanya membacanya.
 *
 * Yang dikerjakan di sini cuma menyusun peringatan awal untuk barang yang
 * kadung menipis, karena peringatan biasanya lahir dari perpindahan status
 * saat stok bergerak, sedangkan barang-barang ini tidak akan bergerak lagi
 * sampai ada transaksi berikutnya.
 */
class InventorySeeder extends Seeder
{
    public function __construct(
        private readonly StockAlertService $alerts,
        private readonly InventoryService $inventory,
    ) {
    }

    public function run(): void
    {
        if (StockAlert::exists()) {
            $this->command->info('Peringatan stok sudah ada, seeder dilewati.');

            return;
        }

        $jumlah = $this->alerts->syncFromCurrentStock();

        $ringkasan = $this->inventory->summary();

        $this->command->newLine();
        $this->command->info('Ringkasan persediaan awal:');
        $this->command->table(
            ['Habis', 'Menipis', 'Aman', 'Total Item', 'Nilai Persediaan'],
            [[
                $ringkasan['habis'],
                $ringkasan['menipis'],
                $ringkasan['aman'],
                $ringkasan['total_item'],
                'Rp'.number_format($ringkasan['nilai_persediaan'], 0, ',', '.'),
            ]]
        );

        if ($jumlah > 0) {
            $this->command->warn("{$jumlah} peringatan stok dibuat untuk barang yang perlu perhatian.");
        }
    }
}
