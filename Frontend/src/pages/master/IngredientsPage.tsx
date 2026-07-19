import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AlertTriangle,
  Boxes,
  Package,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import { DataTable, type Column } from '../../components/data/DataTable';
import { FilterBar } from '../../components/data/FilterBar';
import { PageHeader, StatCard } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/users/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useResourceList } from '../../hooks/useResourceList';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah, toneStatusStok } from '../../lib/format';
import { categoryService, ingredientService, supplierService } from '../../services/masterService';
import type {
  BaseFilters,
  Ingredient,
  IngredientStatistics,
  SelectOption,
  UnitKey,
  UnitOption,
} from '../../types/master';

/**
 * Seluruh angka di form ini ditulis dalam satuan yang dipilih pengguna
 * (misal kilogram). Backend yang mengurus konversi ke satuan dasar —
 * frontend tidak pernah mengalikan faktor konversi sendiri, agar tidak ada
 * dua tempat yang bisa berbeda hasilnya.
 */
interface FormValues {
  name: string;
  category_id: string;
  default_supplier_id: string;
  unit: UnitKey;
  opening_stock: number;
  min_stock: number;
  avg_cost: number;
  shelf_life_days: string;
  notes: string;
  is_active: boolean;
}

const NILAI_AWAL: FormValues = {
  name: '',
  category_id: '',
  default_supplier_id: '',
  unit: 'kg',
  opening_stock: 0,
  min_stock: 0,
  avg_cost: 0,
  shelf_life_days: '',
  notes: '',
  is_active: true,
};

