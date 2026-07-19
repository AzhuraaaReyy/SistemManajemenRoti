import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Factory, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Feedback';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { productionService } from '../../services/productionService';
import type { ProductOption } from '../../types/master';
import type { ProductionPreview } from '../../types/production';

interface Props {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
  onStarted: () => void;
}

export const ProductionFormModal: React.FC<Props> = ({ open, onClose, products, onStarted }) => {
  const toast = useToast();

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const [preview, setPreview] = useState<ProductionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [memuatPreview, setMemuatPreview] = useState(false);
  const [menjalankan, setMenjalankan] = useState(false);

  /** Dibuat sekali per pembukaan dialog agar klik ganda tidak membuat dua batch. */
  const idempotencyKey = useRef('');

  // Menomori permintaan supaya respons yang datang terlambat tidak menimpa
  // hasil pratinjau yang lebih baru.
  const permintaanKe = useRef(0);

  useEffect(() => {
    if (!open) return;

    idempotencyKey.current = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setProductId('');
    setQuantity('');
    setNotes('');
    setPreview(null);
    setPreviewError(null);
  }, [open]);

  const ambilPreview = useCallback(async () => {
    const qty = Number(quantity);

    if (!productId || !qty || qty <= 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const nomor = ++permintaanKe.current;
    setMemuatPreview(true);
    setPreviewError(null);

    try {
      const { preview: hasil } = await productionService.preview(Number(productId), qty);

      if (nomor === permintaanKe.current) setPreview(hasil);
    } catch (error) {
      if (nomor === permintaanKe.current) {
        setPreview(null);
        // Produk tanpa resep aktif ditolak di sini — pesannya ditampilkan
        // sebagai peringatan di dalam dialog, bukan toast yang cepat hilang.
        setPreviewError(pesanError(error, 'Gagal menghitung kebutuhan bahan.'));
      }
    } finally {
      if (nomor === permintaanKe.current) setMemuatPreview(false);
    }
  }, [productId, quantity]);

  // Pratinjau ditunda 350 ms setelah pengetikan berhenti, agar mengetik "150"
  // tidak memicu tiga permintaan berturut-turut.
  useEffect(() => {
    const timer = window.setTimeout(() => void ambilPreview(), 350);
    return () => window.clearTimeout(timer);
  }, [ambilPreview]);

  const jalankan = async () => {
    const qty = Number(quantity);

    if (!productId || !qty || qty <= 0) {
      toast.warning('Pilih produk dan isi jumlah produksi terlebih dahulu.');
      return;
    }

    setMenjalankan(true);

    try {
      const { message } = await productionService.start({
        product_id: Number(productId),
        quantity: qty,
        notes: notes || null,
        idempotency_key: idempotencyKey.current,
      });

      toast.success(message);
      onStarted();
      onClose();
    } catch (error) {
      const validasi = errorValidasi(error);

      // Server mengembalikan rincian per bahan pada errors.materials.
      // Pratinjau sudah menampilkannya, jadi di sini cukup pesan ringkasnya.
      if (validasi?.materials) {
        toast.error(pesanError(error));
        void ambilPreview();
      } else if (validasi) {
        toast.error(Object.values(validasi)[0][0]);
      } else {
        toast.error(pesanError(error));
      }
    } finally {
      setMenjalankan(false);
    }
  };

  const produkTerpilih = products.find((p) => String(p.value) === productId);
  const bisaJalan = preview?.can_produce === true && !memuatPreview;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Mulai Produksi"
      description="Pilih produk dan jumlahnya. Sistem menghitung kebutuhan bahan dari resep aktif."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={menjalankan}>
            Batal
          </Button>
          <Button
            icon={Factory}
            onClick={() => void jalankan()}
            loading={menjalankan}
            disabled={!bisaJalan}
            title={
              !bisaJalan && preview && !preview.can_produce
                ? 'Ada bahan yang stoknya tidak mencukupi'
                : undefined
            }
          >
            {menjalankan ? 'Memproses…' : 'Jalankan Produksi'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Produk"
            placeholder="— Pilih produk —"
            required
            options={products.map((p) => ({ value: String(p.value), label: p.label }))}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            hint={produkTerpilih ? `Harga jual ${rupiah(produkTerpilih.selling_price)}` : undefined}
          />

          <Input
            label={`Jumlah Produksi${produkTerpilih ? ` (${produkTerpilih.unit})` : ''}`}
            type="number"
            min={1}
            step="any"
            required
            placeholder="Contoh: 50"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            hint={
              preview
                ? `Maksimal ${angka(preview.max_producible.quantity)} dengan stok saat ini`
                : undefined
            }
          />
        </div>

        {/* Peringatan bila resep belum ada */}
        {previewError && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-800">{previewError}</p>
          </div>
        )}

        {memuatPreview && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 py-8 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Menghitung kebutuhan bahan…
          </div>
        )}

        {/* Pratinjau kebutuhan bahan — inti dari layar ini */}
        {preview && !memuatPreview && (
          <>
            <div
              className={`flex items-start gap-3 rounded-lg p-4 ${
                preview.can_produce
                  ? 'border border-emerald-200 bg-emerald-50'
                  : 'border border-red-200 bg-red-50'
              }`}
            >
              {preview.can_produce ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    preview.can_produce ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {preview.can_produce
                    ? 'Seluruh bahan mencukupi. Produksi dapat dijalankan.'
                    : `${preview.shortages.length} bahan tidak mencukupi — produksi akan ditolak.`}
                </p>

                <p className="mt-0.5 text-xs text-stone-600">
                  Resep <strong>{preview.recipe.name}</strong> versi {preview.recipe.version} ·
                  standar {angka(preview.recipe.yield_quantity)} {preview.recipe.yield_unit} ·
                  faktor pengali {angka(preview.factor, 3)}×
                </p>

                {!preview.can_produce && preview.max_producible.limiting_ingredient && (
                  <p className="mt-1.5 text-xs text-red-700">
                    Dengan stok sekarang maksimal{' '}
                    <strong>{angka(preview.max_producible.quantity)} {preview.product.unit}</strong>,
                    dibatasi oleh <strong>{preview.max_producible.limiting_ingredient}</strong>.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-stone-700">Kebutuhan Bahan</h4>

              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Butuh</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Tersedia</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Biaya</th>
                      <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {preview.materials.map((m) => (
                      <tr key={m.ingredient_id} className={m.sufficient ? '' : 'bg-red-50/60'}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-stone-800">{m.name}</p>
                          <p className="font-mono text-xs text-stone-400">{m.code}</p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-stone-800">
                          {angka(m.required_display, 3)} {m.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                          {angka(m.available_display, 3)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                          {rupiah(m.line_cost)}
                        </td>
                        <td className="px-3 py-2">
                          {m.sufficient ? (
                            <Badge tone="success">Cukup</Badge>
                          ) : (
                            <div>
                              <Badge tone="danger">Kurang</Badge>
                              <p className="mt-0.5 text-xs font-semibold tabular-nums text-red-600">
                                −{angka(m.shortage_display, 3)} {m.unit}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ringkasan biaya */}
            <dl className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-stone-500">Total Biaya Bahan</dt>
                <dd className="font-bold tabular-nums text-stone-900">{rupiah(preview.material_cost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">HPP per {preview.product.unit}</dt>
                <dd className="font-bold tabular-nums text-stone-900">{rupiah(preview.cost_per_unit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Harga Jual</dt>
                <dd className="font-bold tabular-nums text-stone-900">
                  {rupiah(preview.product.selling_price)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Margin per {preview.product.unit}</dt>
                <dd
                  className={`font-bold tabular-nums ${
                    preview.product.selling_price - preview.cost_per_unit < 0
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {rupiah(preview.product.selling_price - preview.cost_per_unit)}
                </dd>
              </div>
            </dl>
          </>
        )}

        <div>
          <label htmlFor="prod-notes" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Catatan
          </label>
          <textarea
            id="prod-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shift, operator tambahan, atau catatan lain"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          />
        </div>

        <p className="rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
          Saat dijalankan, stok bahan langsung dipotong dan batch berstatus{' '}
          <strong>Diproses</strong>. Stok produk jadi baru bertambah setelah batch diselesaikan
          dengan mengisi jumlah hasil yang layak jual.
        </p>
      </div>
    </Modal>
  );
};
