import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard, TooltipBox } from './ChartCard';
import { AXIS_PROPS, CHART, GRID_PROPS } from '../../lib/chartTheme';
import { angka, rupiah } from '../../lib/format';
import type { TitikPenjualan } from '../../types/dashboard';

interface Props {
  data: TitikPenjualan[];
  days: number;
}

/** Rp1.250.000 → "1,2jt" — sumbu harus terbaca sekilas, bukan dieja. */
const ringkas = (n: number): string => {
  if (n >= 1_000_000) return `${angka(n / 1_000_000, 1)}jt`;
  if (n >= 1_000) return `${angka(n / 1_000, 0)}rb`;
  return angka(n, 0);
};

/*
| Tren penjualan harian.
|
| DUA deret, SATU sumbu: omzet dan laba kotor, keduanya dalam rupiah.
|
| Jumlah transaksi sengaja TIDAK ikut digambar meski datanya tersedia. Ia
| bersatuan berbeda (belasan, bukan jutaan), sehingga menggambarnya menuntut
| sumbu Y kedua — dan penyelarasan dua sumbu selalu sembarang, membuat grafik
| mengarang hubungan yang tidak ada di datanya. Angkanya tetap terbaca di
| tooltip dan di tabel pendamping.
*/
export const SalesTrendChart: React.FC<Props> = ({ data, days }) => {
  const totalOmzet = data.reduce((t, d) => t + d.omzet, 0);

  return (
    <ChartCard
      title="Tren Penjualan"
      description={`${days} hari terakhir · total ${rupiah(totalOmzet)}`}
      legend={[
        { label: 'Omzet', color: CHART.omzet },
        { label: 'Laba kotor', color: CHART.laba },
      ]}
      table={{
        head: ['Tanggal', 'Transaksi', 'Omzet', 'Laba Kotor'],
        rows: data
          .filter((d) => d.transaksi > 0)
          .map((d) => [d.label, d.transaksi, rupiah(d.omzet), rupiah(d.laba_kotor)]),
      }}
    >
      {/* Tinggi wadah memuat pita sumbu, bukan hanya bidang plot. */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOmzet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.omzet} stopOpacity={0.16} />
                <stop offset="100%" stopColor={CHART.omzet} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid {...GRID_PROPS} />

            <XAxis
              dataKey="label"
              {...AXIS_PROPS}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis {...AXIS_PROPS} width={52} tickFormatter={ringkas} />

            <Tooltip
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const d = payload[0].payload as TitikPenjualan;

                return (
                  <TooltipBox
                    title={d.label_penuh}
                    rows={[
                      { label: 'Omzet', value: rupiah(d.omzet), color: CHART.omzet },
                      { label: 'Laba kotor', value: rupiah(d.laba_kotor), color: CHART.laba },
                      { label: 'Transaksi', value: `${d.transaksi}` },
                    ]}
                  />
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="omzet"
              name="Omzet"
              stroke={CHART.omzet}
              strokeWidth={2}
              fill="url(#gradOmzet)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
            />

            <Area
              type="monotone"
              dataKey="laba_kotor"
              name="Laba kotor"
              stroke={CHART.laba}
              strokeWidth={2}
              fill="none"
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
