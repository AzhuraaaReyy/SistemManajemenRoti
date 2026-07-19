import React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { PaginationMeta } from '../../types/auth';
import { Button } from '../ui/Button';
import { TableSkeleton } from '../ui/Feedback';

export interface Column<T> {
  key: string;
  header: string;
  /** Isi sel. Kalau tidak diisi, nilai diambil dari properti bernama `key`. */
  render?: (row: T) => React.ReactNode;
  /** Kolom bisa diurutkan; nilainya dikirim sebagai sort_by ke API. */
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Sembunyikan di layar kecil agar tabel tidak terlalu lebar untuk ponsel. */
  hideOnMobile?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  meta?: PaginationMeta | null;
  emptyState?: React.ReactNode;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onPageChange?: (page: number) => void;
  /** Aksi di ujung kanan setiap baris (ubah, hapus, dst). */
  actions?: (row: T) => React.ReactNode;
  minWidth?: string;
}

const PERATAAN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  meta,
  emptyState,
  sortBy,
  sortDir = 'asc',
  onSort,
  onPageChange,
  actions,
  minWidth = '760px',
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={6} cols={columns.length + (actions ? 1 : 0)} />;
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  const IkonUrut = ({ colKey }: { colKey: string }) => {
    if (sortBy !== colKey) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-stone-300" aria-hidden="true" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
    );
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500
                    ${PERATAAN[col.align ?? 'left']}
                    ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  aria-sort={
                    sortBy === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1.5 transition hover:text-stone-800
                        ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                    >
                      {col.header}
                      <IkonUrut colKey={col.key} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}

              {actions && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-stone-500">
                  Aksi
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-stone-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-middle
                      ${PERATAAN[col.align ?? 'left']}
                      ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                  </td>
                ))}

                {actions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && onPageChange && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row">
          <p className="text-xs text-stone-500">
            Menampilkan <span className="font-semibold text-stone-700">{meta.from ?? 0}</span>–
            <span className="font-semibold text-stone-700">{meta.to ?? 0}</span> dari{' '}
            <span className="font-semibold text-stone-700">{meta.total}</span> data
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={meta.current_page <= 1}
              onClick={() => onPageChange(meta.current_page - 1)}
            >
              Sebelumnya
            </Button>

            <span className="px-2 text-xs font-semibold text-stone-600">
              {meta.current_page} / {meta.last_page}
            </span>

            <Button
              variant="secondary"
              size="sm"
              disabled={meta.current_page >= meta.last_page}
              onClick={() => onPageChange(meta.current_page + 1)}
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
