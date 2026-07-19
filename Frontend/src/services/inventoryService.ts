import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type { PaginatedResult } from '../types/master';
import type {
  InventoryDashboard,
  InventoryOptions,
  StockAdjustmentPayload,
  StockAdjustmentResult,
  StockAlert,
  StockItem,
  StockMovement,
} from '../types/inventory';

const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

/**
 * Memicu unduhan berkas dari endpoint yang dijaga token.
 *
 * Tautan <a href> biasa tidak bisa dipakai karena tidak membawa header
 * Authorization. Berkasnya diambil sebagai blob lewat axios (yang sudah
 * menyisipkan token), lalu diserahkan ke browser sebagai unduhan.
 */
const unduh = async (url: string, params: Record<string, unknown>, namaBerkas: string) => {
  const { data } = await api.get<Blob>(url, {
    params: bersihkan(params),
    responseType: 'blob',
  });

  const tautan = document.createElement('a');
  const objekUrl = URL.createObjectURL(data);

  tautan.href = objekUrl;
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();

  // Dibersihkan agar objek blob tidak menggantung di memori sampai halaman
  // ditutup — export berulang kali akan menumpuk kalau tidak dilepas.
  document.body.removeChild(tautan);
  URL.revokeObjectURL(objekUrl);
};

const tanggalBerkas = () => new Date().toISOString().slice(0, 10);

export const inventoryService = {
  async dashboard(days = 30, kind?: string): Promise<InventoryDashboard> {
    const { data } = await api.get<ApiResponse<InventoryDashboard>>('/inventory/dashboard', {
      params: bersihkan({ days, kind }),
    });
    return data.data!;
  },

  async options(): Promise<InventoryOptions> {
    const { data } = await api.get<ApiResponse<InventoryOptions>>('/inventory/options');
    return data.data!;
  },

  /**
   * Daftar stok gabungan bahan baku dan produk jadi.
   *
   * Tidak berhalaman: jumlah barang sebuah UMKM roti berkisar puluhan, dan
   * menampilkannya sekaligus membuat pengurutan menurut kegentingan benar-benar
   * berguna — halaman kedua yang berisi barang paling aman tidak ada gunanya.
   */
  async items(filters: Record<string, unknown> = {}): Promise<{
    items: StockItem[];
    total: number;
    nilai_total: number;
  }> {
    const { data } = await api.get<
      ApiResponse<{ items: StockItem[]; total: number; nilai_total: number }>
    >('/inventory/items', { params: bersihkan(filters) });
    return data.data!;
  },

  async movements(filters: Record<string, unknown> = {}): Promise<PaginatedResult<StockMovement>> {
    const { data } = await api.get<ApiResponse<StockMovement[]> & PaginatedResult<StockMovement>>(
      '/inventory/movements',
      { params: bersihkan(filters) },
    );
    return { data: data.data, meta: data.meta };
  },

  async adjust(
    payload: StockAdjustmentPayload,
  ): Promise<{ result: StockAdjustmentResult; message: string }> {
    const { data } = await api.post<ApiResponse<StockAdjustmentResult>>(
      '/inventory/adjustments',
      payload,
    );
    return { result: data.data!, message: data.message };
  },

  exportItems(filters: Record<string, unknown> = {}): Promise<void> {
    return unduh('/inventory/export/items', filters, `laporan-stok-${tanggalBerkas()}.csv`);
  },

  exportMovements(filters: Record<string, unknown> = {}): Promise<void> {
    return unduh('/inventory/export/movements', filters, `riwayat-mutasi-${tanggalBerkas()}.csv`);
  },
};

/* -------------------------------------------------------------------------- */
/* Peringatan stok                                                             */
/* -------------------------------------------------------------------------- */

export const stockAlertService = {
  async list(filters: Record<string, unknown> = {}): Promise<PaginatedResult<StockAlert>> {
    const { data } = await api.get<ApiResponse<StockAlert[]> & PaginatedResult<StockAlert>>(
      '/inventory/alerts',
      { params: bersihkan(filters) },
    );
    return { data: data.data, meta: data.meta };
  },

  /** Ringkas — dipakai lonceng di bilah atas. */
  async unread(): Promise<{ count: number; items: StockAlert[] }> {
    const { data } = await api.get<ApiResponse<{ count: number; items: StockAlert[] }>>(
      '/inventory/alerts/unread',
    );
    return data.data!;
  },

  async markRead(id: number): Promise<number> {
    const { data } = await api.patch<ApiResponse<{ unread_count: number }>>(
      `/inventory/alerts/${id}/read`,
    );
    return data.data!.unread_count;
  },

  async markAllRead(): Promise<{ marked: number; message: string }> {
    const { data } = await api.post<ApiResponse<{ marked: number }>>('/inventory/alerts/read-all');
    return { marked: data.data!.marked, message: data.message };
  },
};
