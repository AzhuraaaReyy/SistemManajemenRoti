<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\SaleStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Aturan penjualan (Point of Sale).
 *
 * Alur yang dijaga:
 *
 *   Pilih produk → Input jumlah → Hitung total → Bayar → Simpan →
 *   Stok produk berkurang otomatis → Struk
 *
 * Pengurangan stok TIDAK dilakukan di sini secara langsung. Service ini
 * memanggil StockService, sehingga setiap roti yang keluar punya baris ledger,
 * ikut terhitung dalam rekonsiliasi, dan otomatis memicu peringatan stok bila
 * membuat produknya menipis — tanpa satu baris kode tambahan di modul ini.
 */
class SaleService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly SettingService $settings,
    ) {
    }

    /*
    |--------------------------------------------------------------------------
    | Menyimpan transaksi
    |--------------------------------------------------------------------------
    */

    /**
     * Menjalankan satu transaksi penjualan secara atomik.
     *
     * Seluruhnya dalam satu DB transaction: bila satu produk saja stoknya tidak
     * mencukupi, tidak ada satu pun stok yang terpotong dan transaksinya tidak
     * tersimpan. Tidak ada keadaan setengah jadi.
     *
     * @param  array<int, array{product_id: int, quantity: float}>  $items
     * @param  array<string, mixed>  $data
     */
    public function create(array $items, array $data, ?int $cashierId = null): Sale
    {
        if (empty($items)) {
            throw ValidationException::withMessages([
                'items' => 'Keranjang masih kosong. Tambahkan minimal satu produk.',
            ]);
        }

        $kunci = $data['idempotency_key'] ?? null;

        /*
        | Pemeriksaan idempoten SEBELUM apa pun dibuat.
        |
        | Pelajaran dari "batch hantu" di Modul 4: melindungi ledger saja tidak
        | cukup. Kasir yang menekan Bayar dua kali karena jaringan lambat akan
        | menghasilkan dua transaksi dengan dua nomor struk berbeda, dan yang
        | kedua sudah terlanjur memotong stok sebelum ledger menolaknya.
        */
        if ($kunci) {
            $sudahAda = Sale::where('idempotency_key', $kunci)->first();

            if ($sudahAda) {
                return $sudahAda->load(['items', 'cashier']);
            }
        }

        return DB::transaction(function () use ($items, $data, $cashierId, $kunci) {
            $baris = $this->siapkanBaris($items);

            $hitungan = $this->hitungTotal(
                subtotal: array_sum(array_column($baris, 'line_total')),
                discountType: $data['discount_type'] ?? 'none',
                discountValue: (float) ($data['discount_value'] ?? 0),
            );

            $metode = PaymentMethod::from($data['payment_method'] ?? 'cash');
            $dibayar = (float) ($data['paid_amount'] ?? $hitungan['total']);

            $this->pastikanPembayaranCukup($metode, $dibayar, $hitungan['total']);

            $sale = Sale::create([
                'sale_number' => Sale::generateNumber(),
                'cashier_id' => $cashierId,
                'subtotal' => $hitungan['subtotal'],
                'discount_type' => $hitungan['discount_type'],
                'discount_value' => $hitungan['discount_value'],
                'discount_amount' => $hitungan['discount_amount'],
                'tax_percent' => $hitungan['tax_percent'],
                'tax_amount' => $hitungan['tax_amount'],
                'total' => $hitungan['total'],
                'payment_method' => $metode->value,

                // Non-tunai selalu dibayar pas — menyimpan angka lain hanya
                // akan membuat rekap tutup kasir tidak masuk akal.
                'paid_amount' => $metode->needsChange() ? $dibayar : $hitungan['total'],
                'change_amount' => $metode->needsChange()
                    ? round($dibayar - $hitungan['total'], 2)
                    : 0,

                'cost_total' => round(array_sum(array_column($baris, 'line_cost')), 2),
                'status' => SaleStatus::COMPLETED->value,
                'customer_name' => $data['customer_name'] ?? null,
                'notes' => $data['notes'] ?? null,
                'idempotency_key' => $kunci,
            ]);

            foreach ($baris as $b) {
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_id' => $b['product']->id,
                    'product_name' => $b['product']->name,
                    'product_code' => $b['product']->code,
                    'unit' => $b['product']->unit ?? 'pcs',
                    'unit_price' => $b['unit_price'],
                    'quantity' => $b['quantity'],
                    'line_total' => $b['line_total'],
                    'unit_cost' => $b['unit_cost'],
                    'line_cost' => $b['line_cost'],
                    'cost_source' => $b['cost_source'],
                    'stock_before' => $b['product']->current_stock,
                ]);

                // Stok dipotong lewat StockService — satu-satunya pintu.
                // Kunci idempoten diturunkan dari nomor transaksi dan produk,
                // sehingga percobaan ulang tidak memotong stok dua kali.
                $this->stock->applyMovement(
                    item: $b['product'],
                    quantity: $b['quantity'],
                    direction: 'out',
                    sourceType: StockMovementType::SALE,
                    sourceId: $sale->sale_number,
                    unitCost: null,
                    note: "Penjualan {$sale->sale_number}",
                    userId: $cashierId,
                    idempotencyKey: "sale:{$sale->sale_number}:{$b['product']->id}",
                );
            }

            return $sale->load(['items', 'cashier']);
        });
    }

    /**
     * Menyiapkan baris keranjang: memvalidasi stok dan membekukan harga.
     *
     * Produk dikunci berurutan menurut ID untuk mencegah kebuntuan (deadlock)
     * bila dua kasir menjual produk yang sama secara bersamaan — pola yang sama
     * dipakai StockService dan ProductionService.
     *
     * @param  array<int, array{product_id: int, quantity: float}>  $items
     * @return array<int, array<string, mixed>>
     */
    private function siapkanBaris(array $items): array
    {
        // Baris dengan produk yang sama digabung lebih dulu. Tanpa ini, kasir
        // yang memindai roti yang sama dua kali akan membuat dua baris, dan
        // pemeriksaan stok memeriksa masing-masing terhadap stok penuh —
        // 2 baris @ 30 pcs lolos padahal stoknya hanya 40.
        $digabung = [];

        foreach ($items as $item) {
            $id = (int) $item['product_id'];
            $jumlah = (float) $item['quantity'];

            if ($jumlah <= 0) {
                throw ValidationException::withMessages([
                    'items' => 'Jumlah setiap produk harus lebih besar dari nol.',
                ]);
            }

            $digabung[$id] = ($digabung[$id] ?? 0) + $jumlah;
        }

        ksort($digabung);

        // Resep ikut dimuat untuk menghitung HPP cadangan — lihat hppProduk().
        $produk = Product::with('activeRecipe.items.ingredient')
            ->whereIn('id', array_keys($digabung))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $hasil = [];
        $kurang = [];

        foreach ($digabung as $id => $jumlah) {
            $p = $produk[$id] ?? null;

            if (! $p) {
                throw ValidationException::withMessages([
                    'items' => "Produk dengan ID {$id} tidak ditemukan.",
                ]);
            }

            if (! $p->is_active) {
                throw ValidationException::withMessages([
                    'items' => "Produk {$p->name} sedang dinonaktifkan dan tidak bisa dijual.",
                ]);
            }

            // Stok dikumpulkan dulu, tidak langsung dilempar. Kasir perlu tahu
            // SELURUH produk yang bermasalah sekaligus, bukan satu per satu
            // dengan pelanggan menunggu di depan meja.
            if ((float) $p->current_stock < $jumlah) {
                $kurang[] = [
                    'product_id' => $p->id,
                    'name' => $p->name,
                    'requested' => $jumlah,
                    'available' => (float) $p->current_stock,
                    'unit' => $p->unit ?? 'pcs',
                ];

                continue;
            }

            $harga = (float) $p->selling_price;
            $hpp = $this->hppProduk($p);

            $hasil[] = [
                'product' => $p,
                'quantity' => $jumlah,
                'unit_price' => $harga,
                'line_total' => round($harga * $jumlah, 2),
                'unit_cost' => $hpp['value'],
                'line_cost' => round($hpp['value'] * $jumlah, 2),
                'cost_source' => $hpp['source'],
            ];
        }

        if ($kurang) {
            throw ValidationException::withMessages([
                'items' => $this->pesanStokKurang($kurang),
                'shortages' => json_encode($kurang),
            ]);
        }

        return $hasil;
    }

    /**
     * Harga pokok satu produk, beserta asal-usul angkanya.
     *
     * `avg_cost` berisi rata-rata tertimbang dari produksi yang benar-benar
     * terjadi — itulah angka yang paling bisa dipercaya. Tetapi produk yang
     * stoknya berasal dari saldo awal belum pernah melewati produksi, sehingga
     * avg_cost-nya masih nol.
     *
     * Menjual dengan HPP nol membuat laporan melaporkan margin 100% dan laba
     * kotor sebesar seluruh omzet — angka yang terlihat menyenangkan dan
     * sepenuhnya salah. Karena itu dipakai HPP teoretis dari resep aktif
     * sebagai cadangan, dan asal-usulnya dicatat supaya taksiran tidak pernah
     * tertukar dengan angka nyata.
     *
     * @return array{value: float, source: string}
     */
    private function hppProduk(Product $product): array
    {
        $nyata = (float) $product->avg_cost;

        if ($nyata > 0) {
            return ['value' => $nyata, 'source' => 'actual'];
        }

        $teoretis = $product->unitCost();

        if ($teoretis > 0) {
            return ['value' => round($teoretis, 4), 'source' => 'recipe'];
        }

        return ['value' => 0.0, 'source' => 'unknown'];
    }

    /**
     * @param  array<int, array<string, mixed>>  $kurang
     */
    private function pesanStokKurang(array $kurang): string
    {
        $rincian = array_map(
            fn (array $k) => sprintf(
                '%s (diminta %s, tersedia %s %s)',
                $k['name'],
                rtrim(rtrim(number_format($k['requested'], 2, ',', '.'), '0'), ','),
                rtrim(rtrim(number_format($k['available'], 2, ',', '.'), '0'), ','),
                $k['unit'],
            ),
            $kurang,
        );

        return count($kurang) === 1
            ? 'Stok tidak mencukupi: '.$rincian[0].'.'
            : count($kurang).' produk stoknya tidak mencukupi: '.implode('; ', $rincian).'.';
    }

    /*
    |--------------------------------------------------------------------------
    | Perhitungan
    |--------------------------------------------------------------------------
    */

    /**
     * Subtotal → diskon → pajak → total.
     *
     * URUTAN INI PENTING. Pajak dihitung dari nilai SETELAH diskon, bukan dari
     * subtotal. Memungut pajak atas nilai yang tidak jadi dibayar pelanggan
     * membuat totalnya lebih besar dari seharusnya, dan selisihnya baru
     * ketahuan saat pembukuan tidak cocok.
     *
     * @return array<string, mixed>
     */
    public function hitungTotal(float $subtotal, string $discountType = 'none', float $discountValue = 0): array
    {
        $subtotal = round($subtotal, 2);
        $pengaturan = $this->settings->forPos();

        $potongan = match ($discountType) {
            'percent' => round($subtotal * ($discountValue / 100), 2),
            'amount' => round($discountValue, 2),
            default => 0.0,
        };

        // Diskon tidak boleh melebihi nilai belanjanya — total negatif berarti
        // toko membayar pelanggan.
        $potongan = max(0, min($potongan, $subtotal));

        $this->pastikanDiskonWajar($subtotal, $potongan, $pengaturan['max_discount_percent']);

        $setelahDiskon = round($subtotal - $potongan, 2);

        $tarif = $pengaturan['tax_enabled'] ? (float) $pengaturan['tax_percent'] : 0.0;
        $pajak = round($setelahDiskon * ($tarif / 100), 2);

        return [
            'subtotal' => $subtotal,
            'discount_type' => $potongan > 0 ? $discountType : 'none',
            'discount_value' => $potongan > 0 ? $discountValue : 0,
            'discount_amount' => $potongan,
            'after_discount' => $setelahDiskon,
            'tax_percent' => $tarif,
            'tax_amount' => $pajak,
            'total' => round($setelahDiskon + $pajak, 2),
        ];
    }

    private function pastikanDiskonWajar(float $subtotal, float $potongan, float $batasPersen): void
    {
        if ($subtotal <= 0 || $batasPersen <= 0) {
            return;
        }

        $persen = ($potongan / $subtotal) * 100;

        if ($persen > $batasPersen + 0.01) {
            throw ValidationException::withMessages([
                'discount_value' => sprintf(
                    'Diskon %s%% melebihi batas %s%% yang ditetapkan Owner. '
                    .'Ubah batasnya di Pengaturan bila memang disengaja.',
                    number_format($persen, 1, ',', '.'),
                    rtrim(rtrim(number_format($batasPersen, 2, ',', '.'), '0'), ','),
                ),
            ]);
        }
    }

    private function pastikanPembayaranCukup(PaymentMethod $metode, float $dibayar, float $total): void
    {
        if (! $metode->needsChange()) {
            return;
        }

        if ($dibayar + 0.01 < $total) {
            throw ValidationException::withMessages([
                'paid_amount' => sprintf(
                    'Uang yang diterima (Rp%s) kurang dari total belanja (Rp%s).',
                    number_format($dibayar, 0, ',', '.'),
                    number_format($total, 0, ',', '.'),
                ),
            ]);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Pembatalan
    |--------------------------------------------------------------------------
    */

    /**
     * Membatalkan transaksi dan mengembalikan stoknya.
     *
     * Untuk kesalahan kasir — salah ketik jumlah, salah produk, transaksi
     * tercatat dua kali. BUKAN retur pelanggan; itu modul tersendiri.
     *
     * Transaksinya tidak dihapus. Barisnya tetap ada dengan status Dibatalkan
     * lengkap dengan alasannya, sehingga nomor struk yang sudah dipegang
     * pelanggan tetap bisa ditelusuri.
     */
    public function void(Sale $sale, string $reason, ?int $userId = null): Sale
    {
        if (! $sale->status->canVoid()) {
            throw ValidationException::withMessages([
                'status' => "Transaksi {$sale->sale_number} sudah dibatalkan sebelumnya.",
            ]);
        }

        return DB::transaction(function () use ($sale, $reason, $userId) {
            $sale->load('items');

            foreach ($sale->items as $item) {
                if (! $item->product_id) {
                    // Produknya sudah dihapus dari master data. Stoknya tidak
                    // bisa dikembalikan ke mana pun, tetapi pembatalannya tetap
                    // harus jalan — nilainya sudah dikoreksi di laporan.
                    continue;
                }

                $produk = Product::find($item->product_id);

                if (! $produk) {
                    continue;
                }

                $this->stock->applyMovement(
                    item: $produk,
                    quantity: (float) $item->quantity,
                    direction: 'in',
                    sourceType: StockMovementType::SALE_VOID,
                    sourceId: $sale->sale_number,
                    unitCost: null,
                    note: "Pembatalan penjualan {$sale->sale_number}: {$reason}",
                    userId: $userId,
                    idempotencyKey: "sale-void:{$sale->sale_number}:{$item->product_id}",
                );
            }

            $sale->update([
                'status' => SaleStatus::VOIDED->value,
                'voided_at' => now(),
                'voided_by' => $userId,
                'void_reason' => $reason,
            ]);

            return $sale->fresh(['items', 'cashier', 'voider']);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Ringkasan
    |--------------------------------------------------------------------------
    */

    /**
     * Ringkasan satu hari — dipakai saat tutup kasir.
     *
     * @return array<string, mixed>
     */
    public function dailySummary(?string $date = null, ?int $cashierId = null): array
    {
        $tanggal = $date ?? today()->format('Y-m-d');

        $query = Sale::revenue()
            ->whereDate('created_at', $tanggal)
            ->when($cashierId, fn ($q, $v) => $q->where('cashier_id', $v));

        $transaksi = (clone $query)->count();
        $omzet = (float) (clone $query)->sum('total');
        $hpp = (float) (clone $query)->sum('cost_total');
        $pajak = (float) (clone $query)->sum('tax_amount');
        $diskon = (float) (clone $query)->sum('discount_amount');

        // Dipisah per metode karena inilah yang dicocokkan saat tutup kasir:
        // uang di laci harus sama dengan angka tunai, bukan dengan total omzet.
        $perMetode = (clone $query)
            ->selectRaw('payment_method, COUNT(*) as jumlah, SUM(total) as nilai')
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($r) => [
                'method' => $r->payment_method->value,
                'label' => $r->payment_method->label(),
                'jumlah' => (int) $r->jumlah,
                'nilai' => round((float) $r->nilai, 2),
                'is_cash' => $r->payment_method->isCash(),
            ])
            ->all();

        $dibatalkan = Sale::where('status', SaleStatus::VOIDED->value)
            ->whereDate('created_at', $tanggal)
            ->when($cashierId, fn ($q, $v) => $q->where('cashier_id', $v));

        return [
            'tanggal' => $tanggal,
            'transaksi' => $transaksi,
            'omzet' => round($omzet, 2),
            'hpp' => round($hpp, 2),
            'laba_kotor' => round($omzet - $pajak - $hpp, 2),
            'pajak' => round($pajak, 2),
            'diskon' => round($diskon, 2),
            'rata2_transaksi' => $transaksi > 0 ? round($omzet / $transaksi, 2) : 0,
            'unit_terjual' => round((float) SaleItem::whereIn('sale_id', (clone $query)->select('id'))->sum('quantity'), 2),
            'per_metode' => $perMetode,
            'tunai_di_laci' => round(
                (float) (clone $query)->where('payment_method', PaymentMethod::CASH->value)->sum('total'),
                2
            ),
            'dibatalkan' => [
                'jumlah' => (clone $dibatalkan)->count(),
                'nilai' => round((float) (clone $dibatalkan)->sum('total'), 2),
            ],
        ];
    }

    /**
     * Ringkasan satu bulan, beserta rincian per hari.
     *
     * @return array<string, mixed>
     */
    public function monthlySummary(int $year, int $month, ?int $cashierId = null): array
    {
        $awal = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $akhir = $awal->copy()->endOfMonth();

        $query = Sale::revenue()
            ->whereBetween('created_at', [$awal, $akhir])
            ->when($cashierId, fn ($q, $v) => $q->where('cashier_id', $v));

        $transaksi = (clone $query)->count();
        $omzet = (float) (clone $query)->sum('total');
        $pajak = (float) (clone $query)->sum('tax_amount');
        $hpp = (float) (clone $query)->sum('cost_total');

        $perHari = (clone $query)
            ->selectRaw('DATE(created_at) as tanggal, COUNT(*) as jumlah, SUM(total) as nilai, SUM(cost_total) as hpp')
            ->groupBy('tanggal')
            ->get()
            ->keyBy('tanggal');

        // Hari tanpa penjualan tetap muncul sebagai nol — grafik yang melompati
        // hari kosong menyembunyikan justru hari yang perlu ditanyakan.
        $harian = [];
        $kursor = $awal->copy();
        $hariIni = today();

        while ($kursor <= $akhir && $kursor <= $hariIni) {
            $kunci = $kursor->format('Y-m-d');
            $d = $perHari[$kunci] ?? null;

            $harian[] = [
                'tanggal' => $kunci,
                'label' => $kursor->translatedFormat('d M'),
                'transaksi' => (int) ($d->jumlah ?? 0),
                'omzet' => round((float) ($d->nilai ?? 0), 2),
                'hpp' => round((float) ($d->hpp ?? 0), 2),
            ];

            $kursor->addDay();
        }

        return [
            'periode' => ['tahun' => $year, 'bulan' => $month, 'label' => $awal->translatedFormat('F Y')],
            'transaksi' => $transaksi,
            'omzet' => round($omzet, 2),
            'hpp' => round($hpp, 2),
            'laba_kotor' => round($omzet - $pajak - $hpp, 2),
            'pajak' => round($pajak, 2),
            'diskon' => round((float) (clone $query)->sum('discount_amount'), 2),
            'rata2_transaksi' => $transaksi > 0 ? round($omzet / $transaksi, 2) : 0,
            'harian' => $harian,
            'produk_terlaris' => $this->produkTerlaris($awal->format('Y-m-d'), $akhir->format('Y-m-d')),
            'per_kasir' => $this->perKasir($awal->format('Y-m-d'), $akhir->format('Y-m-d')),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function produkTerlaris(string $from, string $to, int $limit = 5): array
    {
        return DB::table('sale_items as i')
            ->join('sales as s', 's.id', '=', 'i.sale_id')
            ->select(
                'i.product_id',
                'i.product_name',
                'i.unit',
                DB::raw('SUM(i.quantity) as total_qty'),
                DB::raw('SUM(i.line_total) as total_nilai'),
                DB::raw('SUM(i.line_total - i.line_cost) as total_laba'),
            )
            ->where('s.status', SaleStatus::COMPLETED->value)
            ->whereNull('s.deleted_at')
            ->whereDate('s.created_at', '>=', $from)
            ->whereDate('s.created_at', '<=', $to)
            ->groupBy('i.product_id', 'i.product_name', 'i.unit')
            ->orderByDesc('total_qty')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'product_id' => $r->product_id,
                'name' => $r->product_name,
                'unit' => $r->unit,
                'total_qty' => round((float) $r->total_qty, 2),
                'total_nilai' => round((float) $r->total_nilai, 2),
                'total_laba' => round((float) $r->total_laba, 2),
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function perKasir(string $from, string $to): array
    {
        return Sale::revenue()
            ->with('cashier:id,name')
            ->selectRaw('cashier_id, COUNT(*) as jumlah, SUM(total) as nilai')
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->groupBy('cashier_id')
            ->orderByDesc('nilai')
            ->get()
            ->map(fn ($r) => [
                'cashier_id' => $r->cashier_id,
                'name' => $r->cashier?->name ?? 'Tidak diketahui',
                'transaksi' => (int) $r->jumlah,
                'omzet' => round((float) $r->nilai, 2),
            ])
            ->all();
    }
}
