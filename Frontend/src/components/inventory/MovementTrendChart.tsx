import React, { useMemo, useState } from 'react';
import { angka } from '../../lib/format';
import type { MovementTrendPoint } from '../../types/inventory';

interface Props {
  data: MovementTrendPoint[];
  /** Judul satuan pada sumbu, mis. "unit". */
  unitLabel?: string;
}

/*
| Grafik garis tren mutasi stok.
|
| Digambar sendiri dengan SVG, tanpa pustaka chart. Alasannya bukan penghematan
| semata: dashboard pembelian dan produksi sudah memakai batang CSS buatan
| sendiri, dan menambahkan Recharts (~100 KB) hanya untuk satu grafik akan
| membuat tampilan sistem terbelah menjadi dua gaya yang berbeda.
|
| Dua garis: masuk (hijau) dan keluar (merah).
*/

const LEBAR = 720;
const TINGGI = 200;
const PADDING = { atas: 12, kanan: 12, bawah: 26, kiri: 46 };

export const MovementTrendChart: React.FC<Props> = ({ data, unitLabel = 'unit' }) => {
  const [sorot, setSorot] = useState<number | null>(null);

  const { garisMasuk, garisKeluar, titikMasuk, titikKeluar, maksimum, sumbuY } = useMemo(() => {
    const tertinggi = Math.max(...data.map((d) => Math.max(d.masuk, d.keluar)), 1);

    // Dibulatkan ke atas agar garis bantu jatuh di angka yang enak dibaca
    // (0 · 250 · 500 · 750 · 1.000), bukan 0 · 237 · 474.
    const pangkat = 10 ** Math.floor(Math.log10(tertinggi));
    const maks = Math.ceil(tertinggi / pangkat) * pangkat;

    const lebarPlot = LEBAR - PADDING.kiri - PADDING.kanan;
    const tinggiPlot = TINGGI - PADDING.atas - PADDING.bawah;

    const x = (i: number) =>
      PADDING.kiri + (data.length <= 1 ? lebarPlot / 2 : (i / (data.length - 1)) * lebarPlot);

    const y = (nilai: number) => PADDING.atas + tinggiPlot - (nilai / maks) * tinggiPlot;

    const susun = (ambil: (d: MovementTrendPoint) => number) =>
      data.map((d, i) => ({ x: x(i), y: y(ambil(d)), nilai: ambil(d) }));

    const masuk = susun((d) => d.masuk);
    const keluar = susun((d) => d.keluar);

    const jalur = (titik: { x: number; y: number }[]) =>
      titik.map((t, i) => `${i === 0 ? 'M' : 'L'} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join(' ');

    return {
      garisMasuk: jalur(masuk),
      garisKeluar: jalur(keluar),
      titikMasuk: masuk,
      titikKeluar: keluar,
      maksimum: maks,
      sumbuY: [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        nilai: maks * f,
        y: PADDING.atas + tinggiPlot - f * tinggiPlot,
      })),
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
        Belum ada pergerakan stok pada periode ini.
      </p>
    );
  }

  const aktif = sorot !== null ? data[sorot] : null;

  // Label tanggal dijarangkan supaya tidak bertumpuk pada rentang 30 hari.
  const jarakLabel = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-emerald-500" aria-hidden="true" />
          <span className="font-medium text-stone-600">Stok masuk</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-red-500" aria-hidden="true" />
          <span className="font-medium text-stone-600">Stok keluar</span>
        </span>

        {aktif && (
          <span className="ml-auto rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-700">
            {aktif.label} · masuk {angka(aktif.masuk)} · keluar {angka(aktif.keluar)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LEBAR} ${TINGGI}`}
          className="h-52 w-full min-w-[560px]"
          role="img"
          aria-label={`Tren mutasi stok ${data.length} hari terakhir`}
        >
          {/* Garis bantu mendatar */}
          {sumbuY.map((g) => (
            <g key={g.y}>
              <line
                x1={PADDING.kiri}
                x2={LEBAR - PADDING.kanan}
                y1={g.y}
                y2={g.y}
                stroke="#e7e5e4"
                strokeWidth="1"
              />
              <text x={PADDING.kiri - 8} y={g.y + 3} textAnchor="end" className="fill-stone-400 text-[9px]">
                {angka(g.nilai, 0)}
              </text>
            </g>
          ))}

          {/* Area di bawah garis masuk — memberi bobot visual tanpa mengaburkan
              garis keluar yang digambar di atasnya. */}
          <path
            d={`${garisMasuk} L ${titikMasuk[titikMasuk.length - 1].x} ${TINGGI - PADDING.bawah} L ${titikMasuk[0].x} ${TINGGI - PADDING.bawah} Z`}
            fill="#10b981"
            opacity="0.07"
          />

          <path d={garisMasuk} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
          <path d={garisKeluar} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />

          {/* Titik hanya digambar pada hari yang benar-benar ada pergerakan —
              menggambar semuanya membuat garis 30 hari penuh bintik. */}
          {titikMasuk.map((t, i) =>
            data[i].masuk > 0 ? (
              <circle key={`m${i}`} cx={t.x} cy={t.y} r={sorot === i ? 4 : 2.5} fill="#10b981" />
            ) : null,
          )}
          {titikKeluar.map((t, i) =>
            data[i].keluar > 0 ? (
              <circle key={`k${i}`} cx={t.x} cy={t.y} r={sorot === i ? 4 : 2.5} fill="#ef4444" />
            ) : null,
          )}

          {/* Pita transparan sebagai sasaran tunjuk — lebih mudah dikenai
              daripada titik yang hanya beberapa piksel. */}
          {data.map((d, i) => {
            const lebarPita = (LEBAR - PADDING.kiri - PADDING.kanan) / Math.max(data.length, 1);

            return (
              <rect
                key={d.tanggal}
                x={titikMasuk[i].x - lebarPita / 2}
                y={PADDING.atas}
                width={lebarPita}
                height={TINGGI - PADDING.atas - PADDING.bawah}
                fill="transparent"
                onMouseEnter={() => setSorot(i)}
                onMouseLeave={() => setSorot(null)}
              />
            );
          })}

          {sorot !== null && (
            <line
              x1={titikMasuk[sorot].x}
              x2={titikMasuk[sorot].x}
              y1={PADDING.atas}
              y2={TINGGI - PADDING.bawah}
              stroke="#a8a29e"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Label tanggal */}
          {data.map((d, i) =>
            i % jarakLabel === 0 || i === data.length - 1 ? (
              <text
                key={d.tanggal}
                x={titikMasuk[i].x}
                y={TINGGI - 8}
                textAnchor="middle"
                className="fill-stone-400 text-[9px]"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <p className="mt-1 text-right text-[11px] text-stone-400">
        Puncak {angka(maksimum, 0)} {unitLabel} · satuan dasar tiap barang
      </p>
    </div>
  );
};
