import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChefHat,
  Circle,
  Package,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UserCircle,
  Users,
} from 'lucide-react';
import { Badge } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

interface Modul {
  kode: string;
  nama: string;
  icon: React.ElementType;
  status: 'selesai' | 'berikutnya' | 'antre';
  ringkasan: string;
}

const PETA_MODUL: Modul[] = [
  {
    kode: 'M1',
    nama: 'Authentication & User Management',
    icon: ShieldCheck,
    status: 'selesai',
    ringkasan: 'Login, JWT, peran, manajemen pengguna, dan profil.',
  },
  {
    kode: 'M2',
    nama: 'Persediaan & Ledger Stok',
    icon: Package,
    status: 'berikutnya',
    ringkasan: 'Stok masuk, keluar, menipis, dan habis secara real-time.',
  },
  {
    kode: 'M3',
    nama: 'Supplier & Pembelian',
    icon: ShoppingBag,
    status: 'antre',
    ringkasan: 'Purchase order dan penerimaan barang otomatis menambah stok.',
  },
  {
    kode: 'M4',
    nama: 'Resep (BOM)',
    icon: BookOpen,
    status: 'antre',
    ringkasan: 'Komposisi bahan per produk beserta kalkulasi biayanya.',
  },
  {
    kode: 'M5',
    nama: 'Produksi',
    icon: ChefHat,
    status: 'antre',
    ringkasan: 'Bahan mentah menjadi produk jadi, stok terpotong otomatis.',
  },
  {
    kode: 'M6',
    nama: 'Penjualan (POS)',
    icon: ShoppingCart,
    status: 'antre',
    ringkasan: 'Pencatatan penjualan dan pemotongan stok produk jadi.',
  },
  {
    kode: 'M10',
    nama: 'Laporan Laba Kotor',
    icon: BarChart3,
    status: 'antre',
    ringkasan: 'HPP rata-rata tertimbang dan margin per produk.',
  },
];

const GAYA_STATUS = {
  selesai: { tone: 'success' as const, label: 'Selesai', icon: CheckCircle2, warna: 'text-emerald-600' },
  berikutnya: { tone: 'warning' as const, label: 'Berikutnya', icon: Circle, warna: 'text-amber-600' },
  antre: { tone: 'neutral' as const, label: 'Antre', icon: Circle, warna: 'text-stone-300' },
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Sambutan */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br from-stone-900 to-stone-800 p-6 text-stone-200 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-yellow-500">RotiApp</p>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Halo, {user?.name}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-400">
          Anda masuk sebagai <span className="font-semibold text-stone-200">{user?.role_label}</span>.
          Modul 1 (Authentication &amp; User Management) sudah aktif. Modul persediaan, resep, dan
          produksi menyusul pada iterasi berikutnya.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/profil"
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <UserCircle className="h-4 w-4" />
            Profil Saya
          </Link>

          {user?.allowed_menus.includes('pengguna') && (
            <Link
              to="/pengguna"
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-700"
            >
              <Users className="h-4 w-4" />
              Kelola Pengguna
            </Link>
          )}
        </div>
      </div>

      {/* Peta jalan modul */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-base font-bold text-stone-900">Peta Jalan Pengembangan</h3>
          <p className="mt-1 text-sm text-stone-500">
            Sistem dibangun bertahap per modul. Setiap modul dapat dipakai sendiri begitu selesai.
          </p>
        </div>

        <ol className="space-y-3">
          {PETA_MODUL.map((modul) => {
            const gaya = GAYA_STATUS[modul.status];
            const StatusIcon = gaya.icon;
            const ModulIcon = modul.icon;

            return (
              <li
                key={modul.kode}
                className={`flex items-start gap-4 rounded-lg border p-4 transition ${
                  modul.status === 'selesai'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : modul.status === 'berikutnya'
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-stone-200'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-stone-200">
                  <ModulIcon className="h-5 w-5 text-stone-500" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-stone-400">{modul.kode}</span>
                    <h4 className="font-semibold text-stone-900">{modul.nama}</h4>
                    <Badge tone={gaya.tone}>{gaya.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">{modul.ringkasan}</p>
                </div>

                <StatusIcon className={`mt-1 h-5 w-5 shrink-0 ${gaya.warna}`} aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
