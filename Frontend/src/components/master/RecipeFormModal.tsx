import React, { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { recipeService } from '../../services/masterService';
import type { IngredientOption, ProductOption, Recipe } from '../../types/master';

interface ItemRow {
  ingredient_id: string;
  /** Angka takaran, dalam satuan yang dipilih di kolom `unit` baris ini. */
  quantity_display: number;
  /** Satuan takaran baris ini — 'g' atau 'kg' untuk bahan bersatuan berat. */
  unit: string;
  waste_percent: number;
  note: string;
}

interface FormValues {
  product_id: string;
  name: string;
  yield_quantity: number;
  yield_unit: string;
  description: string;
  instructions: string;
  is_active: boolean;
  items: ItemRow[];
}

const BARIS_KOSONG: ItemRow = {
  ingredient_id: '',
  quantity_display: 0,
  unit: '',
  waste_percent: 0,
  note: '',
};

const NILAI_AWAL: FormValues = {
  product_id: '',
  name: '',
  yield_quantity: 1,
  yield_unit: 'pcs',
  description: '',
  instructions: '',
  is_active: true,
  items: [{ ...BARIS_KOSONG }],
};

interface Props {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  products: ProductOption[];
  ingredients: IngredientOption[];
  onSaved: () => void;
}

export const RecipeFormModal: React.FC<Props> = ({
  open,
  onClose,
  recipe,
  products,
  ingredients,
  onSaved,
}) => {
  const toast = useToast();
  const isEdit = !!recipe;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: NILAI_AWAL });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items');
  const yieldQty = watch('yield_quantity');
  const productId = watch('product_id');

  useEffect(() => {
    if (!open) return;

    reset(
      recipe
        ? {
            product_id: String(recipe.product_id),
            name: recipe.name,
            yield_quantity: recipe.yield_quantity,
            yield_unit: recipe.yield_unit,
            description: recipe.description ?? '',
            instructions: recipe.instructions ?? '',
            is_active: recipe.is_active,
            items:
              recipe.items?.map((i) => {
                // Takaran ditampilkan dalam satuan yang paling enak dibaca:
                // 250 g tetap "250 g", 5.000 g menjadi "5 kg" — bukan "0,25 kg".
                const bahan = ingredients.find((x) => x.value === i.ingredient_id);
                const pilihan = bahan?.recipe_units ?? [];
                const besar = pilihan.find((u) => u.factor > 1);
                const pakaiBesar = besar && i.quantity >= besar.factor;
                const dipakai = pakaiBesar ? besar : (pilihan[0] ?? { unit: i.base_unit ?? '', factor: 1 });

                return {
                  ingredient_id: String(i.ingredient_id),
                  quantity_display: Number((i.quantity / dipakai.factor).toFixed(4)),
                  unit: dipakai.unit,
                  waste_percent: i.waste_percent,
                  note: i.note ?? '',
                };
              }) ?? [{ ...BARIS_KOSONG }],
          }
        : NILAI_AWAL,
    );
  }, [open, recipe, reset, ingredients]);

  /** Mengisi nama resep otomatis dari produk yang dipilih, bila masih kosong. */
  const pilihProduk = (id: string) => {
    setValue('product_id', id);

    const produk = products.find((p) => String(p.value) === id);
    if (produk && !watch('name')) {
      setValue('name', `Resep Standar ${produk.label}`);
    }
  };

  const cariBahan = (id: string): IngredientOption | undefined =>
    ingredients.find((i) => String(i.value) === id);

  /** Faktor pengali satuan yang dipilih pada satu baris resep. */
  const faktorBaris = (row: ItemRow | undefined): number => {
    const bahan = cariBahan(row?.ingredient_id ?? '');
    if (!bahan) return 1;

    const cocok = bahan.recipe_units?.find((u) => u.unit === row?.unit);
    return cocok?.factor ?? bahan.recipe_units?.[0]?.factor ?? 1;
  };

  /** Mengubah takaran satu baris ke satuan dasar bahannya. */
  const keDasar = (row: ItemRow | undefined): number =>
    (Number(row?.quantity_display) || 0) * faktorBaris(row);

  /**
   * Saat bahan dipilih, satuan barisnya diisi otomatis dengan satuan terkecil
   * bahan tersebut (gram untuk tepung, butir untuk telur) — takaran resep
   * hampir selalu ditulis dalam satuan kecil.
   */
  const pilihBahan = (index: number, ingredientId: string) => {
    const bahan = ingredients.find((i) => String(i.value) === ingredientId);
    const bawaan = bahan?.recipe_units?.[0]?.unit ?? '';

    setValue(`items.${index}.unit`, bawaan);
  };

  /**
   * Ringkasan biaya dihitung langsung di layar sambil pengguna mengetik,
   * supaya dampak setiap takaran terhadap HPP langsung terlihat — bukan baru
   * ketahuan setelah disimpan.
   */
  const ringkasan = useMemo(() => {
    let total = 0;
    const barisKurang: string[] = [];

    for (const row of items ?? []) {
      const bahan = cariBahan(row.ingredient_id);
      if (!bahan) continue;

      const efektif = keDasar(row) * (1 + (Number(row.waste_percent) || 0) / 100);

      total += efektif * bahan.avg_cost;

      if (efektif > bahan.current_stock) barisKurang.push(bahan.label);
    }

    const yq = Number(yieldQty) || 0;
    const perUnit = yq > 0 ? total / yq : 0;
    const harga = products.find((p) => String(p.value) === productId)?.selling_price ?? 0;

    return {
      total,
      perUnit,
      harga,
      margin: harga > 0 ? harga - perUnit : null,
      marginPersen: harga > 0 && perUnit > 0 ? ((harga - perUnit) / harga) * 100 : null,
      barisKurang,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, yieldQty, productId, ingredients, products]);

  const simpan = async (data: FormValues) => {
    // Form memakai satuan tampilan; API selalu menerima satuan dasar.
    const payload = {
      product_id: Number(data.product_id),
      name: data.name,
      yield_quantity: Number(data.yield_quantity),
      yield_unit: data.yield_unit || 'pcs',
      description: data.description || null,
      instructions: data.instructions || null,
      is_active: data.is_active,
      // Takaran dikirim dalam satuan dasar bahan. Pengguna boleh menulis
      // "250 g" atau "0,25 kg" — keduanya menghasilkan angka tersimpan
      // yang sama persis.
      items: data.items.map((row) => ({
        ingredient_id: Number(row.ingredient_id),
        quantity: keDasar(row),
        waste_percent: Number(row.waste_percent) || 0,
        note: row.note || null,
      })),
    };

    try {
      const hasil = isEdit
        ? await recipeService.update(recipe.id, payload)
        : await recipeService.create(payload);

      toast.success(hasil.message);
      onSaved();
      onClose();
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, pesan]) => {
          // Error per baris datang sebagai "items.2.quantity" — arahkan ke
          // field satuan tampilan yang benar-benar dilihat pengguna.
          const cocok = field.match(/^items\.(\d+)\.(\w+)$/);

          if (cocok) {
            const [, idx, sub] = cocok;
            const target = sub === 'quantity' ? 'quantity_display' : sub;
            setError(`items.${Number(idx)}.${target}` as never, {
              type: 'server',
              message: pesan[0],
            });
          } else {
            setError(field as keyof FormValues, { type: 'server', message: pesan[0] });
          }
        });
        toast.error('Periksa kembali data resep yang Anda isi.');
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Ubah Resep — versi ${recipe.version}` : 'Buat Resep Baru'}
      description={
        isEdit
          ? 'Perubahan berlaku pada versi ini. Untuk menjaga riwayat HPP, buat versi baru.'
          : 'Tentukan bahan dan takaran untuk satu kali produksi standar.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="form-resep" icon={Save} loading={isSubmitting}>
            {isEdit ? 'Simpan Perubahan' : 'Simpan Resep'}
          </Button>
        </>
      }
    >
      <form id="form-resep" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
        {/* Identitas resep */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Produk"
            placeholder="— Pilih produk —"
            required
            disabled={isEdit}
            hint={isEdit ? 'Produk tidak dapat dipindahkan.' : undefined}
            options={products.map((p) => ({ value: String(p.value), label: p.label }))}
            error={errors.product_id?.message}
            {...register('product_id', {
              required: 'Produk wajib dipilih.',
              onChange: (e) => pilihProduk(e.target.value),
            })}
          />

          <Input
            label="Nama Resep"
            placeholder="Contoh: Resep Standar Roti Coklat"
            required
            error={errors.name?.message}
            {...register('name', {
              required: 'Nama resep wajib diisi.',
              minLength: { value: 3, message: 'Nama minimal 3 karakter.' },
            })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Hasil Produksi"
            type="number"
            step="any"
            min={0.01}
            required
            hint="Satu kali resep ini menghasilkan berapa buah?"
            error={errors.yield_quantity?.message}
            {...register('yield_quantity', {
              required: 'Hasil produksi wajib diisi.',
              valueAsNumber: true,
              min: { value: 0.01, message: 'Harus lebih besar dari nol.' },
            })}
          />

          <Input
            label="Satuan Hasil"
            placeholder="pcs"
            error={errors.yield_unit?.message}
            {...register('yield_unit')}
          />
        </div>

        {/* Daftar bahan */}
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-2 text-sm font-bold text-stone-700">
            Bahan Baku <span className="font-normal text-stone-400">({fields.length} bahan)</span>
          </legend>

          <p className="mb-4 text-xs leading-relaxed text-stone-500">
            Takaran diisi untuk <strong>satu kali resep penuh</strong> ({angka(yieldQty) || '?'}{' '}
            {watch('yield_unit') || 'pcs'}), bukan per satu buah.
          </p>

          {errors.items?.message && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {errors.items.message}
            </p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => {
              const row = items?.[index];
              const bahan = cariBahan(row?.ingredient_id ?? '');

              const efektif = keDasar(row) * (1 + (Number(row?.waste_percent) || 0) / 100);
              const kurang = bahan ? efektif > bahan.current_stock : false;
              const opsiSatuan = bahan?.recipe_units ?? [];

              return (
                <div
                  key={field.id}
                  className={`rounded-lg border p-3 ${kurang ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200 bg-stone-50/50'}`}
                >
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Select
                        label="Bahan"
                        placeholder="— Pilih bahan —"
                        required
                        options={ingredients.map((i) => ({
                          value: String(i.value),
                          label: i.label,
                        }))}
                        error={errors.items?.[index]?.ingredient_id?.message}
                        {...register(`items.${index}.ingredient_id`, {
                          required: 'Bahan wajib dipilih.',
                          onChange: (e) => pilihBahan(index, e.target.value),
                        })}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Takaran"
                        type="number"
                        step="any"
                        min={0}
                        required
                        error={errors.items?.[index]?.quantity_display?.message}
                        {...register(`items.${index}.quantity_display`, {
                          required: 'Takaran wajib diisi.',
                          valueAsNumber: true,
                          min: { value: 0.0001, message: 'Harus lebih dari nol.' },
                        })}
                      />
                    </div>

                    {/* Satuan per baris — coklat cukup diketik "15 g",
                        tepung boleh "5 kg". Keduanya tersimpan sebagai gram. */}
                    <div className="sm:col-span-2">
                      <Select
                        label="Satuan"
                        disabled={opsiSatuan.length <= 1}
                        options={opsiSatuan.map((u) => ({ value: u.unit, label: u.unit }))}
                        error={errors.items?.[index]?.unit?.message}
                        {...register(`items.${index}.unit`)}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Input
                        label="Susut (%)"
                        type="number"
                        step="any"
                        min={0}
                        max={99}
                        error={errors.items?.[index]?.waste_percent?.message}
                        {...register(`items.${index}.waste_percent`, {
                          valueAsNumber: true,
                          min: { value: 0, message: 'Tidak boleh negatif.' },
                          max: { value: 99, message: 'Maksimal 99%.' },
                        })}
                      />
                    </div>

                    <div className="flex items-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="mb-0.5 w-full rounded-lg p-2.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Hapus bahan baris ${index + 1}`}
                        title={fields.length === 1 ? 'Resep harus punya minimal satu bahan' : 'Hapus baris'}
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {bahan && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200/70 pt-2 text-xs">
                      <span className="text-stone-500">
                        Dipakai:{' '}
                        <strong className="tabular-nums text-stone-700">
                          {angka(efektif)} {bahan.base_unit}
                        </strong>
                      </span>
                      <span className="text-stone-500">
                        Biaya:{' '}
                        <strong className="tabular-nums text-stone-700">
                          {rupiah(efektif * bahan.avg_cost)}
                        </strong>
                      </span>
                      <span className={kurang ? 'font-semibold text-amber-700' : 'text-stone-500'}>
                        {kurang && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                        Stok: {angka(bahan.current_stock)} {bahan.base_unit}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Plus}
            className="mt-3"
            onClick={() => append({ ...BARIS_KOSONG })}
          >
            Tambah Bahan
          </Button>
        </fieldset>

        {/* Ringkasan biaya langsung */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h4 className="mb-3 text-sm font-bold text-stone-700">Ringkasan Biaya</h4>

          <dl className="grid gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total Bahan</dt>
              <dd className="font-bold tabular-nums text-stone-900">{rupiah(ringkasan.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">HPP per {watch('yield_unit') || 'pcs'}</dt>
              <dd className="font-bold tabular-nums text-stone-900">{rupiah(ringkasan.perUnit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Harga Jual</dt>
              <dd className="font-bold tabular-nums text-stone-900">
                {ringkasan.harga > 0 ? rupiah(ringkasan.harga) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Margin Kotor</dt>
              <dd
                className={`font-bold tabular-nums ${
                  ringkasan.marginPersen == null
                    ? 'text-stone-400'
                    : ringkasan.marginPersen < 0
                      ? 'text-red-600'
                      : 'text-emerald-600'
                }`}
              >
                {ringkasan.marginPersen == null
                  ? '—'
                  : `${angka(ringkasan.marginPersen, 1)}% · ${rupiah(ringkasan.margin)}`}
              </dd>
            </div>
          </dl>

          {ringkasan.marginPersen != null && ringkasan.marginPersen < 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Harga jual berada di bawah biaya bahan. Kerugian sesungguhnya lebih besar lagi karena
              tenaga kerja, gas, dan kemasan belum dihitung.
            </p>
          )}

          {ringkasan.barisKurang.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Stok tidak cukup untuk sekali produksi penuh: {ringkasan.barisKurang.join(', ')}. Resep
              tetap dapat disimpan — kecukupan bahan diperiksa saat produksi dijalankan.
            </p>
          )}
        </div>

        {/* Keterangan tambahan */}
        <div>
          <label htmlFor="resep-deskripsi" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Deskripsi
          </label>
          <textarea
            id="resep-deskripsi"
            rows={2}
            placeholder="Penjelasan singkat resep"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            {...register('description')}
          />
        </div>

        <div>
          <label htmlFor="resep-instruksi" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Cara Pembuatan
          </label>
          <textarea
            id="resep-instruksi"
            rows={4}
            placeholder="Langkah-langkah pembuatan untuk dibaca tim dapur"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            {...register('instructions')}
          />
        </div>

        <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
            {...register('is_active')}
          />
          <div>
            <p className="text-sm font-semibold text-stone-700">Jadikan Resep Aktif</p>
            <p className="text-xs text-stone-500">
              Setiap produk hanya boleh punya satu resep aktif. Versi lain otomatis dinonaktifkan.
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
};
