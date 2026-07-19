/**
 * Modul 7 — Penjualan (Point of Sale).
 *
 * Pengurangan stok memakai `stock_ledger` yang sama dengan modul pembelian,
 * produksi, dan persediaan.
 */

export type PaymentMethod = 'cash' | 'qris' | 'transfer';
export type SaleStatus = 'completed' | 'voided';
export type DiscountType = 'none' | 'percent' | 'amount';

/** Dari mana angka HPP berasal — menentukan bisa-tidaknya laba dipercaya. */
export type CostSource = 'actual' | 'recipe' | 'unknown';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  needs_change: boolean;
  tone: string;
}

/* -------------------------------------------------------------------------- */
/* Katalog POS                                                                 */
/* -------------------------------------------------------------------------- */

export interface CatalogProduct {
  id: number;
  code: string;
  name: string;
  unit: string;
  selling_price: number;
  current_stock: number;
  category_id: number | null;
  category_name: string | null;
  image_url: string | null;
  stock_status: string;
  stock_status_tone: string;
  /** Produk habis tetap tampil tetapi tidak bisa diklik. */
  sellable: boolean;
}

export interface PosSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  tax_enabled: boolean;
  tax_percent: number;
  max_discount_percent: number;
  receipt_footer: string;
}

export interface PosCatalog {
  products: CatalogProduct[];
  categories: { value: number; label: string }[];
  settings: PosSettings;
  payment_methods: PaymentMethodOption[];
}

/* -------------------------------------------------------------------------- */
/* Keranjang (hanya di sisi klien, tidak pernah disimpan)                      */
/* -------------------------------------------------------------------------- */

export interface CartLine {
  product: CatalogProduct;
  quantity: number;
}

export interface Calculation {
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  after_discount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Transaksi                                                                   */
/* -------------------------------------------------------------------------- */

export interface SaleItem {
  id: number;
  product_id: number | null;
  /** Salinan beku — struk lama tetap benar walau produk berubah. */
  product_name: string;
  product_code: string | null;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  unit_cost: number;
  line_cost: number;
  cost_source: CostSource;
  cost_source_label: string;
  cost_reliable: boolean;
  gross_profit: number;
  stock_before: number;
  stock_after: number;
}

export interface Sale {
  id: number;
  sale_number: string;

  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;

  payment_method: PaymentMethod;
  payment_label: string;
  payment_tone: string;
  paid_amount: number;
  change_amount: number;

  cost_total: number;
  gross_profit: number;
  gross_margin_percent: number | null;
  /** Hanya terkirim bila rincian barisnya dimuat. */
  cost_reliable?: boolean;

  status: SaleStatus;
  status_label: string;
  status_tone: string;
  can_void: boolean;

  customer_name: string | null;
  notes: string | null;

  cashier_id: number | null;
  cashier_name?: string | null;

  voided_at: string | null;
  voided_by_name?: string | null;
  void_reason: string | null;

  items_count?: number;
  total_quantity?: number;
  items?: SaleItem[];

  created_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Ringkasan                                                                   */
/* -------------------------------------------------------------------------- */

export interface DailySummary {
  tanggal: string;
  transaksi: number;
  omzet: number;
  hpp: number;
  laba_kotor: number;
  pajak: number;
  diskon: number;
  rata2_transaksi: number;
  unit_terjual: number;
  per_metode: {
    method: PaymentMethod;
    label: string;
    jumlah: number;
    nilai: number;
    is_cash: boolean;
  }[];
  /** Yang harus cocok dengan uang di laci saat tutup kasir. */
  tunai_di_laci: number;
  dibatalkan: { jumlah: number; nilai: number };
}

export interface MonthlySummary {
  periode: { tahun: number; bulan: number; label: string };
  transaksi: number;
  omzet: number;
  hpp: number;
  laba_kotor: number;
  pajak: number;
  diskon: number;
  rata2_transaksi: number;
  harian: { tanggal: string; label: string; transaksi: number; omzet: number; hpp: number }[];
  produk_terlaris: {
    product_id: number | null;
    name: string;
    unit: string;
    total_qty: number;
    total_nilai: number;
    total_laba: number;
  }[];
  per_kasir: { cashier_id: number | null; name: string; transaksi: number; omzet: number }[];
}

export interface SalesDashboard {
  hari_ini: DailySummary;
  kemarin: { omzet: number; transaksi: number };
  perbandingan: { omzet_persen: number | null; transaksi_selisih: number };
  bulan_ini: MonthlySummary;
  transaksi_terakhir: Sale[];
}

export interface SalesOptions {
  statuses: { value: SaleStatus; label: string; tone: string }[];
  payment_methods: PaymentMethodOption[];
  cashiers: { value: number; label: string }[];
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                     */
/* -------------------------------------------------------------------------- */

export interface StoreSalePayload {
  items: { product_id: number; quantity: number }[];
  discount_type?: DiscountType;
  discount_value?: number;
  payment_method: PaymentMethod;
  paid_amount?: number;
  customer_name?: string | null;
  notes?: string | null;
  idempotency_key?: string;
}

/* -------------------------------------------------------------------------- */
/* Pengaturan                                                                  */
/* -------------------------------------------------------------------------- */

export interface SettingField {
  key: string;
  value: string | number | boolean | null;
  type: 'string' | 'integer' | 'decimal' | 'boolean';
  label: string;
  description: string | null;
}

export interface SettingGroups {
  groups: Record<string, SettingField[]>;
  values: Record<string, string | number | boolean | null>;
}
