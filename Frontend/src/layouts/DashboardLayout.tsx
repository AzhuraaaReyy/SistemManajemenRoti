import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StockAlertBell } from '../components/inventory/StockAlertBell';
import { useAuth } from '../context/AuthContext';

const JUDUL_HALAMAN: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pengguna': 'Manajemen Pengguna',
  '/profil': 'Profil Saya',
  '/master/kategori': 'Master Data — Kategori',
  '/master/supplier': 'Master Data — Supplier',
  '/master/bahan-baku': 'Master Data — Bahan Baku',
  '/master/produk': 'Master Data — Produk',
  '/master/resep': 'Master Data — Resep (BOM)',
  '/pembelian/dashboard': 'Pembelian — Dashboard',
  '/pembelian/pesanan': 'Pembelian — Pesanan',
  '/pembelian/penerimaan': 'Pembelian — Penerimaan Barang',
  '/produksi/dashboard': 'Produksi — Dashboard',
  '/produksi/batch': 'Produksi — Batch',
  '/persediaan/dashboard': 'Persediaan — Dashboard',
  '/persediaan/stok': 'Persediaan — Ringkasan Stok',
  '/persediaan/mutasi': 'Persediaan — Riwayat Mutasi',
  '/penjualan/kasir': 'Kasir',
  '/penjualan/riwayat': 'Penjualan — Riwayat',
  '/penjualan/dashboard': 'Penjualan — Dashboard',
  '/pengaturan': 'Pengaturan',
};

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  /*
  | Rute berparameter tidak bisa dicocokkan lewat tabel di atas, jadi
  | ditangani terpisah — /produksi/batch/12 tetap perlu judul yang benar.
  */
  const judul =
    JUDUL_HALAMAN[pathname] ??
    (/^\/produksi\/batch\/\d+$/.test(pathname) ? 'Produksi — Tracking Batch' : 'RotiApp');

  const salam = (() => {
    const jam = new Date().getHours();
    if (jam < 11) return 'Selamat pagi';
    if (jam < 15) return 'Selamat siang';
    if (jam < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  return (
    <div className="flex min-h-screen w-full bg-stone-50 text-stone-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bilah atas — tombol menu hanya muncul di layar kecil */}
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-stone-200 bg-white/80 px-5 py-3.5 backdrop-blur-md sm:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 lg:hidden"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-stone-900 sm:text-lg">{judul}</h1>
            <p className="hidden truncate text-xs text-stone-500 sm:block">
              {salam}, {user?.name.split(' ')[0]} — Anda masuk sebagai {user?.role_label}.
            </p>
          </div>

          {/* Peringatan stok — isinya dari tabel stock_alerts yang diisi saat
              stok bergerak, bukan dihitung ulang setiap lonceng dibuka. */}
          <StockAlertBell />

          <div className="hidden shrink-0 items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-stone-600">Terhubung</span>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
