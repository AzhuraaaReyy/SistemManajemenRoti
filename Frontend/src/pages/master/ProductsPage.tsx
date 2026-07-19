import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { BookOpen, Cookie, Pencil, Plus, Save, Tag, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/users/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, persen, rupiah, toneStatusStok } from '../../lib/format';
import { categoryService, productService } from '../../services/masterService';
import type { BaseFilters, Product, SelectOption } from '../../types/master';

interface FormValues {
  name: string;
  category_id: string;
  unit: string;
  selling_price: number;
  current_stock: number;
  min_stock: number;
  description: string;
  is_active: boolean;
}

const NILAI_AWAL: FormValues = {
  name: '',
  category_id: '',
  unit: 'pcs',
  selling_price: 0,
  current_stock: 0,
  min_stock: 0,
  description: '',
  is_active: true,
};

export const ProductsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const fetcher = useCallback((f: BaseFilters) => productService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Product>({ fetcher, errorMessage: 'Gagal memuat daftar produk.' });

  const [kategori, setKategori] = useState<SelectOption[]>([]);
  const [modal, setModal] = useState<{ open: boolean; item: Product | null }>({
    open: false,
    item: null,
  });
  const [hapus, setHapus] = useState<{ open: boolean; item: Product | null; proses: boolean }>({
    open: false,
    item: null,
    proses: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: NILAI_AWAL });

  useEffect(() => {
    categoryService
      .options({ type: 'produk' })
      .then(setKategori)
      .catch(() => toast.error('Gagal memuat pilihan kategori produk.'));
  }, [toast]);

  const bukaForm = (item: Product | null) => {
    reset(
      item
        ? {
            name: item.name,
            category_id: item.category_id ? String(item.category_id) : '',
            unit: item.unit,
            selling_price: item.selling_price,
            current_stock: item.current_stock,
            min_stock: item.min_stock,
            description: item.description ?? '',
            is_active: item.is_active,
          }
        : NILAI_AWAL,
    );
    setModal({ open: true, item });
  };

  const simpan = async (data: FormValues) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      category_id: data.category_id ? Number(data.category_id) : null,
      unit: data.unit || 'pcs',
      selling_price: Number(data.selling_price),
      min_stock: Number(data.min_stock),
      description: data.description || null,
      is_active: data.is_active,
    };

    // Stok produk jadi hanya bisa ditetapkan saat pertama dibuat; setelah itu
    // bertambah lewat modul Produksi dan berkurang lewat Penjualan.
    if (!modal.item) {
      payload.current_stock = Number(data.current_stock);
    }

    try {
      const hasil = modal.item
        ? await productService.update(modal.item.id, payload)
        : await productService.create(payload);

      toast.success(hasil.message);
      setModal({ open: false, item: null });
      await reload();
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, pesan]) =>
          setError(field as keyof FormValues, { type: 'server', message: pesan[0] }),
        );
        toast.error('Periksa kembali data yang Anda isi.');
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  const konfirmasiHapus = async () => {
    if (!hapus.item) return;
    setHapus((h) => ({ ...h, proses: true }));

    try {
      toast.success(await productService.remove(hapus.item.id));
      setHapus({ open: false, item: null, proses: false });
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
      setHapus((h) => ({ ...h, proses: false }));
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Produk',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{row.name}</p>
          <p className="text-xs text-stone-400">
            <span className="font-mono">{row.code}</span>
            {row.category_name && <span> · {row.category_name}</span>}
          </p>
        </div>
      ),
    },
    {
      key: 'selling_price',
      header: 'Harga Jual',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-stone-900">{rupiah(row.selling_price)}</span>
      ),
    },
    {
      key: 'unit_cost',
      header: 'HPP Bahan',
      align: 'right',
      hideOnMobile: true,
      render: (row) =>
        row.unit_cost != null ? (
          <span className="tabular-nums text-stone-600">{rupiah(row.unit_cost)}</span>
        ) : (
          <span className="text-xs text-stone-400">Belum ada resep</span>
        ),
    },
    {
      key: 'margin_percent',
      header: 'Margin',
      align: 'right',
      hideOnMobile: true,
      render: (row) => {
        if (row.margin_percent == null) return <span className="text-xs text-stone-400">—</span>;

        // Margin negatif berarti produk dijual di bawah biaya bahannya —
        // dibuat mencolok karena ini kerugian yang sering tidak disadari.
        const rugi = row.margin_percent < 0;

        return (
          <div>
            <p className={`font-semibold tabular-nums ${rugi ? 'text-red-600' : 'text-emerald-600'}`}>
              {persen(row.margin_percent)}
            </p>
            <p className="text-xs text-stone-400">{rupiah(row.margin)}/pcs</p>
          </div>
        );
      },
    },
    {
      key: 'current_stock',
      header: 'Stok',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums text-stone-900">
            {angka(row.current_stock)} {row.unit}
          </p>
          <Badge tone={toneStatusStok(row.stock_status)}>{row.stock_status_label}</Badge>
        </div>
      ),
    },
    {
      key: 'has_recipe',
      header: 'Resep',
      render: (row) =>
        row.has_recipe ? (
          <Badge tone="success">v{row.recipe_version}</Badge>
        ) : (
          <Badge tone="warning">Belum ada</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk"
        description="Daftar produk jadi beserta harga jual dan perbandingannya dengan biaya bahan."
        action={
          <Button icon={Plus} onClick={() => bukaForm(null)}>
            Tambah Produk
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nama, kode, atau deskripsi produk…"
          selects={[
            {
              key: 'category_id',
              label: 'Semua Kategori',
              value: (filters.category_id as string) ?? '',
              options: kategori.map((k) => ({ value: String(k.value), label: k.label })),
            },
            {
              key: 'has_recipe',
              label: 'Semua Produk',
              value: (filters.has_recipe as string) ?? '',
              options: [
                { value: 'ya', label: 'Sudah punya resep' },
                { value: 'tidak', label: 'Belum punya resep' },
              ],
            },
            {
              key: 'status',
              label: 'Semua Status',
              value: (filters.status as string) ?? '',
              options: [
                { value: 'aktif', label: 'Aktif' },
                { value: 'nonaktif', label: 'Nonaktif' },
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
          minWidth="900px"
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
              icon={Cookie}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada produk'}
              description={
                hasActiveFilters
                  ? 'Tidak ada produk yang cocok dengan filter Anda.'
                  : 'Tambahkan produk jadi yang Anda jual, lalu susun resepnya.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => bukaForm(null)}>
                    Tambah Produk
                  </Button>
                )
              }
            />
          }
          actions={(row) => (
            <>
              <button
                type="button"
                onClick={() => navigate(row.has_recipe ? `/master/resep?product_id=${row.id}` : '/master/resep?new=1')}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Lihat resep ${row.name}`}
                title={row.has_recipe ? 'Lihat resep' : 'Buat resep'}
              >
                <BookOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => bukaForm(row)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Ubah produk ${row.name}`}
                title="Ubah"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHapus({ open: true, item: row, proses: false })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus produk ${row.name}`}
                title="Hapus"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, item: null })}
        size="md"
        title={modal.item ? 'Ubah Produk' : 'Tambah Produk'}
        description={
          modal.item
            ? `Kode: ${modal.item.code} — stok berubah lewat modul Produksi dan Penjualan.`
            : 'Kode produk dibuat otomatis oleh sistem.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false, item: null })} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" form="form-produk" icon={Save} loading={isSubmitting}>
              {modal.item ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form id="form-produk" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
          <Input
            label="Nama Produk"
            icon={Cookie}
            placeholder="Contoh: Roti Manis Cokelat"
            required
            error={errors.name?.message}
            {...register('name', {
              required: 'Nama produk wajib diisi.',
              minLength: { value: 3, message: 'Nama minimal 3 karakter.' },
            })}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Kategori"
              placeholder="— Tanpa kategori —"
              options={kategori.map((k) => ({ value: String(k.value), label: k.label }))}
              error={errors.category_id?.message}
              {...register('category_id')}
            />

            <Input
              label="Satuan"
              placeholder="pcs"
              hint="Umumnya pcs untuk produk roti."
              error={errors.unit?.message}
              {...register('unit')}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Input
              label="Harga Jual"
              type="number"
              step="any"
              min={0}
              icon={Tag}
              required
              hint="Rupiah per satuan."
              error={errors.selling_price?.message}
              {...register('selling_price', {
                required: 'Harga jual wajib diisi.',
                valueAsNumber: true,
                min: { value: 0, message: 'Tidak boleh negatif.' },
              })}
            />

            <Input
              label={modal.item ? 'Stok Saat Ini' : 'Stok Awal'}
              type="number"
              step="any"
              min={0}
              disabled={!!modal.item}
              hint={modal.item ? 'Diubah lewat Produksi.' : undefined}
              error={errors.current_stock?.message}
              {...register('current_stock', { valueAsNumber: true, min: 0 })}
            />

            <Input
              label="Stok Minimum"
              type="number"
              step="any"
              min={0}
              hint="Batas peringatan stok menipis."
              error={errors.min_stock?.message}
              {...register('min_stock', {
                valueAsNumber: true,
                min: { value: 0, message: 'Tidak boleh negatif.' },
              })}
            />
          </div>

          <div>
            <label htmlFor="produk-deskripsi" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Deskripsi
            </label>
            <textarea
              id="produk-deskripsi"
              rows={3}
              placeholder="Penjelasan singkat produk"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              {...register('description')}
            />
          </div>

          <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
              {...register('is_active')}
            />
            <div>
              <p className="text-sm font-semibold text-stone-700">Produk Aktif</p>
              <p className="text-xs text-stone-500">
                Produk nonaktif tidak muncul di menu penjualan dan rencana produksi.
              </p>
            </div>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={hapus.open}
        loading={hapus.proses}
        onClose={() => setHapus({ open: false, item: null, proses: false })}
        onConfirm={() => void konfirmasiHapus()}
        title="Hapus Produk?"
        confirmLabel="Ya, Hapus"
        message={
          <>
            Produk <strong className="text-stone-900">{hapus.item?.name}</strong> akan dihapus
            beserta seluruh resepnya. Riwayat penjualan yang sudah tercatat tetap tersimpan.
          </>
        }
      />
    </div>
  );
};
