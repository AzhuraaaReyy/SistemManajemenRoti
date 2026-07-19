<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Menambah jenis mutasi `production_cancel` ke kolom enum stock_ledger.
 *
 * Tabel mutasi stok TIDAK dibuat ulang — modul produksi memakai
 * `stock_ledger` yang sama dengan modul pembelian, persis seperti
 * yang dirancang sejak awal. Yang bertambah hanya satu nilai enum.
 */
return new class extends Migration
{
    private const SEBELUM = "'opening','purchase','production_consume','production_yield',"
        ."'sale','return','adjustment','waste'";

    private const SESUDAH = "'opening','purchase','production_consume','production_yield',"
        ."'production_cancel','sale','return','adjustment','waste'";

    public function up(): void
    {
        DB::statement('ALTER TABLE stock_ledger MODIFY COLUMN source_type ENUM('.self::SESUDAH.') NOT NULL');
    }

    public function down(): void
    {
        // Baris yang memakai nilai baru harus dibersihkan lebih dulu, kalau
        // tidak MySQL akan mengubahnya menjadi string kosong secara diam-diam.
        DB::table('stock_ledger')->where('source_type', 'production_cancel')->delete();

        DB::statement('ALTER TABLE stock_ledger MODIFY COLUMN source_type ENUM('.self::SEBELUM.') NOT NULL');
    }
};
