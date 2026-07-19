import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { trackingService } from '../../services/productionService';
import type { BatchTracking, ProductionBatch } from '../../types/production';

interface Props {
  open: boolean;
  onClose: () => void;
  batch: ProductionBatch | null;
  onCompleted: (tracking: BatchTracking) => void;
}

/*
| Dialog "Selesaikan Packaging".
|
| Sejak Modul 5 ini bukan lagi tombol pintas untuk menutup batch, melainkan
| penyelesaian tahap terakhir. Menyelesaikan Packaging-lah yang menutup batch
| dan menambah stok produk jadi — karena itu jumlah hasil ditanyakan di sini.
*/
export const CompleteProductionModal: React.FC<Props> = ({ open, onClose, batch, onCompleted }) => {
  const toast = useToast();

  const [good, setGood] = useState('');
  const [reject, setReject] = useState('0');
  const [notes, setNotes] = useState('');
  const [proses, setProses] = useState(false);

  const idempotencyKey = useRef('');

  useEffect(() => {
    if (!open || !batch) return;

    idempotencyKey.current = `packaging-${batch.id}-${Date.now()}`;
    // Diisi sesuai target — kasus paling umum produksi berjalan lancar.
    setGood(String(batch.target_quantity));
    setReject('0');
    setNotes('');
  }, [open, batch]);

  if (!batch) return null;

  const jumlahBaik = Number(good) || 0;
  const jumlahGagal = Number(reject) || 0;
  const target = batch.target_quantity;

  const hppPerUnit = jumlahBaik > 0 ? batch.material_cost / jumlahBaik : 0;
  const yieldRate = target > 0 ? (jumlahBaik / target) * 100 : 0;
  const melesetJauh = jumlahBaik > 0 && yieldRate < 90;

  const simpan = async () => {
    setProses(true);

    try {
      const hasil = await trackingService.finish(batch.id, 'packaging', {
        good_quantity: jumlahBaik,
        reject_quantity: jumlahGagal,
        notes: notes || null,
        idempotency_key: idempotencyKey.current,
      });

      toast.success(hasil.message);
      onCompleted(hasil);
      onClose();
    } catch (error) {
      const validasi = errorValidasi(error);
      toast.error(validasi ? Object.values(validasi)[0][0] : pesanError(error));
    } finally {
      setProses(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Selesaikan Packaging — ${batch.batch_number}`}
      description={`Tahap terakhir · ${batch.product_name} · target ${angka(target)} ${batch.product_unit}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={proses}>
            Batal
          </Button>
          <Button icon={CheckCircle2} onClick={() => void simpan()} loading={proses}>
            Selesaikan
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
          Menyelesaikan Packaging berarti seluruh tahap tuntas: batch ditutup dan stok produk jadi
          bertambah sebanyak hasil layak jual.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label={`Hasil Layak Jual (${batch.product_unit})`}
            type="number"
            min={0}
            step="any"
            required
            value={good}
            onChange={(e) => setGood(e.target.value)}
            hint="Menambah stok produk jadi."
          />

          <Input
            label={`Produk Gagal (${batch.product_unit})`}
            type="number"
            min={0}
            step="any"
            value={reject}
            onChange={(e) => setReject(e.target.value)}
            hint="Gosong, bantat, rusak. Tidak menambah stok."
          />
        </div>

        {/* Ringkasan dampak — supaya konsekuensinya terlihat sebelum disimpan */}
        <dl className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">Biaya Bahan Terpakai</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(batch.material_cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">HPP per {batch.product_unit}</dt>
            <dd className="font-bold tabular-nums text-stone-900">
              {jumlahBaik > 0 ? rupiah(hppPerUnit) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Rasio Hasil</dt>
            <dd
              className={`font-bold tabular-nums ${
                yieldRate >= 95 ? 'text-emerald-600' : yieldRate >= 85 ? 'text-amber-600' : 'text-red-600'
              }`}
            >
              {angka(yieldRate, 1)}%
            </dd>
          </div>
        </dl>

        {/* Biaya roti gosong dibebankan ke roti yang berhasil — perlu dijelaskan
            karena angka HPP-nya jadi lebih tinggi dari perkiraan resep. */}
        {jumlahGagal > 0 && jumlahBaik > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Biaya bahan untuk {angka(jumlahGagal)} {batch.product_unit} yang gagal ikut dibebankan ke{' '}
            {angka(jumlahBaik)} {batch.product_unit} yang berhasil — itulah biaya sebenarnya per unit
            yang bisa dijual.
          </p>
        )}

        {jumlahBaik === 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tanpa hasil layak jual, stok produk tidak bertambah sama sekali dan seluruh{' '}
            {rupiah(batch.material_cost)} biaya bahan tercatat sebagai kerugian.
          </p>
        )}

        {melesetJauh && jumlahBaik > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hasil jauh di bawah target. Bila ini sering terjadi, pertimbangkan menaikkan persentase
            susut pada resep agar perhitungan kebutuhan bahan lebih akurat.
          </p>
        )}

        <div>
          <label htmlFor="selesai-notes" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Catatan Hasil
          </label>
          <textarea
            id="selesai-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kendala saat produksi, penyebab kegagalan, dan sebagainya"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          />
        </div>
      </div>
    </Modal>
  );
};
