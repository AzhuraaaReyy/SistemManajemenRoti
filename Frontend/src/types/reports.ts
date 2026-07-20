/**
 * Modul 9 — Laporan.
 *
 * Bentuk datanya sengaja seragam untuk ketujuh laporan: satu definisi kolom
 * melayani tabel di layar, berkas Excel, dan berkas PDF sekaligus.
 */

export type ReportTypeKey =
  | 'penjualan'
  | 'produksi'
  | 'pembelian'
  | 'persediaan'
  | 'mutasi_stok'
  | 'supplier'
  | 'produk';

export type ColumnFormat = 'text' | 'number' | 'money' | 'percent' | 'date' | 'datetime';

export interface ReportColumn {
  key: string;
  label: string;
  format: ColumnFormat;
  align?: 'left' | 'right' | 'center';
  /** Ikut dijumlahkan pada baris total. */
  total?: boolean;
}

/** Nama filter yang relevan bagi sebuah laporan. */
export type FilterKey =
  | 'date_range'
  | 'as_of'
  | 'month'
  | 'year'
  | 'supplier_id'
  | 'product_id'
  | 'category_id'
  | 'cashier_id'
  | 'payment_method'
  | 'source_type'
  | 'direction'
  | 'kind'
  | 'status_penjualan'
  | 'status_produksi'
  | 'status_pembelian';

export interface ReportTypeDefinition {
  value: ReportTypeKey;
  label: string;
  description: string;
  filters: FilterKey[];
  columns: ReportColumn[];
}

export interface Pilihan {
  value: string | number;
  label: string;
}

export interface ReportOptions {
  suppliers: Pilihan[];
  products: Pilihan[];
  categories: Pilihan[];
  cashiers: Pilihan[];
  payment_methods: { value: string; label: string }[];
  source_types: { value: string; label: string }[];
  status_penjualan: { value: string; label: string }[];
  status_produksi: { value: string; label: string }[];
  status_pembelian: { value: string; label: string }[];
  kinds: Pilihan[];
}

export interface ReportTypesResponse {
  types: ReportTypeDefinition[];
  options: ReportOptions;
}

export interface ReportMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}

export interface ReportResult {
  type: ReportTypeKey;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  /** Angka ringkasan untuk kepala laporan. Kuncinya sudah berupa label siap tampil. */
  summary: Record<string, string | number>;
  /**
   * Hanya berisi kolom bertanda `total`. Objek kosong bila laporan tidak punya.
   *
   * Dihitung dari SELURUH baris laporan, bukan dari halaman yang sedang tampil.
   */
  total: Record<string, number>;

  /** Jumlah seluruh baris laporan, bukan jumlah baris di halaman ini. */
  row_count: number;

  /** Null saat seluruh baris diminta (dipakai ekspor), terisi saat berhalaman. */
  meta: ReportMeta | null;
  periode: string;
  filters: Record<string, unknown>;
  /** Peringatan penting tentang cara membaca laporan ini. */
  catatan: string | null;
  dibuat_pada: string;
}

/** Isian filter di layar. Dikirim apa adanya ke server. */
export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  month?: number | '';
  year?: number | '';
  as_of?: string;
  supplier_id?: number | '';
  product_id?: number | '';
  category_id?: number | '';
  cashier_id?: number | '';
  payment_method?: string;
  source_type?: string;
  direction?: string;
  kind?: string;
  status?: string;
}
