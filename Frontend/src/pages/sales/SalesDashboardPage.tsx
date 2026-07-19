import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PageHeader, StatCard } from '../../components/data/PageHeader';
import { Badge, LoadingScreen } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, rupiah, tanggalWaktu } from '../../lib/format';
import { salesService } from '../../services/salesService';
import type { SalesDashboard } from '../../types/sales';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export const SalesDashboardPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();

  const kasir = user?.role === 'kasir';

  const [data, setData] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      setData(await salesService.dashboard());
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat dashboard penjualan.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (loading) return <LoadingScreen label="Memuat dashboard penjualan…" />;
  if (!data) return null;

  const { hari_ini, perbandingan, bulan_ini, transaksi_terakhir } = data;

  const omzetTertinggi = Math.max(...bulan_ini.harian.map((h) => h.omzet), 1);
  const naik = (perbandingan.omzet_persen ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Penjualan"
        description={
          kasir
            ? 'Ringkasan penjualan Anda hari ini.'
            : 'Ringkasan penjualan hari ini dan bulan berjalan.'
        }
        action={
          <Link
            to="/penjualan/kasir"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-yellow-700"
          >
            <ShoppingCart className="h-4 w-4" />
            Buka Kasir
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Omzet Hari Ini"
          value={rupiah(hari_ini.omzet)}
          icon={Wallet}
          tone={hari_ini.omzet > 0 ? 'success' : 'neutral'}
          hint={
            perbandingan.omzet_persen === null
              ? 'Kemarin tidak ada penjualan'
              : `${naik ? '+' : ''}${angka(perbandingan.omzet_persen, 1)}% dibanding kemarin`
          }
        />
        <StatCard
          label="Transaksi"
          value={hari_ini.transaksi}
          icon={Receipt}
          tone="info"
          hint={`${angka(hari_ini.unit_terjual)} unit terjual`}
        />
        <StatCard
          label="Tunai di Laci"
          value={rupiah(hari_ini.tunai_di_laci)}
          icon={Banknote}
          tone="warning"
          hint="Harus cocok saat tutup kasir"
        />
        <StatCard
          label="Rata-rata Transaksi"
          value={rupiah(hari_ini.rata2_transaksi)}
          icon={naik ? TrendingUp : TrendingDown}
          tone="neutral"
          hint={`Laba kotor ${rupiah(hari_ini.laba_kotor)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tren harian bulan ini */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Penjualan Harian</h3>
              <p className="mt-0.5 text-sm text-stone-500">{bulan_ini.periode.label}</p>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="text-stone-500">
                Omzet <strong className="tabular-nums text-stone-900">{rupiah(bulan_ini.omzet)}</strong>
              </span>
              <span className="text-stone-500">
                Laba{' '}
                <strong className="tabular-nums text-emerald-600">
                  {rupiah(bulan_ini.laba_kotor)}
                </strong>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            {bulan_ini.harian.map((h) => (
              <div key={h.tanggal} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs font-medium text-stone-500">{h.label}</span>

                <div className="h-5 flex-1 overflow-hidden rounded-md bg-stone-100">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-yellow-600 px-2 transition-all"
                    style={{ width: `${Math.max(1, (h.omzet / omzetTertinggi) * 100)}%` }}
                  >
                    {h.omzet > 0 && (
                      <span className="whitespace-nowrap text-[10px] font-bold text-white">
                        {rupiah(h.omzet)}
                      </span>
                    )}
                  </div>
                </div>

                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-400">
                  {h.transaksi > 0 ? `${h.transaksi} trx` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rekap tutup kasir */}
        <div className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-900">Rekap Tutup Kasir</h3>
            <p className="mb-4 mt-0.5 text-sm text-stone-500">
              Per metode pembayaran, hari ini.
            </p>

            {hari_ini.per_metode.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                Belum ada transaksi hari ini.
              </p>
            ) : (
              <ul className="space-y-2">
                {hari_ini.per_metode.map((m) => (
                  <li
                    key={m.method}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                      m.is_cash ? 'border-amber-200 bg-amber-50/50' : 'border-stone-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-800">{m.label}</p>
                      <p className="text-xs text-stone-500">{m.jumlah} transaksi</p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-stone-900">
                      {rupiah(m.nilai)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs">
              {hari_ini.diskon > 0 && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Total diskon diberikan</dt>
                  <dd className="tabular-nums text-amber-700">{rupiah(hari_ini.diskon)}</dd>
                </div>
              )}
              {hari_ini.pajak > 0 && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Pajak terpungut</dt>
                  <dd className="tabular-nums text-stone-700">{rupiah(hari_ini.pajak)}</dd>
                </div>
              )}
              {hari_ini.dibatalkan.jumlah > 0 && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Dibatalkan</dt>
                  <dd className="tabular-nums text-red-600">
                    {hari_ini.dibatalkan.jumlah} trx · {rupiah(hari_ini.dibatalkan.nilai)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Produk terlaris — Owner saja; kasir tidak perlu analisis produk */}
          {!kasir && bulan_ini.produk_terlaris.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-stone-900">Produk Terlaris</h3>
              <p className="mb-4 mt-0.5 text-sm text-stone-500">{bulan_ini.periode.label}</p>

              <ul className="space-y-2">
                {bulan_ini.produk_terlaris.map((p) => (
                  <li key={p.product_id ?? p.name} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{p.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums text-stone-900">
                        {angka(p.total_qty)} {p.unit}
                      </span>
                      <span className="ml-2 text-xs tabular-nums text-stone-400">
                        {rupiah(p.total_nilai)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Transaksi terakhir */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Transaksi Terakhir</h3>
            <p className="mt-0.5 text-sm text-stone-500">Delapan penjualan paling baru.</p>
          </div>

          <Link
            to="/penjualan/riwayat"
            className="text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
          >
            Lihat semua
          </Link>
        </div>

        {transaksi_terakhir.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            Belum ada transaksi.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {transaksi_terakhir.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-stone-900">{t.sale_number}</p>
                  <p className="truncate text-xs text-stone-500">
                    {tanggalWaktu(t.created_at)}
                    {t.cashier_name && ` · ${t.cashier_name}`}
                    {t.items_count !== undefined && ` · ${t.items_count} item`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={TONE[t.payment_tone] ?? 'neutral'}>{t.payment_label}</Badge>

                  {t.status === 'voided' && <Badge tone="danger">Dibatalkan</Badge>}

                  <span
                    className={`w-28 text-right font-bold tabular-nums ${
                      t.status === 'voided' ? 'text-stone-400 line-through' : 'text-stone-900'
                    }`}
                  >
                    {rupiah(t.total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!kasir && bulan_ini.per_kasir.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Penjualan per Kasir</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">{bulan_ini.periode.label}</p>

          <ul className="space-y-2">
            {bulan_ini.per_kasir.map((k) => (
              <li key={k.cashier_id ?? k.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-stone-700">
                  {k.name}
                  <span className="ml-2 text-xs text-stone-400">{k.transaksi} transaksi</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-stone-900">
                  {rupiah(k.omzet)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
