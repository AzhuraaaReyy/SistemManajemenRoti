import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type { BaseFilters, PaginatedResult } from '../types/master';
import type {
  PurchaseDashboard,
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseReceipt,
  PurchaseStatusOption,
  ReceivePayload,
  SupplierPerformance,
} from '../types/purchase';

const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

export const purchaseService = {
  async list(filters: BaseFilters = {}): Promise<PaginatedResult<PurchaseOrder>> {
    const { data } = await api.get<ApiResponse<PurchaseOrder[]> & PaginatedResult<PurchaseOrder>>(
      '/purchases/orders',
      { params: bersihkan(filters) },
    );
    return { data: data.data, meta: data.meta };
  },

  async show(id: number): Promise<PurchaseOrder> {
    const { data } = await api.get<ApiResponse<{ order: PurchaseOrder }>>(`/purchases/orders/${id}`);
    return data.data!.order;
  },

  async create(payload: PurchaseOrderPayload): Promise<{ order: PurchaseOrder; message: string }> {
    const { data } = await api.post<ApiResponse<{ order: PurchaseOrder }>>('/purchases/orders', payload);
    return { order: data.data!.order, message: data.message };
  },

  async update(id: number, payload: PurchaseOrderPayload): Promise<{ order: PurchaseOrder; message: string }> {
    const { data } = await api.put<ApiResponse<{ order: PurchaseOrder }>>(`/purchases/orders/${id}`, payload);
    return { order: data.data!.order, message: data.message };
  },

  async confirm(id: number): Promise<{ order: PurchaseOrder; message: string }> {
    const { data } = await api.post<ApiResponse<{ order: PurchaseOrder }>>(`/purchases/orders/${id}/confirm`);
    return { order: data.data!.order, message: data.message };
  },

  /** Barang datang — stok bertambah di sisi server. */
  async receive(
    id: number,
    payload: ReceivePayload,
  ): Promise<{ receipt: PurchaseReceipt; order: PurchaseOrder; message: string }> {
    const { data } = await api.post<ApiResponse<{ receipt: PurchaseReceipt; order: PurchaseOrder }>>(
      `/purchases/orders/${id}/receive`,
      payload,
    );
    return { receipt: data.data!.receipt, order: data.data!.order, message: data.message };
  },

  async cancel(id: number, reason: string): Promise<{ order: PurchaseOrder; message: string }> {
    const { data } = await api.post<ApiResponse<{ order: PurchaseOrder }>>(
      `/purchases/orders/${id}/cancel`,
      { reason },
    );
    return { order: data.data!.order, message: data.message };
  },

  async close(id: number, reason?: string): Promise<{ order: PurchaseOrder; message: string }> {
    const { data } = await api.post<ApiResponse<{ order: PurchaseOrder }>>(
      `/purchases/orders/${id}/close`,
      { reason },
    );
    return { order: data.data!.order, message: data.message };
  },

  async remove(id: number): Promise<string> {
    const { data } = await api.delete<ApiResponse>(`/purchases/orders/${id}`);
    return data.message;
  },

  async statuses(): Promise<PurchaseStatusOption[]> {
    const { data } = await api.get<ApiResponse<PurchaseStatusOption[]>>('/purchases/statuses');
    return data.data!;
  },

  async receipts(filters: BaseFilters = {}): Promise<PaginatedResult<PurchaseReceipt>> {
    const { data } = await api.get<ApiResponse<PurchaseReceipt[]> & PaginatedResult<PurchaseReceipt>>(
      '/purchases/receipts',
      { params: bersihkan(filters) },
    );
    return { data: data.data, meta: data.meta };
  },

  async dashboard(months = 6): Promise<PurchaseDashboard> {
    const { data } = await api.get<ApiResponse<PurchaseDashboard>>('/purchases/dashboard', {
      params: { months },
    });
    return data.data!;
  },

  async supplierPerformance(supplierId: number, months = 6): Promise<SupplierPerformance> {
    const { data } = await api.get<ApiResponse<SupplierPerformance>>(
      `/purchases/suppliers/${supplierId}/performance`,
      { params: { months } },
    );
    return data.data!;
  },
};
