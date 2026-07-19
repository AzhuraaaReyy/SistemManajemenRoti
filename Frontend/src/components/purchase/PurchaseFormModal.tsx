import React, { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { purchaseService } from '../../services/purchaseService';
import type { IngredientOption, SelectOption } from '../../types/master';
import type { PurchaseOrder } from '../../types/purchase';

interface ItemRow {
  ingredient_id: string;
  /** Dalam satuan pesan bahan (kg/L/pcs). */
  quantity: number;
  /** Per satuan pesan. */
  unit_price: number;
  discount_amount: number;
  note: string;
}

interface FormValues {
  supplier_id: string;
  order_date: string;
  expected_date: string;
  discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  notes: string;
  items: ItemRow[];
}

const BARIS_KOSONG: ItemRow = {
  ingredient_id: '',
  quantity: 0,
  unit_price: 0,
  discount_amount: 0,
  note: '',
};

const hariIni = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  suppliers: SelectOption[];
  ingredients: IngredientOption[];
  onSaved: () => void;
}

export const PurchaseFormModal: React.FC<Props> = ({
  open,
  onClose,
  order,
  suppliers,
  ingredients,
  onSaved,
}) => {
  const toast = useToast();
  const isEdit = !!order;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      supplier_id: '',
      order_date: hariIni(),
      expected_date: '',
      discount_amount: 0,
      shipping_cost: 0,
      tax_amount: 0,
      notes: '',
      items: [{ ...BARIS_KOSONG }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items');
  const diskon = watch('discount_amount');
  const ongkir = watch('shipping_cost');
  const pajak = watch('tax_amount');
  const supplierId = watch('supplier_id');

  useEffect(() => {
    if (!open) return;

    reset(
      order
        ? {
            supplier_id: String(order.supplier_id),
            order_date: order.order_date ?? hariIni(),
            expected_date: order.expected_date ?? '',
            discount_amount: order.discount_amount,
            shipping_cost: order.shipping_cost,
            tax_amount: order.tax_amount,
            notes: order.notes ?? '',
            items:
              order.items?.map((i) => ({
                ingredient_id: String(i.ingredient_id),
                quantity: i.qty_ordered_display,
                unit_price: i.unit_price_display,
                discount_amount: i.discount_amount,
                note: i.note ?? '',
              })) ?? [{ ...BARIS_KOSONG }],
          }
        : {
            supplier_id: '',
            order_date: hariIni(),
            expected_date: '',
            discount_amount: 0,
            shipping_cost: 0,
            tax_amount: 0,
            notes: '',
            items: [{ ...BARIS_KOSONG }],
          },
    );
  }, [open, order, reset]);

  const cariBahan = (id: string): IngredientOption | undefined =>
    ingredients.find((i) => String(i.value) === id);

  /**
   * Memilih bahan otomatis mengisi harga dengan harga rata-rata terakhir,
   * supaya petugas tidak perlu mengingat harga tiap barang. Angkanya tetap
   * bisa diubah bila supplier menaikkan harga.
   */
  const pilihBahan = (index: number, ingredientId: string) => {
    const bahan = cariBahan(ingredientId);
    if (!bahan) return;

    const hargaPerSatuanPesan = bahan.avg_cost * bahan.conversion_factor;

    if (hargaPerSatuanPesan > 0 && !items?.[index]?.unit_price) {
      setValue(`items.${index}.unit_price`, Math.round(hargaPerSatuanPesan));
    }
  };

  /** Ringkasan dihitung langsung supaya dampak tiap baris terlihat sambil mengetik. */
  const ringkasan = useMemo(() => {
    const subtotal = (items ?? []).reduce((acc, row) => {
      const nilai = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
      return acc + Math.max(0, nilai - (Number(row.discount_amount) || 0));
    }, 0);

    const total =
      subtotal - (Number(diskon) || 0) + (Number(ongkir) || 0) + (Number(pajak) || 0);

    return { subtotal, total };
  }, [items, diskon, ongkir, pajak]);

  const simpan = async (data: FormValues) => {
    const payload = {
      supplier_id: Number(data.supplier_id),
      order_date: data.order_date,
      expected_date: data.expected_date || null,
      discount_amount: Number(data.discount_amount) || 0,
      shipping_cost: Number(data.shipping_cost) || 0,
      tax_amount: Number(data.tax_amount) || 0,
      notes: data.notes || null,
      items: data.items.map((row) => ({
        ingredient_id: Number(row.ingredient_id),
        quantity: Number(row.quantity) || 0,
        unit_price: Number(row.unit_price) || 0,
        discount_amount: Number(row.discount_amount) || 0,
        note: row.note || null,
      })),
    };

    try {
      const hasil = isEdit
        ? await purchaseService.update(order.id, payload)
        : await purchaseService.create(payload);

      toast.success(hasil.message);
      onSaved();
      onClose();
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, pesan]) => {
          const cocok = field.match(/^items\.(\d+)\.(\w+)$/);

          if (cocok) {
            setError(`items.${Number(cocok[1])}.${cocok[2]}` as never, {
              type: 'server',
              message: pesan[0],
            });
          } else if (field === 'status' || field === 'items') {
            toast.error(pesan[0]);
          } else {
            setError(field as keyof FormValues, { type: 'server', message: pesan[0] });
          }
        });
        toast.error('Periksa kembali data pesanan yang Anda isi.');
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  const namaSupplier = suppliers.find((s) => String(s.value) === supplierId)?.label;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Ubah Pesanan — ${order.po_number}` : 'Buat Pesanan Pembelian'}
      description={
        isEdit
          ? 'Hanya draft yang bisa diubah. Setelah dikonfirmasi, pesanan menjadi dokumen tetap.'
          : 'Pesanan disimpan sebagai draft. Konfirmasi bila sudah dikirim ke supplier.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="form-pembelian" icon={Save} loading={isSubmitting}>
            {isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
        </>
      }
    >
      <form id="form-pembelian" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-3">
          <Select
            label="Supplier"
            placeholder="— Pilih supplier —"
            required
            options={suppliers.map((s) => ({ value: String(s.value), label: s.label }))}
            error={errors.supplier_id?.message}
            {...register('supplier_id', { required: 'Supplier wajib dipilih.' })}
          />

          <Input
            label="Tanggal Pesan"
            type="date"
            max={hariIni()}
            required
            error={errors.order_date?.message}
            {...register('order_date', { required: 'Tanggal pesan wajib diisi.' })}
          />

          <Input
            label="Perkiraan Tiba"
            type="date"
            hint="Dipakai menandai pesanan terlambat."
            error={errors.expected_date?.message}
            {...register('expected_date')}
          />
        </div>

        {/* Daftar barang */}
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-2 text-sm font-bold text-stone-700">
            Daftar Barang <span className="font-normal text-stone-400">({fields.length})</span>
          </legend>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const row = items?.[index];
              const bahan = cariBahan(row?.ingredient_id ?? '');
              const nilai =
                (Number(row?.quantity) || 0) * (Number(row?.unit_price) || 0) -
                (Number(row?.discount_amount) || 0);

              return (
                <div key={field.id} className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Select
                        label="Bahan Baku"
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
                        label={`Jumlah${bahan ? ` (${bahan.display_unit})` : ''}`}
                        type="number"
                        step="any"
                        min={0}
                        required
                        error={errors.items?.[index]?.quantity?.message}
                        {...register(`items.${index}.quantity`, {
                          required: 'Wajib diisi.',
                          valueAsNumber: true,
                          min: { value: 0.0001, message: 'Harus > 0.' },
                        })}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Input
                        label={`Harga per ${bahan?.display_unit ?? 'satuan'}`}
                        type="number"
                        step="any"
                        min={0}
                        required
                        error={errors.items?.[index]?.unit_price?.message}
                        {...register(`items.${index}.unit_price`, {
                          required: 'Wajib diisi.',
                          valueAsNumber: true,
                          min: { value: 0, message: 'Tidak boleh negatif.' },
                        })}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Diskon"
                        type="number"
                        step="any"
                        min={0}
                        error={errors.items?.[index]?.discount_amount?.message}
                        {...register(`items.${index}.discount_amount`, {
                          valueAsNumber: true,
                          min: { value: 0, message: 'Tidak boleh negatif.' },
                        })}
                      />
                    </div>

                    <div className="flex items-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="mb-0.5 w-full rounded-lg p-2.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Hapus barang baris ${index + 1}`}
                        title={fields.length === 1 ? 'Pesanan harus punya minimal satu barang' : 'Hapus baris'}
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {bahan && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200/70 pt-2 text-xs">
                      <span className="text-stone-500">
                        Subtotal:{' '}
                        <strong className="tabular-nums text-stone-800">{rupiah(Math.max(0, nilai))}</strong>
                      </span>
                      <span className="text-stone-500">
                        Stok saat ini:{' '}
                        <strong className="tabular-nums text-stone-700">
                          {angka(bahan.current_stock / bahan.conversion_factor)} {bahan.display_unit}
                        </strong>
                      </span>
                      <span className="text-stone-400">
                        Harga terakhir: {rupiah(bahan.avg_cost * bahan.conversion_factor)}/{bahan.display_unit}
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
            Tambah Barang
          </Button>
        </fieldset>

        {/* Biaya tambahan & ringkasan */}
        <div className="grid gap-5 sm:grid-cols-3">
          <Input
            label="Diskon Pesanan"
            type="number"
            step="any"
            min={0}
            hint="Potongan dari total, bukan per barang."
            error={errors.discount_amount?.message}
            {...register('discount_amount', { valueAsNumber: true, min: 0 })}
          />

          <Input
            label="Ongkos Kirim"
            type="number"
            step="any"
            min={0}
            error={errors.shipping_cost?.message}
            {...register('shipping_cost', { valueAsNumber: true, min: 0 })}
          />

          <Input
            label="Pajak"
            type="number"
            step="any"
            min={0}
            error={errors.tax_amount?.message}
            {...register('tax_amount', { valueAsNumber: true, min: 0 })}
          />
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600">
              <dt>Subtotal barang</dt>
              <dd className="tabular-nums">{rupiah(ringkasan.subtotal)}</dd>
            </div>
            {Number(diskon) > 0 && (
              <div className="flex justify-between text-stone-600">
                <dt>Diskon pesanan</dt>
                <dd className="tabular-nums text-red-600">− {rupiah(Number(diskon))}</dd>
              </div>
            )}
            {Number(ongkir) > 0 && (
              <div className="flex justify-between text-stone-600">
                <dt>Ongkos kirim</dt>
                <dd className="tabular-nums">+ {rupiah(Number(ongkir))}</dd>
              </div>
            )}
            {Number(pajak) > 0 && (
              <div className="flex justify-between text-stone-600">
                <dt>Pajak</dt>
                <dd className="tabular-nums">+ {rupiah(Number(pajak))}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-300 pt-2 text-base font-bold text-stone-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{rupiah(ringkasan.total)}</dd>
            </div>
          </dl>

          {namaSupplier && (
            <p className="mt-3 border-t border-stone-200 pt-2 text-xs text-stone-500">
              Akan dipesan ke <strong className="text-stone-700">{namaSupplier}</strong>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="po-notes" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Catatan
          </label>
          <textarea
            id="po-notes"
            rows={2}
            placeholder="Instruksi khusus untuk supplier atau catatan internal"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            {...register('notes')}
          />
        </div>
      </form>
    </Modal>
  );
};
