import React from 'react';
import { Printer, ShoppingBag, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { angka } from '../../lib/format';
import type { PosSettings, Sale } from '../../types/sales';

interface Props {
  open: boolean;
  sale: Sale | null;
  settings: PosSettings | null;
  onClose: () => void;
  /** Tombol tambahan, mis. "Transaksi Baru" setelah pembayaran selesai. */
  onNewSale?: () => void;
}

/*
| Struk thermal 58mm.
|
| Lebarnya dikunci 58mm dengan huruf monospace — format printer struk yang
| lazim dipakai UMKM. Tetap bisa dicetak ke printer biasa lewat dialog cetak
| browser; satu tata letak melayani keduanya.
|
| Pencetakan memakai window.print() dengan aturan @media print di index.css:
| seluruh halaman disembunyikan kecuali elemen ber-id `struk-cetak`. Cara ini
| dipilih daripada membuka jendela baru karena pemblokir pop-up sering
| menghalanginya, dan kasir tidak akan tahu kenapa struknya tidak keluar.
*/

const LEBAR_KOLOM = 32;

/** Baris "Nama .......... Nilai" selebar kertas struk. */
const Baris: React.FC<{ kiri: string; kanan: string; tebal?: boolean }> = ({
  kiri,
  kanan,
  tebal = false,
}) => (
  <div className={`flex justify-between gap-2 ${tebal ? 'font-bold' : ''}`}>
    <span className="truncate">{kiri}</span>
    <span className="shrink-0 tabular-nums">{kanan}</span>
  </div>
);

const Pemisah: React.FC = () => (
  <div className="my-1 overflow-hidden text-stone-400" aria-hidden="true">
    {'-'.repeat(LEBAR_KOLOM)}
  </div>
);

export const ReceiptModal: React.FC<Props> = ({ open, sale, settings, onClose, onNewSale }) => {
  if (!open || !sale) return null;

  const cetak = () => window.print();

  const waktu = sale.created_at
    ? new Date(sale.created_at).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="no-print absolute inset-0 bg-stone-900/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Struk ${sale.sale_number}`}
        className="animate-modal-in relative flex max-h-[92vh] w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="no-print flex items-center justify-between border-b border-stone-200 p-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">Struk Transaksi</h2>
            <p className="font-mono text-xs text-stone-500">{sale.sale_number}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-stone-100 p-4">
          {/* Lebar 58mm — sama dengan kertas struk sungguhan */}
          <div
            id="struk-cetak"
            className="mx-auto bg-white p-3 font-mono text-[11px] leading-snug text-stone-900 shadow-sm"
            style={{ width: '58mm' }}
          >
            <div className="text-center">
              <p className="text-[13px] font-bold uppercase">{settings?.store_name ?? 'Toko'}</p>
              {settings?.store_address && <p className="text-[10px]">{settings.store_address}</p>}
              {settings?.store_phone && <p className="text-[10px]">{settings.store_phone}</p>}
            </div>

            <Pemisah />

            <Baris kiri="No" kanan={sale.sale_number} />
            <Baris kiri="Tgl" kanan={waktu} />
            <Baris kiri="Kasir" kanan={sale.cashier_name ?? '—'} />
            {sale.customer_name && <Baris kiri="Plgn" kanan={sale.customer_name} />}

            <Pemisah />

            {sale.items?.map((i) => (
              <div key={i.id} className="mb-1">
                <p className="truncate">{i.product_name}</p>
                <Baris
                  kiri={`  ${angka(i.quantity)} x ${angka(i.unit_price, 0)}`}
                  kanan={angka(i.line_total, 0)}
                />
              </div>
            ))}

            <Pemisah />

            <Baris kiri="Subtotal" kanan={angka(sale.subtotal, 0)} />

            {sale.discount_amount > 0 && (
              <Baris
                kiri={
                  sale.discount_type === 'percent'
                    ? `Diskon ${angka(sale.discount_value)}%`
                    : 'Diskon'
                }
                kanan={`-${angka(sale.discount_amount, 0)}`}
              />
            )}

            {sale.tax_amount > 0 && (
              <Baris kiri={`Pajak ${angka(sale.tax_percent)}%`} kanan={angka(sale.tax_amount, 0)} />
            )}

            <Pemisah />

            <Baris kiri="TOTAL" kanan={angka(sale.total, 0)} tebal />
            <Baris kiri={sale.payment_label} kanan={angka(sale.paid_amount, 0)} />

            {sale.change_amount > 0 && (
              <Baris kiri="Kembali" kanan={angka(sale.change_amount, 0)} />
            )}

            {sale.status === 'voided' && (
              <>
                <Pemisah />
                <p className="text-center font-bold">*** DIBATALKAN ***</p>
                {sale.void_reason && (
                  <p className="text-center text-[10px]">{sale.void_reason}</p>
                )}
              </>
            )}

            <Pemisah />

            <p className="text-center text-[10px]">{settings?.receipt_footer ?? 'Terima kasih!'}</p>
          </div>
        </div>

        <div className="no-print flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 p-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>

          <Button variant="secondary" icon={Printer} onClick={cetak}>
            Cetak
          </Button>

          {onNewSale && (
            <Button icon={ShoppingBag} onClick={onNewSale}>
              Transaksi Baru
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
