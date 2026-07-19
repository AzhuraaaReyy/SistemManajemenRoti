<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menambah harga pokok rata-rata pada produk jadi.
 *
 * Sampai Modul 3, satu-satunya barang yang stoknya bertambah adalah bahan
 * baku — dan hanya `ingredients` yang punya kolom `avg_cost`. Modul Produksi
 * adalah yang pertama menambah stok PRODUK, dan di situlah kekurangan ini
 * tersingkap: StockService mencoba memperbarui harga rata-rata produk pada
 * kolom yang belum ada.
 *
 * Kolom ini bukan sekadar penambal. Ia menyimpan HPP nyata yang berbeda dari
 * HPP teoretis:
 *
 *   Product::unitCost()  → hitungan dari resep memakai harga bahan HARI INI
 *   products.avg_cost    → rata-rata tertimbang dari biaya produksi yang
 *                          BENAR-BENAR terjadi, batch demi batch
 *
 * Selisih keduanya menunjukkan seberapa jauh biaya nyata menyimpang dari
 * perhitungan resep — dan itulah dasar laporan laba kotor di Modul 10.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('avg_cost', 16, 4)->default(0)->after('selling_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('avg_cost');
        });
    }
};
