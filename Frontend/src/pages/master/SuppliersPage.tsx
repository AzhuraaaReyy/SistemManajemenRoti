import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, MapPin, Pencil, Phone, Plus, Save, Trash2, Truck, User } from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/users/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { errorValidasi, pesanError } from '../../lib/api';
import { supplierService } from '../../services/masterService';
import type { BaseFilters, Supplier } from '../../types/master';

interface FormValues {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  lead_time_days: number;
  notes: string;
  is_active: boolean;
}

const NILAI_AWAL: FormValues = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  lead_time_days: 3,
  notes: '',
  is_active: true,
};

export const SuppliersPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => supplierService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Supplier>({ fetcher, errorMessage: 'Gagal memuat daftar supplier.' });

  const [modal, setModal] = useState<{ open: boolean; item: Supplier | null }>({
    open: false,
    item: null,
  });
  const [hapus, setHapus] = useState<{ open: boolean; item: Supplier | null; proses: boolean }>({
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

  const bukaForm = (item: Supplier | null) => {
    reset(
      item
        ? {
            name: item.name,
            contact_person: item.contact_person ?? '',
            phone: item.phone ?? '',
            email: item.email ?? '',
            address: item.address ?? '',
            lead_time_days: item.lead_time_days,
            notes: item.notes ?? '',
            is_active: item.is_active,
          }
        : NILAI_AWAL,
    );
    setModal({ open: true, item });
  };

  const simpan = async (data: FormValues) => {
    try {
      const hasil = modal.item
        ? await supplierService.update(modal.item.id, data)
        : await supplierService.create(data);

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
      toast.success(await supplierService.remove(hapus.item.id));
      setHapus({ open: false, item: null, proses: false });
      await reload();
    } catch (error) {
      toast.error(pesanError(error));
      setHapus((h) => ({ ...h, proses: false }));
    }
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{row.name}</p>
          <p className="font-mono text-xs text-stone-400">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'contact_person',
      header: 'Kontak',
      hideOnMobile: true,
      render: (row) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-stone-700">{row.contact_person ?? '—'}</p>
          <p className="text-stone-500">{row.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'lead_time_days',
      header: 'Lead Time',
      sortable: true,
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-600">
          {row.lead_time_days} <span className="text-xs text-stone-400">hari</span>
        </span>
      ),
    },
    {
      key: 'ingredients_count',
      header: 'Bahan Dipasok',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-600">{row.ingredients_count ?? 0}</span>
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
        title="Supplier"
        description="Data pemasok bahan baku beserta kontak dan perkiraan lama pengiriman."
        action={
          <Button icon={Plus} onClick={() => bukaForm(null)}>
            Tambah Supplier
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nama, kode, kontak, atau telepon…"
          selects={[
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
              icon={Truck}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada supplier'}
              description={
                hasActiveFilters
                  ? 'Tidak ada supplier yang cocok dengan filter Anda.'
                  : 'Tambahkan pemasok bahan baku agar proses pembelian dapat dicatat.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => bukaForm(null)}>
                    Tambah Supplier
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
                aria-label={`Ubah supplier ${row.name}`}
                title="Ubah"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHapus({ open: true, item: row, proses: false })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus supplier ${row.name}`}
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
        title={modal.item ? 'Ubah Supplier' : 'Tambah Supplier'}
        description={modal.item ? `Kode: ${modal.item.code}` : 'Kode supplier dibuat otomatis oleh sistem.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false, item: null })} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" form="form-supplier" icon={Save} loading={isSubmitting}>
              {modal.item ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form id="form-supplier" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
          <Input
            label="Nama Supplier"
            icon={Truck}
            placeholder="Contoh: PT Indofood Sukses Makmur"
            required
            error={errors.name?.message}
            {...register('name', {
              required: 'Nama supplier wajib diisi.',
              minLength: { value: 3, message: 'Nama minimal 3 karakter.' },
            })}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Nama Kontak"
              icon={User}
              placeholder="Contoh: Pak Roni"
              error={errors.contact_person?.message}
              {...register('contact_person')}
            />

            <Input
              label="Nomor Telepon"
              icon={Phone}
              placeholder="0812xxxxxxxx"
              error={errors.phone?.message}
              {...register('phone', {
                pattern: {
                  value: /^[0-9+\-\s()]{8,25}$/,
                  message: 'Format nomor telepon tidak valid.',
                },
              })}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              icon={Mail}
              placeholder="supplier@contoh.com"
              error={errors.email?.message}
              {...register('email', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Format email tidak valid.',
                },
              })}
            />

            <Input
              label="Lama Pengiriman"
              type="number"
              min={1}
              max={365}
              required
              hint="Rata-rata hari dari pesan sampai barang tiba."
              error={errors.lead_time_days?.message}
              {...register('lead_time_days', {
                required: 'Lama pengiriman wajib diisi.',
                valueAsNumber: true,
                min: { value: 1, message: 'Minimal 1 hari.' },
                max: { value: 365, message: 'Maksimal 365 hari.' },
              })}
            />
          </div>

          <Input
            label="Alamat"
            icon={MapPin}
            placeholder="Alamat lengkap supplier"
            error={errors.address?.message}
            {...register('address')}
          />

          <div>
            <label htmlFor="supplier-notes" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Catatan
            </label>
            <textarea
              id="supplier-notes"
              rows={3}
              placeholder="Syarat pembayaran, minimum order, dan catatan lain"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              {...register('notes')}
            />
          </div>

          <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
              {...register('is_active')}
            />
            <div>
              <p className="text-sm font-semibold text-stone-700">Supplier Aktif</p>
              <p className="text-xs text-stone-500">
                Supplier nonaktif tidak muncul saat membuat pesanan pembelian baru.
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
        title="Hapus Supplier?"
        confirmLabel="Ya, Hapus"
        message={
          <>
            Supplier <strong className="text-stone-900">{hapus.item?.name}</strong> akan dihapus.
            Riwayat pembelian yang sudah tercatat tetap tersimpan.
          </>
        }
      />
    </div>
  );
};
