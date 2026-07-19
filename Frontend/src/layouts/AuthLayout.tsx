import React from 'react';
import { Outlet } from 'react-router-dom';
import { BarChart3, Boxes, ChefHat, Wheat } from 'lucide-react';

const SOROTAN = [
  { icon: Wheat, title: 'Resep & BOM', text: 'Produksi otomatis memotong bahan sesuai takaran resep.' },
  { icon: Boxes, title: 'Stok Real-time', text: 'Pantau stok masuk, keluar, menipis, dan habis.' },
  { icon: BarChart3, title: 'Laba Kotor', text: 'Hitung HPP dari harga bahan yang sesungguhnya.' },
];

/**
 * Kerangka halaman publik (login, lupa & atur ulang kata sandi).
 *
 * Dua kolom di layar lebar, satu kolom di ponsel — panel kiri disembunyikan
 * agar formulir mendapat seluruh ruang layar kecil.
 */
export const AuthLayout: React.FC = () => (
  <div className="flex min-h-screen w-full bg-stone-50">
    {/* Panel kiri — hanya tampil di layar lebar */}
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-stone-900 p-12 text-stone-200 lg:flex">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-yellow-600/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-600 text-xl font-bold text-white shadow-lg">
          R
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none text-white">RotiApp</h1>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            UMKM Manufaktur
          </span>
        </div>
      </div>

      <div className="relative">
        <ChefHat className="mb-6 h-12 w-12 text-yellow-500" aria-hidden="true" />
        <h2 className="max-w-md text-3xl font-bold leading-tight text-white">
          Dari bahan mentah sampai roti di etalase, tercatat rapi.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-400">
          Sistem informasi terpadu untuk mengelola persediaan, resep, produksi, pembelian, dan
          penjualan usaha roti Anda.
        </p>

        <div className="mt-10 space-y-4">
          {SOROTAN.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-800">
                <Icon className="h-4 w-4 text-yellow-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-100">{title}</p>
                <p className="text-xs text-stone-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-stone-500">
        © {new Date().getFullYear()} RotiApp · Modul 1 — Authentication &amp; User Management
      </p>
    </div>

    {/* Panel kanan — formulir */}
    <div className="flex w-full items-center justify-center px-5 py-10 lg:w-1/2 sm:px-8">
      <div className="w-full max-w-md">
        {/* Logo ringkas untuk layar kecil */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-600 text-lg font-bold text-white">
            R
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none text-stone-900">RotiApp</h1>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              UMKM Manufaktur
            </span>
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  </div>
);
