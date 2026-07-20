<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Enums\StockStatus;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\StockLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Pusat monitoring persediaan.
 *
 * Modul ini MURNI MEMBACA. Ia tidak punya tabel sendiri dan tidak membuat
 * sumber data baru — seluruh angkanya berasal dari `stock_ledger` yang sudah
 * diisi modul Pembelian dan Produksi, serta kolom `current_stock` yang dijaga
 * StockService.
 *
 * Satu-satunya kemampuan menulisnya adalah penyesuaian manual, dan itu pun
 * tetap lewat StockService::adjustToCount() — bukan menyentuh stok langsung.
 *
 * Status stok TIDAK PERNAH disimpan. Setiap permintaan menghitungnya ulang
 * lewat StockStatus::classify(). Konsekuensinya: mengubah batas minimum sebuah
 * bahan langsung mengubah statusnya di seluruh laporan, tanpa perlu proses
 * penyegaran apa pun.
 */
class InventoryService
{
    public function __construct(private readonly StockService $stock)
    {
    }

    /*
    |--------------------------------------------------------------------------
    | Ringkasan
    |--------------------------------------------------------------------------
    */

    /**
     * Jumlah barang per status, plus nilai persediaan.
     *
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $items = $this->allItems();

        // Tiga status pokok sesuai spesifikasi. Kritis digulung ke Menipis dan
        // berlebih ke Aman, sehingga ketiganya selalu berjumlah total barang.
        $pokok = ['habis' => 0, 'menipis' => 0, 'aman' => 0];
        $rinci = array_fill_keys(StockStatus::values(), 0);

        foreach ($items as $row) {
            $pokok[$row['status']->headline()->value]++;
            $rinci[$row['status']->value]++;
        }

        $bahan = $items->where('kind', 'ingredient');
        $produk = $items->where('kind', 'product');

        return [
            // Kartu utama
            'habis' => $pokok['habis'],
            'menipis' => $pokok['menipis'],
            'aman' => $pokok['aman'],
            'total_item' => $items->count(),

            // Perincian di balik kartu
            'rinci' => $rinci,

            'perlu_perhatian' => $pokok['habis'] + $pokok['menipis'],

            'nilai_persediaan' => round((float) $items->sum('stock_value'), 2),
            'nilai_bahan_baku' => round((float) $bahan->sum('stock_value'), 2),
            'nilai_produk_jadi' => round((float) $produk->sum('stock_value'), 2),

            'jumlah_bahan_baku' => $bahan->count(),
            'jumlah_produk_jadi' => $produk->count(),

            // Pergerakan hari ini — sekilas apakah ada aktivitas
            'mutasi_hari_ini' => StockLedger::whereDate('created_at', today())->count(),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Daftar stok
    |--------------------------------------------------------------------------
    */

    /**
     * Daftar stok gabungan bahan baku dan produk jadi.
     *
     * Digabung di PHP, bukan lewat UNION SQL. Alasannya: status stok harus
     * dihitung dari perbandingan dua kolom dan tidak bisa disaring lewat indeks
     * dengan rapi, sementara jumlah barang sebuah UMKM roti berkisar puluhan —
     * bukan skala yang menuntut pagination di sisi basis data.
     *
     * Bila suatu saat barangnya menembus ribuan, inilah tempat pertama yang
     * perlu diubah menjadi UNION dengan kolom bantu.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, array<string, mixed>>
     */
    public function items(array $filters = []): Collection
    {
        $items = $this->allItems();

        if ($kind = $filters['kind'] ?? null) {
            $items = $items->where('kind', $kind);
        }

        if ($status = $filters['status'] ?? null) {
            // Status pokok ikut cocok dengan perinciannya: menyaring "menipis"
            // harus juga memunculkan yang "kritis", karena di kartu ringkasan
            // keduanya memang dihitung sebagai satu.
            $items = $items->filter(
                fn (array $r) => $r['status']->value === $status
                    || $r['status']->headline()->value === $status
            );
        }

        if ($categoryId = $filters['category_id'] ?? null) {
            $items = $items->where('category_id', (int) $categoryId);
        }

        if ($cari = trim((string) ($filters['search'] ?? ''))) {
            $items = $items->filter(
                fn (array $r) => str_contains(mb_strtolower($r['name']), mb_strtolower($cari))
                    || str_contains(mb_strtolower((string) $r['code']), mb_strtolower($cari))
            );
        }

        return $this->sortItems($items, $filters['sort_by'] ?? 'status', $filters['sort_dir'] ?? 'asc');
    }

