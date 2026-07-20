<?php

namespace Database\Seeders;

use App\Models\Ingredient;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PurchaseService;
use Illuminate\Database\Seeder;

/**
 * Contoh riwayat pembelian.
 *
 * Sengaja dibuat mencakup keempat keadaan yang akan ditemui pengguna:
 * pesanan selesai, diterima sebagian, masih menunggu, dan draft. Dengan
 * begitu dashboard dan daftar langsung terlihat hidup, dan setiap tombol
 * aksi punya contoh data untuk dicoba.
 */
class PurchaseSeeder extends Seeder
{
    public function __construct(private readonly PurchaseService $purchases)
    {
    }

    public function run(): void
    {
        if (PurchaseOrder::exists()) {
            $this->command->info('Data pembelian sudah ada, seeder dilewati.');

            return;
        }

        // Pengadaan adalah pekerjaan gudang — sejak peran dipisah, PO contoh
        // tercatat atas nama Admin Gudang, bukan orang dapur.
        $admin = User::where('email', 'admin_gudang@rotimanis.test')->first();
        $userId = $admin?->id;

        $indofood = Supplier::where('name', 'like', '%Indofood%')->firstOrFail();
        $grosir = Supplier::where('name', 'like', '%Sumber Makmur%')->firstOrFail();
        $anchor = Supplier::where('name', 'like', '%Anchor%')->firstOrFail();

        $terigu = Ingredient::where('name', 'like', '%Terigu%')->firstOrFail();
        $ragi = Ingredient::where('name', 'like', '%Ragi%')->firstOrFail();
        $gula = Ingredient::where('name', 'like', '%Gula%')->firstOrFail();
        $mentega = Ingredient::where('name', 'like', '%Mentega%')->firstOrFail();
        $telur = Ingredient::where('name', 'like', '%Telur%')->firstOrFail();

        /*
        | 1. Pesanan SELESAI — sudah diterima penuh 3 minggu lalu.
        |    Ini yang membuat stok tepung dan ragi punya riwayat pembelian.
        */
        $po1 = $this->purchases->create([
            'supplier_id' => $indofood->id,
            'order_date' => now()->subDays(24)->toDateString(),
            'expected_date' => now()->subDays(19)->toDateString(),
            'shipping_cost' => 150000,
            'notes' => 'Pesanan rutin awal bulan.',
        ], [
            ['ingredient_id' => $terigu->id, 'quantity' => 50, 'unit_price' => 12500],
            ['ingredient_id' => $ragi->id, 'quantity' => 3, 'unit_price' => 64000],
        ], $userId);

        $this->purchases->confirm($po1, $userId);
        $this->purchases->receive(
            po: $po1->fresh(),
            rows: [
                ['purchase_order_item_id' => $po1->items[0]->id, 'quantity' => 50, 'unit_price' => 12500],
                ['purchase_order_item_id' => $po1->items[1]->id, 'quantity' => 3, 'unit_price' => 64000],
            ],
            receiptDate: now()->subDays(19)->toDateString(),
            deliveryNote: 'SJ/IDF/8841',
            notes: 'Barang lengkap, kondisi baik.',
            userId: $userId,
        );

        /*
        | 2. Pesanan DITERIMA SEBAGIAN — supplier baru mengirim separuh.
        |    Menguji tombol "Terima Barang" lanjutan dan "Tutup Pesanan".
        */
        $po2 = $this->purchases->create([
            'supplier_id' => $grosir->id,
            'order_date' => now()->subDays(9)->toDateString(),
            'expected_date' => now()->subDays(8)->toDateString(),
            'notes' => 'Gula dan telur untuk produksi minggu ini.',
        ], [
            ['ingredient_id' => $gula->id, 'quantity' => 25, 'unit_price' => 14200],
            ['ingredient_id' => $telur->id, 'quantity' => 200, 'unit_price' => 2600],
        ], $userId);

        $this->purchases->confirm($po2, $userId);
        $this->purchases->receive(
            po: $po2->fresh(),
            rows: [
                // Gula datang penuh, telur baru separuh.
                ['purchase_order_item_id' => $po2->items[0]->id, 'quantity' => 25, 'unit_price' => 14200],
                ['purchase_order_item_id' => $po2->items[1]->id, 'quantity' => 100, 'unit_price' => 2600],
            ],
            receiptDate: now()->subDays(8)->toDateString(),
            deliveryNote: 'SJ/SM/1207',
            notes: 'Telur baru datang separuh, sisanya menyusul.',
            userId: $userId,
        );

        /*
        | 3. Pesanan MENUNGGU — sudah dikonfirmasi, barang belum datang,
        |    dan sudah lewat tanggal janji sehingga muncul sebagai terlambat.
        */
        $po3 = $this->purchases->create([
            'supplier_id' => $anchor->id,
            'order_date' => now()->subDays(6)->toDateString(),
            'expected_date' => now()->subDays(1)->toDateString(),
            'shipping_cost' => 75000,
            'notes' => 'Stok mentega kritis, mohon diprioritaskan.',
        ], [
            ['ingredient_id' => $mentega->id, 'quantity' => 10, 'unit_price' => 86000],
        ], $userId);

        $this->purchases->confirm($po3, $userId);

        /*
        | 4. DRAFT — masih disusun, belum dikirim ke supplier.
        */
        $this->purchases->create([
            'supplier_id' => $grosir->id,
            'order_date' => now()->toDateString(),
            'expected_date' => now()->addDays(2)->toDateString(),
            'notes' => 'Draft belanja mingguan, menunggu persetujuan.',
        ], [
            ['ingredient_id' => $gula->id, 'quantity' => 20, 'unit_price' => 14500],
            ['ingredient_id' => $telur->id, 'quantity' => 150, 'unit_price' => 2650],
        ], $userId);

        $this->command->newLine();
        $this->command->info('Data pembelian contoh berhasil dibuat:');
        $this->command->table(
            ['Nomor', 'Supplier', 'Status', 'Total'],
            PurchaseOrder::with('supplier')->get()->map(fn (PurchaseOrder $po) => [
                $po->po_number,
                $po->supplier->name,
                $po->status->label(),
                'Rp'.number_format((float) $po->total, 0, ',', '.'),
            ])->all()
        );
    }
}
