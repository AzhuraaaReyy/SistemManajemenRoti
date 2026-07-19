import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, Gauge, PackageX, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader, StatCard } from '../../components/data/PageHeader';
import { Badge, LoadingScreen } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, persen, rupiah, tanggalWaktu } from '../../lib/format';
import { productionService } from '../../services/productionService';
import type { ProductionDashboard } from '../../types/production';

export const ProductionDashboardPage: React.FC = () => {
  const toast = useToast();
  const [data, setData] = useState<ProductionDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      setData(await productionService.dashboard(6));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat dashboard produksi.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (loading) return <LoadingScreen label="Memuat dashboard produksi…" />;
  if (!data) return null;

  const { ringkasan, batch_aktif, tren_bulanan, produk_teratas, bahan_terpakai, kapasitas_produksi } = data;

  const unitTertinggi = Math.max(...tren_bulanan.map((t) => t.unit), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Produksi"
        description="Ringkasan kegiatan produksi enam bulan terakhir."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sedang Diproses"
          value={ringkasan.batch_aktif}
          icon={Factory}
          tone={ringkasan.batch_aktif > 0 ? 'warning' : 'neutral'}
          hint={`${ringkasan.batch_bulan_ini} batch bulan ini`}
        />
        <StatCard
          label="Unit Diproduksi"
          value={angka(ringkasan.unit_diproduksi)}
          icon={TrendingUp}
          tone="success"
          hint="Bulan ini, layak jual"
        />
        <StatCard
          label="Produk Gagal"
          value={angka(ringkasan.unit_gagal)}
          icon={PackageX}
          tone={ringkasan.unit_gagal > 0 ? 'danger' : 'success'}
          hint="Bulan ini"
        />
        <StatCard
          label="Rasio Hasil"
          value={ringkasan.yield_rate_rata2 !== null ? persen(ringkasan.yield_rate_rata2) : '—'}
          icon={Gauge}
          tone={
            ringkasan.yield_rate_rata2 === null
              ? 'neutral'
              : ringkasan.yield_rate_rata2 >= 95
                ? 'success'
                : ringkasan.yield_rate_rata2 >= 85
                  ? 'warning'
                  : 'danger'
          }
          hint="Hasil nyata vs target"
        />
      </div>

      {/* Batch yang sedang berjalan — paling perlu ditindaklanjuti */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Sedang Diproses</h3>
            <p className="mt-0.5 text-sm text-stone-500">
              Batch yang bahannya sudah dipotong tetapi belum diselesaikan.
            </p>
          </div>

          <Link
            to="/produksi/batch"
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700"
          >
            Kelola Batch
          </Link>
        </div>

        {batch_aktif.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            Tidak ada produksi yang sedang berjalan.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {batch_aktif.map((b) => (
              <li key={b.id}>
                {/*
                  Seluruh kartu menjadi tautan ke halaman tracking — dari sinilah
                  operator paling sering melanjutkan pekerjaannya.
                */}
                <Link
                  to={`/produksi/batch/${b.id}`}
                  className="block rounded-lg border border-amber-200 bg-amber-50/50 p-3 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      {/* Bentuk yang diminta: "PRO-0002 — Sedang Mixing — 14%" */}
                      <p className="text-sm font-semibold text-stone-900">
                        <span className="font-mono">{b.batch_number}</span>
                        {b.current_stage_label && (
                          <>
                            <span className="mx-1.5 text-stone-400">—</span>
                            <span className="text-amber-800">
                              {b.current_stage_status === 'in_progress'
                                ? `Sedang ${b.current_stage_label}`
                                : `Menunggu ${b.current_stage_label}`}
                            </span>
                          </>
                        )}
                        {b.progress_percent !== undefined && (
                          <>
                            <span className="mx-1.5 text-stone-400">—</span>
                            <span className="tabular-nums">{angka(b.progress_percent, 0)}%</span>
                          </>
                        )}
                      </p>

                      <p className="truncate text-xs text-stone-600">
                        {b.product_name} · target {angka(b.target_quantity)} {b.product_unit}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-stone-900">
                        {rupiah(b.material_cost)}
                      </p>
                      <p className="text-xs text-stone-500">dimulai {tanggalWaktu(b.started_at)}</p>
                    </div>
                  </div>

                  {b.progress_percent !== undefined && (
                    <div className="mt-2.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                        <div
                          className="h-full rounded-full bg-yellow-600 transition-all"
                          style={{ width: `${Math.max(2, b.progress_percent)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500">
                        {b.completed_stages} dari {b.total_stages} tahap selesai
                      </p>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tren produksi */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-base font-bold text-stone-900">Tren Produksi Bulanan</h3>
          <p className="mb-5 mt-0.5 text-sm text-stone-500">Jumlah unit layak jual per bulan.</p>

          <div className="space-y-2.5">
            {tren_bulanan.map((t) => (
              <div key={t.bulan} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-stone-500">{t.label}</span>

                <div className="h-6 flex-1 overflow-hidden rounded-md bg-stone-100">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-yellow-600 px-2 transition-all"
                    style={{ width: `${Math.max(2, (t.unit / unitTertinggi) * 100)}%` }}
                  >
                    {t.unit > 0 && (
                      <span className="whitespace-nowrap text-[10px] font-bold text-white">
                        {angka(t.unit)} unit
                      </span>
                    )}
                  </div>
                </div>

                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-stone-400">
                  {rupiah(t.biaya)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bahan terpakai */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Bahan Terbanyak Dipakai</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">Berdasarkan nilai.</p>

          {bahan_terpakai.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
              Belum ada pemakaian bahan.
            </p>
          ) : (
            <ul className="space-y-2">
              {bahan_terpakai.slice(0, 6).map((b) => (
                <li key={b.ingredient_id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-stone-700">{b.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold tabular-nums text-stone-900">
                      {rupiah(b.total_biaya)}
                    </span>
                    <span className="ml-2 text-xs tabular-nums text-stone-400">
                      {angka(b.total_qty_display)} {b.unit}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Kapasitas produksi — pertanyaan pertama tiap pagi */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Kapasitas Produksi Saat Ini</h3>
        <p className="mb-4 mt-0.5 text-sm text-stone-500">
          Berapa unit tiap produk yang masih bisa dibuat dengan stok bahan sekarang.
        </p>

        {kapasitas_produksi.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            Belum ada produk yang punya resep aktif.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Produk</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Stok Jadi</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Bisa Dibuat</th>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan Pembatas</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">HPP</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Margin</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {kapasitas_produksi.map((k) => {
                  const margin = k.selling_price - k.cost_per_unit;

                  return (
                    <tr key={k.product_id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-stone-800">{k.name}</p>
                        <p className="font-mono text-xs text-stone-400">{k.code}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                        {angka(k.current_stock)} {k.unit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            k.max_producible === 0 ? 'text-red-600' : 'text-stone-900'
                          }`}
                        >
                          {angka(k.max_producible)} {k.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {k.limiting_ingredient ? (
                          <Badge tone={k.max_producible === 0 ? 'danger' : 'warning'}>
                            {k.limiting_ingredient}
                          </Badge>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                        {rupiah(k.cost_per_unit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-semibold tabular-nums ${margin < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                        >
                          {rupiah(margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produk teratas */}
      {produk_teratas.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Produk Paling Sering Diproduksi</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">Enam bulan terakhir.</p>

          <ul className="space-y-2">
            {produk_teratas.map((p) => (
              <li key={p.product_id} className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-stone-700">
                  {p.name}
                  <span className="ml-2 text-xs text-stone-400">{p.jumlah_batch} batch</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-semibold tabular-nums text-stone-900">
                    {angka(p.total_unit)} {p.unit}
                  </span>
                  <span className="ml-3 text-xs tabular-nums text-stone-400">
                    HPP rata-rata {rupiah(p.hpp_rata2)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-3 text-xs text-stone-400">
            <Wallet className="h-3.5 w-3.5" />
            Total biaya bahan bulan ini: {rupiah(ringkasan.biaya_bahan_bulan_ini)}
          </div>
        </div>
      )}
    </div>
  );
};
