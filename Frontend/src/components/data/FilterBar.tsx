import React from 'react';
import { CalendarRange, Search, X } from 'lucide-react';

export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

export interface FilterDateRange {
  /** Nama parameter yang dikirim ke API, misal 'date_from' dan 'date_to'. */
  fromKey: string;
  toKey: string;
  fromValue: string;
  toValue: string;
  label?: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  onSelectChange?: (key: string, value: string) => void;
  /** Rentang tanggal; kosongkan bila daftar ini tidak berbasis tanggal. */
  dateRange?: FilterDateRange;
  onDateChange?: (key: string, value: string) => void;
  hasActiveFilters?: boolean;
  onReset?: () => void;
}

/**
 * Baris pencarian dan penyaring di atas tabel.
 *
 * Nilai dikendalikan sepenuhnya oleh induknya (useResourceList), sehingga
 * jeda pengetikan hanya diatur di satu tempat.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Cari…',
  selects = [],
  onSelectChange,
  dateRange,
  onDateChange,
  hasActiveFilters = false,
  onReset,
}) => (
  <div className="flex flex-col gap-3 border-b border-stone-200 p-4 xl:flex-row xl:items-center">
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
      />
    </div>

    {dateRange && (
      <div className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 shadow-sm">
        <CalendarRange className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />

        <input
          type="date"
          value={dateRange.fromValue}
          max={dateRange.toValue || undefined}
          onChange={(e) => onDateChange?.(dateRange.fromKey, e.target.value)}
          aria-label={`${dateRange.label ?? 'Tanggal'} dari`}
          className="w-[8.5rem] border-0 bg-transparent p-0 text-sm text-stone-700 focus:outline-none focus:ring-0"
        />

        <span className="shrink-0 text-stone-300" aria-hidden="true">
          –
        </span>

        <input
          type="date"
          value={dateRange.toValue}
          min={dateRange.fromValue || undefined}
          onChange={(e) => onDateChange?.(dateRange.toKey, e.target.value)}
          aria-label={`${dateRange.label ?? 'Tanggal'} sampai`}
          className="w-[8.5rem] border-0 bg-transparent p-0 text-sm text-stone-700 focus:outline-none focus:ring-0"
        />

        {/* Tombol bersih khusus rentang tanggal — menghapus keduanya sekaligus
            tanpa mengganggu filter lain yang sedang aktif. */}
        {(dateRange.fromValue || dateRange.toValue) && (
          <button
            type="button"
            onClick={() => {
              onDateChange?.(dateRange.fromKey, '');
              onDateChange?.(dateRange.toKey, '');
            }}
            className="shrink-0 rounded p-0.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Hapus filter tanggal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )}

    {selects.length > 0 && (
      <div className="flex flex-wrap gap-3">
        {selects.map((s) => (
          <select
            key={s.key}
            value={s.value}
            onChange={(e) => onSelectChange?.(s.key, e.target.value)}
            aria-label={s.label}
            className="min-w-[9rem] flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 xl:flex-none"
          >
            <option value="">{s.label}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    )}

    {hasActiveFilters && onReset && (
      <button
        type="button"
        onClick={onReset}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <X className="h-4 w-4" />
        Hapus Filter
      </button>
    )}
  </div>
);
