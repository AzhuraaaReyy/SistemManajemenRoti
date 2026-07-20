import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Cookie,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Loader2,
  Receipt,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { ReportFilterPanel } from '../components/reports/ReportFilterPanel';
import { PageHeader } from '../components/data/PageHeader';
import { Button } from '../components/ui/Button';
import { LoadingScreen, TableSkeleton } from '../components/ui/Feedback';
import { useToast } from '../context/ToastContext';
import { pesanError } from '../lib/api';
import { angka, rupiah } from '../lib/format';
import { reportService } from '../services/reportService';
import type {
  ColumnFormat,
  ReportFilters,
  ReportOptions,
  ReportResult,
  ReportTypeDefinition,
  ReportTypeKey,
} from '../types/reports';

const IKON: Record<ReportTypeKey, React.ElementType> = {
  penjualan: Receipt,
  produksi: ChefHat,
  pembelian: ShoppingBag,
  persediaan: Boxes,
  mutasi_stok: History,
  supplier: Truck,
  produk: Cookie,
};


/**
 * Pemformatan nilai untuk tabel di layar.
 *
 * Aturannya sama persis dengan yang dipakai PDF dan Excel — kolom `format`
 * yang sama, angka yang sama. Yang dilihat pengguna sebelum mengekspor adalah
 * benar-benar yang akan tercetak.
 */
const formatNilai = (nilai: string | number | null, format: ColumnFormat): string => {
  if (nilai === null || nilai === '' || nilai === '—') return '—';

  switch (format) {
    case 'money':
      return rupiah(Number(nilai));
    case 'number':
      return angka(Number(nilai));
    case 'percent':
      return `${angka(Number(nilai), 1)}%`;
    case 'date':
      return new Date(String(nilai)).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    case 'datetime':
      return new Date(String(nilai)).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return String(nilai);
  }
};

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const hariIni = () => new Date().toISOString().slice(0, 10);

