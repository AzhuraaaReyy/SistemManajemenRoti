<?php

namespace Database\Seeders;

use App\Enums\CategoryType;
use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\Supplier;
use App\Services\StockService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Data awal master.
 *
 * Isinya diambil dari prototipe React (Frontend/src/data/mockData.ts) agar
 * tampilan setelah modul ini tersambung tetap sama seperti sebelumnya —
 * hanya kini datanya sungguhan dan tersimpan permanen.
 */
class MasterDataSeeder extends Seeder
{
    public function __construct(private readonly StockService $stock)
    {
    }

    public function run(): void
    {
        $kategoriBahan = $this->seedKategoriBahan();
        $kategoriProduk = $this->seedKategoriProduk();
        $supplier = $this->seedSupplier();
        $bahan = $this->seedBahan($kategoriBahan, $supplier);
        $produk = $this->seedProduk($kategoriProduk);
        $this->seedResep($produk, $bahan);

        $this->command->newLine();
        $this->command->info('Master data berhasil dibuat:');
        $this->command->table(
            ['Entitas', 'Jumlah'],
            [
                ['Kategori', Category::count()],
                ['Supplier', Supplier::count()],
                ['Bahan Baku', Ingredient::count()],
                ['Produk', Product::count()],
                ['Resep (BOM)', Recipe::count()],
            ]
        );
    }

    /** @return array<string, Category> */
    private function seedKategoriBahan(): array
    {
        $daftar = [
            'Tepung' => 'Aneka tepung sebagai bahan dasar adonan',
            'Lemak' => 'Mentega, margarin, dan minyak',
            'Pengembang' => 'Ragi dan bahan pengembang adonan',
            'Pemanis' => 'Gula dan pemanis lainnya',
            'Cairan' => 'Susu, air, dan cairan lain',
            'Topping' => 'Bahan isian dan hiasan',
            'Penyedap' => 'Garam dan penambah rasa',
            'Lain-lain' => 'Bahan yang tidak masuk kategori di atas',
        ];

        $hasil = [];

        foreach ($daftar as $nama => $deskripsi) {
            $hasil[$nama] = Category::firstOrCreate(
                ['type' => CategoryType::BAHAN_BAKU->value, 'slug' => Str::slug($nama)],
                ['name' => $nama, 'description' => $deskripsi, 'is_active' => true],
            );
        }

        return $hasil;
    }

    /** @return array<string, Category> */
    private function seedKategoriProduk(): array
    {
        $daftar = [
            'Roti Manis' => 'Roti dengan isian manis',
            'Roti Tawar' => 'Roti tawar polos dan varian gandum',
            'Pastry' => 'Croissant, danish, dan pastry berlapis',
            'Kue Kering' => 'Aneka kue kering dan cookies',
        ];

        $hasil = [];

        foreach ($daftar as $nama => $deskripsi) {
            $hasil[$nama] = Category::firstOrCreate(
                ['type' => CategoryType::PRODUK->value, 'slug' => Str::slug($nama)],
                ['name' => $nama, 'description' => $deskripsi, 'is_active' => true],
            );
        }

        return $hasil;
    }

    /** @return array<string, Supplier> */
    private function seedSupplier(): array
    {
        $daftar = [
            [
                'name' => 'PT Indofood Sukses Makmur',
                'contact_person' => 'Pak Roni',
                'phone' => '08123456789',
                'email' => 'roni@indofood.example',
                'address' => 'Kawasan Industri Candi Blok A, Semarang',
                'lead_time_days' => 5,
            ],
            [
                'name' => 'Fonterra Anchor Distributor',
                'contact_person' => 'Ibu Maya',
                'phone' => '08234567890',
                'email' => 'maya@anchor.example',
                'address' => 'Kawasan Pergudangan Pluit Jaya, Jakarta',
                'lead_time_days' => 7,
            ],
            [
                'name' => 'Grosir Sumber Makmur',
                'contact_person' => 'Ko Aliong',
                'phone' => '08345678901',
                'email' => null,
                'address' => 'Jl. Pasar Baru No. 12, Kota',
                'lead_time_days' => 1,
            ],
        ];

        $hasil = [];

        foreach ($daftar as $data) {
            $hasil[$data['name']] = Supplier::firstOrCreate(
                ['name' => $data['name']],
                [...$data, 'is_active' => true],
            );
        }

        return $hasil;
    }

