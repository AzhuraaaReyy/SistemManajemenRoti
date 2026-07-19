import React from 'react';
import { Clock, Factory, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import { angka, persen, rupiah, tanggalWaktu } from '../../lib/format';
import type { ProductionBatch } from '../../types/production';

interface Props {
  open: boolean;
  onClose: () => void;
  batch: ProductionBatch | null;
}

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const ProductionDetailModal: React.FC<Props> = ({ open, onClose, batch }) => {
  if (!batch) return null;

  const durasi = batch.duration_minutes;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={batch.batch_number}
      description={`${batch.product_name} · resep ${batch.recipe_name} v${batch.recipe_version}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Status & hasil */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <Badge tone={TONE[batch.status_tone] ?? 'neutral'}>{batch.status_label}</Badge>

          <span className="text-sm text-stone-600">
            Target <strong className="tabular-nums text-stone-900">{angka(batch.target_quantity)}</strong>{' '}
            {batch.product_unit}
          </span>

          {batch.good_quantity !== null && (
            <>
              <span className="text-sm text-stone-600">
                Hasil{' '}
                <strong className="tabular-nums text-emerald-700">{angka(batch.good_quantity)}</strong>
              </span>
              {batch.reject_quantity > 0 && (
                <span className="text-sm text-stone-600">
                  Gagal{' '}
                  <strong className="tabular-nums text-red-600">{angka(batch.reject_quantity)}</strong>
                </span>
              )}
              <span className="ml-auto text-sm">
                Rasio hasil{' '}
                <strong
                  className={`tabular-nums ${
                    (batch.yield_rate ?? 0) >= 95
                      ? 'text-emerald-600'
                      : (batch.yield_rate ?? 0) >= 85
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {persen(batch.yield_rate)}
                </strong>
              </span>
            </>
          )}
        </div>

        {/* Biaya */}
        <dl className="grid gap-3 rounded-lg border border-stone-200 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">Total Biaya Bahan</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(batch.material_cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">HPP per {batch.product_unit}</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(batch.cost_per_unit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Kerugian Produk Gagal</dt>
            <dd
              className={`font-bold tabular-nums ${batch.reject_cost > 0 ? 'text-red-600' : 'text-stone-900'}`}
            >
              {rupiah(batch.reject_cost)}
            </dd>
          </div>
        </dl>

        {/* Pemakaian bahan */}
        <div>
          <h4 className="mb-2 text-sm font-bold text-stone-700">Pemakaian Bahan</h4>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Dipakai</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Susut</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Stok Saat Itu</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Biaya</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {batch.materials?.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{m.ingredient_name}</p>
                      <p className="font-mono text-xs text-stone-400">{m.ingredient_code}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                      {angka(m.qty_used_display, 3)} {m.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                      {m.waste_percent > 0 ? `${angka(m.waste_percent, 1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-stone-500">
                      {angka(m.stock_before_display, 2)} → {angka(m.stock_after_display, 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {rupiah(m.line_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-stone-200 bg-stone-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-bold text-stone-800">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-stone-900">
                    {rupiah(batch.material_cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-2 text-xs text-stone-400">
            Harga bahan dibekukan pada saat produksi berjalan, sehingga HPP batch ini tidak berubah
            walaupun harga bahan naik di kemudian hari.
          </p>
        </div>

        {batch.notes && (
          <div>
            <h4 className="mb-1.5 text-sm font-bold text-stone-700">Catatan</h4>
            <p className="whitespace-pre-line rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              {batch.notes}
            </p>
          </div>
        )}

        {batch.cancel_reason && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">Dibatalkan</p>
            <p className="mt-0.5 text-sm text-red-700">{batch.cancel_reason}</p>
            <p className="mt-1 text-xs text-red-600">
              Oleh {batch.cancelled_by_name} · {tanggalWaktu(batch.cancelled_at)} — seluruh bahan
              telah dikembalikan ke stok.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 pt-3 text-xs text-stone-400">
          <span className="inline-flex items-center gap-1">
            <Factory className="h-3 w-3" />
            Dimulai {tanggalWaktu(batch.started_at)}
          </span>
          {batch.operator_name && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              Operator {batch.operator_name}
            </span>
          )}
          {batch.finished_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Selesai {tanggalWaktu(batch.finished_at)}
              {durasi !== null && ` (${durasi < 60 ? `${durasi} menit` : `${Math.floor(durasi / 60)} jam ${durasi % 60} menit`})`}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};
