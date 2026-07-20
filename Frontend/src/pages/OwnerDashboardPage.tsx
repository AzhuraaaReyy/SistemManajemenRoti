import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChefHat,
  Clock,
  Factory,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { ProductionChart } from '../components/dashboard/ProductionChart';
import { SalesTrendChart } from '../components/dashboard/SalesTrendChart';
import { StockMonitor } from '../components/dashboard/StockMonitor';
import { TopProductsChart } from '../components/dashboard/TopProductsChart';
import { PageHeader } from '../components/data/PageHeader';
import { LoadingScreen } from '../components/ui/Feedback';
import { useToast } from '../context/ToastContext';
import { pesanError } from '../lib/api';
import { STATUS, TONE_TO_STATUS } from '../lib/chartTheme';
import { angka, rupiah, tanggal, tanggalWaktu } from '../lib/format';
import { dashboardService } from '../services/dashboardService';
import type { Aktivitas, OwnerDashboard } from '../types/dashboard';

/**
 * Jeda penyegaran otomatis.
 *
 * Dashboard ini dibuka dan dibiarkan terbuka — di layar belakang toko, atau di
 * tab yang ditengok sesekali. Menuntut Owner menekan tombol untuk melihat angka
 * yang sudah berubah membuat halaman ini berbohong tanpa ada yang menyadarinya.
 *
 * Satu menit dipilih karena itu kira-kira jeda terpanjang yang masih terasa
 * "sekarang" untuk angka penjualan, dan cukup jarang untuk tidak membebani.
 */
const JEDA_SEGAR_MS = 60_000;

const PERIODE = [7, 14, 30, 60, 90];

const IKON_AKTIVITAS: Record<Aktivitas['jenis'], React.ElementType> = {
  penjualan: Receipt,
  produksi: Factory,
  pembelian: ShoppingBag,
};