    /**
     * @param  array<string, Category>  $kategori
     * @param  array<string, Supplier>  $supplier
     * @return array<string, Ingredient>
     */
    private function seedBahan(array $kategori, array $supplier): array
    {
        $indofood = $supplier['PT Indofood Sukses Makmur'];
        $anchor = $supplier['Fonterra Anchor Distributor'];
        $grosir = $supplier['Grosir Sumber Makmur'];

        // [nama, kategori, satuan dasar, satuan tampilan, faktor,
        //  stok awal (dasar), stok min (dasar), harga rata2 per satuan dasar,
        //  umur simpan (hari), supplier utama]
        $daftar = [
            ['Tepung Terigu Protein Tinggi', 'Tepung', 'g', 'kg', 1000, 2000, 20000, 12.5, 365, $indofood],
            ['Mentega Anchor Premium', 'Lemak', 'g', 'kg', 1000, 500, 5000, 85.0, 180, $anchor],
            ['Ragi Instan Mauripan', 'Pengembang', 'g', 'kg', 1000, 1200, 2000, 65.0, 730, $indofood],
            ['Gula Pasir Rose Brand', 'Pemanis', 'g', 'kg', 1000, 45000, 10000, 14.0, 730, $grosir],
            ['Susu Cair UHT Frisian Flag', 'Cairan', 'ml', 'L', 1000, 12000, 5000, 18.0, 180, $grosir],
            ['Cokelat Meses Ceres', 'Topping', 'g', 'kg', 1000, 8500, 3000, 42.0, 365, $grosir],
            ['Garam Dapur Refina', 'Penyedap', 'g', 'kg', 1000, 800, 1000, 8.0, 1095, $grosir],
            ['Telur Ayam Segar', 'Lain-lain', 'pcs', 'pcs', 1, 15, 50, 2500.0, 21, $grosir],
        ];

        $hasil = [];

        foreach ($daftar as [$nama, $kat, $base, $display, $faktor, $stok, $min, $harga, $umur, $sup]) {
            $baru = ! Ingredient::where('name', $nama)->exists();

            $bahan = Ingredient::firstOrCreate(
                ['name' => $nama],
                [
                    'category_id' => $kategori[$kat]->id,
                    'default_supplier_id' => $sup->id,
                    'base_unit' => $base,
                    'display_unit' => $display,
                    'conversion_factor' => $faktor,
                    'min_stock' => $min,
                    'avg_cost' => $harga,
                    'shelf_life_days' => $umur,
                    'is_active' => true,
                ],
            );

            $bahan->suppliers()->syncWithoutDetaching([$sup->id]);

            // Stok awal ditulis lewat ledger, bukan langsung ke kolom — sama
            // seperti data yang dibuat lewat aplikasi. Data hasil seeding pun
            // harus lolos `php artisan stock:reconcile`.
            if ($baru) {
                $this->stock->recordOpeningBalance(
                    item: $bahan,
                    quantity: $stok,
                    unitCost: $harga,
                    note: 'Saldo awal dari data contoh sistem',
                );
            }

            $hasil[$nama] = $bahan;
        }

        return $hasil;
    }

