import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, PackageX } from 'lucide-react';
import { STATUS, TONE_TO_STATUS } from '../../lib/chartTheme';
import { angka, rupiah } from '../../lib/format';
import type { DashboardStok } from '../../types/dashboard';

interface Props {
  data: DashboardStok;
}

/*
| Monitoring stok.
|
| Tiga status, dan setiap satu di antaranya SELALU ditemani ikon dan label —
| tidak pernah warna sendirian. Ini bukan hiasan: warna "menipis" (kuning)
| berada di bawah rasio kontras 3:1 terhadap latar putih, dan pasangan
| ikon + label adalah penawarnya. Pembaca dengan buta warna kuning-biru, atau
| yang mencetak halaman ini hitam-putih, tetap bisa membacanya.
|
| Angkanya tidak digambar sebagai diagram lingkaran. Tiga angka yang perlu
| dibandingkan besarannya lebih cepat dibaca sebagai angka, dan pita proporsi
| di bawahnya sudah cukup memberi rasa "berapa bagian dari keseluruhan".
*/

const KARTU = [
  {
    kunci: 'habis' as const,
    label: 'Habis',
    warna: STATUS.habis,
    ikon: PackageX,
    kelas: 'border-red-200 bg-red-50',
    teks: 'text-red-700',
    keterangan: 'Produksi bisa terhenti',
  },
  {
    kunci: 'menipis' as const,
    label: 'Menipis',
    warna: STATUS.menipis,
    ikon: AlertTriangle,
    kelas: 'border-amber-200 bg-amber-50',
    teks: 'text-amber-700',
    keterangan: 'Siapkan pembelian',
  },
  {
    kunci: 'aman' as const,
    label: 'Aman',
    warna: STATUS.aman,
    ikon: CheckCircle2,
    kelas: 'border-emerald-200 bg-emerald-50',
    teks: 'text-emerald-700',
    keterangan: 'Stok mencukupi',
  },
];

export const StockMonitor: React.FC<Props> = ({ data }) => {
  const total = Math.max(data.total_item, 1);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">Monitoring Stok</h3>
          <p className="mt-0.5 text-sm text-stone-500">
            {data.total_item} barang · nilai {rupiah(data.nilai_persediaan)}
          </p>
        </div>

        <Link
          to="/persediaan/stok"
          className="shrink-0 text-xs font-semibold text-yellow-700 transition hover:text-yellow-800"
        >
          Kelola stok
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {KARTU.map((k) => {
          const Ikon = k.ikon;
          const jumlah = data[k.kunci];

          return (
            <div key={k.kunci} className={`rounded-lg border p-3 ${k.kelas}`}>
              <div className={`flex items-center gap-1.5 ${k.teks}`}>
                <Ikon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wide">{k.label}</span>
              </div>

              <p className="mt-1 text-2xl font-bold text-stone-900">{jumlah}</p>
              <p className="text-[11px] text-stone-500">{k.keterangan}</p>
            </div>
          );
        })}
      </div>

      {/* Pita proporsi. Celah 2px di antara ruas memisahkan warna tanpa
          menggambar garis batas di sekelilingnya. */}
      <div className="mt-4">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {KARTU.map((k) =>
            data[k.kunci] > 0 ? (
              <div
                key={k.kunci}
                style={{
                  backgroundColor: k.warna,
                  width: `${(data[k.kunci] / total) * 100}%`,
                }}
                title={`${k.label}: ${data[k.kunci]} barang`}
              />
            ) : null,
          )}
        </div>

        {data.rinci.kritis > 0 && (
          <p className="mt-2 text-xs text-stone-500">
            <strong className="text-red-600">{data.rinci.kritis}</strong> di antara yang menipis
            sudah di bawah setengah batas minimum.
          </p>
        )}
      </div>

      {data.perlu_perhatian.length > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
            Perlu perhatian
          </p>

          <ul className="space-y-1.5">
            {data.perlu_perhatian.map((p) => (
              <li
                key={`${p.kind}-${p.id}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TONE_TO_STATUS[p.status_tone] ?? STATUS.menipis }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-stone-700">{p.name}</span>
                  {/* Label status ikut ditulis — lingkaran warna di kiri bukan
                      satu-satunya pembawa maknanya. */}
                  <span className="shrink-0 text-xs text-stone-400">{p.status_label}</span>
                </span>

                <span className="shrink-0 text-xs tabular-nums text-stone-500">
                  {angka(p.current_stock, 2)} / {angka(p.min_stock, 2)} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
