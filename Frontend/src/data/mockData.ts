import type {
  Ingredient,
  ProductionBatch,
  Product,
  Recipe,
  StockTransaction,
  Supplier,
} from '../types';

/**
 * Data contoh dari prototipe awal.
 *
 * Dipindahkan ke sini saat Modul 1 (Authentication) dikerjakan, supaya App.tsx
 * hanya berisi routing. Data ini akan diganti panggilan API sungguhan pada:
 *
 *   Modul 2 — Persediaan   : ingredients, transactions
 *   Modul 3 — Pembelian    : suppliers
 *   Modul 4 — Resep (BOM)  : recipes
 *   Modul 5 — Produksi     : products, productionBatches
 */

export const mockIngredients: Ingredient[] = [
  {
    id: 'ing_terigu',
    name: 'Tepung Terigu Protein Tinggi',
    category: 'Tepung',
    currentStock: 2000,
    minStock: 20000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T10:15:00Z',
    defaultSupplierId: 'sup_indofood',
  },
  {
    id: 'ing_mentega',
    name: 'Mentega Anchor Premium',
    category: 'Lemak',
    currentStock: 500,
    minStock: 5000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T10:15:00Z',
    defaultSupplierId: 'sup_anchor',
  },
  {
    id: 'ing_ragi',
    name: 'Ragi Instan Mauripan',
    category: 'Pengembang',
    currentStock: 1200,
    minStock: 2000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T08:30:00Z',
    defaultSupplierId: 'sup_indofood',
  },
  {
    id: 'ing_gula',
    name: 'Gula Pasir Rose Brand',
    category: 'Pemanis',
    currentStock: 45000,
    minStock: 10000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T10:15:00Z',
    defaultSupplierId: 'sup_grosir_lokal',
  },
  {
    id: 'ing_susu',
    name: 'Susu Cair UHT Frisian Flag',
    category: 'Cairan',
    currentStock: 12000,
    minStock: 5000,
    unit: 'ml',
    displayUnit: 'L',
    lastUpdated: '2026-07-19T11:00:00Z',
    defaultSupplierId: 'sup_grosir_lokal',
  },
  {
    id: 'ing_meses',
    name: 'Cokelat Meses Ceres',
    category: 'Topping',
    currentStock: 8500,
    minStock: 3000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T10:15:00Z',
    defaultSupplierId: 'sup_grosir_lokal',
  },
  {
    id: 'ing_garam',
    name: 'Garam Dapur Refina',
    category: 'Penyedap',
    currentStock: 800,
    minStock: 1000,
    unit: 'g',
    displayUnit: 'kg',
    lastUpdated: '2026-07-19T08:30:00Z',
    defaultSupplierId: 'sup_grosir_lokal',
  },
  {
    id: 'ing_telur',
    name: 'Telur Ayam Segar',
    category: 'Lain-lain',
    currentStock: 15,
    minStock: 50,
    unit: 'pcs',
    displayUnit: 'pcs',
    lastUpdated: '2026-07-19T11:45:00Z',
    defaultSupplierId: 'sup_grosir_lokal',
  },
];

export const mockTransactions: StockTransaction[] = [
  {
    id: 'tx_4',
    ingredientId: 'ing_telur',
    ingredientName: 'Telur Ayam Segar',
    type: 'OUT',
    quantity: 35,
    unit: 'pcs',
    notes: 'Pemilahan telur busuk/retak dari pengadaan kemarin',
    operator: 'Budi (Dapur)',
    timestamp: '2026-07-19T11:45:00Z',
  },
  {
    id: 'tx_3',
    ingredientId: 'ing_susu',
    ingredientName: 'Susu Cair UHT Frisian Flag',
    type: 'IN',
    quantity: 12000,
    unit: 'ml',
    notes: 'Restock mingguan dari Grosir Sumber Makmur',
    operator: 'Admin',
    timestamp: '2026-07-19T11:00:00Z',
  },
  {
    id: 'tx_2',
    ingredientId: 'ing_terigu',
    ingredientName: 'Tepung Terigu Protein Tinggi',
    type: 'OUT',
    quantity: 48000,
    unit: 'g',
    notes: 'Produksi Roti Cokelat & Roti Tawar Gandum Batch #B091',
    operator: 'Budi (Dapur)',
    timestamp: '2026-07-19T10:15:00Z',
  },
  {
    id: 'tx_1',
    ingredientId: 'ing_terigu',
    ingredientName: 'Tepung Terigu Protein Tinggi',
    type: 'IN',
    quantity: 50000,
    unit: 'g',
    notes: 'Stok awal pembukaan toko',
    operator: 'Admin',
    timestamp: '2026-07-19T08:30:00Z',
  },
];