/** Kartu angka besar. Angka besar memakai angka proporsional, bukan tabular. */
const Kartu: React.FC<{
  label: string;
  nilai: string;
  ikon: React.ElementType;
  hint?: React.ReactNode;
  warna?: string;
}> = ({ label, nilai, ikon: Ikon, hint, warna = 'bg-stone-100 text-stone-600' }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${warna}`}>
        <Ikon className="h-4 w-4" aria-hidden="true" />
      </div>
    </div>

    <p className="mt-2 truncate text-2xl font-bold text-stone-900">{nilai}</p>
    {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
  </div>
);

export const OwnerDashboardPage: React.FC = () => {
  const toast = useToast();

  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [hari, setHari] = useState(30);

  // Galat penyegaran otomatis hanya diberitahukan sekali. Toast yang muncul
  // tiap menit karena jaringan mati lebih mengganggu daripada membantu.
  const sudahLapor = useRef(false);

  const muat = useCallback(
    async (diam = false) => {
      if (diam) setMenyegarkan(true);
      else setLoading(true);

      try {
        setData(await dashboardService.owner(hari));
        sudahLapor.current = false;
      } catch (error) {
        if (!diam || !sudahLapor.current) {
          toast.error(pesanError(error, 'Gagal memuat dashboard.'));
          sudahLapor.current = true;
        }
      } finally {
        setLoading(false);
        setMenyegarkan(false);
      }
    },
    [hari, toast],
  );

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    const timer = setInterval(() => void muat(true), JEDA_SEGAR_MS);

    return () => clearInterval(timer);
  }, [muat]);

  if (loading && !data) return <LoadingScreen label="Menyiapkan dashboard…" />;
  if (!data) return null;

  const { penjualan, produksi, pendapatan, stok, batch_aktif, supplier_terakhir, periode } = data;

  const naik = (pendapatan.perubahan_persen ?? 0) >= 0;
  const PanahTren = naik ? ArrowUpRight : ArrowDownRight;

  return (
    /*
    | Saat penyegaran diam berjalan, seluruh isi diredupkan sedikit alih-alih
    | diganti kerangka abu-abu. Kerangka yang berkedip tiap menit membuat
    | halaman terasa berkedut dan memindahkan tata letaknya.
    */
    <div className={`space-y-6 transition-opacity ${menyegarkan ? 'opacity-60' : 'opacity-100'}`}>
      <PageHeader
        title="Dashboard Owner"
        description="Ringkasan seluruh kegiatan usaha — penjualan, produksi, persediaan, dan pembelian."
        action={
          <div className="flex items-center gap-2">
            <select
              value={hari}
              onChange={(e) => setHari(Number(e.target.value))}
              aria-label="Rentang grafik"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              {PERIODE.map((p) => (
                <option key={p} value={p}>
                  {p} hari
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void muat(true)}
              disabled={menyegarkan}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-600 shadow-sm transition hover:bg-stone-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${menyegarkan ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          </div>
        }
      />

      {/* Penanda kesegaran data — tanpa ini pengguna tidak tahu apakah angkanya
          masih berlaku, dan penyegaran otomatis jadi tak terlihat. */}
      <p className="-mt-3 flex items-center gap-1.5 text-xs text-stone-400">
        <Clock className="h-3.5 w-3.5" />
        Diperbarui {tanggalWaktu(data.diperbarui_pada)} · menyegar otomatis tiap menit
      </p>

      {/* ---------------- Kartu ringkasan ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kartu
          label="Pendapatan Hari Ini"
          nilai={rupiah(pendapatan.hari_ini)}
          ikon={Banknote}
          warna="bg-emerald-50 text-emerald-600"
          hint={
            pendapatan.perubahan_persen === null ? (
              'Kemarin tidak ada penjualan'
            ) : (
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  naik ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                <PanahTren className="h-3.5 w-3.5" />
                {angka(Math.abs(pendapatan.perubahan_persen), 1)}% dibanding kemarin
              </span>
            )
          }
        />

        <Kartu
          label="Pendapatan Bulan Ini"
          nilai={rupiah(pendapatan.bulan_ini)}
          ikon={TrendingUp}
          warna="bg-sky-50 text-sky-600"
          hint={`Laba kotor ${rupiah(pendapatan.laba_kotor_bulan_ini)}`}
        />

        <Kartu
          label="Penjualan"
          nilai={`${penjualan.transaksi_hari_ini} transaksi`}
          ikon={Receipt}
          warna="bg-yellow-50 text-yellow-700"
          hint={`${penjualan.transaksi_bulan_ini} transaksi bulan ini · ${angka(penjualan.unit_bulan_ini)} unit`}
        />

        <Kartu
          label="Produksi Selesai"
          nilai={`${produksi.batch_selesai_hari_ini} batch`}
          ikon={ChefHat}
          warna="bg-stone-100 text-stone-600"
          hint={`${produksi.batch_selesai_bulan_ini} batch bulan ini · ${produksi.batch_aktif} sedang berjalan`}
        />
      </div>

      {/*
        Dua grafik berdampingan, masing-masing separuh lebar.
        Bukan tiga kolom: grafik batang 30 hari yang dijejalkan ke sepertiga
        lebar layar menghasilkan batang selebar empat piksel — terlihat rapi
        dari jauh, mustahil dibaca dari dekat.
      */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SalesTrendChart data={data.grafik_penjualan} days={periode.hari} />
        <ProductionChart data={data.grafik_produksi} days={periode.hari} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopProductsChart data={data.produk_terlaris} periodLabel={periode.bulan_label} />
        <StockMonitor data={stok} />
      </div>

      {/* ---------------- Panel ---------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Batch produksi aktif */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Batch Produksi Aktif</h3>
              <p className="mt-0.5 text-sm text-stone-500">Yang belum selesai, beserta tahapannya.</p>
            </div>

            <Link
              to="/produksi/batch"
              className="shrink-0 text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
            >
              Lihat semua
            </Link>
          </div>

          {batch_aktif.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              Tidak ada produksi yang sedang berjalan.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {batch_aktif.map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/produksi/batch/${b.id}`}
                    className="block rounded-lg border border-stone-200 p-3 transition hover:border-yellow-300 hover:bg-yellow-50/40"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-stone-900">
                          {b.batch_number}
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {b.product_name} · target {angka(b.target_quantity)} {b.unit}
                          {b.operator_name && ` · ${b.operator_name}`}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-amber-700">
                          {b.current_stage_status === 'in_progress'
                            ? `Sedang ${b.current_stage_label}`
                            : `Menunggu ${b.current_stage_label}`}
                        </p>
                        <p className="text-xs tabular-nums text-stone-400">
                          {b.completed_stages}/{b.total_stages} tahap · {angka(b.progress_percent, 0)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, b.progress_percent)}%`,
                          backgroundColor: b.is_overdue ? STATUS.habis : STATUS.menipis,
                        }}
                      />
                    </div>

                    {b.is_overdue && (
                      <p className="mt-1 text-[11px] font-semibold text-red-600">
                        Tahap ini berjalan jauh lebih lama dari biasanya.
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Supplier terakhir */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Penerimaan Terakhir</h3>
              <p className="mt-0.5 text-sm text-stone-500">
                Barang yang benar-benar sudah datang dari supplier.
              </p>
            </div>

            <Link
              to="/pembelian/penerimaan"
              className="shrink-0 text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
            >
              Lihat semua
            </Link>
          </div>

          {supplier_terakhir.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              Belum ada penerimaan barang.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {supplier_terakhir.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                      <Truck className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">
                        {s.supplier_name}
                      </p>
                      <p className="truncate font-mono text-xs text-stone-400">
                        {s.receipt_number}
                        {s.po_number && ` · ${s.po_number}`}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">
                      {rupiah(s.total_value)}
                    </p>
                    <p className="text-xs text-stone-400">
                      {s.items_count} item · {tanggal(s.receipt_date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------------- Aktivitas lintas modul ---------------- */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Aktivitas Terkini</h3>
        <p className="mb-4 mt-0.5 text-sm text-stone-500">
          Kejadian terbaru dari seluruh modul, terurut waktu.
        </p>

        {data.aktivitas_terkini.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            Belum ada aktivitas tercatat.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.aktivitas_terkini.map((a, i) => {
              const Ikon = IKON_AKTIVITAS[a.jenis];

              return (
                <li key={`${a.jenis}-${a.judul}-${i}`}>
                  <Link
                    to={a.tautan}
                    className="-mx-2 flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-stone-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Warna nada ditemani ikon DAN label jenis — jenis
                          kegiatan tidak pernah dibedakan warna sendirian. */}
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${TONE_TO_STATUS[a.tone] ?? STATUS.aman}18`,
                          color: TONE_TO_STATUS[a.tone] ?? STATUS.aman,
                        }}
                      >
                        <Ikon className="h-4 w-4" aria-hidden="true" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm text-stone-800">
                          <span className="font-semibold">{a.label}</span>
                          <span className="mx-1.5 text-stone-300">·</span>
                          <span className="font-mono">{a.judul}</span>
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {a.keterangan}
                          {a.oleh && ` · ${a.oleh}`}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-stone-900">
                        {rupiah(a.nilai)}
                      </p>
                      <p className="text-xs text-stone-400">{tanggalWaktu(a.waktu)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
