import React from 'react';
import { AlertTriangle, PackageCheck, Truck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import { angka, rupiah, tanggal, tanggalWaktu } from '../../lib/format';
import type { PurchaseOrder } from '../../types/purchase';

interface Props {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
}

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const PurchaseDetailModal: React.FC<Props> = ({ open, onClose, order }) => {
  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={order.po_number}
      description={`${order.supplier_name} · dipesan ${tanggal(order.order_date)}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Status & kemajuan */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <Badge tone={TONE[order.status_tone] ?? 'neutral'}>{order.status_label}</Badge>

          {order.is_overdue && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Terlambat {order.days_late} hari
            </span>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${order.received_percent ?? 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-stone-600">
              {angka(order.received_percent ?? 0, 1)}% diterima
            </span>
          </div>
        </div>

        {/* Informasi pesanan */}
        <dl className="grid gap-4 rounded-lg border border-stone-200 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">Supplier</dt>
            <dd className="font-semibold text-stone-900">{order.supplier_name}</dd>
            {order.supplier_contact && (
              <dd className="text-xs text-stone-500">
                {order.supplier_contact}
                {order.supplier_phone && ` · ${order.supplier_phone}`}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-stone-500">Perkiraan Tiba</dt>
            <dd className="font-semibold text-stone-900">{tanggal(order.expected_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Selesai</dt>
            <dd className="font-semibold text-stone-900">{tanggal(order.completed_date)}</dd>
          </div>
        </dl>

        {/* Daftar barang */}
        <div>
          <h4 className="mb-2 text-sm font-bold text-stone-700">Daftar Barang</h4>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Pesan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Terima</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Harga</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Subtotal</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{item.ingredient_name}</p>
                      <p className="font-mono text-xs text-stone-400">{item.ingredient_code}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {angka(item.qty_ordered_display)} {item.order_unit}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${item.is_fully_received ? 'text-emerald-700' : 'text-amber-700'}`}
                      >
                        {angka(item.qty_received_display)}
                      </span>
                      {!item.is_fully_received && (
                        <p className="text-xs text-stone-400">
                          sisa {angka(item.qty_outstanding_display)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {rupiah(item.unit_price_display)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                      {rupiah(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-stone-200 bg-stone-50">
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-stone-500">Subtotal</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">{rupiah(order.subtotal)}</td>
                </tr>
                {order.discount_amount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-stone-500">Diskon</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-600">
                      − {rupiah(order.discount_amount)}
                    </td>
                  </tr>
                )}
                {order.shipping_cost > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-stone-500">Ongkos kirim</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                      + {rupiah(order.shipping_cost)}
                    </td>
                  </tr>
                )}
                {order.tax_amount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-stone-500">Pajak</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                      + {rupiah(order.tax_amount)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-stone-300">
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-bold text-stone-800">Total</td>
                  <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-stone-900">
                    {rupiah(order.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Riwayat penerimaan */}
        <div>
          <h4 className="mb-2 text-sm font-bold text-stone-700">
            Riwayat Penerimaan{' '}
            <span className="font-normal text-stone-400">({order.receipts?.length ?? 0}×)</span>
          </h4>

          {(order.receipts?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
              Belum ada barang yang diterima.
            </p>
          ) : (
            <ol className="space-y-3">
              {order.receipts?.map((receipt) => (
                <li key={receipt.id} className="rounded-lg border border-stone-200 p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <span className="font-semibold text-stone-900">{receipt.receipt_number}</span>
                      <span className="text-xs text-stone-500">{tanggal(receipt.receipt_date)}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-stone-700">
                      {rupiah(receipt.total_value)}
                    </span>
                  </div>

                  <ul className="space-y-1 text-xs">
                    {receipt.items?.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3 text-stone-600">
                        <span>{item.ingredient_name}</span>
                        <span className="tabular-nums">
                          {angka(item.quantity_display)} {item.unit} × {rupiah(item.unit_price_display)}
                          {item.expiry_date && (
                            <span className="ml-2 text-amber-700">exp {tanggal(item.expiry_date)}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex flex-wrap gap-x-4 border-t border-stone-100 pt-2 text-xs text-stone-400">
                    {receipt.delivery_note_number && <span>Surat jalan: {receipt.delivery_note_number}</span>}
                    {receipt.received_by_name && <span>Diterima: {receipt.received_by_name}</span>}
                  </div>

                  {receipt.notes && (
                    <p className="mt-1.5 text-xs italic text-stone-500">{receipt.notes}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Catatan & jejak */}
        {order.notes && (
          <div>
            <h4 className="mb-1.5 text-sm font-bold text-stone-700">Catatan</h4>
            <p className="whitespace-pre-line rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              {order.notes}
            </p>
          </div>
        )}

        {order.cancel_reason && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">Dibatalkan</p>
            <p className="mt-0.5 text-sm text-red-700">{order.cancel_reason}</p>
            <p className="mt-1 text-xs text-red-600">
              Oleh {order.cancelled_by_name} · {tanggalWaktu(order.cancelled_at)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 pt-3 text-xs text-stone-400">
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3" />
            Dibuat {order.created_by_name ?? '—'} · {tanggalWaktu(order.created_at)}
          </span>
          {order.ordered_at && (
            <span>Dikonfirmasi {order.ordered_by_name} · {tanggalWaktu(order.ordered_at)}</span>
          )}
        </div>
      </div>
    </Modal>
  );
};
