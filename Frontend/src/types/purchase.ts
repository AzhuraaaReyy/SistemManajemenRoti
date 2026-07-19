export type PurchaseStatus = 'draft' | 'ordered' | 'partial' | 'completed' | 'cancelled';

export interface PurchaseOrderItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_code: string | null;

  /** Satuan yang dibekukan saat pesanan dibuat. */
  order_unit: string;
  unit_factor: number;

  qty_ordered: number;
  qty_ordered_display: number;
  qty_received: number;
  qty_received_display: number;
  qty_outstanding: number;
  qty_outstanding_display: number;

  /** Per satuan dasar. */
  unit_price: number;
  /** Per satuan pesan — inilah yang ditampilkan dan diketik pengguna. */
  unit_price_display: number;

  discount_amount: number;
  line_total: number;
  is_fully_received: boolean;

  note: string | null;
  sort_order: number;
}

export interface PurchaseReceiptItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  quantity: number;
  quantity_display: number;
  unit: string;
  unit_price: number;
  unit_price_display: number;
  subtotal: number;
  expiry_date: string | null;
  batch_number: string | null;
  note: string | null;
}

export interface PurchaseReceipt {
  id: number;
  receipt_number: string;
  purchase_order_id: number;
  po_number?: string | null;
  receipt_date: string | null;
  delivery_note_number: string | null;
  notes: string | null;
  received_by_name?: string | null;
  total_value: number | null;
  items?: PurchaseReceiptItem[];
  created_at: string | null;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;

  supplier_id: number;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_contact?: string | null;

  order_date: string | null;
  expected_date: string | null;
  completed_date: string | null;

  status: PurchaseStatus;
  status_label: string;
  status_tone: string;

  /** Kemampuan aksi ditentukan server, bukan ditebak frontend. */
  can_edit: boolean;
  can_confirm: boolean;
  can_receive: boolean;
  can_cancel: boolean;
  can_close: boolean;

  is_overdue: boolean;
  days_late: number;

  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  total: number;

  notes: string | null;

  items_count?: number;
  receipts_count?: number;
  received_percent: number | null;

  items?: PurchaseOrderItem[];
  receipts?: PurchaseReceipt[];

  created_by_name?: string | null;
  ordered_by_name?: string | null;
  ordered_at: string | null;
  cancelled_by_name?: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;

  created_at: string | null;
  updated_at: string | null;
}

export interface PurchaseStatusOption {
  value: PurchaseStatus;
  label: string;
  description: string;
  tone: string;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface PurchaseDashboard {
  ringkasan: {
    belanja_bulan_ini: number;
    belanja_bulan_lalu: number;
    perubahan_persen: number | null;
    jumlah_po_bulan_ini: number;
    menunggu_barang: number;
    terlambat: number;
    nilai_belum_datang: number;
  };
  per_status: {
    status: PurchaseStatus;
    label: string;
    tone: string;
    jumlah: number;
    nilai: number;
  }[];
  tren_bulanan: { bulan: string; label: string; jumlah: number; nilai: number }[];
  menunggu_kedatangan: PurchaseOrder[];
  bahan_teratas: {
    ingredient_id: number;
    name: string;
    code: string | null;
    unit: string;
    total_qty: number;
    total_qty_display: number;
    total_nilai: number;
  }[];
  supplier_teratas: {
    supplier_id: number;
    name: string;
    code: string | null;
    lead_time_days: number | null;
    jumlah_po: number;
    total_belanja: number;
  }[];
  perlu_dibeli: {
    ingredient_id: number;
    code: string;
    name: string;
    unit: string;
    current_stock: number;
    min_stock: number;
    stock_status: string;
    suggested_qty: number;
    estimated_cost: number;
    supplier_id: number | null;
    supplier_name: string | null;
  }[];
}

export interface SupplierPerformance {
  supplier: { id: number; code: string; name: string; lead_time_days: number };
  performance: {
    orders_count: number;
    on_time_percent: number | null;
    completeness_percent: number | null;
    score: number | null;
    total_spend: number;
    avg_days_late: number | null;
    note: string | null;
  };
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                     */
/* -------------------------------------------------------------------------- */

export interface PurchaseOrderPayload {
  supplier_id: number;
  order_date: string;
  expected_date?: string | null;
  discount_amount?: number;
  shipping_cost?: number;
  tax_amount?: number;
  notes?: string | null;
  items: {
    ingredient_id: number;
    /** Dalam satuan pesan (kg/L/pcs). */
    quantity: number;
    /** Per satuan pesan. */
    unit_price: number;
    discount_amount?: number;
    note?: string | null;
  }[];
}

export interface ReceivePayload {
  receipt_date: string;
  delivery_note_number?: string | null;
  notes?: string | null;
  idempotency_key?: string;
  items: {
    purchase_order_item_id: number;
    quantity: number;
    unit_price?: number | null;
    expiry_date?: string | null;
    batch_number?: string | null;
    note?: string | null;
  }[];
}
