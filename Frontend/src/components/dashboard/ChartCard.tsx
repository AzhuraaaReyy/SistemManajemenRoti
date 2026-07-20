import React, { useState } from 'react';
import { Table2, X } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  /** Legenda: satu entri per deret. Deret tunggal tidak perlu legenda. */
  legend?: { label: string; color: string }[];
  /** Isi tabel pendamping — kembaran grafik yang bisa dibaca tanpa warna. */
  table?: { head: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
}

/**
 * Bingkai satu grafik.
 *
 * Menegakkan tiga hal yang gampang terlewat saat menulis grafik satu per satu:
 *
 *   1. Legenda selalu ada untuk dua deret atau lebih, sehingga identitas tidak
 *      pernah bergantung pada warna semata.
 *   2. Setiap grafik punya kembaran tabel. Tooltip boleh memperkaya, tetapi
 *      tidak boleh menjadi satu-satunya jalan membaca sebuah angka — pembaca
 *      dengan pembaca layar, atau yang mencetak halaman ini, tidak punya hover.
 *   3. Tinggi bingkai memuat pita sumbu, bukan hanya bidang plotnya, supaya
 *      label tanggal tidak terpotong dan kartunya tidak menumbuhkan
 *      penggulung kecil di dalam.
 */
export const ChartCard: React.FC<Props> = ({
  title,
  description,
  legend,
  table,
  children,
  className = '',
}) => {
  const [lihatTabel, setLihatTabel] = useState(false);

  return (
    <div className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-stone-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Legenda hanya untuk dua deret atau lebih; deret tunggal sudah
              dinamai oleh judulnya. */}
          {legend && legend.length > 1 && (
            <ul className="flex flex-wrap items-center gap-3">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-4 shrink-0 rounded-sm"
                    style={{ backgroundColor: l.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-stone-600">{l.label}</span>
                </li>
              ))}
            </ul>
          )}

          {table && (
            <button
              type="button"
              onClick={() => setLihatTabel((v) => !v)}
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              aria-label={lihatTabel ? 'Tampilkan grafik' : 'Tampilkan tabel'}
              title={lihatTabel ? 'Tampilkan grafik' : 'Tampilkan tabel angka'}
            >
              {lihatTabel ? <X className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {lihatTabel && table ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-stone-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-stone-200 bg-stone-50">
              <tr>
                {table.head.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-500 ${
                      i > 0 ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className={`px-3 py-1.5 ${
                        j > 0 ? 'text-right tabular-nums text-stone-700' : 'text-stone-600'
                      }`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

/**
 * Isi tooltip yang seragam untuk seluruh grafik.
 *
 * Recharts membawa tooltip bawaan berlatar kotak putih tanpa gaya; menuliskan
 * satu di sini membuat ketiga grafik berbicara dengan bentuk yang sama.
 */
export const TooltipBox: React.FC<{
  title: string;
  rows: { label: string; value: string; color?: string }[];
}> = ({ title, rows }) => (
  <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg">
    <p className="mb-1 text-xs font-semibold text-stone-800">{title}</p>

    <ul className="space-y-0.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-stone-500">
            {r.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.color }}
                aria-hidden="true"
              />
            )}
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-stone-900">{r.value}</span>
        </li>
      ))}
    </ul>
  </div>
);
