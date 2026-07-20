<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Inventory\InventoryController;
use App\Http\Controllers\Api\V1\OwnerDashboardController;
use App\Http\Controllers\Api\V1\Inventory\StockAlertController;
use App\Http\Controllers\Api\V1\MasterData\CategoryController;
use App\Http\Controllers\Api\V1\MasterData\IngredientController;
use App\Http\Controllers\Api\V1\MasterData\ProductController;
use App\Http\Controllers\Api\V1\MasterData\RecipeController;
use App\Http\Controllers\Api\V1\MasterData\SupplierController;
use App\Http\Controllers\Api\V1\Production\ProductionBatchController;
use App\Http\Controllers\Api\V1\Production\ProductionDashboardController;
use App\Http\Controllers\Api\V1\Production\ProductionTrackingController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\Purchase\PurchaseDashboardController;
use App\Http\Controllers\Api\V1\Purchase\PurchaseOrderController;
use App\Http\Controllers\Api\V1\Sales\SaleController;
use App\Http\Controllers\Api\V1\Sales\SalesDashboardController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API — Sistem Manajemen Roti
|--------------------------------------------------------------------------
|
| Seluruh rute di berkas ini berawalan /api/v1 (diatur di bootstrap/app.php).
|
| Lapisan penjagaan, berurutan:
|   auth:api  -> token JWT valid
|   active    -> akun belum dinonaktifkan sejak token diterbitkan
|   role:...  -> peran memang berhak atas endpoint tersebut
|
| Modul 1 — Authentication & User Management
| Modul 2 — Master Data (kategori, supplier, bahan baku, produk, resep/BOM)
|
*/

Route::prefix('auth')->group(function () {
    // --- Publik ---
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);

    // --- Perlu token ---
    Route::middleware(['auth:api', 'active'])->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('roles', [AuthController::class, 'roles']);
    });
});

