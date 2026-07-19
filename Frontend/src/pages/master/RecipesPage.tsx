import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Copy, Eye, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { RecipeDetailModal } from '../../components/master/RecipeDetailModal';
import { RecipeFormModal } from '../../components/master/RecipeFormModal';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/users/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { pesanError } from '../../lib/api';
import { angka, persen, rupiah } from '../../lib/format';
import { ingredientService, productOptionsService, recipeService } from '../../services/masterService';
import type { BaseFilters, IngredientOption, ProductOption, Recipe } from '../../types/master';

type Konfirmasi =
  | { jenis: 'hapus'; item: Recipe }
  | { jenis: 'versi'; item: Recipe }
  | { jenis: 'aktifkan'; item: Recipe }
  | null;

export const RecipesPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback(
    (f: BaseFilters) => recipeService.list({ ...f, sort_by: f.sort_by === 'name' ? 'name' : f.sort_by }),
    [],
  );
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Recipe>({
      fetcher,
      initialFilters: { sort_by: 'created_at', sort_dir: 'desc' },
      errorMessage: 'Gagal memuat daftar resep.',
    });

  const [produk, setProduk] = useState<ProductOption[]>([]);
  const [bahan, setBahan] = useState<IngredientOption[]>([]);

  const [form, setForm] = useState<{ open: boolean; item: Recipe | null }>({ open: false, item: null });
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi>(null);
  const [proses, setProses] = useState(false);

  const muatPilihan = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([
        productOptionsService.options(),
        ingredientService.ingredientOptions(),
      ]);
      setProduk(p);
      setBahan(b);
    } catch {
      toast.error('Gagal memuat pilihan produk atau bahan baku.');
    }
  }, [toast]);

  useEffect(() => {
    void muatPilihan();
  }, [muatPilihan]);

  /** Semua aksi konfirmasi (hapus, versi baru, aktifkan) lewat satu jalur. */
  const jalankanKonfirmasi = async () => {
    if (!konfirmasi) return;
    setProses(true);

    try {
      const pesan =
        konfirmasi.jenis === 'hapus'
          ? await recipeService.remove(konfirmasi.item.id)
          : konfirmasi.jenis === 'versi'
            ? (await recipeService.newVersion(konfirmasi.item.id)).message
            : (await recipeService.activate(konfirmasi.item.id)).message;

      toast.success(pesan);
      setKonfirmasi(null);
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const columns: Column<Recipe>[] = [
    {
      key: 'name',
      header: 'Resep',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{row.name}</p>
          <p className="text-xs text-stone-400">
            {row.product_name} · <span className="font-mono">{row.product_code}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Versi',
      sortable: true,
      align: 'center',
      render: (row) => (
        <div className="flex flex-col items-center gap-1">
          <Badge tone={row.is_active ? 'success' : 'neutral'}>
            v{row.version}
            {row.is_active && ' · aktif'}
          </Badge>

          {/* Versi yang sudah dipakai produksi ditandai gembok — pengguna
              perlu tahu kenapa tombol Ubah tidak bisa ditekan. */}
          {row.locked_at && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700"
              title={row.lock_label ?? undefined}
            >
              <Lock className="h-3 w-3" />
              {row.production_count}× produksi
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'yield_quantity',
      header: 'Hasil',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-700">
          {angka(row.yield_quantity)} {row.yield_unit}
        </span>
      ),
    },
    {
      key: 'items_count',
      header: 'Bahan',
      align: 'right',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums text-stone-600">{row.items_count ?? 0}</span>,
    },
    {
      key: 'cost_per_unit',
      header: 'HPP / Margin',
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums text-stone-800">{rupiah(row.cost_per_unit)}</p>
          <p
            className={`text-xs tabular-nums ${
              row.margin_percent == null
                ? 'text-stone-400'
                : row.margin_percent < 0
                  ? 'font-semibold text-red-600'
                  : 'text-emerald-600'
            }`}
          >
            {persen(row.margin_percent)}
          </p>
        </div>
      ),
    },
    {
      key: 'max_producible',
      header: 'Bisa Dibuat',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <div>
          <p className="tabular-nums text-stone-800">
            {angka(row.max_producible ?? 0)} {row.yield_unit}
          </p>
          {row.limiting_ingredient && (
            <p className="truncate text-xs text-stone-400">batas: {row.limiting_ingredient}</p>
          )}
        </div>
      ),
    },
  ];

  const pesanKonfirmasi = () => {
    if (!konfirmasi) return null;

    const { jenis, item } = konfirmasi;

    if (jenis === 'hapus') {
      return (
        <>
          Resep <strong className="text-stone-900">{item.name}</strong> versi {item.version} akan
          dihapus. Batch produksi yang sudah berjalan dengan versi ini tetap tersimpan riwayatnya.
        </>
      );
    }

    if (jenis === 'versi') {
      return (
        <>
          Seluruh isi resep <strong className="text-stone-900">{item.name}</strong> akan disalin
          menjadi versi baru yang langsung aktif. Versi {item.version} disimpan sebagai arsip agar
          perhitungan HPP produksi lama tidak berubah.
        </>
      );
    }

    return (
      <>
        Versi {item.version} akan dijadikan resep aktif untuk{' '}
        <strong className="text-stone-900">{item.product_name}</strong>. Versi yang sekarang aktif
        otomatis dinonaktifkan.
      </>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resep (Bill of Materials)"
        description="Komposisi bahan baku setiap produk, lengkap dengan perhitungan biaya dan kapasitas produksi."
        action={
          <Button icon={Plus} onClick={() => setForm({ open: true, item: null })}>
            Buat Resep
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nama resep atau produk…"
          selects={[
            {
              key: 'product_id',
              label: 'Semua Produk',
              value: (filters.product_id as string) ?? '',
              options: produk.map((p) => ({ value: String(p.value), label: p.label })),
            },
            {
              key: 'status',
              label: 'Semua Versi',
              value: (filters.status as string) ?? '',
              options: [
                { value: 'aktif', label: 'Versi aktif' },
                { value: 'nonaktif', label: 'Versi arsip' },
              ],
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
              icon={BookOpen}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada resep'}
              description={
                hasActiveFilters
                  ? 'Tidak ada resep yang cocok dengan filter Anda.'
                  : 'Susun resep untuk menghubungkan bahan baku dengan produk jadi, agar produksi dapat memotong stok secara otomatis.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => setForm({ open: true, item: null })}>
                    Buat Resep
                  </Button>
                )
              }
            />
          }
          actions={(row) => (
            <>
              <button
                type="button"
                onClick={() => setDetail(row)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Lihat detail ${row.name}`}
                title="Lihat detail & simulasi"
              >
                <Eye className="h-4 w-4" />
              </button>

              {!row.is_active && (
                <button
                  type="button"
                  onClick={() => setKonfirmasi({ jenis: 'aktifkan', item: row })}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                  aria-label={`Aktifkan versi ${row.version}`}
                  title="Jadikan versi aktif"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setKonfirmasi({ jenis: 'versi', item: row })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Buat versi baru dari ${row.name}`}
                title="Buat versi baru"
              >
                <Copy className="h-4 w-4" />
              </button>

              {/* Versi terkunci tidak bisa diubah atau dihapus. Tombolnya
                  dinonaktifkan dengan penjelasan, bukan disembunyikan —
                  pengguna perlu tahu bahwa opsi itu ada tapi tidak berlaku. */}
              <button
                type="button"
                disabled={row.is_locked}
                onClick={() => setForm({ open: true, item: row })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Ubah resep ${row.name}`}
                title={row.is_locked ? `${row.lock_label} — buat versi baru untuk mengubah` : 'Ubah'}
              >
                <Pencil className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={!!row.locked_at}
                onClick={() => setKonfirmasi({ jenis: 'hapus', item: row })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Hapus resep ${row.name}`}
                title={
                  row.locked_at
                    ? 'Tidak dapat dihapus — sudah dipakai produksi'
                    : 'Hapus'
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />
      </div>

      <RecipeFormModal
        open={form.open}
        recipe={form.item}
        products={produk}
        ingredients={bahan}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={() => void reload()}
      />

      <RecipeDetailModal open={!!detail} recipe={detail} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={!!konfirmasi}
        loading={proses}
        onClose={() => setKonfirmasi(null)}
        onConfirm={() => void jalankanKonfirmasi()}
        variant={konfirmasi?.jenis === 'hapus' ? 'danger' : 'primary'}
        title={
          konfirmasi?.jenis === 'hapus'
            ? 'Hapus Resep?'
            : konfirmasi?.jenis === 'versi'
              ? 'Buat Versi Baru?'
              : 'Jadikan Versi Aktif?'
        }
        confirmLabel={
          konfirmasi?.jenis === 'hapus'
            ? 'Ya, Hapus'
            : konfirmasi?.jenis === 'versi'
              ? 'Ya, Buat Versi Baru'
              : 'Ya, Aktifkan'
        }
        message={pesanKonfirmasi()}
      />
    </div>
  );
};
