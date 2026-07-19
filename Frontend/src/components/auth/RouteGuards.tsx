import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../ui/Feedback';
import { Button } from '../ui/Button';
import type { UserRole } from '../../types/auth';

/**
 * Menjaga rute privat.
 *
 * Selama sesi masih dipulihkan, halaman menampilkan indikator memuat — tanpa
 * ini pengguna yang me-refresh halaman akan terlempar sekejap ke layar login
 * meskipun tokennya sebenarnya masih sah.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <LoadingScreen label="Memeriksa sesi Anda…" />;

  if (!isAuthenticated) {
    // Alamat tujuan disimpan agar setelah masuk pengguna kembali ke sana.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

/** Kebalikannya: halaman login tidak perlu dibuka oleh yang sudah masuk. */
export const GuestRoute: React.FC = () => {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <LoadingScreen label="Memeriksa sesi Anda…" />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

/**
 * Pembatas berdasarkan peran.
 *
 * Ini hanya lapisan tampilan. Penegakan yang sesungguhnya ada di middleware
 * `role` pada Laravel — menyembunyikan tombol bukan pengamanan.
 */
export const RoleRoute: React.FC<{ allow: UserRole[] }> = ({ allow }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allow.includes(user.role)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ShieldOff className="h-8 w-8 text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Akses Ditolak</h2>
        <p className="mt-2 max-w-md text-sm text-stone-500">
          Peran <span className="font-semibold text-stone-700">{user.role_label}</span> tidak memiliki
          izin untuk membuka halaman ini. Hubungi Owner jika Anda merasa seharusnya punya akses.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => window.history.back()}
        >
          Kembali
        </Button>
      </div>
    );
  }

  return <Outlet />;
};
