import React, { useCallback, useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { angka, rupiah, tanggal } from '../../lib/format';
import { supplierService } from '../../services/masterService';
import { purchaseService } from '../../services/purchaseService';
import type { BaseFilters, SelectOption } from '../../types/master';
import type { PurchaseReceipt } from '../../types/purchase';

/**
 * Riwayat kedatangan barang lintas pesanan.
 *
 * Menjawab pertanyaan "barang apa saja yang masuk gudang minggu ini?" —
 * pertanyaan yang sulit dijawab dari daftar pesanan, karena satu pesanan
 * bisa datang beberapa kali.
 */
export const ReceiptHistoryPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => purchaseService.receipts(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, hasActiveFilters } =
    useResourceList<PurchaseReceipt>({
      fetcher,
      initialFilters: { per_page: 10 },
      errorMessage: 'Gagal memuat riwayat penerimaan.',
    });

  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);

  useEffect(() => {
    supplierService
      .options()
      .then(setSuppliers)
      .catch(() => toast.error('Gagal memuat pilihan supplier.'));
  }, [toast]);

  const columns: Column<PurchaseReceipt>[] = [
    {
      key: 'receipt_number',
      header: 'Penerimaan',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-stone-900">{row.receipt_number}</p>
          <p className="text-xs text-stone-500">
            dari <span className="font-mono">{row.po_number}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'receipt_date',
      header: 'Tanggal',
      render: (row) => <span className="text-stone-700">{tanggal(row.receipt_date)}</span>,
    },
    {
      key: 'items',
      header: 'Barang Diterima',
      render: (row) => (
        <ul className="space-y-0.5 text-xs">
          {row.items?.slice(0, 3).map((i) => (
            <li key={i.id} className="text-stone-600">
              {i.ingredient_name}{' '}
              <span className="tabular-nums text-stone-400">
                {angka(i.quantity_display)} {i.unit}
              </span>
            </li>
          ))}
          {(row.items?.length ?? 0) > 3 && (
            <li className="text-stone-400">+{(row.items?.length ?? 0) - 3} lainnya</li>
          )}
        </ul>
      ),
    },
    {
      key: 'delivery_note_number',
      header: 'Surat Jalan',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-stone-500">{row.delivery_note_number ?? '—'}</span>
      ),
    },
    {
      key: 'received_by_name',
      header: 'Diterima Oleh',
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-stone-500">{row.received_by_name ?? '—'}</span>,
    },
    {
      key: 'total_value',
      header: 'Nilai',
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-stone-900">{rupiah(row.total_value)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Penerimaan Barang"
        description="Seluruh kedatangan barang dari supplier, lintas pesanan."
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nomor penerimaan, pesanan, atau surat jalan…"
          dateRange={{
            fromKey: 'date_from',
            toKey: 'date_to',
            fromValue: (filters.date_from as string) ?? '',
            toValue: (filters.date_to as string) ?? '',
            label: 'Tanggal terima',
          }}
          onDateChange={(key, value) => setFilter({ [key]: value })}
          selects={[
            {
              key: 'supplier_id',
              label: 'Semua Supplier',
              value: (filters.supplier_id as string) ?? '',
              options: suppliers.map((s) => ({ value: String(s.value), label: s.label })),
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
          minWidth="880px"
          onPageChange={goToPage}
          emptyState={
            <EmptyState
              icon={PackageCheck}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada penerimaan barang'}
              description={
                hasActiveFilters
                  ? 'Tidak ada penerimaan yang cocok dengan filter Anda.'
                  : 'Riwayat akan terisi setiap kali Anda mencatat kedatangan barang dari supplier.'
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
    </div>
  );
};
