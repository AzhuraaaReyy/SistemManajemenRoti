export type ProductionStatus = 'in_progress' | 'completed' | 'cancelled';

/* -------------------------------------------------------------------------- */
/* Modul 5 — Tracking Produksi                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Ketujuh tahap kerja, berurutan.
 *
 * "Produk Jadi" pada spesifikasi tidak ikut di sini karena ia bukan tahap yang
 * dikerjakan, melainkan keadaan setelah Packaging selesai. Di timeline ia
 * tampil sebagai penanda akhir yang menyala saat batch selesai.
 */
export type StageName =
  | 'persiapan'
  | 'mixing'
  | 'fermentasi'
  | 'pembentukan'
  | 'pemanggangan'
  | 'pendinginan'
  | 'packaging';

export type StageStatus = 'pending' | 'in_progress' | 'completed';

export interface StageDefinition {
  value: StageName;
  label: string;
  description: string;
  sequence: number;
  typical_minutes: number;
  is_last: boolean;
}

/** Satu baris percobaan sebuah tahap. */
export interface ProductionStage {
  id: number;
  batch_id: number;

  stage: StageName;
  stage_label: string;
  stage_description: string;
  sequence: number;
  is_last: boolean;

  /** Naik setiap kali tahap diulang. Percobaan lama tetap tersimpan. */
  attempt: number;

  status: StageStatus;
  status_label: string;
  status_tone: string;

  started_at: string | null;
  finished_at: string | null;

  /** Tahap yang masih berjalan dihitung sampai sekarang. */
  duration_minutes: number | null;
  typical_minutes: number;
  is_overdue: boolean;

  operator_id: number | null;
  operator_name?: string | null;

  notes: string | null;
  created_at: string | null;
}

export interface StageSummary {
  total_stages: number;
  completed_stages: number;
  progress_percent: number;
  current_stage: StageName | null;
  current_stage_label: string | null;
  current_stage_status: StageStatus | null;
  is_running: boolean;
  running_since: string | null;
  running_minutes: number | null;
  is_overdue: boolean;
}

/** Isi lengkap halaman tracking satu batch. */
export interface BatchTracking {
  batch: ProductionBatch;
  /** Satu baris per tahap — percobaan terakhirnya saja. */
  stages: ProductionStage[];
  /** Seluruh percobaan, termasuk tahap yang diulang. */
  history: ProductionStage[];
  summary: StageSummary;
}

export interface FinishStagePayload {
  notes?: string | null;
  /** Wajib pada tahap Packaging — di situlah batch ditutup. */
  good_quantity?: number;
  reject_quantity?: number;
  idempotency_key?: string;
}

/** Satu baris kebutuhan bahan pada hasil pratinjau. */
export interface MaterialRequirement {
  ingredient_id: number;
  code: string;
  name: string;
  base_unit: string;
  unit: string;
  conversion_factor: number;

  qty_per_unit: number;
  waste_percent: number;

  /** Satuan dasar untuk perhitungan. */
  required: number;
  available: number;
  shortage: number;

  /** Satuan tampilan untuk dibaca manusia. */
  required_display: number;
  available_display: number;
  shortage_display: number;

  unit_cost: number;
  line_cost: number;

  sufficient: boolean;
  stock_status: string;
}

export interface ProductionPreview {
  product: {
    id: number;
    code: string;
    name: string;
    unit: string;
    selling_price: number;
    current_stock: number;
  };
  recipe: {
    id: number;
    name: string;
    version: number;
    yield_quantity: number;
    yield_unit: string;
  };
  quantity: number;
  factor: number;
  can_produce: boolean;
  materials: MaterialRequirement[];
  shortages: MaterialRequirement[];
  material_cost: number;
  cost_per_unit: number;
  max_producible: { quantity: number; limiting_ingredient: string | null };
}

export interface BatchMaterial {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_code: string | null;
  base_unit: string | null;
  unit: string | null;

  qty_per_unit: number;
  qty_required: number;
  qty_required_display: number;
  qty_used: number;
  qty_used_display: number;

  waste_percent: number;
  unit_cost: number;
  line_cost: number;

  stock_before: number;
  stock_before_display: number;
  stock_after: number;
  stock_after_display: number;

  note: string | null;
}

export interface ProductionBatch {
  id: number;
  batch_number: string;

  product_id: number;
  product_name?: string | null;
  product_code?: string | null;
  product_unit?: string;

  recipe_id: number;
  recipe_name?: string | null;
  recipe_version: number;

  target_quantity: number;
  good_quantity: number | null;
  reject_quantity: number;
  yield_rate: number | null;

  status: ProductionStatus;
  status_label: string;
  status_tone: string;

  /*
  | `can_complete` sudah tidak ada sejak Modul 5. Batch hanya bisa ditutup
  | dengan menyelesaikan tahap Packaging, bukan lewat tombol pintas.
  */
  can_cancel: boolean;

  /*
  | Progress tahapan — hanya terkirim bila relasi `stages` dimuat di server.
  | Dibiarkan undefined (bukan 0) saat belum dimuat, supaya UI bisa
  | membedakan "belum diambil datanya" dari "benar-benar 0%".
  */
  progress_percent?: number;
  completed_stages?: number;
  total_stages: number;
  current_stage?: StageName | null;
  current_stage_label?: string | null;
  current_stage_status?: StageStatus | null;

  material_cost: number;
  cost_per_unit: number | null;
  reject_cost: number;

  started_at: string | null;
  finished_at: string | null;
  duration_minutes: number | null;

  operator_name?: string | null;
  completed_by_name?: string | null;
  cancelled_by_name?: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;

  notes: string | null;
  materials_count?: number;
  materials?: BatchMaterial[];

  created_at: string | null;
  updated_at: string | null;
}

export interface ProductionStatusOption {
  value: ProductionStatus;
  label: string;
  description: string;
  tone: string;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProductionDashboard {
  ringkasan: {
    batch_aktif: number;
    batch_bulan_ini: number;
    unit_diproduksi: number;
    unit_gagal: number;
    biaya_bahan_bulan_ini: number;
    yield_rate_rata2: number | null;
  };
  batch_aktif: ProductionBatch[];
  tren_bulanan: { bulan: string; label: string; jumlah_batch: number; unit: number; biaya: number }[];
  produk_teratas: {
    product_id: number;
    name: string;
    code: string | null;
    unit: string;
    jumlah_batch: number;
    total_unit: number;
    total_biaya: number;
    hpp_rata2: number | null;
  }[];
  bahan_terpakai: {
    ingredient_id: number;
    name: string;
    code: string | null;
    unit: string;
    total_qty: number;
    total_qty_display: number;
    total_biaya: number;
  }[];
  kapasitas_produksi: {
    product_id: number;
    name: string;
    code: string;
    unit: string;
    current_stock: number;
    max_producible: number;
    limiting_ingredient: string | null;
    cost_per_unit: number;
    selling_price: number;
  }[];
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                     */
/* -------------------------------------------------------------------------- */

export interface StartProductionPayload {
  product_id: number;
  quantity: number;
  notes?: string | null;
  idempotency_key?: string;
}

/*
| `CompleteProductionPayload` dihapus bersama endpoint /complete pada Modul 5.
| Penggantinya adalah FinishStagePayload pada tahap Packaging.
*/
