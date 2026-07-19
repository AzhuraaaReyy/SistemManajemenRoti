import React, { useState, useMemo } from 'react';
import type { Recipe, Ingredient } from '../types';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ChevronRight, 
  ChefHat,
  Trash2
} from 'lucide-react';

interface BOMProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onSelectRecipeForProduction: (recipeId: string) => void;
  onAddRecipe: (recipe: Recipe) => void;
}

export const BOM: React.FC<BOMProps> = ({
  recipes,
  ingredients,
  onSelectRecipeForProduction,
  onAddRecipe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  
  // State for Add Recipe Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeYield, setNewRecipeYield] = useState('50');
  const [newRecipeDesc, setNewRecipeDesc] = useState('');
  const [newRecipeItems, setNewRecipeItems] = useState<{ ingredientId: string; quantity: string }[]>([
    { ingredientId: '', quantity: '' }
  ]);

  // Active recipe detail
  const activeRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || recipes[0] || null;
  }, [recipes, selectedRecipeId]);

  // Filtered recipes list
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => 
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recipes, searchQuery]);

  // Format quantity for helper UOM
  const formatQty = (value: number, unit: string) => {
    if (unit === 'g') {
      if (value >= 1000) return `${value / 1000} kg`;
      return `${value} g`;
    }
    if (unit === 'ml') {
      if (value >= 1000) return `${value / 1000} L`;
      return `${value} ml`;
    }
    return `${value} pcs`;
  };

  // Check if a recipe is currently executable for at least 1x yield batch
  const getRecipeFeasibility = (recipe: Recipe) => {
    let allOk = true;
    const itemsStatus = recipe.items.map(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (!ing) return { name: item.ingredientName, ok: false };
      
      const hasEnough = ing.currentStock >= item.quantity;
      if (!hasEnough) allOk = false;
      
      return {
        name: item.ingredientName,
        ok: hasEnough
      };
    });

    return {
      allOk,
      details: itemsStatus
    };
  };

  // Add Item to New Recipe Form
  const handleAddNewItemRow = () => {
    setNewRecipeItems([...newRecipeItems, { ingredientId: '', quantity: '' }]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index: number) => {
    const list = [...newRecipeItems];
    list.splice(index, 1);
    setNewRecipeItems(list);
  };

  // Handle Form Change
  const handleItemRowChange = (index: number, field: 'ingredientId' | 'quantity', value: string) => {
    const list = [...newRecipeItems];
    list[index][field] = value;
    setNewRecipeItems(list);
  };

  // Save new recipe
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName || !newRecipeYield || newRecipeItems.some(i => !i.ingredientId || !i.quantity)) {
      alert('Harap lengkapi semua field dan bahan baku!');
      return;
    }

    const newRecipeId = `rec_${Date.now()}`;
    const newProductId = `prod_${Date.now()}`;

    const items = newRecipeItems.map(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId)!;
      return {
        ingredientId: item.ingredientId,
        ingredientName: ing.name,
        quantity: Number(item.quantity),
        unit: ing.unit
      };
    });

    const newRecipe: Recipe = {
      id: newRecipeId,
      productId: newProductId,
      productName: newRecipeName,
      yieldQuantity: Number(newRecipeYield),
      yieldUnit: 'pcs',
      description: newRecipeDesc || 'Resep produksi roti segar harian.',
      items
    };

    onAddRecipe(newRecipe);
    
    // Reset Form
    setNewRecipeName('');
    setNewRecipeYield('50');
    setNewRecipeDesc('');
    setNewRecipeItems([{ ingredientId: '', quantity: '' }]);
    setShowAddModal(false);
    setSelectedRecipeId(newRecipeId);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Manajemen Resep & BOM</h2>
          <p className="text-sm text-stone-500">Definisikan Bill of Materials (BOM) produk roti untuk kalkulasi stok otomatis saat produksi harian.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-2 bg-yellow-850 hover:bg-yellow-900 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Resep Baru</span>
        </button>
      </div>

      {/* Master Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Panel: Recipe List (Master) */}
        <div className="lg:col-span-1 bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-stone-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari resep..."
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredRecipes.length === 0 ? (
              <p className="text-sm text-stone-450 text-center py-6">Resep tidak ditemukan.</p>
            ) : (
              filteredRecipes.map(recipe => {
                const isActive = activeRecipe?.id === recipe.id;
                const feasibility = getRecipeFeasibility(recipe);
                
                return (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all duration-150 flex items-center justify-between ${
                      isActive 
                        ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <h4 className={`font-bold text-sm truncate ${isActive ? 'text-white' : 'text-stone-900'}`}>
                        {recipe.productName}
                      </h4>
                      <span className={`text-[10px] font-semibold tracking-wide uppercase ${isActive ? 'text-stone-400' : 'text-stone-500'}`}>
                        Yield: {recipe.yieldQuantity} {recipe.yieldUnit} • {recipe.items.length} Bahan
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {feasibility.allOk ? (
                        <span className="w-2 h-2 rounded-full bg-green-500" title="Stok Bahan Cukup" />
                      ) : (
                        <span title="Bahan Kurang">
                          <AlertTriangle className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400 animate-pulse' : 'text-amber-600'}`} />
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-stone-400' : 'text-stone-400'}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Recipe Detail (Detail) */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
          {activeRecipe ? (
            <div className="space-y-6">
              {/* Recipe Top Profile */}
              <div className="flex justify-between items-start pb-4 border-b border-stone-150">
                <div>
                  <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded uppercase">Resep Produksi</span>
                  <h3 className="text-xl font-bold text-stone-900 mt-1">{activeRecipe.productName}</h3>
                  <p className="text-sm text-stone-500 mt-1 leading-relaxed">{activeRecipe.description}</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-center min-w-[100px]">
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Yield Standar</p>
                  <p className="text-lg font-extrabold text-stone-900 tabular-nums">
                    {activeRecipe.yieldQuantity} <span className="text-xs font-semibold">{activeRecipe.yieldUnit}</span>
                  </p>
                </div>
              </div>

              {/* BOM Materials Table */}
              <div className="space-y-3">
                <h4 className="font-bold text-stone-900 text-sm flex items-center">
                  <Scale className="w-4 h-4 mr-2 text-stone-600" />
                  Kebutuhan Bahan Baku Penyusun (BOM)
                </h4>

                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2.5">Bahan Baku</th>
                        <th className="px-4 py-2.5 text-right">Takaran Per Yield</th>
                        <th className="px-4 py-2.5 text-right">Stok Saat Ini</th>
                        <th className="px-4 py-2.5 text-center">Status Kelayakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {activeRecipe.items.map(item => {
                        const ing = ingredients.find(i => i.id === item.ingredientId);
                        const isStockEnough = ing ? ing.currentStock >= item.quantity : false;
                        
                        return (
                          <tr key={item.ingredientId} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-stone-800">{item.ingredientName}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-stone-900">
                              {formatQty(item.quantity, item.unit)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-stone-500 tabular-nums">
                              {ing ? formatQty(ing.currentStock, ing.unit) : 'Tidak Terdaftar'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                isStockEnough 
                                  ? 'bg-green-50 text-green-800 border border-green-200' 
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}>
                                {isStockEnough ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                                    Cukup
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" />
                                    Kurang
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Actions Panel */}
              <div className="pt-4 border-t border-stone-150 flex justify-between items-center bg-stone-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  {getRecipeFeasibility(activeRecipe).allOk ? (
                    <div className="flex items-center text-xs text-green-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-1.5" />
                      Semua bahan baku tersedia di gudang.
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-amber-700 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mr-1.5 animate-pulse" />
                      Beberapa bahan tidak cukup untuk 1x batch produksi.
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => onSelectRecipeForProduction(activeRecipe.id)}
                    className="inline-flex items-center space-x-1.5 bg-yellow-800 hover:bg-yellow-950 text-white text-xs font-semibold py-2 px-3 rounded shadow transition-colors"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Uji Coba Produksi</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <FileText className="w-12 h-12 mb-2 text-stone-300" />
              <p>Belum ada resep terpilih.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add Recipe Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center shrink-0">
              <h4 className="font-bold text-stone-900 text-base flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-stone-600" />
                Tambah Resep & BOM Baru
              </h4>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recipe Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Nama Roti / Produk Jadi</label>
                  <input
                    type="text"
                    required
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="Contoh: Roti Tawar Gandum"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all"
                  />
                </div>

                {/* Yield Quantity */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Hasil Standar (Yield - pcs)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newRecipeYield}
                    onChange={(e) => setNewRecipeYield(e.target.value)}
                    placeholder="Contoh: 50"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Recipe Description */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Deskripsi Resep</label>
                <textarea
                  value={newRecipeDesc}
                  onChange={(e) => setNewRecipeDesc(e.target.value)}
                  placeholder="Deskripsi singkat adonan roti atau instruksi dasar..."
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Ingredients List Form Area */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-stone-500 uppercase">Daftar Bahan Baku & Takaran</label>
                  <button
                    type="button"
                    onClick={handleAddNewItemRow}
                    className="inline-flex items-center text-xs font-semibold text-yellow-800 hover:text-yellow-950"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah Baris Bahan
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {newRecipeItems.map((item, index) => {
                    const selectedIng = ingredients.find(i => i.id === item.ingredientId);
                    return (
                      <div key={index} className="flex items-center space-x-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                        {/* Dropdown Ingredient Select */}
                        <div className="flex-1">
                          <select
                            required
                            value={item.ingredientId}
                            onChange={(e) => handleItemRowChange(index, 'ingredientId', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yellow-800 bg-white"
                          >
                            <option value="">-- Pilih Bahan Baku --</option>
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Input */}
                        <div className="w-32 relative">
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemRowChange(index, 'quantity', e.target.value)}
                            placeholder="Takaran"
                            className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yellow-800"
                          />
                          {selectedIng && (
                            <span className="absolute inset-y-0 right-3.5 flex items-center text-[10px] text-stone-400 font-bold">
                              {selectedIng.unit}
                            </span>
                          )}
                        </div>

                        {/* Remove Row Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(index)}
                          disabled={newRecipeItems.length <= 1}
                          className="p-1.5 rounded hover:bg-red-155 text-stone-400 hover:text-red-650 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-stone-100 flex space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold text-white bg-yellow-800 hover:bg-yellow-900 shadow transition-colors"
                >
                  Simpan Resep
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
