import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type { BaseFilters, PaginatedResult } from '../types/master';
import type {
  Calculation,
  DailySummary,
  DiscountType,
  MonthlySummary,
  PosCatalog,
  PosSettings,
  Sale,
  SalesDashboard,
  SalesOptions,
  SettingGroups,
  StoreSalePayload,
} from '../types/sales';

const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

export const salesService = {
  /** Produk siap jual untuk grid POS, beserta pengaturan pajak dan metode bayar. */
  async catalog(filters: Record<string, unknown> = {}): Promise<PosCatalog> {
    const { data } = await api.get<ApiResponse<PosCatalog>>('/sales/catalog', {
      params: bersihkan(filters),
    });
    return data.data!;
  },

  /**
   * Pratinjau perhitungan tanpa menyimpan apa pun.
   *
   * Memakai kode yang sama dengan penyimpanan di server, sehingga angka di
   * keranjang tidak mungkin berbeda dari angka di struk.
   */
  async calculate(
    subtotal: number,
    discountType: DiscountType = 'none',
    discountValue = 0,
  ): Promise<Calculation> {
    const { data } = await api.post<ApiResponse<Calculation>>('/sales/calculate', {
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
    });
    return data.data!;
  },

  async store(payload: StoreSalePayload): Promise<{ sale: Sale; message: string }> {
    const { data } = await api.post<ApiResponse<{ sale: Sale }>>('/sales', payload);
    return { sale: data.data!.sale, message: data.message };
  },

  async list(filters: BaseFilters = {}): Promise<PaginatedResult<Sale>> {
    const { data } = await api.get<ApiResponse<Sale[]> & PaginatedResult<Sale>>('/sales', {
      params: bersihkan(filters),
    });
    return { data: data.data, meta: data.meta };
  },

  async show(id: number): Promise<{ sale: Sale; settings: PosSettings }> {
    const { data } = await api.get<ApiResponse<{ sale: Sale; settings: PosSettings }>>(
      `/sales/${id}`,
    );
    return data.data!;
  },

  async void(id: number, reason: string): Promise<{ sale: Sale; message: string }> {
    const { data } = await api.post<ApiResponse<{ sale: Sale }>>(`/sales/${id}/void`, { reason });
    return { sale: data.data!.sale, message: data.message };
  },

  async options(): Promise<SalesOptions> {
    const { data } = await api.get<ApiResponse<SalesOptions>>('/sales/options');
    return data.data!;
  },

  async dashboard(date?: string): Promise<SalesDashboard> {
    const { data } = await api.get<ApiResponse<SalesDashboard>>('/sales/dashboard', {
      params: bersihkan({ date }),
    });
    return data.data!;
  },

  async daily(date?: string, cashierId?: number): Promise<DailySummary> {
    const { data } = await api.get<ApiResponse<DailySummary>>('/sales/summary/daily', {
      params: bersihkan({ date, cashier_id: cashierId }),
    });
    return data.data!;
  },

  async monthly(year?: number, month?: number, cashierId?: number): Promise<MonthlySummary> {
    const { data } = await api.get<ApiResponse<MonthlySummary>>('/sales/summary/monthly', {
      params: bersihkan({ year, month, cashier_id: cashierId }),
    });
    return data.data!;
  },
};

/* -------------------------------------------------------------------------- */
/* Pengaturan aplikasi                                                         */
/* -------------------------------------------------------------------------- */

export const settingsService = {
  /** Seluruh pengaturan, dikelompokkan untuk halaman Pengaturan. Khusus Owner. */
  async all(): Promise<SettingGroups> {
    const { data } = await api.get<ApiResponse<SettingGroups>>('/settings');
    return data.data!;
  },

  /** Yang dibutuhkan kasir untuk menyusun struk. Boleh dibaca semua peran. */
  async pos(): Promise<PosSettings> {
    const { data } = await api.get<ApiResponse<PosSettings>>('/settings/pos');
    return data.data!;
  },

  async update(
    values: Record<string, string | number | boolean>,
  ): Promise<{ data: SettingGroups; message: string }> {
    const { data } = await api.put<ApiResponse<SettingGroups>>('/settings', values);
    return { data: data.data!, message: data.message };
  },
};
