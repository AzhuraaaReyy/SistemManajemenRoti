<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /*
    | CATATAN: JANGAN memakai trait WithoutModelEvents di sini.
    |
    | Trait itu mematikan seluruh event model selama seeding, padahal beberapa
    | kolom wajib justru diisi oleh event:
    |
    |   Supplier / Ingredient / Product -> `creating` mengisi kolom `code`
    |                                      (SUP-0001, BB-0003, PRD-0002)
    |   Category                        -> `saving` mengisi kolom `slug`
    |
    | Dengan trait tersebut aktif, seeding gagal dengan pesan
    | "Field 'code' doesn't have a default value" — dan kalau kolomnya kebetulan
    | nullable, datanya akan tersimpan tanpa kode sama sekali tanpa error apa pun.
    */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,        // Modul 1 — Authentication
            MasterDataSeeder::class,  // Modul 2 — Master Data
            PurchaseSeeder::class,    // Modul 3 — Pembelian
            ProductionSeeder::class,  // Modul 4 — Produksi (butuh stok dari pembelian)
            SalesSeeder::class,       // Modul 7 — Penjualan (butuh stok produk dari produksi)
            InventorySeeder::class,   // Modul 6 — Persediaan (harus terakhir: membaca stok akhir)
            // Modul berikutnya menambahkan seeder-nya di sini.
        ]);
    }
}
