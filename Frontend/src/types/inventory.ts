/**
 * Modul 6 — Inventory Management.
 *
 * Seluruh angka di sini berasal dari `stock_ledger` yang diisi modul Pembelian
 * dan Produksi. Modul persediaan tidak punya sumber data sendiri.
 */

/** Lima status rinci. Ketiganya yang pokok ada di StockStatusHeadline. */
export type StockStatus = 'habis' | 'kritis' | 'menipis' | 'aman' | 'berlebih';

/** Tiga status pokok sesuai spesifikasi — dipakai kartu ringkasan. */
export type StockStatusHeadline = 'habis' | 'menipis' | 'aman';

export type ItemKind = 'ingredient' | 'product';

export type MovementDirection = 'in' | 'out';

export interface StockStatusOption {
  value: StockStatus;
  label: string;
  description: string;
  tone: string;
  headline: StockStatusHeadline;
  is_alert: boolean;
}

export interface MovementSourceOption {
  value: string;
  label: string;
  direction: string;
}

/* -------------------------------------------------------------------------- */
/* Ringkasan stok per barang                                                   */
/* -------------------------------------------------------------------------- */

export interface StockItem {
  kind: ItemKind;
  kind_label: string;
  id: number;
  code: string;
  name: string;
  category_name: string | null;

  /** Satuan tampilan. Angka di bawah ini sudah dikonversi ke satuan ini. */
  unit: string;
  conversion_factor: number;
  current_stock: number;
  min_stock: number;

  avg_cost: number;
  stock_value: number;

  status: StockStatus;
  status_label: string;
  status_tone: string;
  /** Status pokok untuk pencocokan dengan kartu ringkasan. */
  status_headline: StockStatusHeadline;

  daily_usage: number;
  /** Perkiraan sisa hari sebelum habis. Null bila belum pernah terpakai. */
  days_remaining: number | null;
}

/* -------------------------------------------------------------------------- */
/* Riwayat mutasi                                                              */
/* -------------------------------------------------------------------------- */

export interface StockMovement {
  id: number;

  kind: ItemKind;
  kind_label: string;
  item_id: number;
  item_name: string;
  item_code: string | null;

  direction: MovementDirection;
  direction_label: string;

  quantity: number;
  delta: number;
  balance_before: number;
  balance_after: number;

  source_type: string;
  source_label: string;
  source_id: string | null;

  unit_cost: number | null;
  total_cost: number | null;

  note: string | null;

  user_id: number | null;
  user_name: string;

  created_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Peringatan perubahan status                                                 */
/* -------------------------------------------------------------------------- */

export interface StockAlert {
  id: number;

  kind: ItemKind;
  item_id: number;
  item_name: string;
  item_code: string | null;

  from_status: StockStatus | null;
  from_status_label: string | null;
  to_status: StockStatus;
  to_status_label: string;
  to_status_tone: string;
  severity: number;

  /** Angka saat peringatan dibuat — bukan angka sekarang. */
  stock_at_alert: number;
  min_stock_at_alert: number;

  message: string;

  is_read: boolean;
  read_at: string | null;
  read_by_name?: string | null;

  created_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface InventorySummary {
  habis: number;
  menipis: number;
  aman: number;
  total_item: number;

  /** Perincian lima status di balik ketiga kartu. */
  rinci: Record<StockStatus, number>;

  perlu_perhatian: number;

  nilai_persediaan: number;
  nilai_bahan_baku: number;
  nilai_produk_jadi: number;

  jumlah_bahan_baku: number;
  jumlah_produk_jadi: number;

  mutasi_hari_ini: number;
}

export interface MovementTrendPoint {
  tanggal: string;
  label: string;
  masuk: number;
  keluar: number;
  jumlah_mutasi: number;
}

export interface AttentionItem {
  kind: ItemKind;
  id: number;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  status: StockStatus;
  status_label: string;
  status_tone: string;
  days_remaining: number | null;
}

export interface InventoryDashboard {
  ringkasan: InventorySummary;
  perlu_perhatian: AttentionItem[];
  tren_mutasi: MovementTrendPoint[];
  per_sumber: {
    source_type: string;
    source_label: string;
    direction: MovementDirection;
    jumlah: number;
    total_qty: number;
  }[];
  peringatan_belum_dibaca: number;
  periode: { dari: string; sampai: string; hari: number };
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                     */
/* -------------------------------------------------------------------------- */

export interface StockAdjustmentPayload {
  kind: ItemKind;
  item_id: number;
  /** Hasil hitungan fisik, dalam satuan tampilan. */
  physical_count: number;
  note: string;
  idempotency_key?: string;
}

export interface StockAdjustmentResult {
  changed: boolean;
  stock_before?: number;
  stock_after?: number;
  difference?: number;
  status_before?: StockStatus;
  status_after?: StockStatus;
  status_after_label?: string;
  movement?: StockMovement;
  /** Terisi saat tidak ada selisih. */
  stock?: number;
}

export interface InventoryOptions {
  statuses: StockStatusOption[];
  headline_statuses: { value: StockStatusHeadline; label: string; tone: string }[];
  sources: MovementSourceOption[];
  kinds: { value: ItemKind; label: string }[];
  items: { value: string; kind: ItemKind; id: number; label: string }[];
}
