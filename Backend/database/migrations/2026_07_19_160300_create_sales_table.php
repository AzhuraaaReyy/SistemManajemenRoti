<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Transaksi penjualan — `transaksi_penjualan` pada spesifikasi.
 *
 * Seluruh angka uang DIBEKUKAN di sini. Tarif pajak, nilai diskon, dan total
 * tidak pernah dihitung ulang dari pengaturan yang berlaku sekarang: struk
 * bulan lalu harus tetap menunjukkan angka yang sama walaupun Owner menaikkan
 * tarif pajak minggu ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_number', 20)->unique();

            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();

            $table->decimal('subtotal', 15, 2);

            // Diskon disimpan lengkap dengan bentuk aslinya. Menyimpan nilai
            // rupiahnya saja membuat struk tidak bisa menuliskan "Diskon 10%",
            // dan itu yang ditanyakan pelanggan saat memeriksa struk.
            $table->enum('discount_type', ['none', 'percent', 'amount'])->default('none');
            $table->decimal('discount_value', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);

            // Tarif ikut disimpan, bukan hanya nominalnya — lihat catatan di atas.
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);

            $table->decimal('total', 15, 2);

            $table->enum('payment_method', ['cash', 'qris', 'transfer'])->default('cash');
            $table->decimal('paid_amount', 15, 2);
            $table->decimal('change_amount', 15, 2)->default(0);

            /*
            | HPP saat transaksi terjadi, dijumlahkan dari seluruh baris.
            |
            | Dibekukan agar laba kotor bisa dihitung tanpa menebak berapa harga
            | pokok produk pada saat itu. Tanpa ini, laporan laba bulan lalu akan
            | berubah setiap kali harga bahan naik.
            */
            $table->decimal('cost_total', 15, 2)->default(0);

            $table->enum('status', ['completed', 'voided'])->default('completed');

            $table->string('customer_name', 100)->nullable();
            $table->string('notes', 255)->nullable();

            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason', 255)->nullable();

            /*
            | Kunci idempoten — pelajaran dari "batch hantu" di Modul 4.
            |
            | Kasir yang menekan Bayar dua kali karena jaringan lambat tidak
            | boleh menghasilkan dua transaksi. Melindungi ledger saja tidak
            | cukup: transaksinya sendiri harus ditolak sebelum dibuat.
            */
            $table->string('idempotency_key', 100)->nullable()->unique();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'created_at'], 'sales_status_time_idx');
            $table->index(['cashier_id', 'created_at'], 'sales_cashier_time_idx');
            $table->index('payment_method');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
