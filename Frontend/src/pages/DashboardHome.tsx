import React, { Suspense, lazy } from 'react';
import { LoadingScreen } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

const OwnerDashboardPage = lazy(() =>
  import('./OwnerDashboardPage').then((m) => ({ default: m.OwnerDashboardPage })),
);
const DashboardPage = lazy(() =>
  import('./DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

/**
 * Beranda `/dashboard`, dipilih menurut peran.
 *
 * Owner mendapat ringkasan lintas modul; peran lain mendapat halaman beranda
 * yang lama. Dipilih di sini, bukan lewat dua entri menu terpisah, supaya
 * "Dashboard" di bilah samping selalu berarti "beranda saya" — Owner tidak
 * perlu memilih di antara dua dashboard yang terdengar mirip.
 *
 * Keduanya dimuat malas, jadi peran non-Owner tidak ikut mengunduh Recharts
 * yang hanya dipakai halaman Owner.
 */
export const DashboardHome: React.FC = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<LoadingScreen label="Memuat dashboard…" />}>
      {user?.role === 'owner' ? <OwnerDashboardPage /> : <DashboardPage />}
    </Suspense>
  );
};
