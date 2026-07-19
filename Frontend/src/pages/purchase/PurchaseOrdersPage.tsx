import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  Eye,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { PurchaseDetailModal } from '../../components/purchase/PurchaseDetailModal';
import { PurchaseFormModal } from '../../components/purchase/PurchaseFormModal';
import { ReceiveGoodsModal } from '../../components/purchase/ReceiveGoodsModal';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/users/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { pesanError } from '../../lib/api';
import { angka, rupiah, tanggal } from '../../lib/format';
import { ingredientService, supplierService } from '../../services/masterService';
import { purchaseService } from '../../services/purchaseService';
import type { BaseFilters, IngredientOption, SelectOption } from '../../types/master';
import type { PurchaseOrder, PurchaseStatusOption } from '../../types/purchase';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

type Aksi = { jenis: 'konfirmasi' | 'hapus' | 'tutup'; order: PurchaseOrder } | null;

export const PurchaseOrdersPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => purchaseService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<PurchaseOrder>({
      fetcher,
      initialFilters: { sort_by: 'order_date', sort_dir: 'desc' },
      errorMessage: 'Gagal memuat daftar pembelian.',
    });

  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [statuses, setStatuses] = useState<PurchaseStatusOption[]>([]);

  const [form, setForm] = useState<{ open: boolean; order: PurchaseOrder | null }>({
    open: false,
    order: null,
  });
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [terima, setTerima] = useState<PurchaseOrder | null>(null);
  const [aksi, setAksi] = useState<Aksi>(null);
  const [proses, setProses] = useState(false);

  const [batal, setBatal] = useState<{ order: PurchaseOrder | null; alasan: string }>({
    order: null,
    alasan: '',
  });

  useEffect(() => {
    Promise.all([
      supplierService.options(),
      ingredientService.ingredientOptions(),
      purchaseService.statuses(),
    ])
      .then(([s, i, st]) => {
        setSuppliers(s);
        setIngredients(i);
        setStatuses(st);
      })
      .catch(() => toast.error('Gagal memuat pilihan supplier atau bahan baku.'));
  }, [toast]);

  /**
   * Daftar hanya membawa ringkasan; detail penuh (baris barang dan riwayat
   * penerimaan) diambil saat dibutuhkan agar tabel tetap ringan.
   */
  const bukaDetail = async (id: number, tujuan: 'detail' | 'terima' | 'ubah') => {
    try {
      const lengkap = await purchaseService.show(id);

      if (tujuan === 'detail') setDetail(lengkap);
      else if (tujuan === 'terima') setTerima(lengkap);
      else setForm({ open: true, order: lengkap });
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat detail pesanan.'));
    }
  };

  const jalankanAksi = async () => {
    if (!aksi) return;
    setProses(true);

    try {
      const pesan =
        aksi.jenis === 'konfirmasi'
          ? (await purchaseService.confirm(aksi.order.id)).message
          : aksi.jenis === 'tutup'
            ? (await purchaseService.close(aksi.order.id)).message
            : await purchaseService.remove(aksi.order.id);

      toast.success(pesan);
      setAksi(null);
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const jalankanBatal = async () => {
    if (!batal.order) return;

    if (batal.alasan.trim().length < 5) {
      toast.warning('Isi alasan pembatalan minimal 5 karakter.');
      return;
    }

    setProses(true);

    try {
      const { message } = await purchaseService.cancel(batal.order.id, batal.alasan.trim());
      toast.success(message);
      setBatal({ order: null, alasan: '' });
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po_number',
      header: 'Nomor',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-stone-900">{row.po_number}</p>
          <p className="truncate text-xs text-stone-500">{row.supplier_name}</p>
        </div>
      ),
    },
    {
      key: 'order_date',
      header: 'Tanggal',
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <div className="text-xs">
          <p className="text-stone-700">{tanggal(row.order_date)}</p>
          {row.expected_date && (
            <p className={row.is_overdue ? 'font-semibold text-red-600' : 'text-stone-400'}>
              {row.is_overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
              tiba {tanggal(row.expected_date)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={TONE[row.status_tone] ?? 'neutral'}>{row.status_label}</Badge>,
    },
    {
      key: 'received_percent',
      header: 'Penerimaan',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <div className="min-w-[6rem]">
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${row.received_percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-stone-500">
            {angka(row.received_percent ?? 0, 1)}%
          </p>
        </div>
      ),
    },
    {
      key: 'items_count',
      header: 'Item',
      align: 'right',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums text-stone-600">{row.items_count ?? 0}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-stone-900">{rupiah(row.total)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pembelian Bahan Baku"
        description="Pesan ke supplier, catat kedatangan barang, dan stok bertambah otomatis."
        action={
          <Button icon={Plus} onClick={() => setForm({ open: true, order: null })}>
            Buat Pesanan
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nomor pesanan, supplier, atau catatan…"
          dateRange={{
            fromKey: 'date_from',
            toKey: 'date_to',
            fromValue: (filters.date_from as string) ?? '',
            toValue: (filters.date_to as string) ?? '',
            label: 'Tanggal pesan',
          }}
          onDateChange={(key, value) => setFilter({ [key]: value })}
          selects={[
            {
              key: 'status',
              label: 'Semua Status',
              value: (filters.status as string) ?? '',
              options: statuses.map((s) => ({ value: s.value, label: s.label })),
            },
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
          minWidth="920px"
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
              icon={ShoppingBag}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada pembelian'}
              description={
                hasActiveFilters
                  ? 'Tidak ada pesanan yang cocok dengan filter Anda.'
                  : 'Buat pesanan pembelian untuk mencatat pengadaan bahan baku dari supplier.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => setForm({ open: true, order: null })}>
                    Buat Pesanan
                  </Button>
                )
              }
            />
          }
          actions={(row) => (
            <>
              <button
                type="button"
                onClick={() => void bukaDetail(row.id, 'detail')}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Lihat detail ${row.po_number}`}
                title="Lihat detail"
              >
                <Eye className="h-4 w-4" />
              </button>

              {/* Kemampuan aksi berasal dari server, bukan ditebak di sini —
                  tombol yang tampil selalu sama dengan yang benar-benar boleh. */}
              {row.can_confirm && (
                <button
                  type="button"
                  onClick={() => setAksi({ jenis: 'konfirmasi', order: row })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-sky-50 hover:text-sky-600"
                  aria-label={`Konfirmasi ${row.po_number}`}
                  title="Konfirmasi pesanan"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}

              {row.can_receive && (
                <button
                  type="button"
                  onClick={() => void bukaDetail(row.id, 'terima')}
                  className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                  aria-label={`Catat barang datang ${row.po_number}`}
                  title="Barang datang"
                >
                  <PackageCheck className="h-4 w-4" />
                </button>
              )}

              {row.can_close && (
                <button
                  type="button"
                  onClick={() => setAksi({ jenis: 'tutup', order: row })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  aria-label={`Tutup pesanan ${row.po_number}`}
                  title="Tutup pesanan — sisa tidak jadi dikirim"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}

              {row.can_edit && (
                <button
                  type="button"
                  onClick={() => void bukaDetail(row.id, 'ubah')}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  aria-label={`Ubah ${row.po_number}`}
                  title="Ubah"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}

              {row.can_cancel && (
                <button
                  type="button"
                  onClick={() => setBatal({ order: row, alasan: '' })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Batalkan ${row.po_number}`}
                  title="Batalkan pesanan"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}

              {row.can_edit && (
                <button
                  type="button"
                  onClick={() => setAksi({ jenis: 'hapus', order: row })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Hapus draft ${row.po_number}`}
                  title="Hapus draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        />
      </div>

      <PurchaseFormModal
        open={form.open}
        order={form.order}
        suppliers={suppliers}
        ingredients={ingredients}
        onClose={() => setForm({ open: false, order: null })}
        onSaved={() => void reload()}
      />

      <PurchaseDetailModal open={!!detail} order={detail} onClose={() => setDetail(null)} />

      <ReceiveGoodsModal
        open={!!terima}
        order={terima}
        onClose={() => setTerima(null)}
        onReceived={() => void reload()}
      />

      <ConfirmDialog
        open={!!aksi}
        loading={proses}
        onClose={() => setAksi(null)}
        onConfirm={() => void jalankanAksi()}
        variant={aksi?.jenis === 'hapus' ? 'danger' : 'primary'}
        title={
          aksi?.jenis === 'konfirmasi'
            ? 'Konfirmasi Pesanan?'
            : aksi?.jenis === 'tutup'
              ? 'Tutup Pesanan?'
              : 'Hapus Draft?'
        }
        confirmLabel={
          aksi?.jenis === 'konfirmasi'
            ? 'Ya, Konfirmasi'
            : aksi?.jenis === 'tutup'
              ? 'Ya, Tutup'
              : 'Ya, Hapus'
        }
        message={
          aksi?.jenis === 'konfirmasi' ? (
            <>
              Pesanan <strong className="text-stone-900">{aksi.order.po_number}</strong> akan berstatus
              Dipesan. Setelah ini isinya tidak dapat diubah lagi, karena dokumen dianggap sudah
              dikirim ke supplier.
            </>
          ) : aksi?.jenis === 'tutup' ? (
            <>
              Sisa barang pada <strong className="text-stone-900">{aksi.order.po_number}</strong> yang
              belum datang dianggap batal. Barang yang sudah diterima tetap tercatat beserta stoknya.
            </>
          ) : (
            <>
              Draft <strong className="text-stone-900">{aksi?.order.po_number}</strong> akan dihapus.
              Belum ada stok yang terpengaruh karena pesanan ini belum dikonfirmasi.
            </>
          )
        }
      />

      {/* Pembatalan butuh alasan, jadi memakai dialog tersendiri. */}
      <Modal
        open={!!batal.order}
        onClose={() => setBatal({ order: null, alasan: '' })}
        size="sm"
        title="Batalkan Pesanan?"
        description={batal.order?.po_number}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setBatal({ order: null, alasan: '' })}
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
            Pesanan yang dibatalkan tetap tersimpan di riwayat beserta alasannya, agar bisa
            ditelusuri di kemudian hari.
          </p>

          <Input
            label="Alasan Pembatalan"
            placeholder="Contoh: Supplier kehabisan stok"
            required
            value={batal.alasan}
            onChange={(e) => setBatal((b) => ({ ...b, alasan: e.target.value }))}
            hint="Minimal 5 karakter."
          />
        </div>
      </Modal>
    </div>
  );
};
