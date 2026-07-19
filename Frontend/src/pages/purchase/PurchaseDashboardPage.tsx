import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  PackageSearch,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';
import { PageHeader, StatCard } from '../../components/data/PageHeader';
import { Badge, LoadingScreen } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, rupiah, tanggal } from '../../lib/format';
import { purchaseService } from '../../services/purchaseService';
import type { PurchaseDashboard } from '../../types/purchase';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const PurchaseDashboardPage: React.FC = () => {
  const toast = useToast();
  const [data, setData] = useState<PurchaseDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      setData(await purchaseService.dashboard(6));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat dashboard pembelian.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (loading) return <LoadingScreen label="Memuat dashboard pembelian…" />;
  if (!data) return null;

  const { ringkasan, per_status, tren_bulanan, menunggu_kedatangan, bahan_teratas, supplier_teratas, perlu_dibeli } =
    data;

  // Skala grafik dibuat relatif terhadap bulan tertinggi supaya perbandingan
  // antar bulan terbaca, bukan sekadar bar yang semuanya penuh.
  const nilaiTertinggi = Math.max(...tren_bulanan.map((t) => t.nilai), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Pembelian"
        description="Ringkasan pengadaan bahan baku enam bulan terakhir."
      />

      {/* Kartu ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Belanja Bulan Ini"
          value={rupiah(ringkasan.belanja_bulan_ini)}
          icon={Wallet}
          tone="info"
          hint={`${ringkasan.jumlah_po_bulan_ini} pesanan`}
        />

        <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              (ringkasan.perubahan_persen ?? 0) > 0
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {(ringkasan.perubahan_persen ?? 0) > 0 ? (
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Dibanding Bulan Lalu
            </p>
            <p className="truncate text-2xl font-bold tabular-nums text-stone-900">
              {ringkasan.perubahan_persen == null
                ? '—'
                : `${ringkasan.perubahan_persen > 0 ? '+' : ''}${angka(ringkasan.perubahan_persen, 1)}%`}
            </p>
            <p className="mt-0.5 truncate text-xs text-stone-400">
              {rupiah(ringkasan.belanja_bulan_lalu)}
            </p>
          </div>
        </div>

        <StatCard
          label="Menunggu Barang"
          value={ringkasan.menunggu_barang}
          icon={Truck}
          tone={ringkasan.menunggu_barang > 0 ? 'warning' : 'success'}
          hint={rupiah(ringkasan.nilai_belum_datang)}
        />

        <StatCard
          label="Pesanan Terlambat"
          value={ringkasan.terlambat}
          icon={Clock}
          tone={ringkasan.terlambat > 0 ? 'danger' : 'success'}
          hint={ringkasan.terlambat > 0 ? 'Perlu ditindaklanjuti' : 'Semua sesuai jadwal'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tren belanja */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-base font-bold text-stone-900">Tren Belanja Bulanan</h3>
          <p className="mb-5 mt-0.5 text-sm text-stone-500">Nilai pembelian per bulan, tidak termasuk yang dibatalkan.</p>

          <div className="space-y-2.5">
            {tren_bulanan.map((t) => (
              <div key={t.bulan} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-stone-500">{t.label}</span>

                <div className="h-6 flex-1 overflow-hidden rounded-md bg-stone-100">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-yellow-600 px-2 transition-all"
                    style={{ width: `${Math.max(2, (t.nilai / nilaiTertinggi) * 100)}%` }}
                  >
                    {t.nilai > 0 && (
                      <span className="whitespace-nowrap text-[10px] font-bold text-white">
                        {rupiah(t.nilai)}
                      </span>
                    )}
                  </div>
                </div>

                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-stone-400">
                  {t.jumlah} PO
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sebaran status */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Status Pesanan</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">Seluruh periode.</p>

          <ul className="space-y-3">
            {per_status.map((s) => (
              <li key={s.status} className="flex items-center justify-between gap-3">
                <Badge tone={TONE[s.tone] ?? 'neutral'}>{s.label}</Badge>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-stone-900">{s.jumlah}</p>
                  <p className="text-xs tabular-nums text-stone-400">{rupiah(s.nilai)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Perlu dibeli — bagian paling bisa ditindaklanjuti */}
      {perlu_dibeli.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-stone-900">Perlu Segera Dibeli</h3>
              <p className="mt-0.5 text-sm text-stone-600">
                Stok sudah di bawah batas minimum dan belum ada pesanan berjalan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Stok</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Saran Beli</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Perkiraan</th>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Supplier</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {perlu_dibeli.map((p) => (
                  <tr key={p.ingredient_id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{p.name}</p>
                      <p className="font-mono text-xs text-stone-400">{p.code}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <p className="tabular-nums font-semibold text-red-600">
                        {angka(p.current_stock)} {p.unit}
                      </p>
                      <p className="text-xs tabular-nums text-stone-400">
                        min {angka(p.min_stock)}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                      {angka(p.suggested_qty)} {p.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                      {rupiah(p.estimated_cost)}
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-600">
                      {p.supplier_name ?? <span className="text-stone-400">Belum ditentukan</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            to="/pembelian/pesanan"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-700"
          >
            <ShoppingCart className="h-4 w-4" />
            Buat Pesanan Sekarang
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Menunggu kedatangan */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Menunggu Kedatangan</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">Diurutkan dari yang paling dekat jatuh tempo.</p>

          {menunggu_kedatangan.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
              Tidak ada pesanan yang sedang ditunggu.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {menunggu_kedatangan.map((o) => (
                <li
                  key={o.id}
                  className={`rounded-lg border p-3 ${o.is_overdue ? 'border-red-200 bg-red-50/50' : 'border-stone-200'}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-stone-900">{o.po_number}</p>
                      <p className="truncate text-xs text-stone-500">{o.supplier_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-stone-900">{rupiah(o.total)}</p>
                      <p className={`text-xs ${o.is_overdue ? 'font-semibold text-red-600' : 'text-stone-400'}`}>
                        {o.is_overdue ? `Telat ${o.days_late} hari` : `Tiba ${tanggal(o.expected_date)}`}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bahan & supplier teratas */}
        <div className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-900">Bahan Paling Banyak Dibeli</h3>
            <p className="mb-4 mt-0.5 text-sm text-stone-500">
              Berdasarkan barang yang benar-benar diterima.
            </p>

            {bahan_teratas.length === 0 ? (
              <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-500">
                <PackageSearch className="h-4 w-4" />
                Belum ada penerimaan barang.
              </p>
            ) : (
              <ul className="space-y-2">
                {bahan_teratas.slice(0, 5).map((b) => (
                  <li key={b.ingredient_id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{b.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums text-stone-900">
                        {rupiah(b.total_nilai)}
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

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-900">Supplier Teratas</h3>
            <p className="mb-4 mt-0.5 text-sm text-stone-500">Berdasarkan nilai belanja.</p>

            {supplier_teratas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                Belum ada data pembelian.
              </p>
            ) : (
              <ul className="space-y-2">
                {supplier_teratas.map((s) => (
                  <li key={s.supplier_id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{s.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums text-stone-900">
                        {rupiah(s.total_belanja)}
                      </span>
                      <span className="ml-2 text-xs tabular-nums text-stone-400">{s.jumlah_po} PO</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
