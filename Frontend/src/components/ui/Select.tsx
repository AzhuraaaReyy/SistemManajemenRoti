import React, { forwardRef, useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className="w-full">
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-stone-700">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>

        <div className="relative">
          <select
            {...props}
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={`w-full appearance-none rounded-lg border bg-white py-2.5 pl-3 pr-9 text-sm text-stone-900 shadow-sm transition
              focus:outline-none focus:ring-2
              disabled:cursor-not-allowed disabled:bg-stone-50
              ${
                error
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                  : 'border-stone-300 focus:border-yellow-500 focus:ring-yellow-200'
              } ${className}`}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