export const ReportsPage: React.FC = () => {
  const toast = useToast();

  const [types, setTypes] = useState<ReportTypeDefinition[]>([]);
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [aktif, setAktif] = useState<ReportTypeKey>('penjualan');

  const [filters, setFilters] = useState<ReportFilters>({
    date_from: awalBulan(),
    date_to: hariIni(),
    as_of: hariIni(),
  });

  const [hasil, setHasil] = useState<ReportResult | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [memuat, setMemuat] = useState(true);
  const [menyusun, setMenyusun] = useState(false);
  const [mengekspor, setMengekspor] = useState<'pdf' | 'excel' | null>(null);

  const definisi = useMemo(() => types.find((t) => t.value === aktif), [types, aktif]);

  useEffect(() => {
    reportService
      .types()
      .then((d) => {
        setTypes(d.types);
        setOptions(d.options);
      })
      .catch((e) => toast.error(pesanError(e, 'Gagal memuat jenis laporan.')))
      .finally(() => setMemuat(false));
  }, [toast]);

  const susun = useCallback(async () => {
    setMenyusun(true);

    try {
      setHasil(await reportService.preview(aktif, filters, halaman));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal menyusun laporan.'));
      setHasil(null);
    } finally {
      setMenyusun(false);
    }
  }, [aktif, filters, halaman, toast]);

  /*
  | Mengubah filter atau jenis laporan selalu kembali ke halaman pertama.
  |
  | Tanpa ini, pengguna yang sedang di halaman 12 lalu mempersempit rentang
  | tanggalnya akan mendapat tabel kosong — server menjepitnya ke halaman
  | terakhir, tetapi nomor halaman di layar tetap 12 dan hasilnya
  | membingungkan.
  */
  useEffect(() => {
    setHalaman(1);
  }, [aktif, filters]);

  useEffect(() => {
    if (memuat) return;

    // Jeda singkat supaya mengubah beberapa filter berturut-turut tidak
    // mengirim satu permintaan per ketukan.
    const timer = window.setTimeout(() => void susun(), 300);

    return () => window.clearTimeout(timer);
  }, [susun, memuat]);

  const gantiJenis = (jenis: ReportTypeKey) => {
    setAktif(jenis);

    // Filter yang tidak relevan bagi laporan baru dibuang, bukan dibiarkan
    // menempel diam-diam. Filter supplier yang tertinggal dari laporan
    // pembelian akan tetap terkirim ke laporan produksi dan menyaring
    // hasilnya tanpa ada isian yang terlihat di layar.
    setFilters({
      date_from: filters.date_from,
      date_to: filters.date_to,
      as_of: filters.as_of,
      month: filters.month,
      year: filters.year,
    });
  };

  const ekspor = async (format: 'pdf' | 'excel') => {
    setMengekspor(format);

    try {
      if (format === 'pdf') await reportService.exportPdf(aktif, filters);
      else await reportService.exportExcel(aktif, filters);

      toast.success(`Laporan diunduh sebagai ${format === 'pdf' ? 'PDF' : 'Excel'}.`);
    } catch (error) {
      toast.error(pesanError(error, 'Gagal mengekspor laporan.'));
    } finally {
      setMengekspor(null);
    }
  };

  if (memuat) return <LoadingScreen label="Menyiapkan laporan…" />;

  const adaTotal = hasil ? Object.keys(hasil.total).length > 0 : false;
  const meta = hasil?.meta ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan"
        description="Pusat pelaporan formal — susun, periksa di layar, lalu ekspor."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={FileText}
              onClick={() => void ekspor('pdf')}
              loading={mengekspor === 'pdf'}
              disabled={!hasil || hasil.row_count === 0 || mengekspor !== null}
            >
              PDF
            </Button>

            <Button
              icon={FileSpreadsheet}
              onClick={() => void ekspor('excel')}
              loading={mengekspor === 'excel'}
              disabled={!hasil || hasil.row_count === 0 || mengekspor !== null}
            >
              Excel
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* ---------------- Pemilih jenis laporan ---------------- */}
        <nav aria-label="Jenis laporan" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-1.5">
            {types.map((t) => {
              const Ikon = IKON[t.value];
              const dipilih = aktif === t.value;

              return (
                <li key={t.value}>
                  <button
                    type="button"
                    onClick={() => gantiJenis(t.value)}
                    aria-current={dipilih ? 'page' : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                      dipilih
                        ? 'border-yellow-500 bg-yellow-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <Ikon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${dipilih ? 'text-yellow-700' : 'text-stone-400'}`}
                    />
                    <span
                      className={`text-sm font-semibold leading-snug ${
                        dipilih ? 'text-yellow-900' : 'text-stone-700'
                      }`}
                    >
                      {t.label.replace('Laporan ', '')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---------------- Filter + pratinjau ---------------- */}
        <div className="min-w-0 space-y-6">
          {definisi && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900">{definisi.label}</h2>
              <p className="mt-1 text-sm text-stone-500">{definisi.description}</p>
            </div>
          )}

          {definisi && (
            <ReportFilterPanel
              filters={definisi.filters}
              values={filters}
              options={options}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              onReset={() =>
                setFilters({ date_from: awalBulan(), date_to: hariIni(), as_of: hariIni() })
              }
            />
          )}

          {/* Ringkasan */}
          {hasil && Object.keys(hasil.summary).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(hasil.summary).map(([label, nilai]) => (
                <div key={label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-xl font-bold text-stone-900">
                    {typeof nilai === 'number'
                      ? nilai >= 1000
                        ? rupiah(nilai)
                        : angka(nilai)
                      : nilai}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Catatan penting tentang cara membaca laporan */}
          {hasil?.catatan && (
            <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-relaxed text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {hasil.catatan}
            </p>
          )}

          {/* Tabel pratinjau */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
              <div>
                <h3 className="text-sm font-bold text-stone-800">Pratinjau</h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  {hasil ? `${hasil.periode} · ${angka(hasil.row_count)} baris` : '—'}
                </p>
              </div>

              {menyusun && (
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyusun…
                </span>
              )}
            </div>

            {!hasil ? (
              <TableSkeleton rows={6} cols={6} />
            ) : hasil.row_count === 0 ? (
              <p className="p-12 text-center text-sm text-stone-500">
                Tidak ada data pada periode dan filter yang dipilih.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-stone-200 bg-stone-50">
                      <tr>
                        {hasil.columns.map((k) => (
                          <th
                            key={k.key}
                            scope="col"
                            className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-500 ${
                              k.align === 'right' ? 'text-right' : ''
                            }`}
                          >
                            {k.label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-stone-100">
                      {hasil.rows.map((baris, i) => (
                        <tr key={i} className="transition hover:bg-stone-50">
                          {hasil.columns.map((k) => (
                            <td
                              key={k.key}
                              className={`whitespace-nowrap px-3 py-2 ${
                                k.align === 'right'
                                  ? 'text-right tabular-nums text-stone-800'
                                  : 'text-stone-700'
                              }`}
                            >
                              {formatNilai(baris[k.key] ?? null, k.format)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>

                    {adaTotal && (
                      <tfoot className="border-t-2 border-stone-300 bg-stone-50">
                        <tr>
                          {hasil.columns.map((k, i) => (
                            <td
                              key={k.key}
                              className={`whitespace-nowrap px-3 py-2.5 font-bold text-stone-900 ${
                                k.align === 'right' ? 'text-right tabular-nums' : ''
                              }`}
                            >
                              {i === 0
                                ? 'TOTAL'
                                : hasil.total[k.key] !== undefined
                                  ? formatNilai(hasil.total[k.key], k.format)
                                  : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/*
                  Bilah paginasi.

                  Baris TOTAL di atas sengaja tetap menampilkan jumlah SELURUH
                  laporan, bukan jumlah halaman ini — itulah gunanya baris
                  total. Kalimat "Menampilkan 1–10 dari 340" di bawah yang
                  menjelaskan bahwa keduanya memang berbeda.
                */}
                {meta && meta.last_page > 1 && (
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row">
                    <p className="text-xs text-stone-500">
                      Menampilkan <span className="font-semibold text-stone-700">{meta.from}</span>–
                      <span className="font-semibold text-stone-700">{meta.to}</span> dari{' '}
                      <span className="font-semibold text-stone-700">{angka(meta.total)}</span> baris
                      · berkas PDF dan Excel memuat <strong>seluruhnya</strong>
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={ChevronLeft}
                        disabled={meta.current_page <= 1 || menyusun}
                        onClick={() => setHalaman(meta.current_page - 1)}
                      >
                        Sebelumnya
                      </Button>

                      <span className="px-2 text-xs font-semibold text-stone-600">
                        {meta.current_page} / {meta.last_page}
                      </span>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={meta.current_page >= meta.last_page || menyusun}
                        onClick={() => setHalaman(meta.current_page + 1)}
                      >
                        Berikutnya
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
