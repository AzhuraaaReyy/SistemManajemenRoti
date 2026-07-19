<?php

namespace App\Console\Commands;

use App\Services\StockAlertService;
use Illuminate\Console\Command;

/**
 * Menyusun peringatan dari keadaan stok saat ini.
 *
 * Peringatan biasanya lahir dari PERPINDAHAN status saat stok bergerak. Tetapi
 * barang yang sudah menipis sebelum modul ini ada tidak pernah mengalami
 * perpindahan apa pun — ia diam di keadaan buruk tanpa pernah memicu apa-apa.
 * Perintah ini menutup celah itu.
 *
 * Aman dijalankan berulang: barang yang peringatan terakhirnya sudah sesuai
 * keadaan sekarang akan dilewati.
 */
class SyncStockAlerts extends Command
{
    protected $signature = 'stock:alerts {--quiet-empty : Tidak menampilkan apa pun bila tidak ada peringatan baru}';

    protected $description = 'Membuat peringatan untuk barang yang sudah habis atau menipis tetapi belum pernah diberitahukan';

    public function handle(StockAlertService $alerts): int
    {
        $jumlah = $alerts->syncFromCurrentStock();

        if ($jumlah === 0) {
            if (! $this->option('quiet-empty')) {
                $this->info('Tidak ada peringatan baru. Seluruh barang bermasalah sudah tercatat.');
            }

            return self::SUCCESS;
        }

        $this->warn("{$jumlah} peringatan stok baru dibuat.");
        $this->line('Belum dibaca seluruhnya: '.$alerts->unreadCount());

        return self::SUCCESS;
    }
}
