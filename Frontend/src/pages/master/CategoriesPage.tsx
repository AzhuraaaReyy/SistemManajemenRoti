import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FolderTree, Pencil, Plus, Save, Trash2 } from 'lucide-react';
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
import { categoryService } from '../../services/masterService';
import type { BaseFilters, Category, CategoryType } from '../../types/master';

interface FormValues {
  type: CategoryType;
  name: string;
  description: string;
  is_active: boolean;
}

const NILAI_AWAL: FormValues = {
  type: 'bahan_baku',
  name: '',
  description: '',
  is_active: true,
};

export const CategoriesPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => categoryService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Category>({ fetcher, errorMessage: 'Gagal memuat daftar kategori.' });

  const [modal, setModal] = useState<{ open: boolean; item: Category | null }>({
    open: false,
    item: null,
  });
  const [hapus, setHapus] = useState<{ open: boolean; item: Category | null; proses: boolean }>({
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

  const bukaForm = (item: Category | null) => {
    reset(
      item
        ? { type: item.type, name: item.name, description: item.description ?? '', is_active: item.is_active }
        : { ...NILAI_AWAL, type: (filters.type as CategoryType) || 'bahan_baku' },
    );
    setModal({ open: true, item });
  };

  const simpan = async (data: FormValues) => {
    try {
      const hasil = modal.item
        ? await categoryService.update(modal.item.id, data)
        : await categoryService.create(data);

      toast.success(hasil.message);
      setModal({ open: false, item: null });
      await reload();
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, pesan]) =>
          setError(field as keyof FormValues, { type: 'server', message: pesan[0] }),
        );
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  const konfirmasiHapus = async () => {
    if (!hapus.item) return;
    setHapus((h) => ({ ...h, proses: true }));

    try {
      toast.success(await categoryService.remove(hapus.item.id));
      setHapus({ open: false, item: null, proses: false });
      await reload();
    } catch (error) {
      // Kategori yang masih dipakai ditolak server dengan alasan yang jelas —
      // tampilkan apa adanya, jangan diringkas jadi "gagal menghapus".
      toast.error(pesanError(error));
      setHapus((h) => ({ ...h, proses: false }));
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Nama Kategori',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{row.name}</p>
          {row.description && (
            <p className="truncate text-xs text-stone-500">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Jenis',
      sortable: true,
      render: (row) => (
        <Badge tone={row.type === 'produk' ? 'info' : 'neutral'}>
          {row.type === 'produk' ? 'Produk' : 'Bahan Baku'}
        </Badge>
      ),
    },
    {
      key: 'usage_count',
      header: 'Dipakai',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-600">
          {row.usage_count ?? 0} <span className="text-xs text-stone-400">data</span>
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori"
        description="Pengelompokan produk dan bahan baku agar daftar tetap mudah ditelusuri."
        action={
          <Button icon={Plus} onClick={() => bukaForm(null)}>
            Tambah Kategori
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nama atau deskripsi kategori…"
          selects={[
            {
              key: 'type',
              label: 'Semua Jenis',
              value: (filters.type as string) ?? '',
              options: [
                { value: 'produk', label: 'Kategori Produk' },
                { value: 'bahan_baku', label: 'Kategori Bahan Baku' },
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
          minWidth="640px"
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
              icon={FolderTree}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada kategori'}
              description={
                hasActiveFilters
                  ? 'Tidak ada kategori yang cocok dengan filter Anda.'
                  : 'Buat kategori terlebih dahulu agar produk dan bahan baku bisa dikelompokkan.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => bukaForm(null)}>
                    Tambah Kategori
                  </Button>
                )
              }
            />
          }
          actions={(row) => (
            <>
              <button
                type="button"
                onClick={() => bukaForm(row)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label={`Ubah kategori ${row.name}`}
                title="Ubah"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHapus({ open: true, item: row, proses: false })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus kategori ${row.name}`}
                title="Hapus"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />
      </div>

      {/* Form tambah / ubah */}
      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, item: null })}
        size="sm"
        title={modal.item ? 'Ubah Kategori' : 'Tambah Kategori'}
        description={
          modal.item
            ? 'Jenis kategori tidak dapat diubah bila sudah dipakai data lain.'
            : 'Kategori produk dan bahan baku dikelola terpisah.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false, item: null })} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" form="form-kategori" icon={Save} loading={isSubmitting}>
              {modal.item ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form id="form-kategori" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
          <Select
            label="Jenis Kategori"
            required
            options={[
              { value: 'bahan_baku', label: 'Kategori Bahan Baku' },
              { value: 'produk', label: 'Kategori Produk' },
            ]}
            error={errors.type?.message}
            {...register('type', { required: 'Jenis kategori wajib dipilih.' })}
          />

          <Input
            label="Nama Kategori"
            placeholder="Contoh: Tepung, Roti Manis"
            required
            error={errors.name?.message}
            {...register('name', {
              required: 'Nama kategori wajib diisi.',
              minLength: { value: 2, message: 'Nama minimal 2 karakter.' },
            })}
          />

          <Input
            label="Deskripsi"
            placeholder="Penjelasan singkat (opsional)"
            error={errors.description?.message}
            {...register('description', {
              maxLength: { value: 255, message: 'Deskripsi maksimal 255 karakter.' },
            })}
          />

          <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
              {...register('is_active')}
            />
            <div>
              <p className="text-sm font-semibold text-stone-700">Kategori Aktif</p>
              <p className="text-xs text-stone-500">
                Kategori nonaktif tidak muncul saat menambah produk atau bahan baku baru.
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
        title="Hapus Kategori?"
        confirmLabel="Ya, Hapus"
        message={
          <>
            Kategori <strong className="text-stone-900">{hapus.item?.name}</strong> akan dihapus.
            {(hapus.item?.usage_count ?? 0) > 0 && (
              <>
                {' '}Kategori ini masih dipakai{' '}
                <strong className="text-stone-900">{hapus.item?.usage_count} data</strong>, jadi
                penghapusan kemungkinan akan ditolak.
              </>
            )}
          </>
        }
      />
    </div>
  );
};
