import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Eye, Factory, GitBranch, Plus } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { ProductionDetailModal } from '../../components/production/ProductionDetailModal';
import { ProductionFormModal } from '../../components/production/ProductionFormModal';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { pesanError } from '../../lib/api';
import { angka, persen, rupiah, tanggalWaktu } from '../../lib/format';
import { productOptionsService } from '../../services/masterService';
import { productionService } from '../../services/productionService';
import type { BaseFilters, ProductOption } from '../../types/master';
import type { ProductionBatch, ProductionStatusOption } from '../../types/production';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const ProductionBatchesPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => productionService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<ProductionBatch>({
      fetcher,
      initialFilters: { sort_by: 'started_at', sort_dir: 'desc' },
      errorMessage: 'Gagal memuat daftar batch produksi.',
    });

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [statuses, setStatuses] = useState<ProductionStatusOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<ProductionBatch | null>(null);
  const [batal, setBatal] = useState<{ batch: ProductionBatch | null; alasan: string }>({
    batch: null,
    alasan: '',
  });
  const [proses, setProses] = useState(false);

  useEffect(() => {
    Promise.all([productOptionsService.options(), productionService.statuses()])
      .then(([p, s]) => {
        setProducts(p);
        setStatuses(s);
      })
      .catch(() => toast.error('Gagal memuat pilihan produk atau status.'));
  }, [toast]);

  /** Daftar hanya membawa ringkasan; rincian bahan diambil saat dibutuhkan. */
  const bukaDetail = async (id: number) => {
    try {
      setDetail(await productionService.show(id));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat detail batch.'));
    }
  };

  const jalankanBatal = async () => {
    if (!batal.batch) return;

    if (batal.alasan.trim().length < 5) {
      toast.warning('Isi alasan pembatalan minimal 5 karakter.');
      return;
    }

    setProses(true);

    try {
      const { message } = await productionService.cancel(batal.batch.id, batal.alasan.trim());
      toast.success(message);
      setBatal({ batch: null, alasan: '' });
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const columns: Column<ProductionBatch>[] = [
    {
      key: 'batch_number',
      header: 'Batch',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-stone-900">{row.batch_number}</p>
          <p className="truncate text-xs text-stone-500">
            {row.product_name} · resep v{row.recipe_version}
          </p>
        </div>
      ),
    },
    {
      key: 'started_at',
      header: 'Mulai',
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <div className="text-xs">
          <p className="text-stone-700">{tanggalWaktu(row.started_at)}</p>
          {row.operator_name && <p className="text-stone-400">{row.operator_name}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={TONE[row.status_tone] ?? 'neutral'}>{row.status_label}</Badge>,
    },
    {
      /*
      | Progress tahapan — inti Modul 5.
      |
      | Menampilkan tahap yang sedang dikerjakan, bukan sekadar persentase:
      | "Sedang Mixing" jauh lebih berguna daripada angka 14% sendirian.
      */
      key: 'progress_percent',
      header: 'Progress',
      render: (row) => {
        if (row.progress_percent === undefined) {
          return <span className="text-xs text-stone-400">—</span>;
        }

        const selesai = row.status === 'completed';

        return (
          <div className="min-w-[130px]">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium text-stone-600">
                {selesai
                  ? 'Produk jadi'
                  : row.current_stage_status === 'in_progress'
                    ? `Sedang ${row.current_stage_label}`
                    : (row.current_stage_label ?? '—')}
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-stone-700">
                {angka(row.progress_percent, 0)}%
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${selesai ? 'bg-emerald-500' : 'bg-yellow-600'}`}
                style={{ width: `${Math.max(2, row.progress_percent)}%` }}
              />
            </div>

            <p className="mt-0.5 text-[10px] text-stone-400">
              {row.completed_stages} dari {row.total_stages} tahap
            </p>
          </div>
        );
      },
    },
    {
      key: 'target_quantity',
      header: 'Target / Hasil',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums text-stone-900">
            {angka(row.target_quantity)} {row.product_unit}
          </p>
          {row.good_quantity !== null ? (
            <p className="text-xs tabular-nums text-stone-500">
              hasil {angka(row.good_quantity)}
              {row.reject_quantity > 0 && (
                <span className="text-red-600"> · gagal {angka(row.reject_quantity)}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-amber-600">belum selesai</p>
          )}
        </div>
      ),
    },
    {
      key: 'yield_rate',
      header: 'Rasio',
      align: 'right',
      hideOnMobile: true,
      render: (row) =>
        row.yield_rate === null ? (
          <span className="text-xs text-stone-400">—</span>
        ) : (
          <span
            className={`font-semibold tabular-nums ${
              row.yield_rate >= 95
                ? 'text-emerald-600'
                : row.yield_rate >= 85
                  ? 'text-amber-600'
                  : 'text-red-600'
            }`}
          >
            {persen(row.yield_rate)}
          </span>
        ),
    },
    {
      key: 'material_cost',
      header: 'Biaya Bahan',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div>
          <p className="font-semibold tabular-nums text-stone-900">{rupiah(row.material_cost)}</p>
          {row.cost_per_unit !== null && (
            <p className="text-xs tabular-nums text-stone-400">
              {rupiah(row.cost_per_unit)}/{row.product_unit}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Produksi"
        description="Jalankan produksi berdasarkan resep, lalu ikuti tahapannya sampai produk jadi."
        action={
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            Mulai Produksi
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nomor batch, produk, atau catatan…"
          dateRange={{
            fromKey: 'date_from',
            toKey: 'date_to',
            fromValue: (filters.date_from as string) ?? '',
            toValue: (filters.date_to as string) ?? '',
            label: 'Tanggal mulai',
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
              key: 'product_id',
              label: 'Semua Produk',
              value: (filters.product_id as string) ?? '',
              options: products.map((p) => ({ value: String(p.value), label: p.label })),
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
          minWidth="1080px"
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
              icon={Factory}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada produksi'}
              description={
                hasActiveFilters
                  ? 'Tidak ada batch yang cocok dengan filter Anda.'
                  : 'Jalankan produksi pertama Anda — sistem akan menghitung kebutuhan bahan dari resep.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => setFormOpen(true)}>
                    Mulai Produksi
                  </Button>
                )
              }
            />
          }
          actions={(row) => (
            <>
              {/*
                Tombol "Selesaikan" sudah tidak ada sejak Modul 5. Batch hanya
                bisa ditutup dengan menyelesaikan tahap Packaging di halaman
                tracking, supaya setiap batch selesai punya jejak waktu utuh.
              */}
              <Link
                to={`/produksi/batch/${row.id}`}
                className="rounded-lg p-2 text-yellow-700 transition hover:bg-yellow-50"
                aria-label={`Tracking ${row.batch_number}`}
                title="Buka tracking tahapan"
              >
                <GitBranch className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={() => void bukaDetail(row.id)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Lihat detail ${row.batch_number}`}
                title="Lihat detail"
              >
                <Eye className="h-4 w-4" />
              </button>

              {row.can_cancel && (
                <button
                  type="button"
                  onClick={() => setBatal({ batch: row, alasan: '' })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Batalkan ${row.batch_number}`}
                  title="Batalkan — bahan dikembalikan"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        />
      </div>

      <ProductionFormModal
        open={formOpen}
        products={products}
        onClose={() => setFormOpen(false)}
        onStarted={() => void reload()}
      />

      <ProductionDetailModal open={!!detail} batch={detail} onClose={() => setDetail(null)} />

      <Modal
        open={!!batal.batch}
        onClose={() => setBatal({ batch: null, alasan: '' })}
        size="sm"
        title="Batalkan Produksi?"
        description={batal.batch?.batch_number}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setBatal({ batch: null, alasan: '' })}
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
            Seluruh bahan yang sudah dipotong akan{' '}
            <strong className="text-stone-900">dikembalikan ke stok</strong>.
          </p>

          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Gunakan ini hanya bila produksinya <strong>tidak jadi dikerjakan</strong> — misalnya
            salah input jumlah. Bila adonan sudah terlanjur dibuat lalu gagal, jangan dibatalkan:
            selesaikan dengan hasil layak jual 0 agar kerugian bahannya tetap tercatat.
          </p>

          <Input
            label="Alasan Pembatalan"
            placeholder="Contoh: Salah input jumlah produksi"
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