export const IngredientsPage: React.FC = () => {
  const toast = useToast();

  const fetcher = useCallback((f: BaseFilters) => ingredientService.list(f), []);
  const { items, meta, loading, filters, setFilter, resetFilters, goToPage, reload, hasActiveFilters } =
    useResourceList<Ingredient>({ fetcher, errorMessage: 'Gagal memuat daftar bahan baku.' });

  const [statistik, setStatistik] = useState<IngredientStatistics | null>(null);
  const [kategori, setKategori] = useState<SelectOption[]>([]);
  const [supplier, setSupplier] = useState<SelectOption[]>([]);
  const [satuan, setSatuan] = useState<UnitOption[]>([]);

  const [modal, setModal] = useState<{ open: boolean; item: Ingredient | null }>({
    open: false,
    item: null,
  });
  const [hapus, setHapus] = useState<{ open: boolean; item: Ingredient | null; proses: boolean }>({
    open: false,
    item: null,
    proses: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: NILAI_AWAL });

  const unitTerpilih = watch('unit');
  const infoSatuan = satuan.find((s) => s.value === unitTerpilih);
  const simbol = infoSatuan?.symbol ?? '';

  /* ---------------------------------------------------------------------- */

  const muatStatistik = useCallback(async () => {
    try {
      setStatistik(await ingredientService.statistics());
    } catch {
      // Statistik hanya pelengkap; kegagalannya tidak boleh menghalangi tabel.
    }
  }, []);

  useEffect(() => {
    void muatStatistik();

    Promise.all([
      categoryService.options({ type: 'bahan_baku' }),
      supplierService.options(),
      ingredientService.units(),
    ])
      .then(([k, s, u]) => {
        setKategori(k);
        setSupplier(s);
        setSatuan(u);
      })
      .catch(() => toast.error('Gagal memuat pilihan kategori, supplier, atau satuan.'));
  }, [muatStatistik, toast]);

  const bukaForm = (item: Ingredient | null) => {
    reset(
      item
        ? {
            name: item.name,
            category_id: item.category_id ? String(item.category_id) : '',
            default_supplier_id: item.default_supplier_id ? String(item.default_supplier_id) : '',
            unit: item.unit,
            opening_stock: item.current_stock_display,
            min_stock: item.min_stock_display,
            avg_cost: item.avg_cost_display,
            shelf_life_days: item.shelf_life_days ? String(item.shelf_life_days) : '',
            notes: item.notes ?? '',
            is_active: item.is_active,
          }
        : NILAI_AWAL,
    );
    setModal({ open: true, item });
  };

  const simpan = async (data: FormValues) => {
    // Angka dikirim apa adanya dalam satuan pilihan pengguna. Konversi ke
    // satuan dasar dikerjakan backend — satu tempat, satu hasil.
    const payload: Record<string, unknown> = {
      name: data.name,
      category_id: data.category_id ? Number(data.category_id) : null,
      default_supplier_id: data.default_supplier_id ? Number(data.default_supplier_id) : null,
      unit: data.unit,
      min_stock: Number(data.min_stock),
      avg_cost: Number(data.avg_cost),
      shelf_life_days: data.shelf_life_days ? Number(data.shelf_life_days) : null,
      notes: data.notes || null,
      is_active: data.is_active,
    };

    // Stok awal hanya boleh ditetapkan saat membuat; server menolak bila
    // dikirim pada permintaan pembaruan.
    if (!modal.item) {
      payload.opening_stock = Number(data.opening_stock);
    }

    try {
      const hasil = modal.item
        ? await ingredientService.update(modal.item.id, payload)
        : await ingredientService.create(payload);

      toast.success(hasil.message);
      setModal({ open: false, item: null });
      await Promise.all([reload(), muatStatistik()]);
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
      toast.success(await ingredientService.remove(hapus.item.id));
      setHapus({ open: false, item: null, proses: false });
      await Promise.all([reload(), muatStatistik()]);
    } catch (error) {
      toast.error(pesanError(error));
      setHapus((h) => ({ ...h, proses: false }));
    }
  };

  /* ---------------------------------------------------------------------- */

  const columns: Column<Ingredient>[] = [
    {
      key: 'name',
      header: 'Bahan Baku',
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
      key: 'current_stock',
      header: 'Stok',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div>
          <p className="font-semibold tabular-nums text-stone-900">
            {angka(row.current_stock_display)} {row.unit_symbol}
          </p>
          <p className="text-xs text-stone-400">
            min {angka(row.min_stock_display)} {row.unit_symbol}
          </p>
        </div>
      ),
    },
    {
      key: 'stock_status',
      header: 'Status',
      render: (row) => <Badge tone={toneStatusStok(row.stock_status)}>{row.stock_status_label}</Badge>,
    },
    {
      key: 'avg_cost',
      header: 'Harga Rata-rata',
      sortable: true,
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <div>
          {/* Backend sudah mengirim harga per satuan tampilan — frontend tidak
              menghitung ulang agar tidak ada dua sumber angka yang bisa beda. */}
          <p className="tabular-nums text-stone-700">{rupiah(row.avg_cost_display)}</p>
          <p className="text-xs text-stone-400">per {row.unit_symbol}</p>
        </div>
      ),
    },
    {
      key: 'stock_value',
      header: 'Nilai',
      align: 'right',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums text-stone-600">{rupiah(row.stock_value)}</span>,
    },
    {
      key: 'default_supplier_name',
      header: 'Supplier',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-stone-500">{row.default_supplier_name ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bahan Baku"
        description="Data bahan mentah beserta satuan, stok minimum, dan harga rata-rata."
        action={
          <Button icon={Plus} onClick={() => bukaForm(null)}>
            Tambah Bahan Baku
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Bahan" value={statistik?.total ?? 0} icon={Package} />
        <StatCard
          label="Perlu Perhatian"
          value={statistik?.perlu_perhatian ?? 0}
          icon={AlertTriangle}
          tone={statistik && statistik.perlu_perhatian > 0 ? 'warning' : 'success'}
          hint="Habis, kritis, atau menipis"
        />
        <StatCard
          label="Stok Habis"
          value={statistik?.per_status.habis ?? 0}
          icon={Boxes}
          tone={statistik && statistik.per_status.habis > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Nilai Persediaan"
          value={rupiah(statistik?.nilai_persediaan ?? 0)}
          icon={Wallet}
          tone="info"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <FilterBar
          search={(filters.search as string) ?? ''}
          onSearchChange={(v) => setFilter({ search: v })}
          searchPlaceholder="Cari nama, kode, atau catatan bahan…"
          selects={[
            {
              key: 'stock_status',
              label: 'Semua Status Stok',
              value: (filters.stock_status as string) ?? '',
              options: [
                { value: 'habis', label: 'Habis' },
                { value: 'kritis', label: 'Kritis' },
                { value: 'menipis', label: 'Menipis' },
                { value: 'aman', label: 'Aman' },
                { value: 'berlebih', label: 'Berlebih' },
              ],
            },
            {
              key: 'category_id',
              label: 'Semua Kategori',
              value: (filters.category_id as string) ?? '',
              options: kategori.map((k) => ({ value: String(k.value), label: k.label })),
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
              icon={Package}
              title={hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada bahan baku'}
              description={
                hasActiveFilters
                  ? 'Tidak ada bahan baku yang cocok dengan filter Anda.'
                  : 'Tambahkan bahan mentah yang dipakai untuk membuat produk.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Hapus Filter
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => bukaForm(null)}>
                    Tambah Bahan Baku
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
                aria-label={`Ubah bahan ${row.name}`}
                title="Ubah"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHapus({ open: true, item: row, proses: false })}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus bahan ${row.name}`}
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
        size="lg"
        title={modal.item ? 'Ubah Bahan Baku' : 'Tambah Bahan Baku'}
        description={
          modal.item
            ? `Kode: ${modal.item.code} — stok hanya dapat diubah melalui modul Persediaan.`
            : 'Kode bahan dibuat otomatis oleh sistem.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false, item: null })} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" form="form-bahan" icon={Save} loading={isSubmitting}>
              {modal.item ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form id="form-bahan" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
          <Input
            label="Nama Bahan Baku"
            icon={Package}
            placeholder="Contoh: Tepung Terigu Protein Tinggi"
            required
            error={errors.name?.message}
            {...register('name', {
              required: 'Nama bahan baku wajib diisi.',
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

            <Select
              label="Supplier Utama"
              placeholder="— Belum ditentukan —"
              options={supplier.map((s) => ({ value: String(s.value), label: s.label }))}
              error={errors.default_supplier_id?.message}
              {...register('default_supplier_id')}
            />
          </div>

          {/* Satuan — satu pilihan, sisanya diurus sistem */}
          <Select
            label="Satuan"
            required
            options={satuan.map((s) => ({ value: s.value, label: s.label }))}
            hint={
              modal.item
                ? 'Bisa diganti antar satuan sejenis (kg ↔ gram). Berpindah jenis tidak diizinkan bila sudah berstok.'
                : 'Satuan yang Anda pakai sehari-hari untuk bahan ini.'
            }
            error={errors.unit?.message}
            {...register('unit', { required: 'Satuan wajib dipilih.' })}
          />

          {/* Stok & harga — semuanya dalam satuan yang dipilih di atas */}
          <div className="grid gap-5 sm:grid-cols-3">
            <Input
              label={modal.item ? 'Stok Saat Ini' : 'Stok Awal'}
              type="number"
              step="any"
              min={0}
              disabled={!!modal.item}
              hint={modal.item ? 'Diubah lewat modul Persediaan.' : `Dalam ${simbol || 'satuan'}.`}
              error={errors.opening_stock?.message}
              {...register('opening_stock', { valueAsNumber: true, min: 0 })}
            />

            <Input
              label="Stok Minimum"
              type="number"
              step="any"
              min={0}
              hint={`Dalam ${simbol || 'satuan'}. Batas peringatan stok menipis.`}
              error={errors.min_stock?.message}
              {...register('min_stock', {
                valueAsNumber: true,
                min: { value: 0, message: 'Tidak boleh negatif.' },
              })}
            />

            <Input
              label={`Harga per ${simbol || 'satuan'}`}
              type="number"
              step="any"
              min={0}
              hint="Diperbarui otomatis setiap kali ada pembelian."
              error={errors.avg_cost?.message}
              {...register('avg_cost', {
                valueAsNumber: true,
                min: { value: 0, message: 'Tidak boleh negatif.' },
              })}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Umur Simpan (hari)"
              type="number"
              min={1}
              placeholder="Kosongkan bila tidak mudah rusak"
              hint="Dipakai untuk peringatan kedaluwarsa nanti."
              error={errors.shelf_life_days?.message}
              {...register('shelf_life_days')}
            />

            <Input
              label="Catatan"
              placeholder="Merek, spesifikasi, atau catatan lain"
              error={errors.notes?.message}
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
              <p className="text-sm font-semibold text-stone-700">Bahan Aktif</p>
              <p className="text-xs text-stone-500">
                Bahan nonaktif tidak muncul saat menyusun resep atau membuat pesanan baru.
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
        title="Hapus Bahan Baku?"
        confirmLabel="Ya, Hapus"
        message={
          <>
            Bahan <strong className="text-stone-900">{hapus.item?.name}</strong> akan dihapus.
            {(hapus.item?.used_in_recipes ?? 0) > 0 && (
              <>
                {' '}Bahan ini masih dipakai dalam{' '}
                <strong className="text-stone-900">{hapus.item?.used_in_recipes} resep</strong>, jadi
                penghapusan akan ditolak.
              </>
            )}
          </>
        }
      />
    </div>
  );
};
