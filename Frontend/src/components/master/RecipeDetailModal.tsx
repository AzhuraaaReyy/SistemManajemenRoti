import React, { useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Feedback';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, persen, rupiah } from '../../lib/format';
import { recipeService } from '../../services/masterService';
import type { Recipe, SimulationResult } from '../../types/master';

interface Props {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
}

export const RecipeDetailModal: React.FC<Props> = ({ open, onClose, recipe }) => {
  const toast = useToast();
  const [jumlah, setJumlah] = useState('');
  const [hasil, setHasil] = useState<SimulationResult | null>(null);
  const [proses, setProses] = useState(false);

  if (!recipe) return null;

  const simulasi = async () => {
    const qty = Number(jumlah);

    if (!qty || qty <= 0) {
      toast.warning('Isi jumlah produksi terlebih dahulu.');
      return;
    }

    setProses(true);

    try {
      const { result } = await recipeService.simulate(recipe.id, qty);
      setHasil(result);
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const tutup = () => {
    setHasil(null);
    setJumlah('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={tutup}
      size="lg"
      title={recipe.name}
      description={`${recipe.product_name} · versi ${recipe.version} · menghasilkan ${angka(recipe.yield_quantity)} ${recipe.yield_unit}`}
      footer={
        <Button variant="secondary" onClick={tutup}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Ringkasan biaya */}
        <dl className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-stone-500">Total Bahan</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(recipe.total_cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">HPP per {recipe.yield_unit}</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(recipe.cost_per_unit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Harga Jual</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(recipe.selling_price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Margin Kotor</dt>
            <dd
              className={`font-bold tabular-nums ${
                recipe.margin_percent == null
                  ? 'text-stone-400'
                  : recipe.margin_percent < 0
                    ? 'text-red-600'
                    : 'text-emerald-600'
              }`}
            >
              {persen(recipe.margin_percent)}
            </dd>
          </div>
        </dl>

        {/* Kapasitas produksi */}
        <div className="rounded-lg border border-stone-200 p-4">
          <p className="text-sm text-stone-600">
            Dengan stok bahan saat ini, resep ini masih bisa membuat{' '}
            <strong className="text-stone-900">
              {angka(recipe.max_producible ?? 0)} {recipe.yield_unit}
            </strong>
            .
            {recipe.limiting_ingredient && (
              <>
                {' '}Bahan pembatasnya adalah{' '}
                <strong className="text-stone-900">{recipe.limiting_ingredient}</strong>.
              </>
            )}
          </p>
        </div>

        {/* Daftar bahan */}
        <div>
          <h4 className="mb-2 text-sm font-bold text-stone-700">Komposisi Bahan</h4>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Takaran</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Susut</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Dipakai</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Biaya</th>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Stok</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {recipe.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{item.ingredient_name}</p>
                      <p className="font-mono text-xs text-stone-400">{item.ingredient_code}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {angka(item.quantity_display)} {item.display_unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                      {item.waste_percent > 0 ? `${angka(item.waste_percent, 1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {angka(item.effective_quantity)} {item.base_unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {rupiah(item.line_cost)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={item.sufficient ? 'success' : 'danger'}>
                        {item.sufficient ? 'Cukup' : 'Kurang'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Simulasi produksi */}
        <div className="rounded-lg border border-stone-200 p-4">
          <h4 className="mb-1 text-sm font-bold text-stone-700">Simulasi Produksi</h4>
          <p className="mb-3 text-xs text-stone-500">
            Cek kebutuhan bahan dan kecukupan stok untuk jumlah produksi tertentu.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label={`Jumlah Produksi (${recipe.yield_unit})`}
                type="number"
                min={1}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="Contoh: 200"
              />
            </div>
            <Button icon={Calculator} onClick={() => void simulasi()} loading={proses}>
              Hitung
            </Button>
          </div>

          {hasil && (
            <div className="mt-4">
              <div
                className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  hasil.can_produce ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {hasil.can_produce ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {hasil.can_produce
                      ? `Bahan mencukupi untuk ${angka(hasil.quantity)} ${recipe.yield_unit}.`
                      : `${hasil.shortages.length} bahan tidak mencukupi.`}
                  </p>
                  <p className="text-xs">
                    Perkiraan biaya bahan: <strong>{rupiah(hasil.estimated_cost)}</strong> · faktor
                    pengali {angka(hasil.factor, 3)}×
                  </p>
                </div>
              </div>

              {hasil.shortages.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {hasil.shortages.map((s) => (
                    <li
                      key={s.ingredient_id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-stone-50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-stone-800">{s.ingredient_name}</span>
                      <span className="tabular-nums text-stone-600">
                        butuh {angka(s.required_base)} {s.base_unit} · tersedia{' '}
                        {angka(s.available_base)} {s.base_unit} ·{' '}
                        <strong className="text-red-600">
                          kurang {angka(s.required_base - s.available_base)} {s.base_unit}
                        </strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {recipe.instructions && (
          <div>
            <h4 className="mb-2 text-sm font-bold text-stone-700">Cara Pembuatan</h4>
            <p className="whitespace-pre-line rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-relaxed text-stone-600">
              {recipe.instructions}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
