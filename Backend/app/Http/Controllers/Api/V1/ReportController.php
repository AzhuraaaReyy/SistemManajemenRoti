<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentMethod;
use App\Enums\ProductionStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReportType;
use App\Enums\SaleStatus;
use App\Enums\StockMovementType;
use App\Exports\ReportExport;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\ReportService;
use App\Services\SettingService;
use App\Traits\ApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pusat pelaporan formal — khusus Owner.
 *
 * Tiga keluaran dari SATU sumber: tabel pratinjau, berkas Excel, dan berkas
 * PDF semuanya dibangun dari hasil ReportService yang sama. Yang dilihat
 * pengguna di layar dijamin sama dengan yang tercetak.
 */
class ReportController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly ReportService $reports,
        private readonly SettingService $settings,
    ) {
    }

    /**
     * GET /api/v1/reports/types
     *
     * Daftar jenis laporan beserta filter dan kolomnya, plus isi pilihan
     * setiap filter. Dipanggil sekali saat halaman dibuka.
     */
    public function types(): JsonResponse
    {
        return $this->success([
            'types' => ReportType::options(),
            'options' => [
                'suppliers' => Supplier::orderBy('name')->get(['id', 'name'])
                    ->map(fn ($s) => ['value' => $s->id, 'label' => $s->name])->all(),

                'products' => Product::orderBy('name')->get(['id', 'name'])
                    ->map(fn ($p) => ['value' => $p->id, 'label' => $p->name])->all(),

                'categories' => Category::orderBy('name')->get(['id', 'name'])
                    ->map(fn ($c) => ['value' => $c->id, 'label' => $c->name])->all(),

                'cashiers' => User::whereIn('role', ['kasir', 'owner'])->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(fn ($u) => ['value' => $u->id, 'label' => $u->name])->all(),

                'payment_methods' => PaymentMethod::options(),
                'source_types' => StockMovementType::options(),

                'status_penjualan' => SaleStatus::options(),
                'status_produksi' => ProductionStatus::options(),
                'status_pembelian' => PurchaseOrderStatus::options(),

                'kinds' => [
                    ['value' => 'ingredient', 'label' => 'Bahan Baku'],
                    ['value' => 'product', 'label' => 'Produk Jadi'],
                ],
            ],
        ], 'Daftar jenis laporan berhasil diambil.');
    }

    /**
     * GET /api/v1/reports/{type}
     *
     * Pratinjau laporan dalam bentuk data terstruktur.
     */
    public function show(Request $request, string $type): JsonResponse
    {
        $jenis = $this->parseType($type);
        $filters = $this->validasiFilter($request);

        $halaman = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        return $this->success(
            $this->reports->build(
                $jenis,
                $filters,
                // Pratinjau SELALU berhalaman. Laporan setahun bisa memuat
                // ribuan baris, dan mengirimkan seluruhnya hanya untuk
                // ditampilkan di layar membuat setiap perubahan filter terasa
                // berat tanpa alasan.
                page: $halaman['page'] ?? 1,
                perPage: $halaman['per_page'] ?? null,
            ),
            $jenis->label().' berhasil disusun.'
        );
    }

    /**
     * GET /api/v1/reports/{type}/export/excel
     */
    public function exportExcel(Request $request, string $type): BinaryFileResponse
    {
        $jenis = $this->parseType($type);
        $filters = $this->validasiFilter($request);

        // Tanpa nomor halaman — berkas ekspor memuat SELURUH baris laporan,
        // bukan sepuluh baris yang kebetulan sedang tampil di layar.
        $laporan = $this->reports->build($jenis, $filters);

        $this->catat($request, $jenis, 'Excel', $laporan['row_count']);

        return Excel::download(
            new ReportExport($laporan),
            $this->namaBerkas($jenis, 'xlsx'),
        );
    }

    /**
     * GET /api/v1/reports/{type}/export/pdf
     */
    public function exportPdf(Request $request, string $type): Response
    {
        $jenis = $this->parseType($type);
        $filters = $this->validasiFilter($request);

        // Sama seperti Excel: tanpa nomor halaman, seluruh baris ikut tercetak.
        $laporan = $this->reports->build($jenis, $filters);

        $this->catat($request, $jenis, 'PDF', $laporan['row_count']);

        // Sama seperti di ReportExport: `total` dikembalikan menjadi array agar
        // pemeriksaan kosong di templat berperilaku benar.
        $laporan['total'] = (array) $laporan['total'];

        $pdf = Pdf::loadView('reports.pdf', [
            'report' => $laporan,
            'toko' => $this->settings->forPos(),
            'pencetak' => $request->user()?->name ?? 'Sistem',

            // Pemformat dikirim sebagai closure supaya aturan tampilnya sama
            // persis dengan Excel dan layar, tanpa menyalinnya ke Blade.
            'format' => fn ($nilai, $format) => $this->formatNilai($nilai, $format),
        ]);

        // Laporan berkolom banyak dicetak mendatar — memaksanya tegak membuat
        // kolom terakhir terpotong keluar halaman.
        $pdf->setPaper('a4', $jenis->pdfOrientation());

        return $pdf->download($this->namaBerkas($jenis, 'pdf'));
    }

    /* ---------------------------------------------------------------------- */

    private function parseType(string $type): ReportType
    {
        $jenis = ReportType::tryFrom($type);

        if (! $jenis) {
            abort(404, "Jenis laporan \"{$type}\" tidak dikenali.");
        }

        return $jenis;
    }

    /**
     * Validasi filter.
     *
     * Seluruh filter dikumpulkan dalam satu aturan, bukan satu set per jenis
     * laporan. Filter yang tidak relevan bagi sebuah laporan cukup diabaikan
     * ReportService — memisahkannya per jenis hanya akan menghasilkan tujuh
     * daftar aturan yang 80% sama.
     *
     * @return array<string, mixed>
     */
    private function validasiFilter(Request $request): array
    {
        return $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'as_of' => ['nullable', 'date'],

            'supplier_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'cashier_id' => ['nullable', 'integer'],

            'payment_method' => ['nullable', Rule::in(PaymentMethod::values())],
            'source_type' => ['nullable', Rule::in(StockMovementType::values())],
            'direction' => ['nullable', Rule::in(['in', 'out'])],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],

            // Satu kunci `status` melayani ketiga jenis status, karena sebuah
            // laporan hanya pernah memakai salah satunya.
            'status' => ['nullable', 'string', 'max:30'],
        ], [
            'date_to.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
            'month.between' => 'Bulan harus antara 1 sampai 12.',
        ]);
    }

    /**
     * Pemformatan nilai untuk PDF.
     *
     * Sengaja mengembalikan HTML siap tempel (bukan teks polos) supaya nilai
     * kosong bisa diberi warna redup — tanda hubung berwarna abu jauh lebih
     * mudah dilewati mata daripada tanda hubung sehitam angkanya.
     */
    private function formatNilai(mixed $nilai, string $format): string
    {
        if ($nilai === null || $nilai === '' || $nilai === '—') {
            return '<span class="redup">—</span>';
        }

        return match ($format) {
            'money' => 'Rp'.number_format((float) $nilai, 0, ',', '.'),
            'number' => number_format(
                (float) $nilai,
                ((float) $nilai == (int) $nilai) ? 0 : 2,
                ',',
                '.'
            ),
            'percent' => number_format((float) $nilai, 1, ',', '.').'%',
            'date' => Carbon::parse($nilai)->format('d/m/Y'),
            'datetime' => Carbon::parse($nilai)->format('d/m/Y H:i'),
            default => e((string) $nilai),
        };
    }

    private function namaBerkas(ReportType $jenis, string $ekstensi): string
    {
        return 'laporan-'.str_replace('_', '-', $jenis->value)
            .'-'.now()->format('Y-m-d-His').'.'.$ekstensi;
    }

    /**
     * Setiap ekspor dicatat.
     *
     * Laporan formal adalah berkas yang keluar dari sistem dan beredar di luar
     * — siapa mengunduh apa dan kapan adalah pertanyaan yang cepat atau lambat
     * akan ditanyakan.
     */
    private function catat(Request $request, ReportType $jenis, string $format, int $baris): void
    {
        ActivityLog::record(
            'laporan_diekspor',
            "Mengekspor {$jenis->label()} ke {$format} ({$baris} baris)",
            $request->user(), null, $request
        );
    }
}
