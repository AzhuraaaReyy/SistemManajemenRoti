import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-xl font-bold tracking-tight text-stone-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  hint?: string;
}

const TONE = {
  neutral: 'bg-stone-100 text-stone-600',
  success: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}) => (
  <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONE[tone]}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="truncate text-2xl font-bold tabular-nums text-stone-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-stone-400">{hint}</p>}
    </div>
  </div>
);
