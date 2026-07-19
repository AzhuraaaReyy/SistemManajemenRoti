import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Receipt, ReceiptText } from 'lucide-react';
import { ReceiptModal } from '../../components/sales/ReceiptModal';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { pesanError } from '../../lib/api';
import { rupiah, tanggalWaktu } from '../../lib/format';
import { salesService } from '../../services/salesService';
import type { BaseFilters } from '../../types/master';
import type { PosSettings, Sale, SalesOptions } from '../../types/sales';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const SalesHistoryPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();

  const kasir = user?.role === 'kasir';

  const fetcher = useCallback((f: BaseFilters) => salesService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Sale>({
      fetcher,
      initialFilters: { sort_by: 'created_at', sort_dir: 'desc', per_page: 15 },
      errorMessage: 'Gagal memuat riwayat penjualan.',
    });

  const [options, setOptions] = useState<SalesOptions | null>(null);
  const [struk, setStruk] = useState<{ sale: Sale; settings: PosSettings } | null>(null);
  const [batal, setBatal] = useState<{ sale: Sale | null; alasan: string }>({
    sale: null,
    alasan: '',
  });
  const [proses, setProses] = useState(false);

  useEffect(() => {
    salesService
      .options()
      .then(setOptions)
      .catch(() => toast.error('Gagal memuat pilihan filter.'));
  }, [toast]);

  const bukaStruk = async (id: number) => {
    try {
      setStruk(await salesService.show(id));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat detail transaksi.'));
    }
  };

  const jalankanBatal = async () => {
    if (!batal.sale) return;

    if (batal.alasan.trim().length < 5) {
      toast.warning('Isi alasan pembatalan minimal 5 karakter.');
      return;
    }

    setProses(true);

    try {
      const { message } = await salesService.void(batal.sale.id, batal.alasan.trim());
      toast.success(message);
      setBatal({ sale: null, alasan: '' });
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const columns: Column<Sale>[] = [
    {
      key: 'sale_number',
      header: 'Transaksi',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-stone-900">{row.sale_number}</p>
          <p className="truncate text-xs text-stone-500">
            {tanggalWaktu(row.created_at)}
            {row.customer_name && ` · ${row.customer_name}`}
          </p>
        </div>
      ),
    },
    {
      key: 'cashier_name',
      header: 'Kasir',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-stone-700">{row.cashier_name ?? '—'}</span>,
    },
    {
      key: 'items_count',
      header: 'Item',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm tabular-nums text-stone-600">{row.items_count ?? '—'}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Bayar',
      render: (row) => <Badge tone={TONE[row.payment_tone] ?? 'neutral'}>{row.payment_label}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={TONE[row.status_tone] ?? 'neutral'}>{row.status_label}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div>
          <p
            className={`font-bold tabular-nums ${
              row.status === 'voided' ? 'text-stone-400 line-through' : 'text-stone-900'
            }`}
          >
            {rupiah(row.total)}
          </p>
          {row.discount_amount > 0 && (
            <p className="text-xs tabular-nums text-amber-600">
              diskon {rupiah(row.discount_amount)}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Penjualan"
        description={
          kasir
            ? 'Transaksi yang Anda buat. Tutup kasir dihitung dari daftar ini.'
            : 'Seluruh transaksi penjualan dari semua kasir.'
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nomor transaksi, pelanggan, atau catatan…"
          dateRange={{
            fromKey: 'date_from',
            toKey: 'date_to',
            fromValue: (filters.date_from as string) ?? '',
            toValue: (filters.date_to as string) ?? '',
            label: 'Tanggal transaksi',
          }}
          onDateChange={(key, value) => setFilter({ [key]: value })}
          selects={[
            {
              key: 'status',
              label: 'Semua Status',
              value: (filters.status as string) ?? '',
              options: (options?.statuses ?? []).map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: 'payment_method',
              label: 'Semua Metode',
              value: (filters.payment_method as string) ?? '',
              options: (options?.payment_methods ?? []).map((m) => ({
                value: m.value,
                label: m.label,
              })),
            },
            // Kasir tidak diberi filter kasir — ia memang hanya melihat
            // transaksinya sendiri, jadi pilihannya akan selalu satu.
            ...(kasir
              ? []
              : [
                  {
                    key: 'cashier_id',
                    label: 'Semua Kasir',
                    value: (filters.cashier_id as string) ?? '',
                    options: (options?.cashiers ?? []).map((c) => ({
                      value: String(c.value),
                      label: c.label,
                    })),
                  },
                ]),
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
          sortBy={filters.sort_by as string}
          sortDir={filters.sort_dir as 'asc' | 'desc'}
          onSort={(key) =>
            setFilter({
              sort_by: key,
              sort_dir: filters.sort_by === key && filters.sort_dir === 'asc' ? 'desc' : 'asc',
            })
          }
          onPageChange={goToPage}
          emptyState={
            <EmptyState
              icon={Receipt}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada transaksi'}
              description={
                hasActiveFilters
                  ? 'Tidak ada transaksi yang cocok dengan filter Anda.'
                  : 'Transaksi akan muncul di sini setelah penjualan pertama dicatat di kasir.'
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
          actions={(row) => (
            <>
              <button
                type="button"
                onClick={() => void bukaStruk(row.id)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Lihat struk ${row.sale_number}`}
                title="Lihat / cetak ulang struk"
              >
                <ReceiptText className="h-4 w-4" />
              </button>

              {/* Tombol batal hanya muncul untuk Owner — server menolak Kasir
                  dengan 403, jadi menampilkannya hanya akan menyesatkan. */}
              {row.can_void && !kasir && (
                <button
                  type="button"
                  onClick={() => setBatal({ sale: row, alasan: '' })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Batalkan ${row.sale_number}`}
                  title="Batalkan — stok dikembalikan"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        />
      </div>

      <ReceiptModal
        open={!!struk}
        sale={struk?.sale ?? null}
        settings={struk?.settings ?? null}
        onClose={() => setStruk(null)}
      />

      <Modal
        open={!!batal.sale}
        onClose={() => setBatal({ sale: null, alasan: '' })}
        size="sm"
        title="Batalkan Transaksi?"
        description={batal.sale?.sale_number}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setBatal({ sale: null, alasan: '' })}
              disabled={proses}
            >
              Kembali
            </Button>
            <Button variant="danger" onClick={() => void jalankanBatal()} loading={proses}>
              Ya, Batalkan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Stok produk akan <strong className="text-stone-900">dikembalikan</strong> dan
            transaksinya tidak lagi dihitung sebagai omzet.
          </p>

          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Gunakan ini hanya untuk <strong>kesalahan pencatatan</strong> — salah ketik jumlah,
            salah produk, atau transaksi tercatat dua kali. Untuk barang yang benar-benar
            dikembalikan pelanggan, gunakan modul Retur agar sebabnya tidak tertukar di laporan.
          </p>

          <Input
            label="Alasan Pembatalan"
            placeholder="Contoh: Salah input jumlah, seharusnya 2 bukan 20"
            required
            value={batal.alasan}
            onChange={(e) => setBatal((b) => ({ ...b, alasan: e.target.value }))}
            hint="Minimal 5 karakter. Tercatat permanen di riwayat."
          />
        </div>
      </Modal>
    </div>
  );
};
