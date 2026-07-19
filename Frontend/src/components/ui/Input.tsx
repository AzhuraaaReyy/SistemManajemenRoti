import React, { forwardRef, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ElementType;
}

/**
 * Field input dengan label, ikon, pesan error, dan tombol lihat/sembunyikan
 * untuk tipe password. Meneruskan ref agar bisa dipakai React Hook Form.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon: Icon, type = 'text', className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    const [terlihat, setTerlihat] = useState(false);
    const isPassword = type === 'password';
    const tipeAktual = isPassword && terlihat ? 'text' : type;

    return (
      <div className="w-full">
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-stone-700">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>

        <div className="relative">
          {Icon && (
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
          )}

          <input
            {...props}
            ref={ref}
            id={inputId}
            type={tipeAktual}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={`w-full rounded-lg border bg-white py-2.5 text-sm text-stone-900 shadow-sm transition
              placeholder:text-stone-400
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500
              ${Icon ? 'pl-9' : 'pl-3'}
              ${isPassword ? 'pr-10' : 'pr-3'}
              ${
                error
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                  : 'border-stone-300 focus:border-yellow-500 focus:ring-yellow-200'
              } ${className}`}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setTerlihat((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              tabIndex={-1}
            >
              {terlihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="mt-1.5 text-xs text-stone-500">
              {hint}
            </p>
          )
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
