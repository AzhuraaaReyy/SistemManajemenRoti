import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Boxes,
  ChefHat,
  ClipboardList,
  Cookie,
  Database,
  Factory,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SubMenuItem {
  /** Harus cocok dengan kunci daun di UserRole::allowedMenus() pada backend. */
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
}

interface MenuItem {
  /** Harus cocok dengan nilai di UserRole::allowedMenus() pada backend. */
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
  /** Modul yang belum dikerjakan ditandai agar harapan pengguna tetap realistis. */
  segera?: boolean;
  /** Sub-menu; induknya menjadi judul kelompok, bukan tautan. */
  children?: SubMenuItem[];
}

/*
| Sejak peran Admin Produksi dipecah menjadi Admin Gudang dan Kepala Produksi,
| izin menu berbutir sampai tingkat SUB-MENU.
|
| Master Data adalah alasannya: gudang mengurus supplier dan bahan baku, dapur
| mengurus produk dan resep. Dengan izin setingkat induk saja, keduanya akan
| melihat kelima sub-menu — termasuk yang ujungnya ditolak server. Menu yang
| menjanjikan halaman lalu menampilkan 403 lebih membingungkan daripada menu
| yang memang tidak ada.
*/
const SEMUA_MENU: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  {
    key: 'master',
    label: 'Master Data',
    path: '/master',
    icon: Database,
    children: [
      { key: 'master.kategori', label: 'Kategori', path: '/master/kategori', icon: FolderTree },
      { key: 'master.supplier', label: 'Supplier', path: '/master/supplier', icon: Truck },
      { key: 'master.bahan-baku', label: 'Bahan Baku', path: '/master/bahan-baku', icon: Package },
      { key: 'master.produk', label: 'Produk', path: '/master/produk', icon: Cookie },
      { key: 'master.resep', label: 'Resep (BOM)', path: '/master/resep', icon: BookOpen },
    ],
  },
  {
    key: 'persediaan',
    label: 'Persediaan',
    path: '/persediaan',
    icon: Boxes,
    children: [
      { key: 'persediaan.dashboard', label: 'Dashboard', path: '/persediaan/dashboard', icon: LayoutDashboard },
      { key: 'persediaan.stok', label: 'Ringkasan Stok', path: '/persediaan/stok', icon: Boxes },
      { key: 'persediaan.mutasi', label: 'Riwayat Mutasi', path: '/persediaan/mutasi', icon: History },
    ],
  },
  {
    key: 'produksi',
    label: 'Produksi',
    path: '/produksi',
    icon: ChefHat,
    children: [
      { key: 'produksi.dashboard', label: 'Dashboard', path: '/produksi/dashboard', icon: LayoutDashboard },
      { key: 'produksi.batch', label: 'Batch Produksi', path: '/produksi/batch', icon: Factory },
    ],
  },
  {
    key: 'pembelian',
    label: 'Pembelian',
    path: '/pembelian',
    icon: ShoppingBag,
    children: [
      { key: 'pembelian.dashboard', label: 'Dashboard', path: '/pembelian/dashboard', icon: LayoutDashboard },
      { key: 'pembelian.pesanan', label: 'Pesanan', path: '/pembelian/pesanan', icon: ClipboardList },
      { key: 'pembelian.penerimaan', label: 'Penerimaan', path: '/pembelian/penerimaan', icon: PackageCheck },
    ],
  },
  {
    key: 'penjualan',
    label: 'Penjualan',
    path: '/penjualan',
    icon: ShoppingCart,
    children: [
      { key: 'penjualan.kasir', label: 'Kasir (POS)', path: '/penjualan/kasir', icon: Store },
      { key: 'penjualan.riwayat', label: 'Riwayat', path: '/penjualan/riwayat', icon: Receipt },
      { key: 'penjualan.dashboard', label: 'Dashboard', path: '/penjualan/dashboard', icon: LayoutDashboard },
    ],
  },
  { key: 'laporan', label: 'Laporan', path: '/laporan', icon: BarChart3 },
  { key: 'pengguna', label: 'Manajemen Pengguna', path: '/pengguna', icon: Users },
  { key: 'pengaturan', label: 'Pengaturan', path: '/pengaturan', icon: Settings },
];

