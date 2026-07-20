<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Enums\StockStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\StockAlertResource;
use App\Models\StockAlert;
use App\Services\StockAlertService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Peringatan perubahan status stok.
 *
 * Baris di sini dibuat StockAlertService saat stok bergerak, bukan saat
 * halaman ini dibuka. Controller ini murni menampilkan dan menandai terbaca.
 */
class StockAlertController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly StockAlertService $alerts)
    {
    }

    /**
     * GET /api/v1/inventory/alerts
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'unread_only' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(StockStatus::values())],
            'kind' => ['nullable', Rule::in(['ingredient', 'product'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $daftar = StockAlert::query()
            ->with(['item:id,name,code', 'reader:id,name'])
            ->when($filters['unread_only'] ?? false, fn ($q) => $q->unread())
            ->ofStatus($filters['status'] ?? null)
            ->ofItemKind($filters['kind'] ?? null)
            ->latest('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $daftar,
            StockAlertResource::collection($daftar->items()),
            'Daftar peringatan stok berhasil diambil.'
        )->withHeaders([
            'X-Unread-Alerts' => (string) $this->alerts->unreadCount(),
        ]);
    }

    /**
     * GET /api/v1/inventory/alerts/unread
     *
     * Ringkas — dipakai lonceng di bilah atas, dipanggil berkala.
     */
    public function unread(): JsonResponse
    {
        $terbaru = StockAlert::with('item:id,name,code')
            ->unread()
            ->latest('id')
            ->limit(8)
            ->get();

        return $this->success([
            'count' => $this->alerts->unreadCount(),
            'items' => StockAlertResource::collection($terbaru)->resolve(),
        ], 'Peringatan belum dibaca berhasil diambil.');
    }

    /**
     * PATCH /api/v1/inventory/alerts/{alert}/read
     */
    public function markRead(Request $request, StockAlert $alert): JsonResponse
    {
        $this->alerts->markAsRead($alert, $request->user()?->id);

        return $this->success([
            'unread_count' => $this->alerts->unreadCount(),
        ], 'Peringatan ditandai sudah dibaca.');
    }

    /**
     * POST /api/v1/inventory/alerts/read-all
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $jumlah = $this->alerts->markAllAsRead($request->user()?->id);

        return $this->success([
            'marked' => $jumlah,
            'unread_count' => 0,
        ], $jumlah > 0
            ? "{$jumlah} peringatan ditandai sudah dibaca."
            : 'Tidak ada peringatan yang belum dibaca.');
    }
}