export const mockSuppliers: Supplier[] = [
  {
    id: 'sup_indofood',
    name: 'PT Indofood Sukses Makmur',
    contact: 'Pak Roni',
    phone: '08123456789',
    address: 'Kawasan Industri Candi Blok A, Semarang',
    suppliedIngredients: ['ing_terigu', 'ing_ragi'],
  },
  {
    id: 'sup_anchor',
    name: 'Fonterra Anchor Distributor',
    contact: 'Ibu Maya',
    phone: '08234567890',
    address: 'Kawasan Pergudangan Pluit Jaya, Jakarta',
    suppliedIngredients: ['ing_mentega'],
  },
  {
    id: 'sup_grosir_lokal',
    name: 'Grosir Sumber Makmur',
    contact: 'Ko Aliong',
    phone: '08345678901',
    address: 'Jl. Pasar Baru No. 12, Kota',
    suppliedIngredients: ['ing_gula', 'ing_susu', 'ing_meses', 'ing_garam', 'ing_telur'],
  },
];

export const mockRecipes: Recipe[] = [
  {
    id: 'rec_manis_cokelat',
    productId: 'prod_manis_cokelat',
    productName: 'Roti Manis Cokelat',
    yieldQuantity: 50,
    yieldUnit: 'pcs',
    description: 'Adonan roti manis lembut dengan isian cokelat meses Ceres melimpah.',
    items: [
      { ingredientId: 'ing_terigu', ingredientName: 'Tepung Terigu Protein Tinggi', quantity: 5000, unit: 'g' },
      { ingredientId: 'ing_gula', ingredientName: 'Gula Pasir Rose Brand', quantity: 1000, unit: 'g' },
      { ingredientId: 'ing_mentega', ingredientName: 'Mentega Anchor Premium', quantity: 750, unit: 'g' },
      { ingredientId: 'ing_ragi', ingredientName: 'Ragi Instan Mauripan', quantity: 100, unit: 'g' },
      { ingredientId: 'ing_telur', ingredientName: 'Telur Ayam Segar', quantity: 10, unit: 'pcs' },
      { ingredientId: 'ing_meses', ingredientName: 'Cokelat Meses Ceres', quantity: 1500, unit: 'g' },
    ],
  },
  {
    id: 'rec_tawar_gandum',
    productId: 'prod_tawar_gandum',
    productName: 'Roti Tawar Gandum',
    yieldQuantity: 20,
    yieldUnit: 'pcs',
    description: 'Roti tawar gandum berserat tinggi yang sehat dan empuk.',
    items: [
      { ingredientId: 'ing_terigu', ingredientName: 'Tepung Terigu Protein Tinggi', quantity: 4000, unit: 'g' },
      { ingredientId: 'ing_gula', ingredientName: 'Gula Pasir Rose Brand', quantity: 500, unit: 'g' },
      { ingredientId: 'ing_mentega', ingredientName: 'Mentega Anchor Premium', quantity: 400, unit: 'g' },
      { ingredientId: 'ing_ragi', ingredientName: 'Ragi Instan Mauripan', quantity: 50, unit: 'g' },
      { ingredientId: 'ing_susu', ingredientName: 'Susu Cair UHT Frisian Flag', quantity: 1500, unit: 'ml' },
      { ingredientId: 'ing_garam', ingredientName: 'Garam Dapur Refina', quantity: 50, unit: 'g' },
    ],
  },
  {
    id: 'rec_croissant_butter',
    productId: 'prod_croissant_butter',
    productName: 'Croissant Butter Premium',
    yieldQuantity: 30,
    yieldUnit: 'pcs',
    description: 'Pastry renyah berlapis-lapis dengan aroma mentega premium yang kuat.',
    items: [
      { ingredientId: 'ing_terigu', ingredientName: 'Tepung Terigu Protein Tinggi', quantity: 3000, unit: 'g' },
      { ingredientId: 'ing_mentega', ingredientName: 'Mentega Anchor Premium', quantity: 1500, unit: 'g' },
      { ingredientId: 'ing_gula', ingredientName: 'Gula Pasir Rose Brand', quantity: 300, unit: 'g' },
      { ingredientId: 'ing_ragi', ingredientName: 'Ragi Instan Mauripan', quantity: 60, unit: 'g' },
      { ingredientId: 'ing_susu', ingredientName: 'Susu Cair UHT Frisian Flag', quantity: 1000, unit: 'ml' },
      { ingredientId: 'ing_garam', ingredientName: 'Garam Dapur Refina', quantity: 30, unit: 'g' },
    ],
  },
];

export const mockProducts: Product[] = [
  { id: 'prod_manis_cokelat', name: 'Roti Manis Cokelat', currentStock: 25, unit: 'pcs', price: 5000 },
  { id: 'prod_tawar_gandum', name: 'Roti Tawar Gandum', currentStock: 10, unit: 'pcs', price: 15000 },
  { id: 'prod_croissant_butter', name: 'Croissant Butter Premium', currentStock: 5, unit: 'pcs', price: 18000 },
];

export const mockProductionBatches: ProductionBatch[] = [
  {
    id: 'B091',
    recipeId: 'rec_manis_cokelat',
    productName: 'Roti Manis Cokelat',
    targetQuantity: 50,
    status: 'COMPLETED',
    operator: 'Budi (Dapur)',
    timestamp: '2026-07-19T10:15:00Z',
  },
];