    /**
     * Seluruh barang bertok dalam satu bentuk yang seragam.
     *
     * Bahan baku dan produk jadi punya kolom yang berbeda — bahan punya satuan
     * dasar dan faktor konversi, produk tidak. Di sini keduanya diseragamkan
     * supaya lapisan di atasnya tidak perlu bercabang terus-menerus.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function allItems(): Collection
    {
        $pemakaian = $this->dailyUsageMap(30);

        $bahan = Ingredient::with('category:id,name')
            ->where('is_active', true)
            ->get()
            ->map(fn (Ingredient $i) => [
                'kind' => 'ingredient',
                'kind_label' => 'Bahan Baku',
                'id' => $i->id,
                'code' => $i->code,
                'name' => $i->name,
                'category_id' => $i->category_id,
                'category_name' => $i->category?->name,

                // Dikirim dalam dua satuan: dasar untuk perhitungan, tampilan
                // untuk dibaca manusia. 2500 g dan 2,5 kg adalah angka yang sama.
                'unit' => $i->display_unit,
                'base_unit' => $i->base_unit->value,
                'conversion_factor' => (float) $i->conversion_factor,
                'current_stock' => (float) $i->current_stock,
                'current_stock_display' => round($i->toDisplayUnit((float) $i->current_stock), 4),
                'min_stock' => (float) $i->min_stock,
                'min_stock_display' => round($i->toDisplayUnit((float) $i->min_stock), 4),

                'avg_cost' => (float) $i->avg_cost,
                'stock_value' => round($i->stockValue(), 2),

                'status' => $i->stockStatus(),
                'daily_usage' => $pemakaian[Ingredient::class.':'.$i->id] ?? 0.0,
                'model' => $i,
            ]);

        $produk = Product::with('category:id,name')
            ->where('is_active', true)
            ->get()
            ->map(fn (Product $p) => [
                'kind' => 'product',
                'kind_label' => 'Produk Jadi',
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'category_id' => $p->category_id,
                'category_name' => $p->category?->name,

                // Produk tidak punya konversi satuan — faktor 1 membuat kolom
                // tampilan dan dasar bernilai sama, sehingga bentuk datanya
                // tetap seragam dengan bahan baku.
                'unit' => $p->unit ?? 'pcs',
                'base_unit' => $p->unit ?? 'pcs',
                'conversion_factor' => 1.0,
                'current_stock' => (float) $p->current_stock,
                'current_stock_display' => (float) $p->current_stock,
                'min_stock' => (float) $p->min_stock,
                'min_stock_display' => (float) $p->min_stock,

                'avg_cost' => (float) $p->avg_cost,
                'stock_value' => round($p->stockValue(), 2),

                'status' => $p->stockStatus(),
                'daily_usage' => $pemakaian[Product::class.':'.$p->id] ?? 0.0,
                'model' => $p,
            ]);

        return $bahan->concat($produk)->values();
    }

    /**
     * Rata-rata pemakaian harian seluruh barang, dalam SATU query.
     *
     * Trait HasStockLedger punya averageDailyUsage() per barang, tetapi
     * memanggilnya di dalam perulangan berarti satu query per barang. Untuk
     * halaman yang menampilkan seluruh stok sekaligus, itu N+1 yang tumbuh
     * seiring bertambahnya barang.
     *
     * @return array<string, float>  kunci "App\Models\Ingredient:12"
     */
    private function dailyUsageMap(int $days): array
    {
        if ($days <= 0) {
            return [];
        }

        return StockLedger::query()
            ->select(
                'item_type',
                'item_id',
                DB::raw('SUM(quantity) as total'),
            )
            ->where('direction', 'out')
            // Hanya pemakaian sesungguhnya. Penyesuaian dan kerugian bukan
            // pemakaian rutin, jadi memasukkannya akan membuat perkiraan
            // "cukup untuk berapa hari" terlalu pesimistis.
            ->whereIn('source_type', ['production_consume', 'sale'])
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('item_type', 'item_id')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->item_type.':'.$row->item_id => round((float) $row->total / $days, 4),
            ])
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @return Collection<int, array<string, mixed>>
     */
    private function sortItems(Collection $items, string $sortBy, string $sortDir): Collection
    {
        $menurun = $sortDir === 'desc';

        $items = match ($sortBy) {
            // Urutan bawaan: yang paling genting di atas. Membuka halaman
            // persediaan seharusnya langsung memperlihatkan apa yang bermasalah,
            // bukan daftar menurut abjad.
            'status' => $items->sortBy([
                fn (array $a, array $b) => $b['status']->severity() <=> $a['status']->severity(),
                fn (array $a, array $b) => strcmp($a['name'], $b['name']),
            ]),
            'name' => $items->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE, $menurun),
            'code' => $items->sortBy('code', SORT_NATURAL | SORT_FLAG_CASE, $menurun),
            'stock' => $items->sortBy('current_stock_display', SORT_REGULAR, $menurun),
            'value' => $items->sortBy('stock_value', SORT_REGULAR, $menurun),
            default => $items->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE, $menurun),
        };

        // Urutan status punya arah sendiri (genting → aman), jadi pembalikannya
        // ditangani terpisah agar tidak bentrok dengan pembanding di atas.
        if ($sortBy === 'status' && $menurun) {
            $items = $items->reverse();
        }

        return $items->values();
    }

    /*
    |--------------------------------------------------------------------------
    | Riwayat mutasi
    |--------------------------------------------------------------------------
    */

    /**
     * Riwayat pergerakan stok dengan penyaringan.
     *
     * @param  array<string, mixed>  $filters
     */
    public function movements(array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        return StockLedger::query()
            ->with(['item:id,name,code', 'user:id,name'])
            ->when($filters['direction'] ?? null, fn ($q, $v) => $q->where('direction', $v))
            ->when($filters['source_type'] ?? null, fn ($q, $v) => $q->where('source_type', $v))
            ->when(
                $filters['kind'] ?? null,
                fn ($q, $v) => $q->where('item_type', $v === 'ingredient' ? Ingredient::class : Product::class)
            )
            ->when($filters['item_id'] ?? null, fn ($q, $v) => $q->where('item_id', $v))
            ->when($filters['date_from'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($filters['date_to'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->where(function ($sub) use ($v) {
                $sub->where('note', 'like', "%{$v}%")->orWhere('source_id', 'like', "%{$v}%");
            }))
            ->latest('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();
    }

    /**
     * Tren mutasi harian untuk grafik.
     *
     * Hari tanpa pergerakan tetap muncul sebagai nol. Tanpa itu, grafik garis
     * akan menyambung langsung dari Senin ke Kamis dan menyembunyikan dua hari
     * yang sebenarnya kosong.
     *
     * @return array<int, array<string, mixed>>
     */
    public function movementTrend(int $days = 30, ?string $kind = null): array
    {
        $sejak = today()->subDays($days - 1);

        $baris = StockLedger::query()
            ->select(
                DB::raw('DATE(created_at) as tanggal'),
                DB::raw("SUM(CASE WHEN direction = 'in' THEN quantity ELSE 0 END) as masuk"),
                DB::raw("SUM(CASE WHEN direction = 'out' THEN quantity ELSE 0 END) as keluar"),
                DB::raw('COUNT(*) as jumlah'),
            )
            ->where('created_at', '>=', $sejak)
            ->when(
                $kind,
                fn ($q, $v) => $q->where('item_type', $v === 'ingredient' ? Ingredient::class : Product::class)
            )
            ->groupBy('tanggal')
            ->get()
            ->keyBy('tanggal');

        $hasil = [];
        $kursor = $sejak->copy();

        while ($kursor <= today()) {
            $kunci = $kursor->format('Y-m-d');
            $data = $baris[$kunci] ?? null;

            $hasil[] = [
                'tanggal' => $kunci,
                'label' => $kursor->translatedFormat('d M'),
                'masuk' => round((float) ($data->masuk ?? 0), 2),
                'keluar' => round((float) ($data->keluar ?? 0), 2),
                'jumlah_mutasi' => (int) ($data->jumlah ?? 0),
            ];

            $kursor->addDay();
        }

        return $hasil;
    }

    /**
     * Rekap mutasi per sumber pada rentang waktu tertentu.
     *
     * Menjawab "stok keluar bulan ini paling banyak karena apa?" — produksi,
     * penjualan, atau kerugian.
     *
     * @return array<int, array<string, mixed>>
     */
    public function movementBySource(?string $dateFrom = null, ?string $dateTo = null): array
    {
        $baris = StockLedger::query()
            ->select(
                'source_type',
                'direction',
                DB::raw('COUNT(*) as jumlah'),
                DB::raw('SUM(quantity) as total_qty'),
            )
            ->when($dateFrom, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($dateTo, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->groupBy('source_type', 'direction')
            ->get();

        return $baris->map(fn ($row) => [
            'source_type' => $row->source_type->value,
            'source_label' => $row->source_type->label(),
            'direction' => $row->direction,
            'jumlah' => (int) $row->jumlah,
            'total_qty' => round((float) $row->total_qty, 2),
        ])->sortByDesc('jumlah')->values()->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Penyesuaian manual
    |--------------------------------------------------------------------------
    */

    /**
     * Koreksi stok ke hasil hitungan fisik.
     *
     * Catatan WAJIB — bukan sekadar aturan validasi, melainkan inti gunanya.
     * Penyesuaian tanpa alasan sama saja dengan mengubah angka stok diam-diam,
     * dan itulah yang selama ini dicegah seluruh rancangan ledger.
     *
     * Yang tercatat adalah SELISIHNYA sebagai satu baris ledger bertipe
     * `adjustment`, bukan menimpa angka lama — riwayat sebelumnya tetap utuh.
     *
     * @param  string  $kind  'ingredient' atau 'product'
     * @param  float  $physicalCount  jumlah hasil hitungan, dalam satuan dasar
     */
    public function adjust(
        string $kind,
        int $itemId,
        float $physicalCount,
        string $note,
        ?int $userId = null,
        ?string $idempotencyKey = null,
    ): array {
        $item = $this->findItem($kind, $itemId);

        $sebelum = (float) $item->current_stock;
        $statusSebelum = StockStatus::classify($sebelum, (float) $item->min_stock);

        $ledger = $this->stock->adjustToCount(
            item: $item,
            physicalCount: $physicalCount,
            reason: $note,
            userId: $userId,
            idempotencyKey: $idempotencyKey,
        );

        $item = $item->fresh();
        $statusSesudah = $item->stockStatus();

        return [
            'changed' => $ledger !== null,
            'ledger' => $ledger,
            'stock_before' => $sebelum,
            'stock_after' => (float) $item->current_stock,
            'difference' => round((float) $item->current_stock - $sebelum, 4),
            'status_before' => $statusSebelum,
            'status_after' => $statusSesudah,
            'item' => $item,
        ];
    }

    public function findItem(string $kind, int $id): Model
    {
        return match ($kind) {
            'ingredient' => Ingredient::findOrFail($id),
            'product' => Product::findOrFail($id),
            default => throw new \InvalidArgumentException("Jenis barang tidak dikenali: {$kind}"),
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Export
    |--------------------------------------------------------------------------
    */

    /**
     * Ringkasan stok dalam bentuk CSV yang siap dibuka Excel.
     *
     * Pemisahnya titik-koma, bukan koma, karena Excel dengan pengaturan wilayah
     * Indonesia memakai koma sebagai pemisah desimal — dengan pemisah koma,
     * angka "4,5" akan pecah menjadi dua kolom.
     *
     * @param  array<string, mixed>  $filters
     */
    public function exportItemsCsv(array $filters = []): string
    {
        $baris = [[
            'Kode', 'Nama', 'Jenis', 'Kategori', 'Satuan',
            'Stok', 'Minimum', 'Status', 'Harga Rata-rata', 'Nilai Persediaan',
        ]];

        foreach ($this->items($filters) as $row) {
            $baris[] = [
                $row['code'],
                $row['name'],
                $row['kind_label'],
                $row['category_name'] ?? '-',
                $row['unit'],
                $this->angkaCsv($row['current_stock_display']),
                $this->angkaCsv($row['min_stock_display']),
                strtoupper($row['status']->label()),
                $this->angkaCsv($row['avg_cost'] * $row['conversion_factor']),
                $this->angkaCsv($row['stock_value']),
            ];
        }

        return $this->susunCsv($baris);
    }

    /**
     * Riwayat mutasi dalam bentuk CSV.
     *
     * @param  array<string, mixed>  $filters
     */
    public function exportMovementsCsv(array $filters = []): string
    {
        $baris = [[
            'Tanggal', 'Kode', 'Barang', 'Jenis Barang', 'Arah',
            'Jumlah', 'Sumber', 'Referensi', 'Saldo Sebelum', 'Saldo Sesudah',
            'Petugas', 'Catatan',
        ]];

        // Export tidak dibatasi halaman — kalau pengguna menyaring satu bulan,
        // yang diunduh harus satu bulan penuh, bukan 20 baris pertama.
        $query = StockLedger::query()
            ->with(['item:id,name,code', 'user:id,name'])
            ->when($filters['direction'] ?? null, fn ($q, $v) => $q->where('direction', $v))
            ->when($filters['source_type'] ?? null, fn ($q, $v) => $q->where('source_type', $v))
            ->when(
                $filters['kind'] ?? null,
                fn ($q, $v) => $q->where('item_type', $v === 'ingredient' ? Ingredient::class : Product::class)
            )
            ->when($filters['item_id'] ?? null, fn ($q, $v) => $q->where('item_id', $v))
            ->when($filters['date_from'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($filters['date_to'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->latest('id');

        foreach ($query->cursor() as $m) {
            $baris[] = [
                $m->created_at?->format('d/m/Y H:i'),
                $m->item?->code ?? '-',
                $m->item?->name ?? '(barang dihapus)',
                $m->item_type === Ingredient::class ? 'Bahan Baku' : 'Produk Jadi',
                $m->direction === 'in' ? 'MASUK' : 'KELUAR',
                $this->angkaCsv((float) $m->quantity),
                $m->source_type->label(),
                $m->source_id ?? '-',
                $this->angkaCsv((float) $m->balance_before),
                $this->angkaCsv((float) $m->balance_after),
                $m->user?->name ?? 'Sistem',
                $m->note ?? '',
            ];
        }

        return $this->susunCsv($baris);
    }

    /**
     * @param  array<int, array<int, string|null>>  $baris
     */
    private function susunCsv(array $baris): string
    {
        $keluaran = '';

        foreach ($baris as $kolom) {
            $keluaran .= implode(';', array_map([$this, 'kutipCsv'], $kolom))."\r\n";
        }

        // BOM UTF-8. Tanpa ini Excel di Windows membaca berkas sebagai ANSI dan
        // huruf beraksen pada nama bahan berubah menjadi karakter aneh.
        return "\xEF\xBB\xBF".$keluaran;
    }

    private function kutipCsv(string|int|float|null $nilai): string
    {
        $teks = (string) ($nilai ?? '');

        if (str_contains($teks, ';') || str_contains($teks, '"') || str_contains($teks, "\n")) {
            return '"'.str_replace('"', '""', $teks).'"';
        }

        return $teks;
    }

    /** Desimal memakai koma, mengikuti format angka Indonesia di Excel. */
    private function angkaCsv(float $nilai): string
    {
        return str_replace('.', ',', (string) round($nilai, 2));
    }

    /*
    |--------------------------------------------------------------------------
    | Pembantu
    |--------------------------------------------------------------------------
    */

    /** Daftar jenis mutasi untuk pengisi filter. */
    public function sourceOptions(): array
    {
        return StockMovementType::options();
    }

    /**
     * Barang yang perlu ditindaklanjuti, terurut dari yang paling genting.
     *
     * @return array<int, array<string, mixed>>
     */
    public function needsAttention(int $limit = 10): array
    {
        return $this->allItems()
            ->filter(fn (array $r) => $r['status']->isAlert())
            ->sortByDesc(fn (array $r) => $r['status']->severity())
            ->take($limit)
            ->map(function (array $r) {
                $harian = (float) $r['daily_usage'];

                return [
                    'kind' => $r['kind'],
                    'id' => $r['id'],
                    'code' => $r['code'],
                    'name' => $r['name'],
                    'unit' => $r['unit'],
                    'current_stock' => $r['current_stock_display'],
                    'min_stock' => $r['min_stock_display'],
                    'status' => $r['status']->value,
                    'status_label' => $r['status']->label(),
                    'status_tone' => $r['status']->tone(),

                    // Sisa hari sebelum stok habis, dari rata-rata pemakaian
                    // 30 hari terakhir. Null bila barang ini belum pernah
                    // terpakai — tidak ada dasar untuk memperkirakan.
                    'days_remaining' => $harian > 0
                        ? (int) floor($r['current_stock'] / $harian)
                        : null,
                ];
            })
            ->values()
            ->all();
    }

    /** Rentang tanggal yang dipakai dashboard, sekali hitung. */
    public function periode(int $days): array
    {
        return [
            'dari' => Carbon::today()->subDays($days - 1)->format('Y-m-d'),
            'sampai' => Carbon::today()->format('Y-m-d'),
            'hari' => $days,
        ];
    }
}
