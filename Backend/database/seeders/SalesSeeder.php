<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Services\SaleService;
use App\Services\SettingService;
use Illuminate\Database\Seeder;

/**
 * Contoh transaksi penjualan.
 *
 * Dijalankan setelah ProductionSeeder karena penjualan butuh stok produk jadi,
 * dan stok itu datang dari produksi. Urutannya mengikuti alur usaha yang
 * sesungguhnya: beli bahan → produksi → jual.
 */
class SalesSeeder extends Seeder
{
    public function __construct(
        private readonly SaleService $sales,
        private readonly SettingService $settings,
    ) {
    }

    public function run(): void
    {
        // Pengaturan harus ada lebih dulu — SaleService membaca tarif pajak
        // dan batas diskon dari sana saat menghitung total.
        $dibuat = $this->settings->sync();

        if ($dibuat > 0) {
            $this->command->info("{$dibuat} pengaturan bawaan dibuat.");
        }

        if (Sale::exists()) {
            $this->command->info('Data penjualan sudah ada, seeder dilewati.');

            return;
        }

        $kasir = User::where('email', 'kasir@rotimanis.test')->first();
        $owner = User::where('email', 'owner@rotimanis.test')->first();

        $produk = Product::where('is_active', true)
            ->where('current_stock', '>', 0)
            ->where('selling_price', '>', 0)
            ->orderByDesc('current_stock')
            ->get();

        if ($produk->isEmpty()) {
            $this->command->warn('Tidak ada produk berstok, seeder penjualan dilewati.');

            return;
        }

        $utama = $produk->first();
        $kedua = $produk->skip(1)->first() ?? $utama;

        /*
        | Empat transaksi contoh yang sengaja berbeda-beda bentuknya, supaya
        | halaman riwayat dan dashboard langsung menunjukkan variasi nyata:
        | tunai dengan kembalian, QRIS, ada diskon, dan satu yang dibatalkan.
        */
        $this->coba(fn () => $this->sales->create(
            items: [['product_id' => $utama->id, 'quantity' => 3]],
            data: ['payment_method' => 'cash', 'paid_amount' => 50000, 'customer_name' => 'Bu Ratna'],
            cashierId: $kasir?->id,
        ), 'transaksi tunai');

        $this->coba(fn () => $this->sales->create(
            items: [
                ['product_id' => $utama->id, 'quantity' => 2],
                ['product_id' => $kedua->id, 'quantity' => 1],
            ],
            data: ['payment_method' => 'qris'],
            cashierId: $kasir?->id,
        ), 'transaksi QRIS');

        $this->coba(fn () => $this->sales->create(
            items: [['product_id' => $utama->id, 'quantity' => 5]],
            data: [
                'payment_method' => 'cash',
                'paid_amount' => 100000,
                'discount_type' => 'percent',
                'discount_value' => 10,
                'notes' => 'Pelanggan langganan.',
            ],
            cashierId: $owner?->id,
        ), 'transaksi berdiskon');

        $dibatalkan = $this->coba(fn () => $this->sales->create(
            items: [['product_id' => $kedua->id, 'quantity' => 1]],
            data: ['payment_method' => 'cash', 'paid_amount' => 20000],
            cashierId: $kasir?->id,
        ), 'transaksi yang akan dibatalkan');

        if ($dibatalkan) {
            $this->sales->void(
                $dibatalkan,
                'Salah input jumlah, pelanggan hanya membeli setengahnya.',
                $owner?->id,
            );
        }

        $this->command->newLine();

        $daftar = Sale::with('cashier')->get();

        $this->command->info('Data penjualan contoh berhasil dibuat:');
        $this->command->table(
            ['Nomor', 'Kasir', 'Metode', 'Status', 'Total'],
            $daftar->map(fn (Sale $s) => [
                $s->sale_number,
                $s->cashier?->name ?? '—',
                $s->payment_method->label(),
                $s->status->label(),
                'Rp'.number_format((float) $s->total, 0, ',', '.'),
            ])->all()
        );

        $ringkasan = $this->sales->dailySummary();
        $this->command->line(sprintf(
            'Omzet hari ini: Rp%s dari %d transaksi · tunai di laci Rp%s',
            number_format($ringkasan['omzet'], 0, ',', '.'),
            $ringkasan['transaksi'],
            number_format($ringkasan['tunai_di_laci'], 0, ',', '.'),
        ));
    }

    /**
     * Seeder tidak boleh gagal total hanya karena stok contoh kurang —
     * cukup beri tahu, lalu lanjutkan.
     */
    private function coba(callable $aksi, string $label): ?Sale
    {
        try {
            return $aksi();
        } catch (\Throwable $e) {
            $this->command->warn("Gagal membuat {$label}: ".$e->getMessage());

            return null;
        }
    }
}
