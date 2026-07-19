<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Enums\StockMovementType;
use App\Enums\StockStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StockAdjustmentRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\ActivityLog;
use App\Services\InventoryService;
use App\Services\StockAlertService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pusat monitoring persediaan.
 *
 * Modul ini membaca tabel yang sama dengan Pembelian dan Produksi. Tidak ada
 * sumber data baru — hanya cara baru membacanya.
 */
class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventory,
        private readonly StockAlertService $alerts,
    ) {
    }

    /**
     * GET /api/v1/inventory/dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'days' => ['nullable', 'integer', 'min:7', 'max:90'],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
        ]);

        $hari = $filters['days'] ?? 30;

        return $this->success([
            'ringkasan' => $this->inventory->summary(),
            'perlu_perhatian' => $this->inventory->needsAttention(10),
            'tren_mutasi' => $this->inventory->movementTrend($hari, $filters['kind'] ?? null),
            'per_sumber' => $this->inventory->movementBySource(
                now()->subDays($hari - 1)->format('Y-m-d'),
            ),
            'peringatan_belum_dibaca' => $this->alerts->unreadCount(),
            'periode' => $this->inventory->periode($hari),
        ], 'Dashboard persediaan berhasil diambil.');
    }

    /**
     * GET /api/v1/inventory/items
     *
     * Ringkasan stok saat ini per barang — bahan baku dan produk jadi
     * dalam satu daftar.
     */
    public function items(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
            'status' => ['nullable', Rule::in(StockStatus::values())],
            'category_id' => ['nullable', 'integer'],
            'sort_by' => ['nullable', Rule::in(['status', 'name', 'code', 'stock', 'value'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $items = $this->inventory->items($filters);

        return $this->success([
            'items' => $items->map(fn (array $r) => $this->bentukItem($r))->all(),
            'total' => $items->count(),
            'nilai_total' => round((float) $items->sum('stock_value'), 2),
        ], 'Ringkasan stok berhasil diambil.');
    }

    /**
     * GET /api/v1/inventory/movements
     *
     * Riwayat mutasi dengan penyaringan tanggal, arah, dan sumber.
     */
    public function movements(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'direction' => ['nullable', Rule::in(['in', 'out'])],
            'source_type' => ['nullable', Rule::in(StockMovementType::values())],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
            'item_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ], [
            'date_to.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
        ]);

        $mutasi = $this->inventory->movements($filters);

        return $this->paginated(
            $mutasi,
            StockMovementResource::collection($mutasi->items()),
            'Riwayat mutasi stok berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/inventory/adjustments
     *
     * Penyesuaian stok manual. Tercatat sebagai mutasi bertipe `adjustment`
     * dengan catatan wajib — bukan menimpa angka stok diam-diam.
     */
    public function adjust(StockAdjustmentRequest $request): JsonResponse
    {
        $item = $this->inventory->findItem(
            $request->string('kind')->toString(),
            $request->integer('item_id'),
        );

        /*
        | Pengguna mengetik dalam satuan yang ia lihat (kg), sedangkan stok
        | disimpan dalam satuan dasar (gram). Konversi dilakukan di sini karena
        | hanya di lapisan ini faktor konversi barangnya diketahui — service
        | tetap berurusan dengan satuan dasar saja.
        */
        $faktor = (float) ($item->conversion_factor ?? 1);
        $hitungan = (float) $request->input('physical_count') * max($faktor, 0.0001);

        $hasil = $this->inventory->adjust(
            kind: $request->string('kind')->toString(),
            itemId: $request->integer('item_id'),
            physicalCount: $hitungan,
            note: $request->string('note')->toString(),
            userId: $request->user()?->id,
            idempotencyKey: $request->input('idempotency_key'),
        );

        // Penyesuaian yang tidak mengubah apa pun bukan kesalahan — hitungan
        // fisik yang cocok dengan catatan justru kabar baik.
        if (! $hasil['changed']) {
            return $this->success([
                'changed' => false,
                'stock' => $hasil['stock_after'],
            ], 'Stok sudah sesuai hitungan fisik. Tidak ada penyesuaian yang perlu dicatat.');
        }

        $selisih = $hasil['difference'];
        $arah = $selisih > 0 ? 'bertambah' : 'berkurang';

        ActivityLog::record(
            'stok_disesuaikan',
            sprintf(
                'Menyesuaikan stok %s: %s %s %s (%s)',
                $item->name,
                $arah,
                rtrim(rtrim(number_format(abs($selisih) / max($faktor, 0.0001), 4, ',', '.'), '0'), ','),
                $item->display_unit ?? $item->unit ?? '',
                $request->string('note')->toString(),
            ),
            $request->user(), $item, $request
        );

        return $this->success([
            'changed' => true,
            'stock_before' => round($hasil['stock_before'] / max($faktor, 0.0001), 4),
            'stock_after' => round($hasil['stock_after'] / max($faktor, 0.0001), 4),
            'difference' => round($selisih / max($faktor, 0.0001), 4),
            'status_before' => $hasil['status_before']->value,
            'status_after' => $hasil['status_after']->value,
            'status_after_label' => $hasil['status_after']->label(),
            'movement' => new StockMovementResource($hasil['ledger']->load(['item', 'user'])),
        ], sprintf(
            'Stok %s disesuaikan. Selisih %s tercatat sebagai mutasi penyesuaian.',
            $item->name,
            $arah,
        ));
    }

    /**
     * GET /api/v1/inventory/export/items
     */
    public function exportItems(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
            'status' => ['nullable', Rule::in(StockStatus::values())],
            'category_id' => ['nullable', 'integer'],
            'sort_by' => ['nullable', Rule::in(['status', 'name', 'code', 'stock', 'value'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        return $this->unduh(
            $this->inventory->exportItemsCsv($filters),
            'laporan-stok-'.now()->format('Y-m-d').'.csv',
        );
    }

    /**
     * GET /api/v1/inventory/export/movements
     */
    public function exportMovements(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'direction' => ['nullable', Rule::in(['in', 'out'])],
            'source_type' => ['nullable', Rule::in(StockMovementType::values())],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
            'item_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        return $this->unduh(
            $this->inventory->exportMovementsCsv($filters),
            'riwayat-mutasi-'.now()->format('Y-m-d').'.csv',
        );
    }

    /**
     * GET /api/v1/inventory/options
     *
     * Pengisi filter: status, jenis mutasi, dan daftar barang.
     */
    public function options(): JsonResponse
    {
        return $this->success([
            'statuses' => StockStatus::options(),
            'headline_statuses' => array_map(
                fn (StockStatus $s) => ['value' => $s->value, 'label' => $s->label(), 'tone' => $s->tone()],
                StockStatus::headlines(),
            ),
            'sources' => $this->inventory->sourceOptions(),
            'kinds' => [
                ['value' => 'ingredient', 'label' => 'Bahan Baku'],
                ['value' => 'product', 'label' => 'Produk Jadi'],
            ],
            'items' => $this->inventory->items()->map(fn (array $r) => [
                'value' => $r['kind'].':'.$r['id'],
                'kind' => $r['kind'],
                'id' => $r['id'],
                'label' => $r['name'].' ('.$r['code'].')',
            ])->all(),
        ], 'Pilihan filter persediaan berhasil diambil.');
    }

    /* ---------------------------------------------------------------------- */

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function bentukItem(array $row): array
    {
        $status = $row['status'];
        $harian = (float) $row['daily_usage'];

        return [
            'kind' => $row['kind'],
            'kind_label' => $row['kind_label'],
            'id' => $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'category_name' => $row['category_name'],

            'unit' => $row['unit'],
            'conversion_factor' => $row['conversion_factor'],
            'current_stock' => $row['current_stock_display'],
            'min_stock' => $row['min_stock_display'],

            'avg_cost' => round($row['avg_cost'] * $row['conversion_factor'], 2),
            'stock_value' => $row['stock_value'],

            'status' => $status->value,
            'status_label' => $status->label(),
            'status_tone' => $status->tone(),
            'status_headline' => $status->headline()->value,

            'daily_usage' => round($harian / max($row['conversion_factor'], 0.0001), 4),
            'days_remaining' => $harian > 0
                ? (int) floor($row['current_stock'] / $harian)
                : null,
        ];
    }

    /**
     * Mengirim berkas CSV sebagai unduhan.
     *
     * Dialirkan, bukan dikembalikan sekaligus, supaya riwayat mutasi yang
     * panjang tidak menumpuk di memori.
     */
    private function unduh(string $isi, string $namaBerkas): StreamedResponse
    {
        return response()->streamDownload(function () use ($isi) {
            echo $isi;
        }, $namaBerkas, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }
}
