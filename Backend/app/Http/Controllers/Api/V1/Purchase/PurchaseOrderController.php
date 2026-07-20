<?php

namespace App\Http\Controllers\Api\V1\Purchase;

use App\Enums\PurchaseOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Http\Requests\Purchase\ReceiveGoodsRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\PurchaseReceiptResource;
use App\Models\ActivityLog;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReceipt;
use App\Services\PurchaseService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly PurchaseService $purchases)
    {
    }

    /**
     * GET /api/v1/purchases/orders
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(PurchaseOrderStatus::values())],
            'supplier_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'outstanding' => ['nullable', 'boolean'],
            'sort_by' => ['nullable', Rule::in(['po_number', 'order_date', 'expected_date', 'total', 'created_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $orders = PurchaseOrder::query()
            ->with(['supplier:id,name,phone,contact_person', 'items'])
            ->withCount(['items', 'receipts'])
            ->search($filters['search'] ?? null)
            ->status($filters['status'] ?? null)
            ->betweenDates($filters['date_from'] ?? null, $filters['date_to'] ?? null)
            ->when($filters['supplier_id'] ?? null, fn ($q, $id) => $q->where('supplier_id', $id))
            ->when($filters['outstanding'] ?? false, fn ($q) => $q->outstanding())
            ->orderBy($filters['sort_by'] ?? 'order_date', $filters['sort_dir'] ?? 'desc')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $orders,
            PurchaseOrderResource::collection($orders->items()),
            'Daftar pembelian berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/purchases/orders/{purchase_order}
     */
    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($purchaseOrder))],
            'Detail pembelian berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/purchases/orders
     */
    public function store(PurchaseOrderRequest $request): JsonResponse
    {
        $po = $this->purchases->create(
            $request->safe()->except('items'),
            $request->input('items', []),
            $request->user()?->id,
        );

        ActivityLog::record(
            'pembelian_dibuat',
            "Membuat pesanan pembelian {$po->po_number} untuk {$po->supplier->name}",
            $request->user(), $po, $request
        );

        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
            "Pesanan {$po->po_number} berhasil dibuat sebagai draft.",
            201
        );
    }

    /**
     * PUT /api/v1/purchases/orders/{purchase_order}
     */
    public function update(PurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $po = $this->purchases->update(
            $purchaseOrder,
            $request->safe()->except('items'),
            $request->input('items', []),
        );

        ActivityLog::record(
            'pembelian_diperbarui',
            "Memperbarui pesanan {$po->po_number}",
            $request->user(), $po, $request
        );

        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
            "Pesanan {$po->po_number} berhasil diperbarui."
        );
    }

    /**
     * POST /api/v1/purchases/orders/{purchase_order}/confirm
     */
    public function confirm(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $po = $this->purchases->confirm($purchaseOrder, $request->user()?->id);

        ActivityLog::record(
            'pembelian_dikonfirmasi',
            "Mengonfirmasi pesanan {$po->po_number} — menunggu barang datang",
            $request->user(), $po, $request
        );

        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
            "Pesanan {$po->po_number} dikonfirmasi. Catat penerimaan saat barang tiba."
        );
    }

    /**
     * POST /api/v1/purchases/orders/{purchase_order}/receive
     *
     * "Barang datang" — mencatat penerimaan dan menambah stok.
     */
    public function receive(ReceiveGoodsRequest $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $receipt = $this->purchases->receive(
            po: $purchaseOrder,
            rows: $request->input('items', []),
            receiptDate: $request->input('receipt_date'),
            deliveryNote: $request->input('delivery_note_number'),
            notes: $request->input('notes'),
            userId: $request->user()?->id,
            idempotencyKey: $request->input('idempotency_key'),
        );

        $po = $purchaseOrder->fresh();

        ActivityLog::record(
            'barang_diterima',
            "Mencatat penerimaan {$receipt->receipt_number} untuk pesanan {$po->po_number}",
            $request->user(), $receipt, $request
        );

        $pesan = $po->status === PurchaseOrderStatus::COMPLETED
            ? "Penerimaan {$receipt->receipt_number} tercatat. Seluruh barang sudah diterima dan stok telah bertambah."
            : "Penerimaan {$receipt->receipt_number} tercatat dan stok telah bertambah. Sebagian barang masih ditunggu.";

        return $this->success([
            'receipt' => new PurchaseReceiptResource($receipt->load(['items.ingredient', 'items.orderItem', 'receiver'])),
            'order' => new PurchaseOrderResource($this->muatLengkap($po)),
        ], $pesan, 201);
    }

    /**
     * PATCH /api/v1/purchases/orders/{purchase_order}/status
     *
     * Jalan pintas satu langkah untuk mengubah status pesanan.
     *
     * Endpoint aksi rinci (confirm / receive / cancel / close) tetap tersedia
     * dan diperlukan untuk kedatangan bertahap. Yang ini melayani kasus paling
     * umum: barang datang lengkap sesuai pesanan, cukup ditandai sekali.
     *
     * Istilah dari spesifikasi diterima sebagai alias, sehingga klien boleh
     * mengirim "pending", "barang_diterima", atau "selesai" apa adanya.
     */
    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'max:30'],
            'reason' => ['nullable', 'string', 'max:255'],
            'receipt_date' => ['nullable', 'date', 'before_or_equal:today'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
        ], [
            'status.required' => 'Status tujuan wajib diisi.',
        ]);

        $tujuan = $this->normalkanStatus($data['status']);

        if ($tujuan === null) {
            return $this->error(
                'Status "'.$data['status'].'" tidak dikenali. Gunakan salah satu: '
                .'pending/ordered, received/barang_diterima, completed/selesai, atau cancelled/batal.',
                422
            );
        }

        $user = $request->user();

        return match ($tujuan) {
            PurchaseOrderStatus::ORDERED => $this->statusKeDipesan($purchaseOrder, $user, $request),
            PurchaseOrderStatus::PARTIAL,
            PurchaseOrderStatus::COMPLETED => $this->statusKeDiterima($purchaseOrder, $data, $user, $request, $tujuan),
            PurchaseOrderStatus::CANCELLED => $this->cancel(
                $request->merge(['reason' => $data['reason'] ?? 'Dibatalkan lewat perubahan status.']),
                $purchaseOrder
            ),
            default => $this->error('Pesanan tidak dapat dikembalikan ke status draft.', 422),
        };
    }

    /**
     * Menerjemahkan istilah status dari berbagai penulisan menjadi enum internal.
     *
     * Spesifikasi memakai "pending / barang diterima / selesai", sementara
     * sistem memakai lima status agar bisa menangani kedatangan bertahap.
     * Pemetaan ini membuat keduanya bisa dipakai bergantian.
     */
    private function normalkanStatus(string $nilai): ?PurchaseOrderStatus
    {
        $kunci = str_replace([' ', '-'], '_', mb_strtolower(trim($nilai)));

        return match ($kunci) {
            'pending', 'ordered', 'dipesan', 'menunggu' => PurchaseOrderStatus::ORDERED,
            'received', 'barang_diterima', 'diterima', 'partial', 'diterima_sebagian' => PurchaseOrderStatus::PARTIAL,
            'completed', 'selesai', 'done' => PurchaseOrderStatus::COMPLETED,
            'cancelled', 'canceled', 'dibatalkan', 'batal' => PurchaseOrderStatus::CANCELLED,
            'draft' => PurchaseOrderStatus::DRAFT,
            default => null,
        };
    }

    private function statusKeDipesan(PurchaseOrder $po, $user, Request $request): JsonResponse
    {
        if ($po->status === PurchaseOrderStatus::ORDERED) {
            return $this->success(
                ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
                "Pesanan {$po->po_number} memang sudah berstatus Dipesan."
            );
        }

        return $this->confirm($request, $po);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function statusKeDiterima(
        PurchaseOrder $po,
        array $data,
        $user,
        Request $request,
        PurchaseOrderStatus $tujuan,
    ): JsonResponse {
        $po->loadMissing('items');

        if ($po->status === PurchaseOrderStatus::CANCELLED) {
            return $this->error(
                "Pesanan {$po->po_number} sudah dibatalkan, jadi tidak dapat menerima barang.",
                422
            );
        }

        // Draft yang langsung ditandai diterima dikonfirmasi lebih dulu, agar
        // jejak "kapan dipesan" tetap terisi dan tidak ada lompatan status.
        if ($po->status === PurchaseOrderStatus::DRAFT) {
            $this->purchases->confirm($po, $user?->id);
            $po->refresh()->loadMissing('items');
        }

        /*
        | Pemeriksaan idempotensi.
        |
        | Ditempatkan SEBELUM penjagaan status, karena pesanan yang sudah
        | Selesai memang tidak bisa "menerima barang" — tetapi mengubah
        | statusnya menjadi diterima untuk kedua kalinya bukan kesalahan
        | pemanggil, melainkan permintaan yang hasilnya sudah tercapai.
        |
        | Menjawabnya sebagai error akan membuat klien yang mengirim ulang
        | permintaan (jaringan lambat, tombol tertekan dua kali) mengira ada
        | yang salah, padahal stok justru sudah benar.
        */
        if ($po->items->isNotEmpty() && $po->isFullyReceived()) {
            return $this->success(
                ['order' => new PurchaseOrderResource($this->muatLengkap($po->fresh()))],
                "Seluruh barang pada pesanan {$po->po_number} sudah diterima sebelumnya. Stok tidak ditambah lagi."
            );
        }

        // Menutup sisa yang tidak jadi dikirim.
        if ($tujuan === PurchaseOrderStatus::COMPLETED && $po->status === PurchaseOrderStatus::PARTIAL) {
            $ditutup = $this->purchases->close($po, $data['reason'] ?? null);

            ActivityLog::record(
                'pembelian_ditutup',
                "Menutup pesanan {$ditutup->po_number} lewat perubahan status",
                $user, $ditutup, $request
            );

            return $this->success(
                ['order' => new PurchaseOrderResource($this->muatLengkap($ditutup))],
                "Pesanan {$ditutup->po_number} ditutup. Barang yang sudah diterima tetap tercatat."
            );
        }

        if (! $po->status->canReceive()) {
            return $this->error(
                "Pesanan berstatus {$po->status->label()} tidak dapat menerima barang.",
                422
            );
        }

        $receipt = $this->purchases->receiveAllInFull(
            po: $po,
            receiptDate: $data['receipt_date'] ?? null,
            userId: $user?->id,
            idempotencyKey: $data['idempotency_key'] ?? null,
        );

        // Jaring pengaman kedua: bila ternyata tidak ada sisa sama sekali.
        if ($receipt === null) {
            return $this->success(
                ['order' => new PurchaseOrderResource($this->muatLengkap($po->fresh()))],
                "Seluruh barang pada pesanan {$po->po_number} sudah diterima sebelumnya. Stok tidak ditambah lagi."
            );
        }

        $segar = $po->fresh();

        ActivityLog::record(
            'barang_diterima',
            "Menandai pesanan {$segar->po_number} sebagai barang diterima ({$receipt->receipt_number})",
            $user, $receipt, $request
        );

        return $this->success([
            'receipt' => new PurchaseReceiptResource($receipt->load(['items.ingredient', 'items.orderItem', 'receiver'])),
            'order' => new PurchaseOrderResource($this->muatLengkap($segar)),
        ], "Barang diterima lengkap. Stok bertambah dan pesanan {$segar->po_number} berstatus {$segar->status->label()}.");
    }

    /**
     * POST /api/v1/purchases/orders/{purchase_order}/cancel
     */
    public function cancel(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
        ], [
            'reason.required' => 'Alasan pembatalan wajib diisi agar riwayat tetap bisa ditelusuri.',
            'reason.min' => 'Alasan pembatalan terlalu singkat.',
        ]);

        $po = $this->purchases->cancel($purchaseOrder, $data['reason'], $request->user()?->id);

        ActivityLog::record(
            'pembelian_dibatalkan',
            "Membatalkan pesanan {$po->po_number}: {$data['reason']}",
            $request->user(), $po, $request
        );

        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
            "Pesanan {$po->po_number} dibatalkan."
        );
    }

    /**
     * POST /api/v1/purchases/orders/{purchase_order}/close
     */
    public function close(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $po = $this->purchases->close($purchaseOrder, $data['reason'] ?? null);

        ActivityLog::record(
            'pembelian_ditutup',
            "Menutup pesanan {$po->po_number} — sisa tidak jadi dikirim",
            $request->user(), $po, $request
        );

        return $this->success(
            ['order' => new PurchaseOrderResource($this->muatLengkap($po))],
            "Pesanan {$po->po_number} ditutup. Barang yang sudah diterima tetap tercatat."
        );
    }

    /**
     * DELETE /api/v1/purchases/orders/{purchase_order}
     */
    public function destroy(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $nomor = $purchaseOrder->po_number;

        ActivityLog::record(
            'pembelian_dihapus',
            "Menghapus draft pesanan {$nomor}",
            $request->user(), $purchaseOrder, $request
        );

        $this->purchases->delete($purchaseOrder);

        return $this->success(null, "Draft pesanan {$nomor} berhasil dihapus.");
    }

    /**
     * GET /api/v1/purchases/receipts
     *
     * Riwayat penerimaan barang lintas pesanan.
     */
    public function receipts(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $receipts = PurchaseReceipt::query()
            ->with(['purchaseOrder.supplier:id,name', 'items.ingredient:id,name', 'items.orderItem', 'receiver:id,name'])
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where(function ($w) use ($s) {
                $w->where('receipt_number', 'like', "%{$s}%")
                    ->orWhere('delivery_note_number', 'like', "%{$s}%")
                    ->orWhereHas('purchaseOrder', fn ($p) => $p->where('po_number', 'like', "%{$s}%"));
            }))
            ->when($filters['supplier_id'] ?? null, fn ($q, $id) => $q->whereHas(
                'purchaseOrder', fn ($p) => $p->where('supplier_id', $id)
            ))
            ->when($filters['date_from'] ?? null, fn ($q, $d) => $q->whereDate('receipt_date', '>=', $d))
            ->when($filters['date_to'] ?? null, fn ($q, $d) => $q->whereDate('receipt_date', '<=', $d))
            ->orderByDesc('receipt_date')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $receipts,
            PurchaseReceiptResource::collection($receipts->items()),
            'Riwayat penerimaan barang berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/purchases/statuses
     */
    public function statuses(): JsonResponse
    {
        return $this->success(PurchaseOrderStatus::options(), 'Daftar status berhasil diambil.');
    }

    private function muatLengkap(PurchaseOrder $po): PurchaseOrder
    {
        return $po->load([
            'supplier',
            'items.ingredient:id,name,code,display_unit,base_unit,conversion_factor,current_stock',
            'receipts.items.ingredient:id,name',
            'receipts.items.orderItem',
            'receipts.receiver:id,name',
            'creator:id,name',
            'orderer:id,name',
            'canceller:id,name',
        ])->loadCount(['items', 'receipts']);
    }
}
