import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute, RoleRoute } from './components/auth/RouteGuards';
import { LoadingScreen } from './components/ui/Feedback';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';

/*
| Pemecahan kode per rute.
|
| Halaman login dimuat langsung karena itulah yang pertama dilihat pengguna.
| Sisanya dimuat saat rutenya dibuka, sehingga menambah modul baru tidak
| memperbesar berkas yang harus diunduh di awal.
|
| Tanpa ini, bundel sudah menembus 500 KB pada modul ketiga dan akan terus
| membengkak seiring modul produksi, penjualan, dan laporan menyusul.
*/
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const ComingSoonPage = lazy(() =>
  import('./pages/ComingSoonPage').then((m) => ({ default: m.ComingSoonPage })),
);

// Modul 2 — Master Data
const CategoriesPage = lazy(() =>
  import('./pages/master/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const SuppliersPage = lazy(() =>
  import('./pages/master/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);
const IngredientsPage = lazy(() =>
  import('./pages/master/IngredientsPage').then((m) => ({ default: m.IngredientsPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/master/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const RecipesPage = lazy(() =>
  import('./pages/master/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);

// Modul 3 — Pembelian
const PurchaseDashboardPage = lazy(() =>
  import('./pages/purchase/PurchaseDashboardPage').then((m) => ({ default: m.PurchaseDashboardPage })),
);
const PurchaseOrdersPage = lazy(() =>
  import('./pages/purchase/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })),
);
const ReceiptHistoryPage = lazy(() =>
  import('./pages/purchase/ReceiptHistoryPage').then((m) => ({ default: m.ReceiptHistoryPage })),
);

// Modul 4 — Produksi
const ProductionDashboardPage = lazy(() =>
  import('./pages/production/ProductionDashboardPage').then((m) => ({
    default: m.ProductionDashboardPage,
  })),
);
const ProductionBatchesPage = lazy(() =>
  import('./pages/production/ProductionBatchesPage').then((m) => ({
    default: m.ProductionBatchesPage,
  })),
);

// Modul 5 — Tracking Produksi
const ProductionTrackingPage = lazy(() =>
  import('./pages/production/ProductionTrackingPage').then((m) => ({
    default: m.ProductionTrackingPage,
  })),
);

// Modul 6 — Inventory Management
const InventoryDashboardPage = lazy(() =>
  import('./pages/inventory/InventoryDashboardPage').then((m) => ({
    default: m.InventoryDashboardPage,
  })),
);
const StockItemsPage = lazy(() =>
  import('./pages/inventory/StockItemsPage').then((m) => ({ default: m.StockItemsPage })),
);
const StockMovementsPage = lazy(() =>
  import('./pages/inventory/StockMovementsPage').then((m) => ({ default: m.StockMovementsPage })),
);

// Modul 7 — Penjualan (POS)
const PosPage = lazy(() => import('./pages/sales/PosPage').then((m) => ({ default: m.PosPage })));
const SalesHistoryPage = lazy(() =>
  import('./pages/sales/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })),
);
const SalesDashboardPage = lazy(() =>
  import('./pages/sales/SalesDashboardPage').then((m) => ({ default: m.SalesDashboardPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

/**
 * Susunan rute.
 *
 *   GuestRoute      -> hanya untuk yang belum masuk (login, lupa sandi)
 *   ProtectedRoute  -> butuh token JWT yang sah
 *   RoleRoute       -> pembatas tambahan berdasarkan peran
 *
 * ToastProvider berada di luar AuthProvider agar notifikasi tetap bisa tampil
 * meskipun terjadi kegagalan saat memulihkan sesi.
 */
const App: React.FC = () => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen label="Memuat halaman…" />}>
          <Routes>
            {/* --- Publik --- */}
            <Route element={<GuestRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>
            </Route>

            {/* --- Privat --- */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profil" element={<ProfilePage />} />

                {/* Khusus Owner */}
                <Route element={<RoleRoute allow={['owner']} />}>
                  <Route path="/pengguna" element={<UsersPage />} />
                  <Route path="/pengaturan" element={<SettingsPage />} />
                </Route>

                {/*
                  Modul 7 — Penjualan (POS).
                  Kasir dan Owner. Admin Produksi tidak berjualan.
                */}
                <Route element={<RoleRoute allow={['owner', 'kasir']} />}>
                  <Route path="/penjualan" element={<Navigate to="/penjualan/kasir" replace />} />
                  <Route path="/penjualan/kasir" element={<PosPage />} />
                  <Route path="/penjualan/riwayat" element={<SalesHistoryPage />} />
                  <Route path="/penjualan/dashboard" element={<SalesDashboardPage />} />
                </Route>

                {/*
                  Modul 2 — Master Data.
                  Kasir tidak diberi akses: ia hanya butuh daftar produk untuk
                  menjual, dan itu disediakan endpoint penjualan pada Modul 6.
                */}
                <Route element={<RoleRoute allow={['owner', 'admin_produksi']} />}>
                  <Route path="/master" element={<Navigate to="/master/bahan-baku" replace />} />
                  <Route path="/master/kategori" element={<CategoriesPage />} />
                  <Route path="/master/supplier" element={<SuppliersPage />} />
                  <Route path="/master/bahan-baku" element={<IngredientsPage />} />
                  <Route path="/master/produk" element={<ProductsPage />} />
                  <Route path="/master/resep" element={<RecipesPage />} />

                  {/* Modul 3 — Pembelian Bahan Baku */}
                  <Route path="/pembelian" element={<Navigate to="/pembelian/dashboard" replace />} />
                  <Route path="/pembelian/dashboard" element={<PurchaseDashboardPage />} />
                  <Route path="/pembelian/pesanan" element={<PurchaseOrdersPage />} />
                  <Route path="/pembelian/penerimaan" element={<ReceiptHistoryPage />} />

                  {/* Modul 4 — Produksi (Bill of Materials) */}
                  <Route path="/produksi" element={<Navigate to="/produksi/dashboard" replace />} />
                  <Route path="/produksi/dashboard" element={<ProductionDashboardPage />} />
                  <Route path="/produksi/batch" element={<ProductionBatchesPage />} />

                  {/*
                    Modul 5 — Tracking Produksi.
                    Didaftarkan setelah /produksi/batch agar rute daftar tidak
                    tertangkap pola :id.
                  */}
                  <Route path="/produksi/batch/:id" element={<ProductionTrackingPage />} />

                  {/* Modul 6 — Inventory Management */}
                  <Route path="/persediaan" element={<Navigate to="/persediaan/dashboard" replace />} />
                  <Route path="/persediaan/dashboard" element={<InventoryDashboardPage />} />
                  <Route path="/persediaan/stok" element={<StockItemsPage />} />
                  <Route path="/persediaan/mutasi" element={<StockMovementsPage />} />
                </Route>

                {/*
                  Modul yang belum dikerjakan (M5–M10).

                  Komponen prototipe di src/components/ sengaja BELUM dipasang.
                  Keputusan iterasi 1: setiap komponen disambungkan sekali saja,
                  langsung ke API sungguhan pada modulnya masing-masing.

                    /laporan → M10, laporan laba kotor

                  BOM.tsx        digantikan /master/resep   (M2)
                  Purchasing.tsx digantikan /pembelian/*    (M3)
                  Production.tsx digantikan /produksi/*     (M4)
                  Dashboard.tsx  digantikan /persediaan/*   (M6)
                  POS.tsx        digantikan /penjualan/*    (M7)
                */}
                <Route path="/laporan" element={<ComingSoonPage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
