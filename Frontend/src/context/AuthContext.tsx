import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setSessionExpiredHandler } from '../lib/api';
import { lastEmailStorage, tokenStorage } from '../lib/storage';
import { authService } from '../services/authService';
import type { LoginCredentials, User, UserRole } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  /** true selama pemulihan sesi awal saat aplikasi pertama dibuka. */
  initializing: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canAccess: (menu: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  /**
   * Pemulihan sesi.
   *
   * Data pengguna sengaja TIDAK disimpan di localStorage lalu dipercaya begitu
   * saja — kalau peran seseorang diubah Owner, salinan lama akan membuat menu
   * yang salah tetap muncul. Token diverifikasi ulang ke server setiap kali
   * aplikasi dibuka, dan server yang menjadi sumber kebenaran.
   */
  useEffect(() => {
    let dibatalkan = false;

    const pulihkanSesi = async () => {
      if (!tokenStorage.get()) {
        setInitializing(false);
        return;
      }

      try {
        const profil = await authService.me();
        if (!dibatalkan) setUserState(profil);
      } catch {
        tokenStorage.clear();
      } finally {
        if (!dibatalkan) setInitializing(false);
      }
    };

    void pulihkanSesi();

    return () => {
      dibatalkan = true;
    };
  }, []);

  // Dipanggil interceptor axios ketika token tidak bisa diperbarui lagi.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      tokenStorage.clear();
      setUserState(null);
    });
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    const payload = await authService.login(credentials);

    tokenStorage.set(payload.access_token, credentials.remember ?? false);
    lastEmailStorage.set(credentials.email);
    setUserState(payload.user);

    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Server mungkin tidak terjangkau. Sesi lokal tetap dibersihkan supaya
      // tombol keluar tidak pernah terasa "macet" bagi pengguna.
    } finally {
      tokenStorage.clear();
      setUserState(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAuthenticated: !!user,
      login,
      logout,
      setUser: setUserState,
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
      canAccess: (menu) => user?.allowed_menus.includes(menu) ?? false,
    }),
    [user, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
};
