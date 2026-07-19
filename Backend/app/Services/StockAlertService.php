<?php

namespace App\Services;

use App\Enums\StockStatus;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\StockAlert;
use App\Models\StockLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Peringatan stok — dibuat hanya saat status BERUBAH.
 *
 * Perbedaan yang mudah terlewat: memeriksa "apakah stok di bawah minimum?"
 * setiap kali halaman dibuka akan memunculkan peringatan yang sama berulang
 * kali sampai stoknya diisi. Yang diminta adalah pemberitahuan saat terjadi
 * PERPINDAHAN — satu peristiwa, satu baris, satu kali muncul.
 *
 * Karena itu service ini dipanggil dari StockService setiap kali stok bergerak,
 * bukan dari controller yang menampilkan data.
 */
class StockAlertService
{
    /**
     * Membandingkan status sebelum dan sesudah satu pergerakan stok.
     *
     * @param  StockStatus  $before  status sebelum pergerakan
     */
    public function evaluate(
        Model $item,
        StockStatus $before,
        ?StockLedger $ledger = null,
    ): ?StockAlert {
        $after = StockStatus::classify(
            (float) $item->current_stock,
            (float) $item->min_stock,
        );

        // Tidak berubah → tidak ada yang perlu diberitahukan. Inilah bedanya
        // dengan pemeriksaan ambang batas biasa: stok yang turun dari 4 kg ke
        // 3 kg sementara minimumnya 5 kg tetap "menipis", jadi diam saja.
        if ($after === $before) {
            return null;
        }

        /*
        | Hanya perubahan yang MEMBURUK yang layak mengganggu orang.
        |
        | Dua syarat, dan keduanya perlu:
        |
        |   1. Keadaan barunya memang bermasalah (habis/kritis/menipis).
        |      Naik ke Aman itu kabar baik, tidak menuntut tindakan apa pun.
        |
        |   2. Keadaannya lebih genting dari sebelumnya.
        |      Tanpa syarat ini, barang yang stoknya BERTAMBAH dari Habis
        |      menjadi Kritis ikut memicu peringatan — padahal itu perbaikan.
        |      Persis yang terjadi saat saldo awal dicatat: setiap bahan baru
        |      berangkat dari nol, sehingga pengisian pertamanya selalu
        |      terbaca sebagai "Habis → Kritis" dan membanjiri lonceng dengan
        |      kabar yang justru menyenangkan.
        */
        if (! $after->isAlert() || $after->severity() <= $before->severity()) {
            return null;
        }

        return StockAlert::create([
            'item_type' => $item::class,
            'item_id' => $item->getKey(),
            'from_status' => $before->value,
            'to_status' => $after->value,
            'stock_at_alert' => (float) $item->current_stock,
            'min_stock_at_alert' => (float) $item->min_stock,
            'stock_ledger_id' => $ledger?->id,
        ]);
    }

    /**
     * Versi yang tidak pernah melempar galat.
     *
     * Dipanggil StockService SETELAH transaksi stok selesai. Kegagalan membuat
     * peringatan tidak boleh membatalkan pembelian atau produksi yang sudah
     * sah — pemberitahuan itu pelengkap, bukan syarat sahnya pergerakan stok.
     */
    public function evaluateSafely(Model $item, StockStatus $before, ?StockLedger $ledger = null): void
    {
        try {
            $this->evaluate($item, $before, $ledger);
        } catch (\Throwable $e) {
            Log::warning('Gagal membuat peringatan stok', [
                'item_type' => $item::class,
                'item_id' => $item->getKey(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Pembacaan
    |--------------------------------------------------------------------------
    */

    public function unreadCount(): int
    {
        return StockAlert::unread()->count();
    }

    public function markAsRead(StockAlert $alert, ?int $userId = null): StockAlert
    {
        if ($alert->is_read) {
            return $alert;
        }

        $alert->update([
            'is_read' => true,
            'read_at' => now(),
            'read_by' => $userId,
        ]);

        return $alert->fresh();
    }

    /** @return int jumlah peringatan yang baru saja ditandai terbaca */
    public function markAllAsRead(?int $userId = null): int
    {
        return StockAlert::unread()->update([
            'is_read' => true,
            'read_at' => now(),
            'read_by' => $userId,
        ]);
    }

    /**
     * Menyusun ulang peringatan dari keadaan stok saat ini.
     *
     * Dipakai artisan command dan seeder untuk barang yang sudah menipis
     * SEBELUM modul ini ada — tanpa ini, peringatan baru muncul setelah ada
     * pergerakan stok berikutnya, padahal masalahnya sudah ada sekarang.
     *
     * Barang yang peringatan terakhirnya sudah sesuai keadaan sekarang
     * dilewati, supaya menjalankan ulang perintah ini tidak menumpuk duplikat.
     *
     * @return int jumlah peringatan baru yang dibuat
     */
    public function syncFromCurrentStock(): int
    {
        $dibuat = 0;

        foreach ([Ingredient::class, Product::class] as $kelas) {
            foreach ($kelas::where('is_active', true)->get() as $item) {
                $status = StockStatus::classify(
                    (float) $item->current_stock,
                    (float) $item->min_stock,
                );

                if (! $status->isAlert()) {
                    continue;
                }

                $terakhir = StockAlert::where('item_type', $kelas)
                    ->where('item_id', $item->getKey())
                    ->latest('id')
                    ->first();

                if ($terakhir && $terakhir->to_status === $status) {
                    continue;
                }

                StockAlert::create([
                    'item_type' => $kelas,
                    'item_id' => $item->getKey(),
                    'from_status' => $terakhir?->to_status?->value,
                    'to_status' => $status->value,
                    'stock_at_alert' => (float) $item->current_stock,
                    'min_stock_at_alert' => (float) $item->min_stock,
                ]);

                $dibuat++;
            }
        }

        return $dibuat;
    }
}
