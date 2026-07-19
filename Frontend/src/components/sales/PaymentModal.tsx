import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CreditCard, QrCode, Wallet } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { angka, rupiah } from '../../lib/format';
import type { Calculation, PaymentMethod, PaymentMethodOption } from '../../types/sales';

interface Props {
  open: boolean;
  calculation: Calculation | null;
  methods: PaymentMethodOption[];
  processing: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    payment_method: PaymentMethod;
    paid_amount: number;
    customer_name: string | null;
    notes: string | null;
  }) => void;
}

const IKON: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  qris: QrCode,
  transfer: CreditCard,
};

/**
 * Pecahan uang untuk tombol cepat.
 *
 * Kasir yang sedang melayani antrean tidak sempat mengetik "50000" — satu
 * ketukan jauh lebih cepat, dan salah ketik nol adalah kesalahan yang paling
 * sering terjadi di meja kasir.
 */
const PECAHAN = [2000, 5000, 10000, 20000, 50000, 100000];

export const PaymentModal: React.FC<Props> = ({
  open,
  calculation,
  methods,
  processing,
  onClose,
  onConfirm,
}) => {
  const [metode, setMetode] = useState<PaymentMethod>('cash');
  const [dibayar, setDibayar] = useState('');
  const [pelanggan, setPelanggan] = useState('');
  const [catatan, setCatatan] = useState('');

  const total = calculation?.total ?? 0;

  useEffect(() => {
    if (!open) return;

    setMetode('cash');
    setDibayar('');
    setPelanggan('');
    setCatatan('');
  }, [open]);

  const perluKembalian = useMemo(
    () => methods.find((m) => m.value === metode)?.needs_change ?? false,
    [methods, metode],
  );

  const jumlahBayar = perluKembalian ? Number(dibayar) || 0 : total;
  const kembalian = jumlahBayar - total;
  const cukup = !perluKembalian || jumlahBayar + 0.01 >= total;

  /**
   * Pembulatan ke atas ke pecahan yang wajar.
   *
   * Total Rp41.000 menghasilkan saran Rp50.000 — pecahan yang benar-benar ada
   * di dompet, bukan Rp41.000 yang menuntut uang pas.
   */
  const saranUang = useMemo(() => {
    if (total <= 0) return [];

    const hasil = new Set<number>([Math.ceil(total)]);

    for (const p of [5000, 10000, 20000, 50000, 100000]) {
      const bulat = Math.ceil(total / p) * p;
      if (bulat >= total) hasil.add(bulat);
    }

    return Array.from(hasil)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [total]);

  if (!calculation) return null;

  const bayar = () => {
    onConfirm({
      payment_method: metode,
      paid_amount: jumlahBayar,
      customer_name: pelanggan.trim() || null,
      notes: catatan.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Pembayaran"
      description={`Total belanja ${rupiah(total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={processing}>
            Kembali
          </Button>
          <Button
            icon={Wallet}
            onClick={bayar}
            loading={processing}
            disabled={!cukup || total <= 0}
          >
            Simpan Transaksi
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Rincian total */}
        <dl className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Subtotal</dt>
            <dd className="tabular-nums text-stone-700">{rupiah(calculation.subtotal)}</dd>
          </div>

          {calculation.discount_amount > 0 && (
            <div className="flex justify-between">
              <dt className="text-stone-500">
                Diskon
                {calculation.discount_type === 'percent' && ` ${angka(calculation.discount_value)}%`}
              </dt>
              <dd className="tabular-nums text-amber-700">
                −{rupiah(calculation.discount_amount)}
              </dd>
            </div>
          )}

          {calculation.tax_amount > 0 && (
            <div className="flex justify-between">
              <dt className="text-stone-500">Pajak {angka(calculation.tax_percent)}%</dt>
              <dd className="tabular-nums text-stone-700">{rupiah(calculation.tax_amount)}</dd>
            </div>
          )}

          <div className="flex justify-between border-t border-stone-200 pt-1.5">
            <dt className="font-bold text-stone-800">Total</dt>
            <dd className="text-lg font-bold tabular-nums text-stone-900">{rupiah(total)}</dd>
          </div>
        </dl>

        {/* Metode pembayaran */}
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-700">Metode Pembayaran</p>

          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => {
              const Ikon = IKON[m.value] ?? Wallet;
              const aktif = metode === m.value;

              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMetode(m.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm font-semibold transition ${
                    aktif
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                  aria-pressed={aktif}
                >
                  <Ikon className="h-5 w-5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {perluKembalian ? (
          <div>
            <Input
              label="Uang Diterima"
              type="number"
              min={0}
              step="any"
              autoFocus
              value={dibayar}
              onChange={(e) => setDibayar(e.target.value)}
              hint="Kosongkan lalu tekan Uang Pas bila pelanggan membayar tepat."
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDibayar(String(Math.ceil(total)))}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Uang Pas
              </button>

              {saranUang.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDibayar(String(n))}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  {rupiah(n)}
                </button>
              ))}

              {/* Menambah pecahan ke jumlah yang sudah diketik — untuk
                  pelanggan yang menyerahkan beberapa lembar sekaligus. */}
              {PECAHAN.slice(3).map((n) => (
                <button
                  key={`plus-${n}`}
                  type="button"
                  onClick={() => setDibayar(String((Number(dibayar) || 0) + n))}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-200"
                >
                  +{angka(n / 1000)}rb
                </button>
              ))}
            </div>

            <div
              className={`mt-3 flex items-center justify-between rounded-lg p-3 ${
                !cukup
                  ? 'bg-red-50 text-red-800'
                  : kembalian > 0
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-stone-50 text-stone-700'
              }`}
            >
              <span className="text-sm font-semibold">
                {!cukup ? 'Uang kurang' : 'Kembalian'}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {rupiah(Math.abs(kembalian))}
              </span>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pembayaran {methods.find((m) => m.value === metode)?.label} dicatat pas sejumlah
            tagihan, tanpa kembalian. Pastikan pembayarannya sudah masuk sebelum menyimpan.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nama Pelanggan"
            placeholder="Opsional"
            value={pelanggan}
            onChange={(e) => setPelanggan(e.target.value)}
          />

          <Input
            label="Catatan"
            placeholder="Opsional"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};
