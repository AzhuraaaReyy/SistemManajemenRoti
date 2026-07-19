<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Menambahkan `sale_void` ke jenis mutasi stok.
 *
 * Pembatalan penjualan mengembalikan produk ke stok. Jenisnya dibedakan dari
 * `return` supaya laporan retur tidak menghitung kesalahan pengetikan kasir
 * sebagai keluhan pelanggan.
 */
return new class extends Migration
{
    private const SEBELUM = "'opening','purchase','production_consume','production_yield',"
        ."'production_cancel','sale','return','adjustment','waste'";

    private const SESUDAH = "'opening','purchase','production_consume','production_yield',"
        ."'production_cancel','sale','sale_void','return','adjustment','waste'";

    public function up(): void
    {
        DB::statement('ALTER TABLE stock_ledger MODIFY COLUMN source_type ENUM('.self::SESUDAH.') NOT NULL');
    }

    public function down(): void
    {
        // Baris yang memakai nilai baru harus dibersihkan lebih dulu, kalau
        // tidak MySQL akan mengubahnya menjadi string kosong secara diam-diam.
        DB::table('stock_ledger')->where('source_type', 'sale_void')->delete();

        DB::statement('ALTER TABLE stock_ledger MODIFY COLUMN source_type ENUM('.self::SEBELUM.') NOT NULL');
    }
};
