import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  PackageX,
  Wallet,
} from 'lucide-react';
import { MovementTrendChart } from '../../components/inventory/MovementTrendChart';
import { PageHeader, StatCard } from '../../components/data/PageHeader';
import { Badge, LoadingScreen } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { inventoryService } from '../../services/inventoryService';
import type { InventoryDashboard } from '../../types/inventory';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

const PERIODE = [7, 14, 30, 60, 90];

export const InventoryDashboardPage: React.FC = () => {
  const toast = useToast();

  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [hari, setHari] = useState(30);

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      setData(await inventoryService.dashboard(hari));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat dashboard persediaan.'));
    } finally {
      setLoading(false);
    }
  }, [hari, toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (loading && !data) return <LoadingScreen label="Memuat dashboard persediaan…" />;
  if (!data) return null;

  const { ringkasan, perlu_perhatian, tren_mutasi, per_sumber } = data;

  const totalMasuk = tren_mutasi.reduce((t, d) => t + d.masuk, 0);
  const totalKeluar = tren_mutasi.reduce((t, d) => t + d.keluar, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Persediaan"
        description="Pusat monitoring seluruh pergerakan stok — bahan baku dan produk jadi."
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="periode" className="text-sm text-stone-500">
              Periode
            </label>
            <select
              id="periode"
              value={hari}
              onChange={(e) => setHari(Number(e.target.value))}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              {PERIODE.map((p) => (
                <option key={p} value={p}>
                  {p} hari
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/*
        Tiga kartu status sesuai spesifikasi. Kritis digulung ke Menipis dan
        berlebih ke Aman, jadi ketiganya selalu berjumlah total barang —
        tidak ada barang yang tidak terhitung di mana pun.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Habis"
          value={ringkasan.habis}
          icon={PackageX}
          tone={ringkasan.habis > 0 ? 'danger' : 'success'}
          hint="Stok kosong, produksi bisa terhenti"
        />
        <StatCard
          label="Menipis"
          value={ringkasan.menipis}
          icon={AlertTriangle}
          tone={ringkasan.menipis > 0 ? 'warning' : 'success'}
          hint={
            ringkasan.rinci.kritis > 0
              ? `${ringkasan.rinci.kritis} di antaranya kritis`
              : 'Sudah menyentuh batas minimum'
          }
        />
        <StatCard
          label="Aman"
          value={ringkasan.aman}
          icon={CheckCircle2}
          tone="success"
          hint={
            ringkasan.rinci.berlebih > 0
              ? `${ringkasan.rinci.berlebih} berlebih, modal menganggur`
              : `dari ${ringkasan.total_item} barang`
          }
        />
        <StatCard
          label="Nilai Persediaan"
          value={rupiah(ringkasan.nilai_persediaan)}
          icon={Wallet}
          tone="info"
          hint={`${ringkasan.jumlah_bahan_baku} bahan · ${ringkasan.jumlah_produk_jadi} produk`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Grafik tren */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Tren Mutasi Stok</h3>
              <p className="mt-0.5 text-sm text-stone-500">
                {hari} hari terakhir · {ringkasan.mutasi_hari_ini} mutasi hari ini
              </p>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="text-stone-500">
                Masuk <strong className="tabular-nums text-emerald-600">{angka(totalMasuk)}</strong>
              </span>
              <span className="text-stone-500">
                Keluar <strong className="tabular-nums text-red-600">{angka(totalKeluar)}</strong>
              </span>
            </div>
          </div>

          <MovementTrendChart data={tren_mutasi} />
        </div>

        {/* Perlu perhatian */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Perlu Perhatian</h3>
              <p className="mt-0.5 text-sm text-stone-500">Terurut dari yang paling genting.</p>
            </div>

            <Link
              to="/persediaan/stok"
              className="shrink-0 text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
            >
              Lihat semua
            </Link>
          </div>

          {perlu_perhatian.length === 0 ? (
            <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-800">Seluruh stok aman.</p>
              <p className="mt-0.5 text-xs text-emerald-600">
                Tidak ada barang yang menyentuh batas minimum.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {perlu_perhatian.map((p) => (
                <li
                  key={`${p.kind}-${p.id}`}
                  className="rounded-lg border border-stone-200 p-3 transition hover:border-stone-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">{p.name}</p>
                      <p className="font-mono text-[11px] text-stone-400">{p.code}</p>
                    </div>
                    <Badge tone={TONE[p.status_tone] ?? 'neutral'}>{p.status_label}</Badge>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                    <span className="tabular-nums text-stone-600">
                      Sisa <strong>{angka(p.current_stock, 2)}</strong> / min{' '}
                      {angka(p.min_stock, 2)} {p.unit}
                    </span>

                    {/* Perkiraan sisa hari hanya tampil bila barangnya memang
                        pernah terpakai — tanpa riwayat pemakaian, angka apa pun
                        akan menyesatkan. */}
                    {p.days_remaining !== null && (
                      <span
                        className={`shrink-0 font-semibold ${
                          p.days_remaining <= 2 ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        ± {p.days_remaining} hari lagi
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rekap per sumber */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Mutasi Menurut Sumber</h3>
            <p className="mt-0.5 text-sm text-stone-500">
              Dari mana stok datang dan ke mana perginya, {hari} hari terakhir.
            </p>
          </div>

          <Link
            to="/persediaan/mutasi"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
          >
            Riwayat lengkap
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {per_sumber.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            Belum ada pergerakan stok pada periode ini.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {per_sumber.map((s) => (
              <div
                key={`${s.source_type}-${s.direction}`}
                className={`rounded-lg border p-3 ${
                  s.direction === 'in'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-red-200 bg-red-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-stone-800">{s.source_label}</p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      s.direction === 'in'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {s.direction === 'in' ? 'Masuk' : 'Keluar'}
                  </span>
                </div>

                <p className="mt-1 text-xs text-stone-500">
                  <strong className="tabular-nums text-stone-800">{s.jumlah}</strong> mutasi ·{' '}
                  <span className="tabular-nums">{angka(s.total_qty)}</span> satuan dasar
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500 shadow-sm">
        <span className="inline-flex items-center gap-2">
          <Boxes className="h-4 w-4 text-stone-400" />
          Nilai bahan baku {rupiah(ringkasan.nilai_bahan_baku)}
        </span>
        <span>Nilai produk jadi {rupiah(ringkasan.nilai_produk_jadi)}</span>
        <span className="text-stone-400">
          Status stok dihitung ulang setiap permintaan dari stok saat ini dibanding batas minimum —
          tidak ada nilai status yang disimpan.
        </span>
      </div>
    </div>
  );
};
