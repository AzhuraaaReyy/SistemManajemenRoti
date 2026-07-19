import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type {
  BaseFilters,
  Category,
  Ingredient,
  IngredientOption,
  IngredientStatistics,
  PaginatedResult,
  Product,
  ProductOption,
  Recipe,
  SelectOption,
  SimulationResult,
  Supplier,
  UnitOption,
} from '../types/master';

/** Membuang nilai kosong agar tidak dikirim sebagai ?status= yang gagal validasi. */
const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

/**
 * Membuat sekumpulan operasi CRUD untuk satu entitas master data.
 *
 * Kelima entitas memakai bentuk endpoint yang sama persis, jadi menulis lima
 * service terpisah hanya akan menggandakan kode yang identik.
 *
 * Payload dibiarkan generik (`P extends object`) supaya halaman bisa mengirim
 * antarmuka form miliknya sendiri maupun objek lepas hasil konversi satuan,
 * tanpa perlu menambahkan index signature ke setiap tipe form.
 *
 * @param path   segmen URL, misal 'ingredients'
 * @param key    nama properti pada respons detail, misal 'ingredient'
 */
const buatCrud = <T>(path: string, key: string) => ({
  async list(filters: BaseFilters = {}): Promise<PaginatedResult<T>> {
    const { data } = await api.get<ApiResponse<T[]> & PaginatedResult<T>>(`/master/${path}`, {
      params: bersihkan(filters),
    });
    return { data: data.data, meta: data.meta };
  },

  async show(id: number): Promise<T> {
    const { data } = await api.get<ApiResponse<Record<string, T>>>(`/master/${path}/${id}`);
    return data.data![key];
  },

  async create<P extends object>(payload: P): Promise<{ item: T; message: string }> {
    const { data } = await api.post<ApiResponse<Record<string, T>>>(`/master/${path}`, payload);
    return { item: data.data![key], message: data.message };
  },

  async update<P extends object>(id: number, payload: P): Promise<{ item: T; message: string }> {
    const { data } = await api.put<ApiResponse<Record<string, T>>>(`/master/${path}/${id}`, payload);
    return { item: data.data![key], message: data.message };
  },

  async remove(id: number): Promise<string> {
    const { data } = await api.delete<ApiResponse>(`/master/${path}/${id}`);
    return data.message;
  },

  async options(params: Record<string, unknown> = {}): Promise<SelectOption[]> {
    const { data } = await api.get<ApiResponse<SelectOption[]>>(`/master/${path}/options`, {
      params: bersihkan(params),
    });
    return data.data!;
  },
});

/* -------------------------------------------------------------------------- */

export const categoryService = buatCrud<Category>('categories', 'category');
export const supplierService = buatCrud<Supplier>('suppliers', 'supplier');
export const productService = buatCrud<Product>('products', 'product');

export const ingredientService = {
  ...buatCrud<Ingredient>('ingredients', 'ingredient'),

  async ingredientOptions(): Promise<IngredientOption[]> {
    const { data } = await api.get<ApiResponse<IngredientOption[]>>('/master/ingredients/options');
    return data.data!;
  },

  async units(): Promise<UnitOption[]> {
    const { data } = await api.get<ApiResponse<UnitOption[]>>('/master/ingredients/units');
    return data.data!;
  },

  async statistics(): Promise<IngredientStatistics> {
    const { data } = await api.get<ApiResponse<IngredientStatistics>>('/master/ingredients/statistics');
    return data.data!;
  },
};

export const productOptionsService = {
  async options(withoutRecipe = false): Promise<ProductOption[]> {
    const { data } = await api.get<ApiResponse<ProductOption[]>>('/master/products/options', {
      params: withoutRecipe ? { without_recipe: 1 } : {},
    });
    return data.data!;
  },
};

export const recipeService = {
  ...buatCrud<Recipe>('recipes', 'recipe'),

  async newVersion(id: number): Promise<{ item: Recipe; message: string }> {
    const { data } = await api.post<ApiResponse<{ recipe: Recipe }>>(
      `/master/recipes/${id}/new-version`,
    );
    return { item: data.data!.recipe, message: data.message };
  },

  async activate(id: number): Promise<{ item: Recipe; message: string }> {
    const { data } = await api.patch<ApiResponse<{ recipe: Recipe }>>(
      `/master/recipes/${id}/activate`,
    );
    return { item: data.data!.recipe, message: data.message };
  },

  async simulate(id: number, quantity: number): Promise<{ result: SimulationResult; message: string }> {
    const { data } = await api.post<ApiResponse<SimulationResult>>(
      `/master/recipes/${id}/simulate`,
      { quantity },
    );
    return { result: data.data!, message: data.message };
  },
};
