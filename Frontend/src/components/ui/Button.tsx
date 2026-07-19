import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ElementType;
  fullWidth?: boolean;
}

const VARIAN: Record<Variant, string> = {
  primary:
    'bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-yellow-500 disabled:bg-yellow-600/50',
  secondary:
    'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 focus-visible:ring-stone-400 disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-600/50',
  ghost:
    'bg-transparent text-stone-600 hover:bg-stone-100 focus-visible:ring-stone-400 disabled:opacity-50',
};

const UKURAN: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}) => (
  <button
    {...props}
    disabled={disabled || loading}
    aria-busy={loading}
    className={`inline-flex items-center justify-center rounded-lg font-semibold shadow-sm transition-all
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:cursor-not-allowed ${VARIAN[variant]} ${UKURAN[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
  >
    {loading ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : (
      Icon && <Icon className="h-4 w-4" aria-hidden="true" />
    )}
    {children}
  </button>
);
