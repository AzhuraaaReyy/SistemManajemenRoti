import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { inventoryService } from '../../services/inventoryService';
import type { StockItem } from '../../types/inventory';

interface Props {
  open: boolean;
  item: StockItem | null;
  onClose: () => void;
  onAdjusted: () => void;
}

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

/**
 * Penyesuaian stok manual.
 *
 * Pengguna mengisi hasil HITUNGAN FISIK, bukan selisihnya. Menghitung selisih
 * sendiri adalah sumber kesalahan yang tidak perlu — orang di gudang tahu ada
 * berapa kilogram di rak, bukan berapa kilogram yang hilang.
 */
export const StockAdjustmentModal: React.FC<Props> = ({ open, item, onClose, onAdjusted }) => {
  const toast = useToast();

  const [hitungan, setHitungan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);

  const idempotencyKey = useRef('');

  useEffect(() => {
    if (!open || !item) return;

    idempotencyKey.current = `adjust-${item.kind}-${item.id}-${Date.now()}`;
    setHitungan(String(item.current_stock));
    setCatatan('');
  }, [open, item]);

  if (!item) return null;

  const fisik = Number(hitungan);
  const valid = hitungan !== '' && Number.isFinite(fisik) && fisik >= 0;
  const selisih = valid ? fisik - item.current_stock : 0;
  const adaSelisih = Math.abs(selisih) > 0.00005;

  // Status setelah penyesuaian dihitung di sini juga, memakai rumus yang sama
  // dengan server, supaya konsekuensinya terlihat SEBELUM disimpan.
  const statusBaru = (() => {
    if (!valid) return null;
    if (fisik <= 0) return 'Habis';
    if (item.min_stock <= 0) return 'Aman';
    if (fisik < item.min_stock * 0.5) return 'Kritis';
    if (fisik <= item.min_stock) return 'Menipis';
    if (fisik > item.min_stock * 3) return 'Berlebih';
    return 'Aman';
  })();

  const memburuk = statusBaru !== null && ['Habis', 'Kritis', 'Menipis'].includes(statusBaru);

  const simpan = async () => {
    if (!valid) {
      toast.warning('Isi jumlah hasil hitungan fisik terlebih dahulu.');
      return;
    }

    if (catatan.trim().length < 10) {
      toast.warning('Alasan penyesuaian minimal 10 karakter.');
      return;
    }

    setProses(true);

    try {
      const { message } = await inventoryService.adjust({
        kind: item.kind,
        item_id: item.id,
        physical_count: fisik,
        note: catatan.trim(),
        idempotency_key: idempotencyKey.current,
      });

      toast.success(message);
      onAdjusted();
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
      title={`Penyesuaian Stok — ${item.name}`}
      description={`${item.code} · ${item.kind_label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={proses}>
            Batal
          </Button>
          <Button icon={ClipboardCheck} onClick={() => void simpan()} loading={proses}>
            Simpan Penyesuaian
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">Stok Tercatat</dt>
            <dd className="font-bold tabular-nums text-stone-900">
              {angka(item.current_stock, 4)} {item.unit}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Batas Minimum</dt>
            <dd className="font-bold tabular-nums text-stone-900">
              {angka(item.min_stock, 4)} {item.unit}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Status Sekarang</dt>
            <dd className="mt-0.5">
              <Badge tone={TONE[item.status_tone] ?? 'neutral'}>{item.status_label}</Badge>
            </dd>
          </div>
        </dl>

        <Input
          label={`Hasil Hitungan Fisik (${item.unit})`}
          type="number"
          min={0}
          step="any"
          required
          value={hitungan}
          onChange={(e) => setHitungan(e.target.value)}
          hint="Isi jumlah yang benar-benar ada di gudang. Selisihnya dihitung sistem."
        />

        {/* Dampak diperlihatkan sebelum disimpan — penyesuaian stok adalah satu
            dari sedikit aksi di sistem ini yang mengubah angka tanpa transaksi
            di baliknya, jadi konsekuensinya harus terbaca dulu. */}
        {valid && adaSelisih && (
          <div
            className={`rounded-lg border p-4 ${
              selisih > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p
              className={`flex items-center gap-2 text-sm font-bold ${
                selisih > 0 ? 'text-emerald-800' : 'text-amber-800'
              }`}
            >
              {selisih > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              Stok {selisih > 0 ? 'bertambah' : 'berkurang'} {angka(Math.abs(selisih), 4)} {item.unit}
            </p>

            <p className="mt-1 text-xs text-stone-600">
              {angka(item.current_stock, 4)} → <strong>{angka(fisik, 4)}</strong> {item.unit} · status
              menjadi <strong>{statusBaru}</strong>
              {item.avg_cost > 0 && (
                <>
                  {' '}
                  · nilai persediaan{' '}
                  <strong>
                    {selisih > 0 ? '+' : '−'}
                    {rupiah(Math.abs(selisih) * item.avg_cost)}
                  </strong>
                </>
              )}
            </p>
          </div>
        )}

        {valid && !adaSelisih && (
          <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
            Angkanya sama dengan catatan sistem. Menyimpan tidak akan mencatat mutasi apa pun —
            dan itu memang hasil yang diharapkan dari opname yang cocok.
          </p>
        )}

        {valid && adaSelisih && memburuk && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Setelah penyesuaian, barang ini masuk status <strong>{statusBaru}</strong> dan akan
            memunculkan peringatan stok.
          </p>
        )}

        <div>
          <label htmlFor="alasan-penyesuaian" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Alasan Penyesuaian <span className="text-red-500">*</span>
          </label>
          <textarea
            id="alasan-penyesuaian"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: Hasil opname 19 Juli, selisih karena tumpah saat penimbangan"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          />
          <p className="mt-1 text-xs text-stone-500">
            Minimal 10 karakter. Tercatat permanen di riwayat mutasi — inilah satu-satunya
            keterangan yang tersisa bila selisih ini dipertanyakan berbulan-bulan kemudian.
          </p>
        </div>
      </div>
    </Modal>
  );
};
