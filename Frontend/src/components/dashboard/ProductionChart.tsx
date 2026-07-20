import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, TooltipBox } from './ChartCard';
import { AXIS_PROPS, CHART, GRID_PROPS } from '../../lib/chartTheme';
import { angka } from '../../lib/format';
import type { TitikProduksi } from '../../types/dashboard';

interface Props {
  data: TitikProduksi[];
  days: number;
}

/*
| Jumlah batch produksi selesai per hari.
|
| SATU deret, jadi satu warna untuk seluruh batang — bukan gradasi
| gelap-untuk-yang-besar. Mewarnai batang menurut tingginya berarti menyandikan
| angka yang sama dua kali dan membakar satu-satunya saluran warna yang tersisa
| untuk informasi yang sudah ditunjukkan panjang batangnya.
|
| Karena hanya satu deret, tidak ada legenda — judulnya sudah menamainya.
*/
export const ProductionChart: React.FC<Props> = ({ data, days }) => {
  const totalBatch = data.reduce((t, d) => t + d.batch, 0);
  const totalUnit = data.reduce((t, d) => t + d.unit, 0);

  return (
    <ChartCard
      title="Produksi Harian"
      description={`${days} hari terakhir · ${totalBatch} batch selesai, ${angka(totalUnit)} unit`}
      table={{
        head: ['Tanggal', 'Batch', 'Unit Baik', 'Gagal'],
        rows: data
          .filter((d) => d.batch > 0)
          .map((d) => [d.label, d.batch, angka(d.unit), angka(d.gagal)]),
      }}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid {...GRID_PROPS} />

            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={28} />

            {/* allowDecimals dimatikan: jumlah batch selalu bulat, dan sumbu
                yang menampilkan "0,5 batch" hanya membingungkan. */}
            <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />

            <Tooltip
              cursor={{ fill: CHART.grid, fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const d = payload[0].payload as TitikProduksi;

                return (
                  <TooltipBox
                    title={d.label_penuh}
                    rows={[
                      { label: 'Batch selesai', value: `${d.batch}`, color: CHART.batch },
                      { label: 'Unit layak jual', value: angka(d.unit) },
                      ...(d.gagal > 0 ? [{ label: 'Unit gagal', value: angka(d.gagal) }] : []),
                    ]}
                  />
                );
              }}
            />

            {/* Ujung data dibulatkan 4px, pangkalnya menempel pada garis nol. */}
            <Bar dataKey="batch" name="Batch" fill={CHART.batch} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
