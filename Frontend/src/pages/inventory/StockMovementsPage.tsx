import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, History } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { pesanError } from '../../lib/api';
import { angka, rupiah, tanggalWaktu } from '../../lib/format';
import { inventoryService } from '../../services/inventoryService';
import type { BaseFilters } from '../../types/master';
import type { InventoryOptions, StockMovement } from '../../types/inventory';

/**
 * Riwayat mutasi stok.
 *
 * Membaca `stock_ledger` yang sama dengan modul Pembelian dan Produksi —
 * setiap baris di sini ditulis oleh salah satu modul itu, bukan oleh modul
 * persediaan.
 */
export const StockMovementsPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => inventoryService.movements(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, hasActiveFilters } =
    useResourceList<StockMovement>({
      fetcher,
      initialFilters: { per_page: 10 },
      errorMessage: 'Gagal memuat riwayat mutasi stok.',
    });

  const [options, setOptions] = useState<InventoryOptions | null>(null);
  const [mengekspor, setMengekspor] = useState(false);

  useEffect(() => {
    inventoryService
      .options()
      .then(setOptions)
      .catch(() => toast.error('Gagal memuat pilihan filter.'));
  }, [toast]);

  const ekspor = async () => {
    setMengekspor(true);

    try {
      // Filter yang sedang aktif ikut dikirim — yang diunduh harus sama dengan
      // yang terlihat di layar, bukan seluruh riwayat.
      await inventoryService.exportMovements({
        direction: filters.direction,
        source_type: filters.source_type,
        kind: filters.kind,
        date_from: filters.date_from,
        date_to: filters.date_to,
      });
      toast.success('Riwayat mutasi diunduh sesuai filter yang aktif.');
    } catch (error) {
      toast.error(pesanError(error, 'Gagal mengunduh riwayat.'));
    } finally {
      setMengekspor(false);
    }
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'created_at',
      header: 'Waktu',
      render: (row) => (
        <div className="text-xs">
          <p className="text-stone-700">{tanggalWaktu(row.created_at)}</p>
          <p className="text-stone-400">{row.user_name}</p>
        </div>
      ),
    },
    {
      key: 'item_name',
      header: 'Barang',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-800">{row.item_name}</p>
          <p className="font-mono text-xs text-stone-400">
            {row.item_code} · {row.kind_label}
          </p>
        </div>
      ),
    },
    {
      key: 'direction',
      header: 'Arah',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.direction === 'in'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
              : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
          }`}
        >
          {row.direction === 'in' ? (
            <ArrowDownLeft className="h-3 w-3" />
          ) : (
            <ArrowUpRight className="h-3 w-3" />
          )}
          {row.direction_label}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Jumlah',
      align: 'right',
      render: (row) => (
        <div>
          <p
            className={`font-semibold tabular-nums ${
              row.direction === 'in' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {row.direction === 'in' ? '+' : '−'}
            {angka(row.quantity, 2)}
          </p>
          {/* Saldo sebelum dan sesudah membuat setiap baris bisa diperiksa
              sendiri — inilah yang membuat ledger bisa dipertanggungjawabkan. */}
          <p className="text-[11px] tabular-nums text-stone-400">
            {angka(row.balance_before, 2)} → {angka(row.balance_after, 2)}
          </p>
        </div>
      ),
    },
    {
      key: 'source_type',
      header: 'Sumber',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-stone-700">{row.source_label}</p>
          {row.source_id && (
            <p className="truncate font-mono text-xs text-stone-400">{row.source_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Catatan',
      hideOnMobile: true,
      render: (row) => (
        <div className="max-w-[16rem]">
          <p className="truncate text-xs text-stone-500" title={row.note ?? ''}>
            {row.note ?? '—'}
          </p>
          {row.total_cost !== null && (
            <p className="text-[11px] tabular-nums text-stone-400">
              nilai {rupiah(row.total_cost)}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Mutasi Stok"
        description="Setiap pergerakan stok masuk dan keluar, lengkap dengan asal-usulnya."
        action={
          <Button variant="secondary" icon={Download} onClick={() => void ekspor()} loading={mengekspor}>
            Export Excel
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari catatan atau nomor referensi…"
          dateRange={{
            fromKey: 'date_from',
            toKey: 'date_to',
            fromValue: (filters.date_from as string) ?? '',
            toValue: (filters.date_to as string) ?? '',
            label: 'Tanggal mutasi',
          }}
          onDateChange={(key, value) => setFilter({ [key]: value })}
          selects={[
            {
              key: 'direction',
              label: 'Semua Arah',
              value: (filters.direction as string) ?? '',
              options: [
                { value: 'in', label: 'Masuk' },
                { value: 'out', label: 'Keluar' },
              ],
            },
            {
              key: 'source_type',
              label: 'Semua Sumber',
              value: (filters.source_type as string) ?? '',
              options: (options?.sources ?? []).map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: 'kind',
              label: 'Semua Jenis',
              value: (filters.kind as string) ?? '',
              options: (options?.kinds ?? []).map((k) => ({ value: k.value, label: k.label })),
            },
          ]}
          onSelectChange={(key, value) => setFilter({ [key]: value })}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          meta={meta}
          minWidth="960px"
          onPageChange={goToPage}
          emptyState={
            <EmptyState
              icon={History}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada mutasi'}
              description={
                hasActiveFilters
                  ? 'Tidak ada pergerakan stok yang cocok dengan filter Anda.'
                  : 'Mutasi tercatat otomatis saat barang dibeli, dipakai produksi, atau disesuaikan.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <p className="text-xs text-stone-400">
        Riwayat bersifat append-only: baris yang sudah tercatat tidak pernah diubah atau dihapus.
        Koreksi dilakukan dengan menambah mutasi penyesuaian baru, sehingga jejak aslinya tetap ada.
      </p>
    </div>
  );
};
