import React, { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { purchaseService } from '../../services/purchaseService';
import type { PurchaseOrder } from '../../types/purchase';

interface Baris {
  purchase_order_item_id: number;
  quantity: number;
  unit_price: number;
  expiry_date: string;
  batch_number: string;
}

interface FormValues {
  receipt_date: string;
  delivery_note_number: string;
  notes: string;
  items: Baris[];
}

const hariIni = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onReceived: () => void;
}

export const ReceiveGoodsModal: React.FC<Props> = ({ open, onClose, order, onReceived }) => {
  const toast = useToast();

  /**
   * Kunci idempotensi dibuat sekali per pembukaan dialog.
   *
   * Bila tombol tertekan dua kali atau jaringan lambat lalu klien mengirim
   * ulang, server mengenali kunci yang sama dan tidak menambah stok dua kali.
   */
  const idempotencyKey = useRef<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { receipt_date: hariIni(), delivery_note_number: '', notes: '', items: [] },
  });

  const items = watch('items');

  // Hanya baris yang masih punya sisa yang perlu ditampilkan — barang yang
  // sudah lengkap tidak akan datang lagi.
  const barisTersisa = useMemo(
    () => (order?.items ?? []).filter((i) => i.qty_outstanding_display > 0),
    [order],
  );

  useEffect(() => {
    if (!open || !order) return;

    idempotencyKey.current = `receive-${order.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    reset({
      receipt_date: hariIni(),
      delivery_note_number: '',
      notes: '',
      items: barisTersisa.map((i) => ({
        purchase_order_item_id: i.id,
        // Diisi penuh sesuai sisa — kasus paling umum barang datang lengkap.
        // Petugas tinggal mengurangi bila ternyata kurang.
        quantity: i.qty_outstanding_display,
        unit_price: i.unit_price_display,
        expiry_date: '',
        batch_number: '',
      })),
    });
  }, [open, order, barisTersisa, reset]);

  const isiSemuaPenuh = () => {
    barisTersisa.forEach((baris, index) => {
      setValue(`items.${index}.quantity`, baris.qty_outstanding_display);
    });
  };

  const kosongkanSemua = () => {
    barisTersisa.forEach((_, index) => setValue(`items.${index}.quantity`, 0));
  };

  const totalNilai = useMemo(
    () =>
      (items ?? []).reduce(
        (acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0),
        0,
      ),
    [items],
  );

  const simpan = async (data: FormValues) => {
    if (!order) return;

    try {
      const hasil = await purchaseService.receive(order.id, {
        receipt_date: data.receipt_date,
        delivery_note_number: data.delivery_note_number || null,
        notes: data.notes || null,
        idempotency_key: idempotencyKey.current,
        items: data.items
          .filter((r) => (Number(r.quantity) || 0) > 0)
          .map((r) => ({
            purchase_order_item_id: r.purchase_order_item_id,
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price) || null,
            expiry_date: r.expiry_date || null,
            batch_number: r.batch_number || null,
          })),
      });

      toast.success(hasil.message);
      onReceived();
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
          } else {
            // Kelebihan kirim dan kesalahan status dilaporkan sebagai toast
            // karena pesannya panjang dan menjelaskan jalan keluarnya.
            toast.error(pesan[0]);
          }
        });
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Barang Datang — ${order.po_number}`}
      description={`Dari ${order.supplier_name}. Stok bertambah otomatis setelah disimpan.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="form-terima" icon={PackageCheck} loading={isSubmitting}>
            {isSubmitting ? 'Menyimpan…' : 'Catat Penerimaan'}
          </Button>
        </>
      }
    >
      <form id="form-terima" onSubmit={handleSubmit(simpan)} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Tanggal Terima"
            type="date"
            max={hariIni()}
            required
            error={errors.receipt_date?.message}
            {...register('receipt_date', { required: 'Tanggal terima wajib diisi.' })}
          />

          <Input
            label="Nomor Surat Jalan"
            placeholder="Contoh: SJ/IDF/8841"
            hint="Dari supplier, untuk mencocokkan dokumen."
            error={errors.delivery_note_number?.message}
            {...register('delivery_note_number')}
          />
        </div>

        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-2 text-sm font-bold text-stone-700">Barang yang Diterima</legend>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500">
              Jumlah sudah terisi sesuai sisa pesanan. Kurangi bila ada yang belum datang.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" icon={CheckCircle2} onClick={isiSemuaPenuh}>
                Isi Penuh
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={kosongkanSemua}>
                Kosongkan
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {barisTersisa.map((baris, index) => {
              const row = items?.[index];
              const jumlah = Number(row?.quantity) || 0;
              const kurang = jumlah > 0 && jumlah < baris.qty_outstanding_display;

              return (
                <div
                  key={baris.id}
                  className={`rounded-lg border p-3 ${
                    jumlah <= 0
                      ? 'border-stone-200 bg-stone-50/50 opacity-60'
                      : kurang
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-emerald-300 bg-emerald-50/40'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-stone-900">{baris.ingredient_name}</p>
                    <p className="text-xs text-stone-500">
                      Sisa pesanan:{' '}
                      <strong className="tabular-nums text-stone-700">
                        {angka(baris.qty_outstanding_display)} {baris.order_unit}
                      </strong>
                      {baris.qty_received_display > 0 && (
                        <span className="ml-2 text-stone-400">
                          (sudah diterima {angka(baris.qty_received_display)})
                        </span>
                      )}
                    </p>
                  </div>

                  <input type="hidden" {...register(`items.${index}.purchase_order_item_id`)} />

                  <div className="grid gap-3 sm:grid-cols-4">
                    <Input
                      label={`Jumlah (${baris.order_unit})`}
                      type="number"
                      step="any"
                      min={0}
                      error={errors.items?.[index]?.quantity?.message}
                      {...register(`items.${index}.quantity`, {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Tidak boleh negatif.' },
                      })}
                    />

                    <Input
                      label={`Harga / ${baris.order_unit}`}
                      type="number"
                      step="any"
                      min={0}
                      hint="Ubah bila berbeda dari pesanan."
                      error={errors.items?.[index]?.unit_price?.message}
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true, min: 0 })}
                    />

                    <Input
                      label="Kedaluwarsa"
                      type="date"
                      hint="Opsional."
                      error={errors.items?.[index]?.expiry_date?.message}
                      {...register(`items.${index}.expiry_date`)}
                    />

                    <Input
                      label="No. Batch"
                      placeholder="Opsional"
                      error={errors.items?.[index]?.batch_number?.message}
                      {...register(`items.${index}.batch_number`)}
                    />
                  </div>

                  {kurang && (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      Kurang {angka(baris.qty_outstanding_display - jumlah)} {baris.order_unit} — pesanan
                      akan berstatus Diterima Sebagian.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-4">
          <span className="text-sm font-semibold text-stone-700">Nilai barang diterima</span>
          <span className="text-lg font-bold tabular-nums text-stone-900">{rupiah(totalNilai)}</span>
        </div>

        <div>
          <label htmlFor="terima-notes" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Catatan Penerimaan
          </label>
          <textarea
            id="terima-notes"
            rows={2}
            placeholder="Kondisi barang, kekurangan, atau catatan lain"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            {...register('notes')}
          />
        </div>
      </form>
    </Modal>
  );
};
