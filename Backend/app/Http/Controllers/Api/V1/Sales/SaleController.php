<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Enums\PaymentMethod;
use App\Enums\SaleStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\Sale;
use App\Services\SaleService;
use App\Services\SettingService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Point of Sale.
 *
 * Pengurangan stok memakai `stock_ledger` yang sama dengan modul pembelian,
 * produksi, dan persediaan. Tidak ada tabel mutasi baru.
 */
class SaleController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SaleService $sales,
        private readonly SettingService $settings,
    ) {
    }

    /**
     * GET /api/v1/sales/catalog
     *
     * Daftar produk siap jual untuk grid POS.
     *
     * Berbeda dari /master/products: hanya produk aktif berharga, dengan angka
     * seperlunya. Kasir tidak butuh HPP, margin, atau informasi resep — dan
     * peran Kasir memang tidak boleh mengaksesnya.
     */
    public function catalog(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'in_stock_only' => ['nullable', 'boolean'],
        ]);

        $produk = Product::with('category:id,name')
            ->where('is_active', true)
            ->where('selling_price', '>', 0)
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->search($v))
            ->when($filters['category_id'] ?? null, fn ($q, $v) => $q->where('category_id', $v))
            ->when($filters['in_stock_only'] ?? false, fn ($q) => $q->where('current_stock', '>', 0))
            ->orderBy('name')
            ->get()
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'unit' => $p->unit ?? 'pcs',
                'selling_price' => (float) $p->selling_price,
                'current_stock' => (float) $p->current_stock,
                'category_id' => $p->category_id,
                'category_name' => $p->category?->name,
                'image_url' => $p->image ? asset('storage/'.$p->image) : null,
                'stock_status' => $p->stockStatus()->value,
                'stock_status_tone' => $p->stockStatus()->tone(),
                // Produk habis tetap ditampilkan, tetapi tidak bisa diklik.
                // Menyembunyikannya membuat kasir mengira produknya dihapus.
                'sellable' => (float) $p->current_stock > 0,
            ]);

        $kategori = $produk->pluck('category_name', 'category_id')
            ->filter()
            ->map(fn ($nama, $id) => ['value' => (int) $id, 'label' => $nama])
            ->values();

        return $this->success([
            'products' => $produk->values()->all(),
            'categories' => $kategori->all(),
            'settings' => $this->settings->forPos(),
            'payment_methods' => PaymentMethod::options(),
        ], 'Katalog produk berhasil diambil.');
    }

    /**
     * POST /api/v1/sales/calculate
     *
     * Pratinjau perhitungan tanpa menyimpan apa pun.
     *
     * Dipakai keranjang untuk menampilkan pajak dan total sebelum kasir menekan
     * Bayar — perhitungannya memakai kode yang sama dengan penyimpanan, jadi
     * angka di layar tidak mungkin berbeda dari angka di struk.
     */
    public function calculate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subtotal' => ['required', 'numeric', 'min:0'],
            'discount_type' => ['nullable', Rule::in(['none', 'percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        return $this->success(
            $this->sales->hitungTotal(
                subtotal: (float) $data['subtotal'],
                discountType: $data['discount_type'] ?? 'none',
                discountValue: (float) ($data['discount_value'] ?? 0),
            ),
            'Perhitungan berhasil.'
        );
    }

    /**
     * POST /api/v1/sales
     *
     * Menyimpan transaksi: memvalidasi stok, memotong stok, dan mencatat
     * seluruhnya dalam satu DB transaction.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $sale = $this->sales->create(
            items: $request->input('items'),
            data: $request->safe()->except('items'),
            cashierId: $request->user()?->id,
        );

        ActivityLog::record(
            'penjualan_dibuat',
            "Transaksi {$sale->sale_number}: {$sale->items->count()} produk, total Rp"
                .number_format((float) $sale->total, 0, ',', '.'),
            $request->user(), $sale, $request
        );

        return $this->success(
            ['sale' => new SaleResource($this->muatLengkap($sale))],
            "Transaksi {$sale->sale_number} tersimpan. Stok produk telah dikurangi.",
            201
        );
    }

    /**
     * GET /api/v1/sales
     *
     * Kasir hanya melihat transaksinya sendiri; Owner melihat semuanya.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(SaleStatus::values())],
            'payment_method' => ['nullable', Rule::in(PaymentMethod::values())],
            'cashier_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'sort_by' => ['nullable', Rule::in(['created_at', 'total', 'sale_number'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ], [
            'date_to.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
        ]);

        $sales = Sale::query()
            ->with(['cashier:id,name', 'voider:id,name'])
            ->withCount('items')
            ->search($filters['search'] ?? null)
            ->betweenDates($filters['date_from'] ?? null, $filters['date_to'] ?? null)
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['payment_method'] ?? null, fn ($q, $v) => $q->where('payment_method', $v))
            ->when($this->batasKasir($request), fn ($q, $id) => $q->where('cashier_id', $id))
            ->when(
                ! $this->batasKasir($request) && ($filters['cashier_id'] ?? null),
                fn ($q) => $q->where('cashier_id', $filters['cashier_id'])
            )
            ->orderBy($filters['sort_by'] ?? 'created_at', $filters['sort_dir'] ?? 'desc')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();

        return $this->paginated(
            $sales,
            SaleResource::collection($sales->items()),
            'Riwayat penjualan berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/sales/{sale}
     */
    public function show(Request $request, Sale $sale): JsonResponse
    {
        $this->pastikanBolehMelihat($request, $sale);

        return $this->success(
            [
                'sale' => new SaleResource($this->muatLengkap($sale)),
                // Identitas toko ikut dikirim agar struk bisa dicetak ulang
                // dari riwayat tanpa permintaan tambahan.
                'settings' => $this->settings->forPos(),
            ],
            'Detail transaksi berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/sales/{sale}/void
     *
     * Membatalkan transaksi karena kesalahan kasir. Stok dikembalikan.
     */
    public function void(Request $request, Sale $sale): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
        ], [
            'reason.required' => 'Alasan pembatalan wajib diisi agar riwayat tetap bisa ditelusuri.',
            'reason.min' => 'Alasan pembatalan terlalu singkat.',
        ]);

        $dibatalkan = $this->sales->void($sale, $data['reason'], $request->user()?->id);

        ActivityLog::record(
            'penjualan_dibatalkan',
            "Membatalkan transaksi {$dibatalkan->sale_number}: {$data['reason']}",
            $request->user(), $dibatalkan, $request
        );

        return $this->success(
            ['sale' => new SaleResource($this->muatLengkap($dibatalkan))],
            "Transaksi {$dibatalkan->sale_number} dibatalkan. Stok produk telah dikembalikan."
        );
    }

    /**
     * GET /api/v1/sales/options
     */
    public function options(): JsonResponse
    {
        return $this->success([
            'statuses' => SaleStatus::options(),
            'payment_methods' => PaymentMethod::options(),
            'cashiers' => \App\Models\User::whereIn('role', ['kasir', 'owner'])
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn ($u) => ['value' => $u->id, 'label' => $u->name])
                ->all(),
        ], 'Pilihan filter penjualan berhasil diambil.');
    }

    /* ---------------------------------------------------------------------- */

    /**
     * ID kasir bila permintaan ini harus dibatasi ke transaksinya sendiri.
     *
     * Kasir hanya boleh melihat penjualannya sendiri — bukan karena data orang
     * lain rahasia, melainkan karena tutup kasir adalah tanggung jawab pribadi
     * dan mencampur transaksi rekan membuat selisihnya mustahil ditelusuri.
     */
    private function batasKasir(Request $request): ?int
    {
        return $request->user()?->role->value === 'kasir'
            ? $request->user()->id
            : null;
    }

    private function pastikanBolehMelihat(Request $request, Sale $sale): void
    {
        $batas = $this->batasKasir($request);

        if ($batas !== null && $sale->cashier_id !== $batas) {
            abort(403, 'Anda hanya dapat melihat transaksi yang Anda buat sendiri.');
        }
    }

    private function muatLengkap(Sale $sale): Sale
    {
        return $sale->load(['items', 'cashier:id,name', 'voider:id,name'])->loadCount('items');
    }
}
