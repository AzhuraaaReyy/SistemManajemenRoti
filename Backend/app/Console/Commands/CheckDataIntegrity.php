<?php

namespace App\Console\Commands;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeItem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Memeriksa hal-hal yang seharusnya mustahil terjadi.
 *
 * Setiap pemeriksaan di sini mewakili satu keadaan yang, bila muncul, akan
 * membuat modul lain berperilaku salah tanpa memunculkan error apa pun.
 * Menemukannya lewat perintah terjadwal jauh lebih murah daripada menemukannya
 * lewat laporan laba yang angkanya aneh.
 *
 *   php artisan data:check
 */
class CheckDataIntegrity extends Command
{
    protected $signature = 'data:check {--strict : Kembalikan kode gagal bila ada peringatan}';

    protected $description = 'Memeriksa konsistensi data antar modul';

    /** @var array<int, array{level: string, check: string, detail: string}> */
    private array $temuan = [];

    public function handle(): int
    {
        $this->info('Memeriksa integritas data…');
        $this->newLine();

        $this->periksaResepAktifGanda();
        $this->periksaResepKosong();
        $this->periksaResepAktifTanpaBahan();
        $this->periksaProdukTanpaResep();
        $this->periksaBahanYatim();
        $this->periksaStokNegatif();
        $this->periksaFaktorKonversi();
        $this->periksaResepTerkunciTanpaProduksi();
        $this->periksaMarginNegatif();

        if ($this->temuan === []) {
            $this->info('✓ Tidak ditemukan masalah integritas data.');

            return self::SUCCESS;
        }

        $galat = array_filter($this->temuan, fn ($t) => $t['level'] === 'GALAT');
        $peringatan = array_filter($this->temuan, fn ($t) => $t['level'] === 'PERINGATAN');

        $this->table(
            ['Tingkat', 'Pemeriksaan', 'Rincian'],
            array_map(fn ($t) => [$t['level'], $t['check'], $t['detail']], $this->temuan),
        );

        $this->newLine();
        $this->line(sprintf('Galat: %d · Peringatan: %d', count($galat), count($peringatan)));

        if ($galat !== []) {
            return self::FAILURE;
        }

        return $this->option('strict') && $peringatan !== [] ? self::FAILURE : self::SUCCESS;
    }

    /* ---------------------------------------------------------------------- */

    /**
     * Dua resep aktif untuk satu produk membuat modul Produksi tidak tahu
     * mana yang harus dipakai — dan pilihannya bisa berubah-ubah antar
     * permintaan tergantung urutan baris di database.
     */
    private function periksaResepAktifGanda(): void
    {
        $ganda = Recipe::select('product_id', DB::raw('COUNT(*) as jumlah'))
            ->where('is_active', true)
            ->groupBy('product_id')
            ->having('jumlah', '>', 1)
            ->pluck('jumlah', 'product_id');

        foreach ($ganda as $productId => $jumlah) {
            $nama = Product::find($productId)?->name ?? "ID {$productId}";
            $this->catat('GALAT', 'Resep aktif ganda', "{$nama} punya {$jumlah} resep aktif sekaligus");
        }
    }

    /** Resep tanpa bahan menghasilkan HPP nol dan produksi tanpa potong stok. */
    private function periksaResepKosong(): void
    {
        $kosong = Recipe::doesntHave('items')->get(['id', 'name', 'version', 'is_active']);

        foreach ($kosong as $recipe) {
            $level = $recipe->is_active ? 'GALAT' : 'PERINGATAN';
            $this->catat($level, 'Resep tanpa bahan', "{$recipe->name} v{$recipe->version}");
        }
    }

    /** Produk aktif dengan resep aktif kosong akan gagal saat diproduksi. */
    private function periksaResepAktifTanpaBahan(): void
    {
        $jumlah = Recipe::where('is_active', true)->doesntHave('items')->count();

        if ($jumlah > 0) {
            $this->catat('GALAT', 'Resep aktif kosong', "{$jumlah} resep aktif tidak punya bahan sama sekali");
        }
    }

    private function periksaProdukTanpaResep(): void
    {
        $tanpa = Product::where('is_active', true)
            ->whereDoesntHave('recipes', fn ($q) => $q->where('is_active', true))
            ->pluck('name');

        if ($tanpa->isNotEmpty()) {
            $this->catat(
                'PERINGATAN',
                'Produk tanpa resep aktif',
                $tanpa->take(5)->implode(', ').($tanpa->count() > 5 ? " (+{$tanpa->count()} lainnya)" : ''),
            );
        }
    }

    /** Baris resep yang menunjuk ke bahan yang sudah dihapus. */
    private function periksaBahanYatim(): void
    {
        $yatim = RecipeItem::whereDoesntHave('ingredient')->count();

        if ($yatim > 0) {
            $this->catat('GALAT', 'Baris resep yatim', "{$yatim} baris menunjuk ke bahan yang tidak ada");
        }
    }

    private function periksaStokNegatif(): void
    {
        foreach ([Ingredient::class => 'Bahan baku', Product::class => 'Produk'] as $kelas => $label) {
            $negatif = $kelas::where('current_stock', '<', 0)->pluck('name');

            if ($negatif->isNotEmpty()) {
                $this->catat('GALAT', 'Stok negatif', "{$label}: ".$negatif->implode(', '));
            }
        }
    }

    /**
     * Faktor konversi nol atau negatif membuat seluruh konversi satuan
     * menghasilkan nol atau angka terbalik.
     */
    private function periksaFaktorKonversi(): void
    {
        $rusak = Ingredient::where('conversion_factor', '<=', 0)->pluck('name');

        if ($rusak->isNotEmpty()) {
            $this->catat('GALAT', 'Faktor konversi tidak valid', $rusak->implode(', '));
        }
    }

    /**
     * Resep terkunci seharusnya punya production_count > 0. Bila nol, berarti
     * ada yang mengunci resep tanpa lewat RecipeService::markAsUsedInProduction().
     */
    private function periksaResepTerkunciTanpaProduksi(): void
    {
        $aneh = Recipe::whereNotNull('locked_at')->where('production_count', 0)->count();

        if ($aneh > 0) {
            $this->catat('PERINGATAN', 'Kunci resep tak wajar', "{$aneh} resep terkunci tapi belum pernah diproduksi");
        }
    }

    /** Produk yang dijual di bawah biaya bahannya. */
    private function periksaMarginNegatif(): void
    {
        $rugi = [];

        Product::with('activeRecipe.items.ingredient')
            ->where('is_active', true)
            ->chunk(100, function ($produk) use (&$rugi) {
                foreach ($produk as $p) {
                    if (! $p->activeRecipe) {
                        continue;
                    }

                    $hpp = $p->activeRecipe->costPerUnit();
                    $harga = (float) $p->selling_price;

                    if ($hpp > 0 && $harga > 0 && $harga < $hpp) {
                        $rugi[] = sprintf('%s (jual %s < HPP %s)', $p->name, number_format($harga), number_format($hpp));
                    }
                }
            });

        if ($rugi !== []) {
            $this->catat('PERINGATAN', 'Harga jual di bawah HPP', implode('; ', array_slice($rugi, 0, 5)));
        }
    }

    private function catat(string $level, string $check, string $detail): void
    {
        $this->temuan[] = compact('level', 'check', 'detail');
    }
}