Route::middleware(['auth:api', 'active'])->group(function () {

    /*
    | Profil — setiap pengguna mengelola datanya sendiri, tanpa batasan peran.
    */
    Route::prefix('profile')->group(function () {
        Route::get('/', [ProfileController::class, 'show']);
        Route::post('/', [ProfileController::class, 'update']);
        Route::put('password', [ProfileController::class, 'changePassword']);
        Route::delete('avatar', [ProfileController::class, 'deleteAvatar']);
        Route::get('activities', [ProfileController::class, 'activities']);
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 8 — Dashboard Owner
    |--------------------------------------------------------------------------
    |
    | Ringkasan tingkat tertinggi: agregasi penjualan, produksi, persediaan,
    | dan pembelian dalam satu permintaan. Murni membaca, tanpa tabel baru.
    |
    | Khusus Owner — memakai middleware `role` yang sama dengan seluruh sistem.
    */
    Route::get('dashboard/owner', [OwnerDashboardController::class, 'index'])
        ->middleware('role:owner');

    /*
    |--------------------------------------------------------------------------
    | Modul 9 — Laporan
    |--------------------------------------------------------------------------
    |
    | Pusat pelaporan formal, terpisah dari Dashboard Owner yang ringkas dan
    | real-time. Murni membaca — tidak ada tabel baru.
    |
    | Khusus Owner: laporan memuat laba kotor, HPP, dan performa per kasir —
    | angka yang tidak dibagikan ke staf.
    |
    | Rute export didaftarkan SEBELUM rute {type} agar tidak tertangkap polanya.
    */
    Route::prefix('reports')->middleware('role:owner')->group(function () {
        Route::get('types', [ReportController::class, 'types']);
        Route::get('{type}/export/excel', [ReportController::class, 'exportExcel']);
        Route::get('{type}/export/pdf', [ReportController::class, 'exportPdf']);
        Route::get('{type}', [ReportController::class, 'show']);
    });

    /*
    | Manajemen Pengguna — khusus Owner.
    */
    Route::middleware('role:owner')->group(function () {
        Route::get('users/statistics', [UserController::class, 'statistics']);
        Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
        Route::apiResource('users', UserController::class);
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 2 — Master Data
    |--------------------------------------------------------------------------
    |
    | Kasir tidak diberi akses sama sekali: ia hanya perlu membaca daftar
    | produk, dan itu disediakan endpoint penjualan tersendiri pada Modul 7 —
    | bukan lewat master data.
    |
    | Sisanya dipilah antara gudang dan dapur, dan pemilahannya TIDAK bisa utuh
    | per sumber daya. Kepala Produksi menyusun resep dari bahan baku; kalau
    | `ingredients` menjadi milik gudang sepenuhnya, pemilih bahan pada formulir
    | resep akan 403 dan resep tidak bisa dibuat sama sekali. Karena itu bahan
    | baku dan produk dipilah BACA vs TULIS, bukan dipilah utuh:
    |
    |   Kategori     baca+tulis  Gudang & Dapur   (dipakai keduanya, punya kolom
    |                                              `type`; menyaringnya per peran
    |                                              berarti menyembunyikan aturan
    |                                              otorisasi di dalam query)
    |   Supplier     baca+tulis  Gudang
    |   Bahan Baku   baca        Gudang & Dapur
    |                tulis       Gudang
    |   Produk       baca        Gudang & Dapur   (gudang melihatnya lewat stok
    |                                              produk jadi di Persediaan)
    |                tulis       Dapur
    |   Resep        baca+tulis  Dapur
    |
    | Rute statis (options, units, statistics) didaftarkan SEBELUM pola {id}
    | agar tidak tertangkap dan dikira detail sebuah data. Urutan itu berlaku
    | lintas kelompok middleware — Laravel mencocokkan sesuai urutan pendaftaran,
    | bukan per kelompok.
    */
    Route::prefix('master')->group(function () {

        // --- Kategori: dipakai bersama ---
        Route::middleware('role:owner,admin_gudang,kepala_produksi')->group(function () {
            Route::get('categories/options', [CategoryController::class, 'options']);
            Route::apiResource('categories', CategoryController::class);
        });

        // --- Supplier: gudang ---
        Route::middleware('role:owner,admin_gudang')->group(function () {
            Route::get('suppliers/options', [SupplierController::class, 'options']);
            Route::apiResource('suppliers', SupplierController::class);
        });

        // --- Bahan Baku: statis dulu, baru pola {ingredient} ---
        Route::middleware('role:owner,admin_gudang,kepala_produksi')->group(function () {
            Route::get('ingredients/options', [IngredientController::class, 'options']);
            Route::get('ingredients/units', [IngredientController::class, 'units']);
        });

        Route::middleware('role:owner,admin_gudang')->group(function () {
            Route::get('ingredients/statistics', [IngredientController::class, 'statistics']);
            Route::get('ingredients/{ingredient}/ledger', [IngredientController::class, 'ledger']);
        });

        // Dapur boleh melihat bahan baku — tanpa itu resep tidak bisa disusun.
        Route::middleware('role:owner,admin_gudang,kepala_produksi')->group(function () {
            Route::apiResource('ingredients', IngredientController::class)->only(['index', 'show']);
        });

        Route::middleware('role:owner,admin_gudang')->group(function () {
            Route::apiResource('ingredients', IngredientController::class)->except(['index', 'show']);
        });

        // --- Produk: gudang melihat, dapur mengubah ---
        Route::middleware('role:owner,admin_gudang,kepala_produksi')->group(function () {
            Route::get('products/options', [ProductController::class, 'options']);
            Route::apiResource('products', ProductController::class)->only(['index', 'show']);
        });

        Route::middleware('role:owner,kepala_produksi')->group(function () {
            Route::apiResource('products', ProductController::class)->except(['index', 'show']);
        });

        // --- Resep / Bill of Materials: dapur ---
        Route::middleware('role:owner,kepala_produksi')->group(function () {
            Route::post('recipes/{recipe}/new-version', [RecipeController::class, 'newVersion']);
            Route::patch('recipes/{recipe}/activate', [RecipeController::class, 'activate']);
            Route::post('recipes/{recipe}/simulate', [RecipeController::class, 'simulate']);
            Route::apiResource('recipes', RecipeController::class);
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 3 — Pembelian Bahan Baku
    |--------------------------------------------------------------------------
    |
    | Alur: Supplier → Input Pembelian → Barang Datang → Tambah Stok → Riwayat
    |
    | Owner dan Admin Gudang. Pengadaan adalah pekerjaan gudang seutuhnya —
    | ini satu-satunya modul yang pemilahannya tidak butuh pengecualian.
    | Kasir dan Kepala Produksi tidak terlibat.
    */
    Route::prefix('purchases')->middleware('role:owner,admin_gudang')->group(function () {

        Route::get('dashboard', [PurchaseDashboardController::class, 'index']);
        Route::get('suppliers/{supplier}/performance', [PurchaseDashboardController::class, 'supplierPerformance']);

        Route::get('statuses', [PurchaseOrderController::class, 'statuses']);
        Route::get('receipts', [PurchaseOrderController::class, 'receipts']);

        // Aksi alur kerja didaftarkan sebelum apiResource agar tidak
        // tertangkap pola {id}.
        // Jalan pintas satu langkah — barang datang lengkap sesuai pesanan.
        Route::patch('orders/{purchase_order}/status', [PurchaseOrderController::class, 'updateStatus']);

        // Aksi rinci — diperlukan untuk kedatangan bertahap.
        Route::post('orders/{purchase_order}/confirm', [PurchaseOrderController::class, 'confirm']);
        Route::post('orders/{purchase_order}/receive', [PurchaseOrderController::class, 'receive']);
        Route::post('orders/{purchase_order}/cancel', [PurchaseOrderController::class, 'cancel']);
        Route::post('orders/{purchase_order}/close', [PurchaseOrderController::class, 'close']);

        Route::apiResource('orders', PurchaseOrderController::class)
            ->parameters(['orders' => 'purchase_order']);
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 4 — Produksi (Bill of Materials)
    |--------------------------------------------------------------------------
    |
    | Alur: pilih produk → input jumlah → hitung kebutuhan → cek stok →
    |       potong bahan + buat batch → selesaikan → stok produk bertambah
    |
    | Seluruh pergerakan stok memakai stock_ledger yang sama dengan modul
    | pembelian. Tidak ada tabel mutasi baru.
    |
    | Owner dan Kepala Produksi. Gudang menyediakan bahannya, tapi tidak
    | menjalankan batch dan tidak menutup tahap produksi.
    */
    Route::prefix('production')->middleware('role:owner,kepala_produksi')->group(function () {

        Route::get('dashboard', [ProductionDashboardController::class, 'index']);
        Route::get('statuses', [ProductionBatchController::class, 'statuses']);

        // Pratinjau kebutuhan bahan — tidak mengubah apa pun.
        Route::post('preview', [ProductionBatchController::class, 'preview']);

        /*
        | Modul 5 — Tracking Produksi.
        |
        | Rute `batches/{batch}/complete` DIHAPUS: batch kini hanya bisa
        | ditutup dengan menyelesaikan tahap Packaging, sehingga setiap batch
        | selesai dipastikan punya jejak waktu per tahap.
        */
        Route::get('stages', [ProductionTrackingController::class, 'definitions']);
        Route::get('batches/{batch}/stages', [ProductionTrackingController::class, 'index']);
        Route::post('batches/{batch}/stages/{stage}/start', [ProductionTrackingController::class, 'start']);
        Route::post('batches/{batch}/stages/{stage}/finish', [ProductionTrackingController::class, 'finish']);
        Route::post('batches/{batch}/stages/{stage}/repeat', [ProductionTrackingController::class, 'repeat']);

        Route::post('batches/{batch}/cancel', [ProductionBatchController::class, 'cancel']);

        Route::get('batches', [ProductionBatchController::class, 'index']);
        Route::post('batches', [ProductionBatchController::class, 'store']);
        Route::get('batches/{batch}', [ProductionBatchController::class, 'show']);
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 6 — Inventory Management
    |--------------------------------------------------------------------------
    |
    | Pusat monitoring stok. Modul ini MEMBACA tabel `stock_ledger` yang sudah
    | diisi Pembelian dan Produksi — tidak ada sumber data baru.
    |
    | Satu-satunya endpoint yang menulis adalah penyesuaian manual, dan itu pun
    | tetap lewat StockService seperti modul lainnya.
    |
    | Kasir tidak diberi akses: ia tidak mengelola persediaan.
    |
    | Gudang dan Dapur sama-sama MEMBACA. Kepala produksi yang tidak bisa
    | melihat stok tepung tidak bisa merencanakan batch — ia hanya akan tahu
    | bahannya kurang setelah pembuatan batch ditolak, tanpa cara melihat
    | mengapa.
    |
    | Penyesuaian manual hanya Gudang. Menyesuaikan stok berarti menyatakan
    | bahwa hitungan fisik berbeda dari catatan sistem, dan yang memegang
    | barangnya adalah gudang. Membukanya untuk dua peran berarti dua orang
    | bisa mengoreksi angka yang sama tanpa siapa pun bertanggung jawab atasnya.
    */
    Route::prefix('inventory')->group(function () {

        Route::middleware('role:owner,admin_gudang,kepala_produksi')->group(function () {
            Route::get('dashboard', [InventoryController::class, 'dashboard']);
            Route::get('options', [InventoryController::class, 'options']);

            Route::get('items', [InventoryController::class, 'items']);
            Route::get('movements', [InventoryController::class, 'movements']);

            // Rute export didaftarkan sebelum pola lain agar tidak tertukar.
            Route::get('export/items', [InventoryController::class, 'exportItems']);
            Route::get('export/movements', [InventoryController::class, 'exportMovements']);

            // --- Peringatan perubahan status stok ---
            Route::get('alerts/unread', [StockAlertController::class, 'unread']);
            Route::post('alerts/read-all', [StockAlertController::class, 'markAllRead']);
            Route::patch('alerts/{alert}/read', [StockAlertController::class, 'markRead']);
            Route::get('alerts', [StockAlertController::class, 'index']);
        });

        // Satu-satunya endpoint persediaan yang menulis.
        Route::post('adjustments', [InventoryController::class, 'adjust'])
            ->middleware('role:owner,admin_gudang');
    });

    /*
    |--------------------------------------------------------------------------
    | Modul 7 — Penjualan (Point of Sale)
    |--------------------------------------------------------------------------
    |
    | Alur: pilih produk → input jumlah → hitung total → bayar → simpan →
    |       stok produk berkurang otomatis → struk
    |
    | Kasir dan Owner. Admin Produksi tidak berjualan.
    |
    | Pembatasan tambahan ditegakkan di controller, bukan di rute: Kasir hanya
    | melihat transaksinya sendiri. Ini tidak bisa diungkapkan sebagai middleware
    | peran karena bergantung pada isi datanya, bukan pada perannya saja.
    */
    Route::prefix('sales')->middleware('role:owner,kasir')->group(function () {

        // Rute statis didaftarkan sebelum pola {sale} agar tidak tertangkap.
        Route::get('catalog', [SaleController::class, 'catalog']);
        Route::get('options', [SaleController::class, 'options']);
        Route::post('calculate', [SaleController::class, 'calculate']);

        Route::get('dashboard', [SalesDashboardController::class, 'index']);
        Route::get('summary/daily', [SalesDashboardController::class, 'daily']);
        Route::get('summary/monthly', [SalesDashboardController::class, 'monthly']);

        Route::post('{sale}/void', [SaleController::class, 'void'])->middleware('role:owner');

        Route::get('/', [SaleController::class, 'index']);
        Route::post('/', [SaleController::class, 'store']);
        Route::get('{sale}', [SaleController::class, 'show']);
    });

    /*
    |--------------------------------------------------------------------------
    | Pengaturan aplikasi
    |--------------------------------------------------------------------------
    |
    | Membaca boleh siapa saja yang sudah masuk — kasir butuh tarif pajak dan
    | identitas toko untuk menyusun struk. Mengubah hanya Owner.
    */
    Route::prefix('settings')->group(function () {
        Route::get('pos', [SettingController::class, 'pos']);
        Route::get('/', [SettingController::class, 'index'])->middleware('role:owner');
        Route::put('/', [SettingController::class, 'update'])->middleware('role:owner');
    });
});
