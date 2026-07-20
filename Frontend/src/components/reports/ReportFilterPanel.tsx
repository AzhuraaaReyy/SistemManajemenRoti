import React from 'react';
import { CalendarRange, RotateCcw } from 'lucide-react';
import type {
  FilterKey,
  Pilihan,
  ReportFilters,
  ReportOptions,
} from '../../types/reports';

interface Props {
  filters: FilterKey[];
  values: ReportFilters;
  options: ReportOptions | null;
  onChange: (patch: Partial<ReportFilters>) => void;
  onReset: () => void;
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-stone-600">
    {children}
  </label>
);

const kelasInput =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm transition focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200';

/**
 * Panel filter yang menyesuaikan diri dengan jenis laporan.
 *
 * Hanya filter yang benar-benar dipakai laporan terpilih yang ditampilkan.
 * Menampilkan filter supplier pada laporan produksi hanya akan membuat
 * pengguna mengira laporannya bisa disaring begitu — lalu bingung ketika
 * hasilnya tidak berubah. Daftar filternya datang dari server, satu sumber
 * dengan yang dipakai query-nya.
 */
export const ReportFilterPanel: React.FC<Props> = ({
  filters,
  values,
  options,
  onChange,
  onReset,
}) => {
  const punya = (f: FilterKey) => filters.includes(f);

  const pilihanSelect = (
    id: string,
    label: string,
    key: keyof ReportFilters,
    daftar: Pilihan[] | { value: string; label: string }[],
    semua: string,
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={String(values[key] ?? '')}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<ReportFilters>)}
        className={kelasInput}
      >
        <option value="">{semua}</option>
        {daftar.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-stone-800">
          <CalendarRange className="h-4 w-4 text-stone-400" />
          Filter Laporan
        </h3>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Atur Ulang
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Rentang tanggal — dipakai enam dari tujuh laporan */}
        {punya('date_range') && (
          <>
            <div>
              <Label htmlFor="f-dari">Dari Tanggal</Label>
              <input
                id="f-dari"
                type="date"
                value={values.date_from ?? ''}
                max={values.date_to || undefined}
                onChange={(e) => onChange({ date_from: e.target.value })}
                className={kelasInput}
              />
            </div>

            <div>
              <Label htmlFor="f-sampai">Sampai Tanggal</Label>
              <input
                id="f-sampai"
                type="date"
                value={values.date_to ?? ''}
                min={values.date_from || undefined}
                onChange={(e) => onChange({ date_to: e.target.value })}
                className={kelasInput}
              />
            </div>

            {/*
              Pintasan bulan dan tahun.
              Mengisinya akan MENIMPA rentang tanggal di server — jadi kedua
              isian tanggal dikosongkan begitu pintasan dipakai, supaya layar
              tidak menampilkan dua periode yang saling bertentangan.
            */}
            <div>
              <Label htmlFor="f-bulan">Bulan</Label>
              <select
                id="f-bulan"
                value={String(values.month ?? '')}
                onChange={(e) =>
                  onChange({
                    month: e.target.value ? Number(e.target.value) : '',
                    year: e.target.value && !values.year ? new Date().getFullYear() : values.year,
                    date_from: '',
                    date_to: '',
                  })
                }
                className={kelasInput}
              >
                <option value="">— pakai rentang tanggal —</option>
                {BULAN.map((b, i) => (
                  <option key={b} value={i + 1}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="f-tahun">Tahun</Label>
              <select
                id="f-tahun"
                value={String(values.year ?? '')}
                onChange={(e) =>
                  onChange({
                    year: e.target.value ? Number(e.target.value) : '',
                    month: e.target.value ? values.month : '',
                    date_from: '',
                    date_to: '',
                  })
                }
                className={kelasInput}
              >
                <option value="">— pakai rentang tanggal —</option>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Snapshot — satu tanggal, bukan rentang */}
        {punya('as_of') && (
          <div>
            <Label htmlFor="f-asof">Keadaan Stok Per Tanggal</Label>
            <input
              id="f-asof"
              type="date"
              value={values.as_of ?? ''}
              onChange={(e) => onChange({ as_of: e.target.value })}
              className={kelasInput}
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Disusun ulang dari riwayat mutasi, bukan stok hari ini.
            </p>
          </div>
        )}

        {punya('supplier_id') &&
          pilihanSelect('f-supplier', 'Supplier', 'supplier_id', options?.suppliers ?? [], 'Semua Supplier')}

        {punya('product_id') &&
          pilihanSelect('f-produk', 'Produk', 'product_id', options?.products ?? [], 'Semua Produk')}

        {punya('category_id') &&
          pilihanSelect('f-kategori', 'Kategori', 'category_id', options?.categories ?? [], 'Semua Kategori')}

        {punya('cashier_id') &&
          pilihanSelect('f-kasir', 'Kasir', 'cashier_id', options?.cashiers ?? [], 'Semua Kasir')}

        {punya('payment_method') &&
          pilihanSelect('f-bayar', 'Metode Bayar', 'payment_method', options?.payment_methods ?? [], 'Semua Metode')}

        {punya('source_type') &&
          pilihanSelect('f-sumber', 'Sumber Mutasi', 'source_type', options?.source_types ?? [], 'Semua Sumber')}

        {punya('direction') && (
          <div>
            <Label htmlFor="f-arah">Arah Mutasi</Label>
            <select
              id="f-arah"
              value={values.direction ?? ''}
              onChange={(e) => onChange({ direction: e.target.value })}
              className={kelasInput}
            >
              <option value="">Masuk & Keluar</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
            </select>
          </div>
        )}

        {punya('kind') &&
          pilihanSelect('f-jenis', 'Jenis Barang', 'kind', options?.kinds ?? [], 'Bahan & Produk')}

        {/* Ketiga status memakai satu kunci `status` — sebuah laporan hanya
            pernah memakai salah satunya. */}
        {punya('status_penjualan') &&
          pilihanSelect('f-status', 'Status', 'status', options?.status_penjualan ?? [], 'Semua Status')}

        {punya('status_produksi') &&
          pilihanSelect('f-status', 'Status', 'status', options?.status_produksi ?? [], 'Semua Status')}

        {punya('status_pembelian') &&
          pilihanSelect('f-status', 'Status', 'status', options?.status_pembelian ?? [], 'Semua Status')}
      </div>
    </div>
  );
};
