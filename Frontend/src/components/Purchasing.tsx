import React, { useState, useMemo } from 'react';
import type { Supplier, Ingredient } from '../types';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Phone,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  X,
  FileText
} from 'lucide-react';

// PurchaseOrder type (internal to this module)
interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  items: POItem[];
  status: 'DIPESAN' | 'DITERIMA';
  createdAt: string;
  receivedAt?: string;
  operator: string;
  notes: string;
}

interface POItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface PurchasingProps {
  suppliers: Supplier[];
  ingredients: Ingredient[];
  onReceivePO: (po: PurchaseOrder) => void;
}

export const Purchasing: React.FC<PurchasingProps> = ({
  suppliers,
  ingredients,
  onReceivePO,
}) => {
  // PO List state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    {
      id: 'PO-001',
      supplierId: 'sup_indofood',
      supplierName: 'PT Indofood Sukses Makmur',
      status: 'DIPESAN',
      createdAt: '2026-07-19T07:00:00Z',
      operator: 'Admin',
      notes: 'Restock darurat terigu dan ragi sebelum stok habis total.',
      items: [
        { ingredientId: 'ing_terigu', ingredientName: 'Tepung Terigu Protein Tinggi', quantity: 50000, unit: 'g', unitPrice: 12000 },
        { ingredientId: 'ing_ragi', ingredientName: 'Ragi Instan Mauripan', quantity: 5000, unit: 'g', unitPrice: 35000 },
      ],
    },
    {
      id: 'PO-002',
      supplierId: 'sup_anchor',
      supplierName: 'Fonterra Anchor Distributor',
      status: 'DIPESAN',
      createdAt: '2026-07-19T07:30:00Z',
      operator: 'Admin',
      notes: 'Pengadaan mentega untuk produksi croissant minggu ini.',
      items: [
        { ingredientId: 'ing_mentega', ingredientName: 'Mentega Anchor Premium', quantity: 20000, unit: 'g', unitPrice: 55000 },
      ],
    },
    {
      id: 'PO-000',
      supplierId: 'sup_grosir_lokal',
      supplierName: 'Grosir Sumber Makmur',
      status: 'DITERIMA',
      createdAt: '2026-07-18T08:00:00Z',
      receivedAt: '2026-07-19T11:00:00Z',
      operator: 'Admin',
      notes: 'Pembelian rutin mingguan susu UHT.',
      items: [
        { ingredientId: 'ing_susu', ingredientName: 'Susu Cair UHT Frisian Flag', quantity: 12000, unit: 'ml', unitPrice: 18000 },
        { ingredientId: 'ing_gula', ingredientName: 'Gula Pasir Rose Brand', quantity: 25000, unit: 'g', unitPrice: 14000 },
      ],
    },
  ]);

  // UI State
  const [activeTab, setActiveTab] = useState<'pesanan' | 'supplier'>('pesanan');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIPESAN' | 'DITERIMA'>('ALL');
  const [expandedPOId, setExpandedPOId] = useState<string | null>('PO-001');
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);

  // New PO Modal state
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const [newPOSupplierId, setNewPOSupplierId] = useState('');
  const [newPOItems, setNewPOItems] = useState<{ ingredientId: string; quantity: string; unitPrice: string }[]>([
    { ingredientId: '', quantity: '', unitPrice: '' }
  ]);
  const [newPONotes, setNewPONotes] = useState('');
  const [newPOOperator, setNewPOOperator] = useState('Admin');

  // Format quantity helper
  const formatQty = (value: number, unit: string) => {
    if (unit === 'g') {
      if (value >= 1000) return `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`;
      return `${value} g`;
    }
    if (unit === 'ml') {
      if (value >= 1000) return `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} L`;
      return `${value} ml`;
    }
    return `${value} ${unit}`;
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

  // Compute PO total value
  const computePOTotal = (po: PurchaseOrder) => {
    return po.items.reduce((sum, item) => {
      // convert to display unit for price (per kg/L/pcs)
      const displayQty = item.unit === 'g' ? item.quantity / 1000 :
                         item.unit === 'ml' ? item.quantity / 1000 :
                         item.quantity;
      return sum + (displayQty * item.unitPrice);
    }, 0);
  };

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders
      .filter(po => {
        const matchSearch = po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.items.some(i => i.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        // Sort: DIPESAN first, then by date desc
        if (a.status === 'DIPESAN' && b.status !== 'DIPESAN') return -1;
        if (a.status !== 'DIPESAN' && b.status === 'DIPESAN') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [purchaseOrders, searchQuery, statusFilter]);

  // Confirm receive handler
  const handleConfirmReceive = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const receivedAt = new Date().toISOString();

    // Update PO status
    setPurchaseOrders(prev =>
      prev.map(p =>
        p.id === poId
          ? { ...p, status: 'DITERIMA' as const, receivedAt }
          : p
      )
    );

    // Trigger stock update (passed up to App)
    onReceivePO({ ...po, status: 'DITERIMA', receivedAt });

    setConfirmReceiveId(null);
    setExpandedPOId(poId);
  };

  // Handle save new PO
  const handleSaveNewPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOSupplierId || newPOItems.some(i => !i.ingredientId || !i.quantity)) {
      alert('Harap lengkapi supplier dan semua bahan baku yang dipesan!');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === newPOSupplierId)!;
    const newId = `PO-${String(purchaseOrders.length + 1).padStart(3, '0')}`;

    const items: POItem[] = newPOItems.map(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId)!;
      return {
        ingredientId: item.ingredientId,
        ingredientName: ing.name,
        quantity: Number(item.quantity),
        unit: ing.unit,
        unitPrice: Number(item.unitPrice) || 0,
      };
    });

    const newPO: PurchaseOrder = {
      id: newId,
      supplierId: newPOSupplierId,
      supplierName: selectedSupplier.name,
      status: 'DIPESAN',
      createdAt: new Date().toISOString(),
      operator: newPOOperator,
      notes: newPONotes,
      items,
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    // Reset
    setNewPOSupplierId('');
    setNewPOItems([{ ingredientId: '', quantity: '', unitPrice: '' }]);
    setNewPONotes('');
    setShowNewPOModal(false);
    setExpandedPOId(newId);
  };

  // Get supplier-associated ingredients
  const supplierIngredients = (supplierId: string) => {
    const s = suppliers.find(s => s.id === supplierId);
    if (!s) return [];
    return s.suppliedIngredients
      .map(id => ingredients.find(i => i.id === id))
      .filter(Boolean) as Ingredient[];
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Pembelian Bahan Baku & Supplier</h2>
          <p className="text-sm text-stone-500">Kelola pemesanan dan penerimaan bahan baku. Stok hanya bertambah saat status berubah menjadi <strong>"Diterima"</strong>.</p>
        </div>
        <button
          onClick={() => setShowNewPOModal(true)}
          className="inline-flex items-center space-x-2 bg-yellow-800 hover:bg-yellow-900 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Purchase Order</span>
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex space-x-1 border-b border-stone-200">
        {(['pesanan', 'supplier'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'bg-white border-t border-x border-stone-200 text-stone-900 -mb-px'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab === 'pesanan' ? (
              <span className="flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4" />
                <span>Daftar Pesanan (PO)</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  purchaseOrders.filter(p => p.status === 'DIPESAN').length > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {purchaseOrders.filter(p => p.status === 'DIPESAN').length} menunggu
                </span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <Building2 className="w-4 h-4" />
                <span>Daftar Supplier</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === TAB: DAFTAR PO === */}
      {activeTab === 'pesanan' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama supplier, nomor PO, atau bahan..."
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex space-x-2">
              {(['ALL', 'DIPESAN', 'DITERIMA'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                    statusFilter === s
                      ? s === 'DIPESAN'
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : s === 'DITERIMA'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {s === 'ALL' ? 'Semua' : s}
                </button>
              ))}
            </div>
          </div>

          {/* PO Cards List */}
          <div className="space-y-3">
            {filteredPOs.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p>Tidak ada Purchase Order ditemukan.</p>
              </div>
            ) : (
              filteredPOs.map(po => {
                const isDipesan = po.status === 'DIPESAN';
                const isExpanded = expandedPOId === po.id;
                const poTotal = computePOTotal(po);

                return (
                  <div
                    key={po.id}
                    className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                      isDipesan
                        ? 'border-sky-200 shadow-sm shadow-sky-100/60'
                        : 'border-stone-200 shadow-sm'
                    }`}
                  >
                    {/* PO Header Row */}
                    <div
                      className={`flex items-center justify-between p-4 cursor-pointer ${
                        isDipesan ? 'bg-sky-50/80' : 'bg-white'
                      }`}
                      onClick={() => setExpandedPOId(isExpanded ? null : po.id)}
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        {/* Status Badge – visually distinct */}
                        <div className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 ${
                          isDipesan
                            ? 'border-sky-300 bg-sky-100 text-sky-800'
                            : 'border-green-300 bg-green-100 text-green-800'
                        }`}>
                          {isDipesan
                            ? <Clock className="w-6 h-6 mb-0.5" />
                            : <Package className="w-6 h-6 mb-0.5" />
                          }
                          <span className="text-[9px] font-extrabold uppercase tracking-tight leading-none">
                            {isDipesan ? 'Dipesan' : 'Diterima'}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-mono font-bold text-stone-400">{po.id}</span>
                            <span className="text-stone-300">·</span>
                            <span className="text-[11px] text-stone-500 font-medium">
                              {new Date(po.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <h4 className="font-bold text-stone-900 text-sm truncate">{po.supplierName}</h4>
                          <p className="text-[11px] text-stone-500">
                            {po.items.length} item bahan baku · Total ~{formatCurrency(poTotal)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 ml-4">
                        {/* Receive Button – only for DIPESAN */}
                        {isDipesan && (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmReceiveId(po.id); }}
                            className="inline-flex items-center space-x-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors shadow-sm"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Terima Barang</span>
                          </button>
                        )}

                        {/* Expand toggle */}
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-stone-400" />
                          : <ChevronDown className="w-4 h-4 text-stone-400" />
                        }
                      </div>
                    </div>

                    {/* PO Detail Expanded */}
                    {isExpanded && (
                      <div className="bg-white border-t border-stone-100 p-4 space-y-4">
                        {/* Warning banner for DIPESAN */}
                        {isDipesan && (
                          <div className="flex items-start space-x-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                              <strong>Stok belum bertambah.</strong> Barang pada PO ini tercatat sebagai <em>"Dipesan"</em> dan belum diterima di gudang. Tekan tombol <strong>"Terima Barang"</strong> di atas saat barang sudah benar-benar tiba untuk memperbarui stok.
                            </p>
                          </div>
                        )}

                        {/* Received success notice for DITERIMA */}
                        {!isDipesan && (
                          <div className="flex items-start space-x-2.5 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-green-700 font-medium leading-relaxed">
                              <strong>Stok telah diperbarui.</strong> Barang diterima pada{' '}
                              {po.receivedAt ? new Date(po.receivedAt).toLocaleString('id-ID', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              }) : '-'}. Kuantitas telah ditambahkan ke stok gudang secara otomatis.
                            </p>
                          </div>
                        )}

                        {/* Item Table */}
                        <div className="overflow-x-auto border border-stone-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-stone-50 text-stone-500 text-[10px] uppercase font-bold border-b border-stone-200">
                              <tr>
                                <th className="px-4 py-2.5 text-left">Bahan Baku</th>
                                <th className="px-4 py-2.5 text-right">Qty Dipesan</th>
                                <th className="px-4 py-2.5 text-right">Harga Satuan</th>
                                <th className="px-4 py-2.5 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {po.items.map(item => {
                                const displayQty = item.unit === 'g' ? item.quantity / 1000 :
                                                   item.unit === 'ml' ? item.quantity / 1000 :
                                                   item.quantity;
                                const subtotal = displayQty * item.unitPrice;
                                return (
                                  <tr key={item.ingredientId} className="hover:bg-stone-50/50">
                                    <td className="px-4 py-3 font-bold text-stone-800">{item.ingredientName}</td>
                                    <td className="px-4 py-3 text-right font-bold tabular-nums text-stone-900">
                                      {formatQty(item.quantity, item.unit)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-stone-500 tabular-nums">
                                      {item.unitPrice > 0 ? `${formatCurrency(item.unitPrice)}/kg` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-800">
                                      {item.unitPrice > 0 ? formatCurrency(subtotal) : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="border-t-2 border-stone-200 bg-stone-50">
                              <tr>
                                <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-bold text-stone-600 uppercase">Total Estimasi Nilai PO</td>
                                <td className="px-4 py-2.5 text-right font-extrabold text-stone-900 tabular-nums">
                                  {formatCurrency(poTotal)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Notes */}
                        {po.notes && (
                          <div className="text-[11px] text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-100">
                            <span className="font-bold text-stone-700 block mb-0.5">Catatan:</span>
                            {po.notes}
                          </div>
                        )}

                        {/* Operator */}
                        <div className="text-[10px] text-stone-400 font-semibold">
                          Dibuat oleh: {po.operator}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* === TAB: DAFTAR SUPPLIER === */}
      {activeTab === 'supplier' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(supplier => {
            const ingList = supplierIngredients(supplier.id);
            return (
              <div key={supplier.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm leading-tight">{supplier.name}</h4>
                    <p className="text-[11px] text-stone-400 font-medium mt-0.5">Kontak: {supplier.contact}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-stone-500" />
                  </div>
                </div>

                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center space-x-2 text-stone-600">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                  <div className="flex items-start space-x-2 text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{supplier.address}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-stone-500 uppercase mb-1.5">Bahan Baku yang Disuplai</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingList.map(ing => (
                      <span key={ing.id} className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded font-semibold">
                        {ing.name}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { setNewPOSupplierId(supplier.id); setShowNewPOModal(true); }}
                  className="w-full py-2 text-xs font-semibold bg-stone-900 hover:bg-yellow-800 text-white rounded-lg transition-colors"
                >
                  Buat PO ke Supplier Ini
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* === CONFIRMATION DIALOG: Terima Barang === */}
      {confirmReceiveId && (
        <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-sm w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-base">Konfirmasi Penerimaan Barang</h4>
                <p className="text-xs text-stone-500">{purchaseOrders.find(p => p.id === confirmReceiveId)?.id}</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs text-green-800 leading-relaxed">
              <strong>Tindakan ini tidak dapat dibatalkan.</strong> Setelah dikonfirmasi, sistem akan secara otomatis <strong>menambahkan kuantitas bahan baku pada PO ini ke stok gudang</strong>. Pastikan barang benar-benar sudah tiba secara fisik sebelum konfirmasi.
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setConfirmReceiveId(null)}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleConfirmReceive(confirmReceiveId)}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold text-white bg-green-700 hover:bg-green-800 shadow transition-colors flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya, Barang Sudah Diterima</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === NEW PO MODAL === */}
      {showNewPOModal && (
        <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center shrink-0">
              <h4 className="font-bold text-stone-900 text-base flex items-center">
                <ShoppingBag className="w-5 h-5 mr-2 text-stone-600" />
                Buat Purchase Order Baru
              </h4>
              <button onClick={() => setShowNewPOModal(false)}>
                <X className="w-5 h-5 text-stone-400 hover:text-stone-700 transition-colors" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPO} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Supplier Select */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Supplier Tujuan</label>
                <select
                  required
                  value={newPOSupplierId}
                  onChange={e => setNewPOSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800 cursor-pointer"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.contact}</option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-stone-500 uppercase">Bahan Baku yang Dipesan</label>
                  <button
                    type="button"
                    onClick={() => setNewPOItems([...newPOItems, { ingredientId: '', quantity: '', unitPrice: '' }])}
                    className="text-xs font-semibold text-yellow-800 hover:text-yellow-950 flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
                  </button>
                </div>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {newPOItems.map((item, idx) => {
                    const selIng = ingredients.find(i => i.id === item.ingredientId);
                    return (
                      <div key={idx} className="flex items-center space-x-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                        <select
                          required
                          value={item.ingredientId}
                          onChange={e => {
                            const list = [...newPOItems]; list[idx].ingredientId = e.target.value; setNewPOItems(list);
                          }}
                          className="flex-1 px-2 py-1.5 text-xs border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-800"
                        >
                          <option value="">-- Pilih Bahan --</option>
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </select>

                        <div className="relative w-28">
                          <input
                            type="number" required min="1" value={item.quantity}
                            onChange={e => { const list = [...newPOItems]; list[idx].quantity = e.target.value; setNewPOItems(list); }}
                            placeholder="Qty"
                            className="w-full px-2 py-1.5 pr-6 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-800 tabular-nums"
                          />
                          {selIng && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-bold">{selIng.unit}</span>}
                        </div>

                        <div className="relative w-24">
                          <input
                            type="number" min="0" value={item.unitPrice}
                            onChange={e => { const list = [...newPOItems]; list[idx].unitPrice = e.target.value; setNewPOItems(list); }}
                            placeholder="Harga"
                            className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-800 tabular-nums"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => { const list = [...newPOItems]; list.splice(idx, 1); setNewPOItems(list); }}
                          disabled={newPOItems.length <= 1}
                          className="p-1.5 text-stone-400 hover:text-red-600 transition-colors disabled:opacity-30"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Dibuat Oleh</label>
                <select value={newPOOperator} onChange={e => setNewPOOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-yellow-800 cursor-pointer"
                >
                  <option value="Admin">Admin / Pemilik</option>
                  <option value="Lilik (Kepala Admin)">Lilik (Kepala Admin)</option>
                  <option value="Budi (Dapur)">Budi (Dapur)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Catatan Pesanan</label>
                <textarea
                  value={newPONotes} onChange={e => setNewPONotes(e.target.value)}
                  placeholder="Catatan tambahan untuk supplier atau staf gudang..."
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-800"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex space-x-2">
                <button type="button" onClick={() => setShowNewPOModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors">
                  Batal
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-yellow-800 hover:bg-yellow-900 shadow transition-colors">
                  Simpan PO (Status: Dipesan)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
