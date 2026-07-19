export interface Ingredient {
  id: string;
  name: string;
  category: string;
  currentStock: number; // dalam satuan dasar (misal gram, ml, pcs)
  minStock: number; // batas minimum aman (dalam satuan dasar)
  unit: string; // satuan dasar ('g', 'ml', 'pcs')
  displayUnit: string; // satuan tampilan default ('kg', 'L', 'pcs')
  lastUpdated: string;
  defaultSupplierId?: string;
}

export interface StockTransaction {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: 'IN' | 'OUT'; // IN = Stok Masuk, OUT = Stok Keluar
  quantity: number; // dalam satuan dasar
  unit: string;
  notes: string; // misal: "Produksi Roti Tawar", "Pembelian Supplier A", "Bahan Tumpah"
  timestamp: string;
  operator: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  suppliedIngredients: string[]; // array of ingredientIds
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number; // takaran dalam satuan dasar (misal gram/ml/pcs)
  unit: string;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  yieldQuantity: number; // hasil standar (misal 50 pcs)
  yieldUnit: string; // 'pcs'
  description: string;
  items: RecipeItem[];
}

export interface Product {
  id: string;
  name: string;
  currentStock: number; // stok roti jadi di etalase/kasir
  unit: string; // 'pcs'
  price: number;
}

export interface ProductionBatch {
  id: string;
  recipeId: string;
  productName: string;
  targetQuantity: number; // jumlah yang akan diproduksi
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  operator: string;
  timestamp: string;
}
