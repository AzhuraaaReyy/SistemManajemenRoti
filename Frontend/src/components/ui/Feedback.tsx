import React from 'react';
import { Loader2 } from 'lucide-react';

/** Indikator memuat yang mengisi seluruh area konten. */
export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Memuat…' }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-stone-500">
    <Loader2 className="h-8 w-8 animate-spin text-yellow-600" aria-hidden="true" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

/** Baris-baris abu-abu berdenyut sebagai pengganti tabel yang sedang dimuat. */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="animate-pulse space-y-3 p-4" aria-hidden="true">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-4 flex-1 rounded bg-stone-200" />
        ))}
      </div>
    ))}
  </div>
);

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
      <Icon className="h-7 w-7 text-stone-400" aria-hidden="true" />
    </div>
    <h3 className="text-base font-bold text-stone-800">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  neutral: 'bg-stone-100 text-stone-700 ring-stone-500/20',
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[tone]}`}
  >
    {children}
  </span>
);
