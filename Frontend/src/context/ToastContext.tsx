import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const GAYA: Record<ToastType, { wrapper: string; icon: React.ElementType; iconColor: string }> = {
  success: { wrapper: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2, iconColor: 'text-emerald-600' },
  error: { wrapper: 'border-red-200 bg-red-50', icon: XCircle, iconColor: 'text-red-600' },
  warning: { wrapper: 'border-amber-200 bg-amber-50', icon: AlertTriangle, iconColor: 'text-amber-600' },
  info: { wrapper: 'border-sky-200 bg-sky-50', icon: Info, iconColor: 'text-sky-600' },
};

let idBerikutnya = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hapus = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const tampilkan = useCallback(
    (type: ToastType, message: string) => {
      const id = idBerikutnya++;
      setToasts((list) => [...list, { id, type, message }]);
      // Pesan error diberi waktu baca lebih lama karena biasanya lebih panjang
      // dan pengguna perlu memahaminya sebelum mencoba lagi.
      window.setTimeout(() => hapus(id), type === 'error' ? 6000 : 4000);
    },
    [hapus],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => tampilkan('success', m),
      error: (m) => tampilkan('error', m),
      warning: (m) => tampilkan('warning', m),
      info: (m) => tampilkan('info', m),
    }),
    [tampilkan],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="fixed top-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-live="polite"
        aria-label="Notifikasi"
      >
        {toasts.map((toast) => {
          const gaya = GAYA[toast.type];
          const Icon = gaya.icon;

          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg shadow-stone-900/5 animate-toast-in ${gaya.wrapper}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${gaya.iconColor}`} />
              <p className="flex-1 text-sm font-medium leading-snug text-stone-800">{toast.message}</p>
              <button
                type="button"
                onClick={() => hapus(toast.id)}
                className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-white/60 hover:text-stone-700"
                aria-label="Tutup notifikasi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
};
