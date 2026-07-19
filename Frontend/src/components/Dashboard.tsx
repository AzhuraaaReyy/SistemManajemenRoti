import React, { useState, useMemo } from 'react';
import type { Ingredient, StockTransaction } from '../types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  History, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  Truck
} from 'lucide-react';

interface DashboardProps {
  ingredients: Ingredient[];
  transactions: StockTransaction[];
  onAddTransaction: (transaction: Omit<StockTransaction, 'id' | 'timestamp'>) => void;
  onQuickPO: (ingredient: Ingredient) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  ingredients,
  transactions,
  onAddTransaction,
  onQuickPO,
}) => {
  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  // State for Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedIngForAdjust, setSelectedIngForAdjust] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustOperator, setAdjustOperator] = useState('Admin');

  // Categories list
  const categories = useMemo(() => {
    const list = new Set(ingredients.map(i => i.category));
    return ['All', ...Array.from(list)];
  }, [ingredients]);

  // Utility to format quantity nicely
  const formatQty = (value: number, unit: string) => {
    if (unit === 'g') {
      if (value >= 1000) {
        return `${(value / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
      }
      return `${value.toLocaleString('id-ID')} g`;
    }
    if (unit === 'ml') {
      if (value >= 1000) {
        return `${(value / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L`;
      }
      return `${value.toLocaleString('id-ID')} ml`;
    }
    return `${value.toLocaleString('id-ID')} pcs`;
  };

  // Helper to determine status
  const getStockStatus = (current: number, min: number) => {
    if (current <= min * 0.1) {
      return { 
        label: 'Habis', 
        severity: 'critical', 
        icon: XCircle, 
        bg: 'bg-red-50 border-red-200', 
        text: 'text-red-800', 
        iconColor: 'text-red-600' 
      };
    }
    if (current <= min) {
      return { 
        label: 'Menipis', 
        severity: 'warning', 
        icon: AlertTriangle, 
        bg: 'bg-amber-50 border-amber-200', 
        text: 'text-amber-800', 
        iconColor: 'text-amber-600' 
      };
    }
    return { 
      label: 'Aman', 
      severity: 'safe', 
      icon: CheckCircle2, 
      bg: 'bg-green-50 border-green-200', 
      text: 'text-green-800', 
      iconColor: 'text-green-600' 
    };
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter(ing => {
        const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ing.category.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === 'All' || ing.category === selectedCategory;
        
        const status = getStockStatus(ing.currentStock, ing.minStock);
        const matchesStatus = selectedStatus === 'All' || 
          (selectedStatus === 'Habis' && status.severity === 'critical') ||
          (selectedStatus === 'Menipis' && status.severity === 'warning') ||
          (selectedStatus === 'Aman' && status.severity === 'safe');

        return matchesSearch && matchesCategory && matchesStatus;
      })
      // Sorting: Critical first, then Warning, then Safe
      .sort((a, b) => {
        const statusA = getStockStatus(a.currentStock, a.minStock).severity;
        const statusB = getStockStatus(b.currentStock, b.minStock).severity;
        
        const severityWeight: Record<string, number> = { critical: 3, warning: 2, safe: 1 };
        return severityWeight[statusB] - severityWeight[statusA];
      });
  }, [ingredients, searchQuery, selectedCategory, selectedStatus]);

  // Critical alerts list
  const criticalAlerts = useMemo(() => {
    return ingredients.filter(ing => {
      const status = getStockStatus(ing.currentStock, ing.minStock);
      return status.severity === 'critical' || status.severity === 'warning';
    }).sort((a, b) => {
      // Habis/Critical first
      const isCriticalA = a.currentStock <= a.minStock * 0.1 ? 1 : 0;
      const isCriticalB = b.currentStock <= b.minStock * 0.1 ? 1 : 0;
      return isCriticalB - isCriticalA;
    });
  }, [ingredients]);

  // Handle Stock Adjustment Submit
  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngForAdjust || !adjustQty || isNaN(Number(adjustQty))) return;

    const qty = Number(adjustQty);
    
    // Check if OUT transaction exceeds current stock
    if (adjustType === 'OUT' && qty > selectedIngForAdjust.currentStock) {
      alert('Kesalahan: Jumlah pengeluaran melebihi stok yang tersedia!');
      return;
    }

    onAddTransaction({
      ingredientId: selectedIngForAdjust.id,
      ingredientName: selectedIngForAdjust.name,
      type: adjustType,
      quantity: qty,
      unit: selectedIngForAdjust.unit,
      notes: adjustNotes || (adjustType === 'IN' ? 'Koreksi Stok Masuk Manual' : 'Koreksi Stok Keluar Manual'),
      operator: adjustOperator,
    });

    // Reset and Close
    setAdjustQty('');
    setAdjustNotes('');
    setShowAdjustModal(false);
    setSelectedIngForAdjust(null);
  };

  const openAdjustModal = (ing: Ingredient, type: 'IN' | 'OUT') => {
    setSelectedIngForAdjust(ing);
    setAdjustType(type);
    setShowAdjustModal(true);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      {/* Top Welcome Header */}
      <div className="flex justify-between items-center pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Monitoring Persediaan</h2>
          <p className="text-sm text-stone-500">Pantau stok bahan baku harian, kelola pengadaan, dan mutasi inventori dapur secara real-time.</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            Sistem Online
          </span>
        </div>
      </div>

      {/* Action Center - Critical Alerts (Signature Element) */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
              <h3 className="text-sm font-bold text-red-900">Eskalasi Bahan Kritis & Menipis ({criticalAlerts.length})</h3>
            </div>
            <span className="text-xs text-red-700 font-medium">Harap segera koordinasikan dengan bagian pembelian</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {criticalAlerts.map(ing => {
              const status = getStockStatus(ing.currentStock, ing.minStock);
              const gap = ing.minStock - ing.currentStock;

              return (
                <div key={ing.id} className="bg-white border border-red-100 rounded-lg p-3.5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm leading-snug">{ing.name}</h4>
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-semibold uppercase">{ing.category}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${status.bg} ${status.text}`}>
                      <status.icon className="w-3.5 h-3.5 mr-1" />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Stok Saat Ini:</span>
                      <span className="font-bold text-stone-800 tabular-nums">{formatQty(ing.currentStock, ing.unit)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Batas Aman (Min):</span>
                      <span className="font-medium text-stone-700 tabular-nums">{formatQty(ing.minStock, ing.unit)}</span>
                    </div>
                    {gap > 0 && (
                      <div className="flex justify-between text-[11px] text-red-600 font-medium pt-1 border-t border-dotted border-stone-200">
                        <span>Kekurangan:</span>
                        <span className="font-bold tabular-nums">-{formatQty(gap, ing.unit)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-stone-100 flex space-x-2">
                    <button
                      onClick={() => onQuickPO(ing)}
                      className="flex-1 inline-flex items-center justify-center bg-yellow-800 hover:bg-yellow-900 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5 mr-1.5" />
                      Pesan via PO
                    </button>
                    <button
                      onClick={() => openAdjustModal(ing, 'IN')}
                      className="inline-flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold py-1.5 px-2.5 rounded transition-colors"
                      title="Tambah Stok Darurat"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Stock Table (Left 2/3) & Log Mutasi (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Stock Table */}
        <div className="lg:col-span-2 space-y-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <h3 className="font-bold text-stone-900 text-base flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-stone-600" />
              Tabel Inventori Bahan Baku
            </h3>
            
            {/* Quick Summary Pill */}
            <div className="flex space-x-2">
              <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full">
                {ingredients.filter(i => i.currentStock <= i.minStock * 0.1).length} Habis
              </span>
              <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">
                {ingredients.filter(i => i.currentStock > i.minStock * 0.1 && i.currentStock <= i.minStock).length} Menipis
              </span>
              <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-full">
                {ingredients.filter(i => i.currentStock > i.minStock).length} Aman
              </span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-stone-400" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama bahan baku..."
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none w-full pl-3 pr-8 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'Semua Kategori' : cat}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Filter className="h-3.5 w-3.5 text-stone-400" />
              </span>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none w-full pl-3 pr-8 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="All">Semua Status</option>
                <option value="Habis">Habis (Kritis)</option>
                <option value="Menipis">Menipis (Warning)</option>
                <option value="Aman">Aman (OK)</option>
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <AlertCircle className="h-3.5 w-3.5 text-stone-400" />
              </span>
            </div>
          </div>

          {/* Actual Table */}
          <div className="overflow-x-auto border border-stone-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Nama Bahan</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                  <th className="px-4 py-3 text-right">Batas Min</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                      Bahan baku tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map(ing => {
                    const status = getStockStatus(ing.currentStock, ing.minStock);
                    return (
                      <tr key={ing.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-stone-900">{ing.name}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-semibold uppercase">{ing.category}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums text-stone-800">
                          {formatQty(ing.currentStock, ing.unit)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-stone-500 tabular-nums">
                          {formatQty(ing.minStock, ing.unit)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${status.bg} ${status.text}`}>
                            <status.icon className="w-3.5 h-3.5 mr-1" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => openAdjustModal(ing, 'IN')}
                              className="p-1 rounded bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
                              title="Stok Masuk (+)"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openAdjustModal(ing, 'OUT')}
                              className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                              title="Stok Keluar (-)"
                              disabled={ing.currentStock <= 0}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Log Mutasi (Stok Masuk / Stok Keluar) */}
        <div className="space-y-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-stone-900 text-base flex items-center">
              <History className="w-5 h-5 mr-2 text-stone-600" />
              Log Mutasi Stok
            </h3>
            <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Terbaru</span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                Belum ada riwayat transaksi stok.
              </div>
            ) : (
              transactions.map(tx => {
                const isIN = tx.type === 'IN';
                return (
                  <div key={tx.id} className="border border-stone-100 rounded-lg p-3 hover:bg-stone-50 transition-colors">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className={`p-1 rounded ${isIN ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {isIN ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </span>
                        <span className="font-bold text-stone-950 text-xs truncate max-w-[120px]">{tx.ingredientName}</span>
                      </div>
                      <span className={`font-extrabold text-xs tabular-nums ${isIN ? 'text-green-700' : 'text-red-700'}`}>
                        {isIN ? '+' : '-'}{formatQty(tx.quantity, tx.unit)}
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed bg-stone-50 p-1.5 rounded border border-stone-100 mb-1.5 font-medium">
                      {tx.notes}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-stone-400 font-semibold">
                      <span className="flex items-center">
                        <span className="w-1 h-1 rounded-full bg-stone-300 mr-1.5"></span>
                        {tx.operator}
                      </span>
                      <span>
                        {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedIngForAdjust && (
        <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
              <h4 className="font-bold text-stone-900 text-base">
                Koreksi Stok: {selectedIngForAdjust.name}
              </h4>
              <button 
                onClick={() => setShowAdjustModal(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Tipe Penyesuaian</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('IN')}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${
                      adjustType === 'IN' 
                        ? 'bg-green-100 text-green-800 border border-green-300 ring-2 ring-green-100' 
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Stok Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('OUT')}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${
                      adjustType === 'OUT' 
                        ? 'bg-red-100 text-red-800 border border-red-300 ring-2 ring-red-100' 
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <Minus className="w-4 h-4 mr-1.5" />
                    Stok Keluar
                  </button>
                </div>
              </div>

              {/* Current Stock Preview */}
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex justify-between text-xs">
                <span className="text-stone-500 font-semibold">Stok Saat Ini:</span>
                <span className="font-extrabold text-stone-850 tabular-nums">
                  {formatQty(selectedIngForAdjust.currentStock, selectedIngForAdjust.unit)}
                </span>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Jumlah Kuantitas ({selectedIngForAdjust.unit})</label>
                <div className="relative">
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    required
                    min="1"
                    placeholder={`Masukkan angka kuantitas (${selectedIngForAdjust.unit})`}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all tabular-nums"
                  />
                  {adjustQty && !isNaN(Number(adjustQty)) && (
                    <span className="absolute inset-y-0 right-3 flex items-center text-xs text-stone-400 font-semibold">
                      = {formatQty(Number(adjustQty), selectedIngForAdjust.unit)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Harap ketikkan angka dalam satuan dasar: <b>{selectedIngForAdjust.unit}</b>.</p>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Petugas / Operator</label>
                <select
                  value={adjustOperator}
                  onChange={(e) => setAdjustOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all cursor-pointer"
                >
                  <option value="Admin">Admin / Pemilik</option>
                  <option value="Budi (Dapur)">Budi (Dapur)</option>
                  <option value="Siti (Kasir)">Siti (Kasir)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Keterangan / Alasan</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Contoh: Koreksi stok tumpah di dapur, kiriman supplier, dll."
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold text-white bg-yellow-800 hover:bg-yellow-900 shadow transition-colors"
                >
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
