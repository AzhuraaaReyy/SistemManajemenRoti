import type { PaginationMeta } from './auth';

export type CategoryType = 'produk' | 'bahan_baku';
export type BaseUnit = 'g' | 'ml' | 'pcs';
export type StockStatus = 'habis' | 'kritis' | 'menipis' | 'aman' | 'berlebih';

/**
 * Satuan siap pakai — satu-satunya nilai satuan yang disentuh form.
 * base_unit / display_unit / conversion_factor adalah turunannya.
 */
export type UnitKey = 'kg' | 'gram' | 'liter' | 'ml' | 'butir' | 'sak_25kg';

/** Satuan yang boleh dipakai menulis takaran pada baris resep. */
export interface RecipeUnit {
  unit: string;
  label: string;
  factor: number;
}

/* -------------------------------------------------------------------------- */
/* Kategori                                                                    */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: number;
  type: CategoryType;
  type_label: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  usage_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Supplier                                                                    */
/* -------------------------------------------------------------------------- */

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lead_time_days: number;
  notes: string | null;
  is_active: boolean;
  ingredients_count?: number;
  ingredients?: IngredientBrief[];
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierBrief {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  lead_time_days: number;
  supplier_sku?: string | null;
  last_price?: number | null;
}

/* -------------------------------------------------------------------------- */
/* Bahan Baku                                                                  */
/* -------------------------------------------------------------------------- */

export interface IngredientBrief {
  id: number;
  code: string;
  name: string;
  base_unit: BaseUnit;
  display_unit: string;
  conversion_factor: number;
  current_stock: number;
  avg_cost: number;
  is_active: boolean;
}

export interface Ingredient {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category_name?: string | null;
  default_supplier_id: number | null;
  default_supplier_name?: string | null;

  /** Pilihan satuan pengguna — ini yang dipakai form. */
  unit: UnitKey;
  unit_label: string;
  unit_symbol: string;
  recipe_units: RecipeUnit[];

  /** Turunan teknis; dipakai untuk perhitungan, bukan untuk diisi pengguna. */
  base_unit: BaseUnit;
  display_unit: string;
  conversion_factor: number;

  current_stock: number;
  current_stock_display: number;
  min_stock: number;
  min_stock_display: number;

  stock_status: StockStatus;
  stock_status_label: string;

  /** Per satuan dasar (per gram). */
  avg_cost: number;
  /** Per satuan pilihan pengguna (per kg) — inilah yang ditampilkan. */
  avg_cost_display: number;
  stock_value: number;

  shelf_life_days: number | null;
  notes: string | null;
  is_active: boolean;
  used_in_recipes?: number;
  suppliers?: SupplierBrief[];

  created_at: string | null;
  updated_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Produk                                                                      */
/* -------------------------------------------------------------------------- */

export interface Product {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category_name?: string | null;
  unit: string;
  selling_price: number;

  current_stock: number;
  min_stock: number;
  stock_status: Exclude<StockStatus, 'berlebih'>;
  stock_status_label: string;

  description: string | null;
  image_url: string | null;
  is_active: boolean;

  has_recipe: boolean;
  recipe_id: number | null;
  recipe_version: number | null;
  unit_cost: number | null;
  margin: number | null;
  margin_percent: number | null;
  recipes_count?: number;

  created_at: string | null;
  updated_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Resep (BOM)                                                                 */
/* -------------------------------------------------------------------------- */

export interface RecipeItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_code: string | null;

  base_unit: BaseUnit | null;
  display_unit: string | null;
  conversion_factor: number;

  quantity: number;
  quantity_display: number;
  waste_percent: number;
  effective_quantity: number;

  unit_cost: number;
  line_cost: number;

  available_stock: number;
  sufficient: boolean;

  note: string | null;
  sort_order: number;
}

export interface Recipe {
  id: number;
  product_id: number;
  product_name?: string | null;
  product_code?: string | null;

  version: number;
  name: string;

  yield_quantity: number;
  yield_unit: string;

  description: string | null;
  instructions: string | null;
  is_active: boolean;

  /** Versi yang sudah dipakai produksi atau sudah diarsipkan tidak bisa diubah. */
  is_locked: boolean;
  lock_label: string | null;
  locked_at: string | null;
  production_count: number;

  items_count?: number;
  items?: RecipeItem[];

  total_cost: number | null;
  cost_per_unit: number | null;
  selling_price: number | null;
  margin_per_unit: number | null;
  margin_percent: number | null;

  max_producible: number | null;
  limiting_ingredient: string | null;

  created_at: string | null;
  updated_at: string | null;
}

export interface SimulationResult {
  quantity: number;
  yield_quantity: number;
  factor: number;
  can_produce: boolean;
  requirements: {
    ingredient_id: number;
    ingredient_name: string;
    base_unit: BaseUnit;
    required_base: number;
    available_base: number;
    sufficient: boolean;
  }[];
  shortages: SimulationResult['requirements'];
  estimated_cost: number;
}

/* -------------------------------------------------------------------------- */
/* Pilihan untuk form                                                          */
/* -------------------------------------------------------------------------- */

export interface SelectOption {
  value: number;
  label: string;
  [key: string]: unknown;
}

export interface IngredientOption extends SelectOption {
  code: string;
  base_unit: BaseUnit;
  display_unit: string;
  conversion_factor: number;
  current_stock: number;
  avg_cost: number;
  /** Satuan yang boleh dipakai menulis takaran bahan ini di resep. */
  recipe_units: RecipeUnit[];
}

export interface ProductOption extends SelectOption {
  code: string;
  unit: string;
  selling_price: number;
}

export interface UnitOption {
  value: UnitKey;
  label: string;
  symbol: string;
  base_unit: BaseUnit;
  factor: number;
  recipe_units: RecipeUnit[];
}

export interface IngredientStatistics {
  total: number;
  aktif: number;
  nilai_persediaan: number;
  per_status: Record<StockStatus, number>;
  perlu_perhatian: number;
}

/* -------------------------------------------------------------------------- */
/* Filter daftar                                                               */
/* -------------------------------------------------------------------------- */

export interface BaseFilters {
  search?: string;
  status?: 'aktif' | 'nonaktif' | '';
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