interface SidebarProps {
  /** Terbuka sebagai laci geser di layar kecil. */
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();

  /*
  | Daftar menu berasal dari peran yang dikirim server, bukan dari daftar
  | statis di frontend — satu sumber kebenaran di enum UserRole::allowedMenus().
  |
  | `?? []` bukan hiasan. Tanpa itu, balasan server yang tidak memuat
  | `allowed_menus` — versi API yang lebih tua, atau perubahan bentuk balasan —
  | membuat baris ini melempar galat dan menumbangkan seluruh halaman. Dengan
  | itu, menunya menyusut menjadi kosong: gagal ke arah aman, tidak pernah
  | membuka menu yang bukan haknya.
  */
  const izin = user?.allowed_menus ?? [];

  /*
  | Penyaringan dua tingkat.
  |
  | Sub-menu disaring lebih dulu, lalu induk yang kehabisan anak ikut hilang.
  | Urutannya penting: menyaring induk saja akan menampilkan kelompok "Master
  | Data" berisi lima tautan yang sebagian ditolak server, sedangkan menyaring
  | anak saja akan menyisakan judul kelompok kosong tanpa satu pun tautan di
  | bawahnya.
  */
  const menu = SEMUA_MENU.map((item) =>
    item.children
      ? { ...item, children: item.children.filter((sub) => izin.includes(sub.key)) }
      : item,
  ).filter((item) => (item.children ? item.children.length > 0 : izin.includes(item.key)));

  return (
    <>
      {/* Latar gelap saat laci terbuka di ponsel */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-stone-900/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col justify-between border-r border-stone-800 bg-stone-900 text-stone-200 transition-transform duration-300
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-stone-800 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-600 text-lg font-bold tracking-wider text-white shadow-inner">
                R
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none tracking-tight text-white">RotiApp</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  UMKM Manufaktur
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white lg:hidden"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/*
            Peran yang sedang aktif ditulis di kepala menu.

            Ini bukan sekadar hiasan: tanpa penanda ini, menu yang keliru
            (misalnya sesi lama yang masih tersimpan di tab lain) terlihat
            persis sama dengan menu yang benar. Dengan label peran di sini,
            ketidakcocokan langsung terlihat pada pandangan pertama.
          */}
          <div className="border-b border-stone-800 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Menu untuk
            </p>
            <p className="mt-0.5 text-sm font-semibold text-yellow-600">
              {user?.role_label ?? 'Belum masuk'}
              <span className="ml-1.5 text-xs font-normal text-stone-500">
                · {menu.length} menu
              </span>
            </p>
          </div>

          <nav className="space-y-1 p-4" aria-label="Menu utama">
            {menu.map(({ key, label, path, icon: Icon, segera, children }) => {
              // Menu bersub-menu tampil sebagai judul kelompok, bukan tautan —
              // /master sendiri tidak punya halaman.
              if (children) {
                return (
                  <div key={key} className="pt-2 first:pt-0">
                    <p className="flex items-center gap-2 px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </p>

                    <div className="space-y-0.5">
                      {children.map((sub) => {
                        const SubIcon = sub.icon;

                        return (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex w-full items-center gap-3 rounded-lg py-2.5 pl-5 pr-4 text-sm font-medium transition-all duration-200 ${
                                isActive
                                  ? 'bg-yellow-800 text-white shadow-md'
                                  : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <SubIcon
                                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`}
                                />
                                <span className="flex-1 text-left">{sub.label}</span>
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={key}
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-yellow-800 text-white shadow-md'
                        : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                      <span className="flex-1 text-left">{label}</span>
                      {segera && (
                        <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">
                          Segera
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Kartu pengguna */}
        <div className="border-t border-stone-800 bg-stone-950/50 p-4">
          <NavLink
            to="/profil"
            onClick={onClose}
            className="mb-2 flex items-center gap-3 rounded-lg p-2 transition hover:bg-stone-800"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-stone-700"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-700 text-xs font-bold text-white">
                {user?.initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight text-stone-100">{user?.name}</p>
              <span className="text-[10px] font-medium uppercase tracking-wide text-yellow-600">
                {user?.role_label}
              </span>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-stone-400 transition hover:bg-red-950/50 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
};
