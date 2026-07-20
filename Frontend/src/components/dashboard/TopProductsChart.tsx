import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, TooltipBox } from './ChartCard';
import { AXIS_PROPS, CHART, GRID_PROPS } from '../../lib/chartTheme';
import { angka, rupiah } from '../../lib/format';

interface Props {
  data: {
    product_id: number | null;
    name: string;
    unit: string;
    total_qty: number;
    total_nilai: number;
    total_laba: number;
  }[];
  periodLabel: string;
}

/*
| Lima produk terlaris.
|
| Batang MENDATAR, karena nama produk panjang — "Croissant Butter Premium"
| dimiringkan di sumbu bawah adalah salah satu cara paling sering sebuah grafik
| menjadi tidak terbaca.
|
| Satu warna untuk seluruh batang. Produk adalah kategori nominal tanpa urutan
| alami, jadi gradasi warna menurut besarnya hanya mengulang apa yang sudah
| dikatakan panjang batangnya.
*/
export const TopProductsChart: React.FC<Props> = ({ data, periodLabel }) => {
  if (data.length === 0) {
    return (
      <ChartCard title="Produk Terlaris" description={periodLabel}>
        <p className="rounded-lg border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          Belum ada penjualan pada periode ini.
        </p>
      </ChartCard>
    );
  }

  // Nama dipendekkan hanya di sumbu; nama utuhnya tetap muncul di tooltip
  // dan di tabel pendamping.
  const chartData = data.map((d) => ({
    ...d,
    pendek: d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name,
  }));

  return (
    <ChartCard
      title="Produk Terlaris"
      description={`Lima teratas menurut jumlah terjual · ${periodLabel}`}
      table={{
        head: ['Produk', 'Terjual', 'Nilai', 'Laba Kotor'],
        rows: data.map((d) => [
          d.name,
          `${angka(d.total_qty)} ${d.unit}`,
          rupiah(d.total_nilai),
          rupiah(d.total_laba),
        ]),
      }}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="22%"
          >
            <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />

            <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="pendek"
              {...AXIS_PROPS}
              width={132}
              tick={{ fill: '#57534e', fontSize: 11 }}
            />

            <Tooltip
              cursor={{ fill: CHART.grid, fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const d = payload[0].payload as (typeof chartData)[number];

                return (
                  <TooltipBox
                    title={d.name}
                    rows={[
                      {
                        label: 'Terjual',
                        value: `${angka(d.total_qty)} ${d.unit}`,
                        color: CHART.produk,
                      },
                      { label: 'Nilai penjualan', value: rupiah(d.total_nilai) },
                      { label: 'Laba kotor', value: rupiah(d.total_laba) },
                    ]}
                  />
                );
              }}
            />

            <Bar dataKey="total_qty" name="Terjual" fill={CHART.produk} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
