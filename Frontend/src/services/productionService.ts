import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type { BaseFilters, PaginatedResult } from '../types/master';
import type {
  BatchTracking,
  FinishStagePayload,
  ProductionBatch,
  ProductionDashboard,
  ProductionPreview,
  ProductionStage,
  ProductionStatusOption,
  StageDefinition,
  StageName,
  StartProductionPayload,
} from '../types/production';

const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

export const productionService = {
  /**
   * Menghitung kebutuhan bahan tanpa mengubah apa pun.
   *
   * Dipanggil form produksi setiap kali produk atau jumlah berubah, supaya
   * pengguna melihat kecukupan stok sebelum menekan tombol.
   */
  async preview(productId: number, quantity: number): Promise<{ preview: ProductionPreview; message: string }> {
    const { data } = await api.post<ApiResponse<ProductionPreview>>('/production/preview', {
      product_id: productId,
      quantity,
    });
    return { preview: data.data!, message: data.message };
  },

  async list(filters: BaseFilters = {}): Promise<PaginatedResult<ProductionBatch>> {
    const { data } = await api.get<ApiResponse<ProductionBatch[]> & PaginatedResult<ProductionBatch>>(
      '/production/batches',
      { params: bersihkan(filters) },
    );
    return { data: data.data, meta: data.meta };
  },

  async show(id: number): Promise<ProductionBatch> {
    const { data } = await api.get<ApiResponse<{ batch: ProductionBatch }>>(`/production/batches/${id}`);
    return data.data!.batch;
  },

  async start(payload: StartProductionPayload): Promise<{ batch: ProductionBatch; message: string }> {
    const { data } = await api.post<ApiResponse<{ batch: ProductionBatch }>>('/production/batches', payload);
    return { batch: data.data!.batch, message: data.message };
  },

  /*
  | Method `complete()` dihapus bersama endpointnya pada Modul 5.
  | Batch ditutup lewat finishStage(id, 'packaging', { good_quantity }).
  */

  async cancel(id: number, reason: string): Promise<{ batch: ProductionBatch; message: string }> {
    const { data } = await api.post<ApiResponse<{ batch: ProductionBatch }>>(
      `/production/batches/${id}/cancel`,
      { reason },
    );
    return { batch: data.data!.batch, message: data.message };
  },

  async statuses(): Promise<ProductionStatusOption[]> {
    const { data } = await api.get<ApiResponse<ProductionStatusOption[]>>('/production/statuses');
    return data.data!;
  },

  async dashboard(months = 6): Promise<ProductionDashboard> {
    const { data } = await api.get<ApiResponse<ProductionDashboard>>('/production/dashboard', {
      params: { months },
    });
    return data.data!;
  },
};

/* -------------------------------------------------------------------------- */
/* Modul 5 — Tracking Produksi                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Bentuk balasan yang sama untuk mulai / selesaikan / ulangi tahap.
 *
 * Server selalu mengirim keadaan terbaru batch beserta seluruh tahapnya,
 * sehingga halaman cukup mengganti state tanpa memuat ulang.
 */
interface StageActionResult extends BatchTracking {
  stage: ProductionStage;
  message: string;
}

const aksiTahap = async (
  batchId: number,
  stage: StageName,
  aksi: 'start' | 'finish' | 'repeat',
  payload: Record<string, unknown> = {},
): Promise<StageActionResult> => {
  const { data } = await api.post<ApiResponse<BatchTracking & { stage: ProductionStage }>>(
    `/production/batches/${batchId}/stages/${stage}/${aksi}`,
    payload,
  );

  return { ...data.data!, message: data.message };
};

export const trackingService = {
  /** Ketujuh tahap beserta urutannya — UI tidak menuliskan urutannya sendiri. */
  async definitions(): Promise<StageDefinition[]> {
    const { data } = await api.get<ApiResponse<{ stages: StageDefinition[] }>>('/production/stages');
    return data.data!.stages;
  },

  async show(batchId: number): Promise<BatchTracking> {
    const { data } = await api.get<ApiResponse<BatchTracking>>(
      `/production/batches/${batchId}/stages`,
    );
    return data.data!;
  },

  start(batchId: number, stage: StageName): Promise<StageActionResult> {
    return aksiTahap(batchId, stage, 'start');
  },

  /**
   * Menyelesaikan tahap. Pada Packaging, `good_quantity` wajib diisi — di
   * situlah batch ditutup dan stok produk jadi bertambah.
   */
  finish(batchId: number, stage: StageName, payload: FinishStagePayload = {}): Promise<StageActionResult> {
    return aksiTahap(batchId, stage, 'finish', payload as Record<string, unknown>);
  },

  repeat(batchId: number, stage: StageName, reason: string): Promise<StageActionResult> {
    return aksiTahap(batchId, stage, 'repeat', { reason });
  },
};
