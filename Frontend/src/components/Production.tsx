import React, { useState, useMemo } from 'react';
import type { Recipe, Ingredient, ProductionBatch } from '../types';
import { 
  ChefHat, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  Calendar, 
  User, 
  TrendingUp,
  Clock
} from 'lucide-react';

interface ProductionProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  productionBatches: ProductionBatch[];
  preselectedRecipeId: string;
  onExecuteProduction: (recipeId: string, quantity: number, operator: string) => void;
  onClearPreselectedRecipe: () => void;
}

export const Production: React.FC<ProductionProps> = ({
  recipes,
  ingredients,
  productionBatches,
  preselectedRecipeId,
  onExecuteProduction,
  onClearPreselectedRecipe,
}) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState(preselectedRecipeId || recipes[0]?.id || '');
  const [productionQty, setProductionQty] = useState('');
  const [operator, setOperator] = useState('Budi (Dapur)');

  // Selected recipe object
  const activeRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || recipes[0] || null;
  }, [recipes, selectedRecipeId]);

  // Sync if preselectedRecipeId changes (e.g. clicked from BOM page)
  React.useEffect(() => {
    if (preselectedRecipeId) {
      setSelectedRecipeId(preselectedRecipeId);
      // Auto-fill standard yield
      const recipe = recipes.find(r => r.id === preselectedRecipeId);
      if (recipe) {
        setProductionQty(recipe.yieldQuantity.toString());
      }
      // Clear selection so user can change manually later
      onClearPreselectedRecipe();
    }
  }, [preselectedRecipeId, recipes, onClearPreselectedRecipe]);

  // Set default quantity when recipe changes
  React.useEffect(() => {
    if (activeRecipe && !productionQty) {
      setProductionQty(activeRecipe.yieldQuantity.toString());
    }
  }, [selectedRecipeId, activeRecipe]);

  // Utility to format quantity nicely
  const formatQty = (value: number, unit: string) => {
    if (unit === 'g') {
      if (value >= 1000) return `${(value / 1000).toFixed(2)} kg`;
      return `${value} g`;
    }
    if (unit === 'ml') {
      if (value >= 1000) return `${(value / 1000).toFixed(2)} L`;
      return `${value} ml`;
    }
    return `${value} pcs`;
  };

  // Live BOM Calculation based on current input quantity
  const bomLivePreview = useMemo(() => {
    if (!activeRecipe || !productionQty || isNaN(Number(productionQty))) {
      return { items: [], allAvailable: true, progressPercent: 0 };
    }

    const target = Number(productionQty);
    const factor = target / activeRecipe.yieldQuantity;
    let allAvailable = true;
    let sufficientItemsCount = 0;

    const items = activeRecipe.items.map(item => {
      const neededQty = item.quantity * factor;
      const ing = ingredients.find(i => i.id === item.ingredientId);
      const stock = ing ? ing.currentStock : 0;
      const isEnough = stock >= neededQty;
      const gap = neededQty - stock;

      if (!isEnough) allAvailable = false;
      else sufficientItemsCount++;

      return {
        ...item,
        neededQuantity: neededQty,
        currentStock: stock,
        isEnough,
        gap: gap > 0 ? gap : 0,
      };
    });

    const progressPercent = activeRecipe.items.length > 0 
      ? Math.round((sufficientItemsCount / activeRecipe.items.length) * 100)
      : 0;

    return {
      items,
      allAvailable,
      progressPercent
    };
  }, [activeRecipe, productionQty, ingredients]);

  // Handle Production Form Submit
  const handleSubmitProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !productionQty || isNaN(Number(productionQty))) return;

    const qty = Number(productionQty);
    
    // Safety check again
    if (!bomLivePreview.allAvailable) {
      alert('Gagal mengeksekusi produksi: Stok bahan baku tidak mencukupi!');
      return;
    }

    onExecuteProduction(selectedRecipeId, qty, operator);
    
    // Show success alert and reset qty
    alert(`PRODUKSI BERHASIL DIEKSEKUSI!\n\n` +
      `Sistem telah mengurangi stok bahan baku di gudang secara otomatis berdasarkan porsi resep,\n` +
      `dan menambah stok produk jadi: "${activeRecipe.productName}" sebanyak ${qty} pcs.`);
    
    setProductionQty('');
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Eksekusi Produksi Dapur</h2>
          <p className="text-sm text-stone-500">Catat batch produksi roti. Sistem akan mengalkulasi live preview kebutuhan bahan sebelum dijalankan.</p>
        </div>
      </div>

      {/* Main Grid: Form Input (Left) & BOM Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Kolom Kiri: Form Input (2/5 width) */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="font-bold text-stone-900 text-base flex items-center border-b border-stone-100 pb-3">
            <Layers className="w-5 h-5 mr-2 text-stone-600" />
            Detail Rencana Produksi
          </h3>

          <form onSubmit={handleSubmitProduction} className="space-y-4">
            {/* Choose Recipe */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Pilih Resep Produk Jadi</label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all cursor-pointer"
              >
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.productName} (Yield Std: {r.yieldQuantity} pcs)
                  </option>
                ))}
              </select>
            </div>

            {/* Target Quantity to Produce */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Jumlah Target Produksi (pcs)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={productionQty}
                  onChange={(e) => setProductionQty(e.target.value)}
                  placeholder="Masukkan angka target produksi..."
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all tabular-nums"
                />
                {activeRecipe && (
                  <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-stone-400 font-semibold">
                    pcs
                  </span>
                )}
              </div>
              {activeRecipe && (
                <p className="text-[11px] text-stone-400 mt-1">
                  *Porsi standar resep ini menghasilkan <b>{activeRecipe.yieldQuantity} pcs</b>. Kebutuhan bahan akan disesuaikan secara proporsional.
                </p>
              )}
            </div>

            {/* Operator Selection */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Staf Produksi / Pembuat</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="Budi (Dapur)">Budi (Dapur)</option>
                <option value="Siti (Kasir)">Siti (Kasir)</option>
                <option value="Lilik (Kepala Admin)">Lilik (Kepala Admin)</option>
              </select>
            </div>

            {/* Kelayakan Panel */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Kelayakan Produksi</label>
              {bomLivePreview.allAvailable ? (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Stok Bahan Baku Cukup</p>
                    <p className="text-[10px] text-green-700/90 mt-0.5">Semua bahan baku di gudang mencukupi untuk memproduksi batch ini. Eksekusi aman dilakukan.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start space-x-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Stok Bahan Baku Tidak Cukup!</p>
                    <p className="text-[10px] text-red-700/90 mt-0.5">Beberapa bahan baku berada di bawah kebutuhan produksi. Tombol produksi dikunci demi keamanan stok.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Execute Button */}
            <button
              type="submit"
              disabled={!bomLivePreview.allAvailable || !productionQty}
              className={`w-full py-3 px-4 rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
                bomLivePreview.allAvailable && productionQty
                  ? 'bg-yellow-800 hover:bg-yellow-950 text-white shadow-lg cursor-pointer'
                  : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Mulai Eksekusi Produksi</span>
            </button>
          </form>
        </div>

        {/* Kolom Kanan: Live Preview BOM (3/5 width) */}
        <div className="lg:col-span-3 bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-base flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-stone-600" />
                Live Preview Kebutuhan Bahan (BOM)
              </h3>
              {activeRecipe && productionQty && (
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-bold">
                  Target: {productionQty} pcs
                </span>
              )}
            </div>

            {/* Progress Bar Kecukupan (Signature Element) */}
            {activeRecipe && (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                <div className="flex justify-between text-xs font-bold text-stone-600 mb-1.5">
                  <span>Rasio Kesiapan Bahan Baku</span>
                  <span className="tabular-nums">{bomLivePreview.progressPercent}%</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      bomLivePreview.progressPercent === 100 
                        ? 'bg-green-600' 
                        : bomLivePreview.progressPercent >= 50 
                        ? 'bg-amber-500' 
                        : 'bg-red-500'
                    }`} 
                    style={{ width: `${bomLivePreview.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Materials Preview Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-2.5">Bahan Baku</th>
                    <th className="px-4 py-2.5 text-right">Dibutuhkan</th>
                    <th className="px-4 py-2.5 text-right">Stok Gudang</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!activeRecipe || !productionQty ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-stone-400">
                        Harap isi target produksi di sebelah kiri terlebih dahulu.
                      </td>
                    </tr>
                  ) : (
                    bomLivePreview.items.map(item => (
                      <tr key={item.ingredientId} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-stone-850">{item.ingredientName}</p>
                          {!item.isEnough && (
                            <span className="text-[10px] text-red-650 font-semibold block mt-0.5">
                              ⚠️ Kurang {formatQty(item.gap, item.unit)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-stone-900">
                          {formatQty(item.neededQuantity, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-stone-550 tabular-nums">
                          {formatQty(item.currentStock, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.isEnough 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.isEnough ? 'Sedia' : 'Kurang'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-stone-400 italic pt-3 border-t border-stone-100 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Kalkulasi live preview didasarkan pada rasio Yield Resep secara real-time.
          </div>
        </div>

      </div>

      {/* Production History (At the Bottom) */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-stone-900 text-base flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-stone-600" />
          Riwayat Produksi Hari Ini
        </h3>

        <div className="overflow-x-auto border border-stone-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Batch ID</th>
                <th className="px-4 py-3">Roti yang Diproduksi</th>
                <th className="px-4 py-3 text-right">Kuantitas Jadi</th>
                <th className="px-4 py-3">Petugas Pelaksana</th>
                <th className="px-4 py-3">Waktu Selesai</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {productionBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                    Belum ada riwayat produksi hari ini.
                  </td>
                </tr>
              ) : (
                productionBatches.map(batch => (
                  <tr key={batch.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-stone-500 font-bold">#{batch.id}</td>
                    <td className="px-4 py-3 font-bold text-stone-900">{batch.productName}</td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-stone-800">{batch.targetQuantity} pcs</td>
                    <td className="px-4 py-3 text-stone-700 flex items-center py-4">
                      <User className="w-3.5 h-3.5 text-stone-400 mr-1.5" />
                      {batch.operator}
                    </td>
                    <td className="px-4 py-3 text-stone-500 font-medium">
                      {new Date(batch.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-800 border border-green-200`}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mr-1" />
                        Selesai
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