    /**
     * @param  array<string, Category>  $kategori
     * @return array<string, Product>
     */
    private function seedProduk(array $kategori): array
    {
        $daftar = [
            ['Roti Manis Cokelat', 'Roti Manis', 5000, 25, 20, 'Roti manis lembut dengan isian cokelat meses melimpah.'],
            ['Roti Tawar Gandum', 'Roti Tawar', 15000, 10, 8, 'Roti tawar gandum berserat tinggi yang sehat dan empuk.'],
            ['Croissant Butter Premium', 'Pastry', 18000, 5, 6, 'Pastry renyah berlapis dengan aroma mentega premium.'],
        ];

        $hasil = [];

        foreach ($daftar as [$nama, $kat, $harga, $stok, $min, $deskripsi]) {
            $baru = ! Product::where('name', $nama)->exists();

            $produk = Product::firstOrCreate(
                ['name' => $nama],
                [
                    'category_id' => $kategori[$kat]->id,
                    'unit' => 'pcs',
                    'selling_price' => $harga,
                    'min_stock' => $min,
                    'description' => $deskripsi,
                    'is_active' => true,
                ],
            );

            if ($baru) {
                $this->stock->recordOpeningBalance(
                    item: $produk,
                    quantity: $stok,
                    note: 'Saldo awal dari data contoh sistem',
                );
            }

            $hasil[$nama] = $produk;
        }

        return $hasil;
    }

    /**
     * @param  array<string, Product>  $produk
     * @param  array<string, Ingredient>  $bahan
     */
    private function seedResep(array $produk, array $bahan): void
    {
        $daftar = [
            [
                'produk' => 'Roti Manis Cokelat',
                'nama' => 'Resep Standar Roti Manis Cokelat',
                'yield' => 50,
                'deskripsi' => 'Adonan roti manis lembut dengan isian cokelat meses Ceres melimpah.',
                'items' => [
                    ['Tepung Terigu Protein Tinggi', 5000, 2],
                    ['Gula Pasir Rose Brand', 1000, 1],
                    ['Mentega Anchor Premium', 750, 1],
                    ['Ragi Instan Mauripan', 100, 0],
                    ['Telur Ayam Segar', 10, 5],
                    ['Cokelat Meses Ceres', 1500, 3],
                ],
            ],
            [
                'produk' => 'Roti Tawar Gandum',
                'nama' => 'Resep Standar Roti Tawar Gandum',
                'yield' => 20,
                'deskripsi' => 'Roti tawar gandum berserat tinggi yang sehat dan empuk.',
                'items' => [
                    ['Tepung Terigu Protein Tinggi', 4000, 2],
                    ['Gula Pasir Rose Brand', 500, 1],
                    ['Mentega Anchor Premium', 400, 1],
                    ['Ragi Instan Mauripan', 50, 0],
                    ['Susu Cair UHT Frisian Flag', 1500, 2],
                    ['Garam Dapur Refina', 50, 0],
                ],
            ],
            [
                'produk' => 'Croissant Butter Premium',
                'nama' => 'Resep Standar Croissant Butter',
                'yield' => 30,
                'deskripsi' => 'Pastry renyah berlapis-lapis dengan aroma mentega premium yang kuat.',
                'items' => [
                    ['Tepung Terigu Protein Tinggi', 3000, 3],
                    ['Mentega Anchor Premium', 1500, 2],
                    ['Gula Pasir Rose Brand', 300, 1],
                    ['Ragi Instan Mauripan', 60, 0],
                    ['Susu Cair UHT Frisian Flag', 1000, 2],
                    ['Garam Dapur Refina', 30, 0],
                ],
            ],
        ];

        foreach ($daftar as $data) {
            $product = $produk[$data['produk']];

            if ($product->recipes()->exists()) {
                continue;
            }

            $recipe = Recipe::create([
                'product_id' => $product->id,
                'version' => 1,
                'name' => $data['nama'],
                'yield_quantity' => $data['yield'],
                'yield_unit' => 'pcs',
                'description' => $data['deskripsi'],
                'is_active' => true,
            ]);

            foreach ($data['items'] as $urutan => [$namaBahan, $takaran, $susut]) {
                $recipe->items()->create([
                    'ingredient_id' => $bahan[$namaBahan]->id,
                    'quantity' => $takaran,
                    'waste_percent' => $susut,
                    'sort_order' => $urutan,
                ]);
            }
        }
    }
}
