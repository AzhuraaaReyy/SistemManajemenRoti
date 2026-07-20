import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Boxes, ClipboardCheck, Download, Search, X } from 'lucide-react';
import { StockAdjustmentModal } from '../../components/inventory/StockAdjustmentModal';
import { PageHeader } from '../../components/data/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { inventoryService } from '../../services/inventoryService';
import type { InventoryOptions, StockItem } from '../../types/inventory';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

type SortKey = 'status' | 'name' | 'code' | 'stock' | 'value';

/**
 * Tabel stok gabungan bahan baku dan produk jadi.
 *
 * Tidak berhalaman: seluruh barang ditampilkan sekaligus, terurut dari yang
 * paling genting. Halaman kedua yang berisi barang paling aman tidak ada
 * gunanya, dan pencarian di sisi klien terasa seketika untuk puluhan baris.
 */
export const StockItemsPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();

  /*
  | Kepala Produksi boleh MELIHAT stok, tapi tidak menyesuaikannya — koreksi
  | terhadap hitungan fisik adalah tanggung jawab gudang, dan servernya menolak
  | endpoint `inventory/adjustments` untuk peran lain.
  |
  | Kolomnya ikut disembunyikan, bukan sekadar tombolnya dinonaktifkan. Tombol
  | mati yang tidak pernah bisa ditekan hanya membuat orang mengira haknya
  | sedang bermasalah.
  */
  const bolehSesuaikan = user?.role === 'owner' || user?.role === 'admin_gudang';

  const [items, setItems] = useState<StockItem[]>([]);
  const [nilaiTotal, setNilaiTotal] = useState(0);
  const [options, setOptions] = useState<InventoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [mengekspor, setMengekspor] = useState(false);

  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [sesuaikan, setSesuaikan] = useState<StockItem | null>(null);

  const filters = useMemo(
    () => ({ status, kind, sort_by: sortBy, sort_dir: sortDir }),
    [status, kind, sortBy, sortDir],
  );

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      const hasil = await inventoryService.items(filters);
      setItems(hasil.items);
      setNilaiTotal(hasil.nilai_total);
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat daftar stok.'));
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    inventoryService
      .options()
      .then(setOptions)
      .catch(() => toast.error('Gagal memuat pilihan filter.'));
  }, [toast]);

  // Pencarian ditapis di sisi klien agar terasa seketika. Filter status dan
  // jenis tetap ke server karena keduanya juga dipakai saat export.
  const terlihat = useMemo(() => {
    const kata = cari.trim().toLowerCase();

    if (!kata) return items;

    return items.filter(
      (i) => i.name.toLowerCase().includes(kata) || i.code.toLowerCase().includes(kata),
    );
  }, [items, cari]);

  const adaFilter = !!(cari || status || kind);

  const urutkan = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const ekspor = async () => {
    setMengekspor(true);

    try {
      await inventoryService.exportItems(filters);
      toast.success('Laporan stok diunduh. Berkas CSV bisa langsung dibuka di Excel.');
    } catch (error) {
      toast.error(pesanError(error, 'Gagal mengunduh laporan.'));
    } finally {
      setMengekspor(false);
    }
  };

  const Kolom: React.FC<{ label: string; sortKey?: SortKey; align?: string }> = ({
    label,
    sortKey,
    align = 'left',
  }) => (
    <th
      scope="col"
      className={`px-3 py-2.5 text-${align} text-xs font-bold uppercase tracking-wide text-stone-500`}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => urutkan(sortKey)}
          className={`inline-flex items-center gap-1 transition hover:text-stone-800 ${
            sortBy === sortKey ? 'text-stone-800' : ''
          }`}
        >
          {label}
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Stok"
        description="Stok terkini seluruh bahan baku dan produk jadi, terurut dari yang paling genting."
        action={
          <Button variant="secondary" icon={Download} onClick={() => void ekspor()} loading={mengekspor}>
            Export Excel
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Filter */}
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau kode barang…"
              aria-label="Cari barang"
              className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter status stok"
              className="min-w-[10rem] rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              <option value="">Semua Status</option>
              {options?.statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Filter jenis barang"
              className="min-w-[10rem] rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              <option value="">Semua Jenis</option>
              {options?.kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          {adaFilter && (
            <button
              type="button"
              onClick={() => {
                setCari('');
                setStatus('');
                setKind('');
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
              Hapus Filter
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : terlihat.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={adaFilter ? 'Tidak ada hasil' : 'Belum ada barang'}
            description={
              adaFilter
                ? 'Tidak ada barang yang cocok dengan filter Anda.'
                : 'Tambahkan bahan baku atau produk di Master Data terlebih dahulu.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <Kolom label="Barang" sortKey="name" />
                  <Kolom label="Jenis" />
                  <Kolom label="Stok" sortKey="stock" align="right" />
                  <Kolom label="Minimum" align="right" />
                  <Kolom label="Status" />
                  <Kolom label="Perkiraan Habis" align="right" />
                  <Kolom label="Nilai" sortKey="value" align="right" />
                  {bolehSesuaikan && (
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase text-stone-500">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {terlihat.map((i) => (
                  <tr key={`${i.kind}-${i.id}`} className="transition hover:bg-stone-50">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-stone-800">{i.name}</p>
                      <p className="font-mono text-xs text-stone-400">
                        {i.code}
                        {i.category_name && ` · ${i.category_name}`}
                      </p>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        {i.kind_label}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <span className="font-semibold tabular-nums text-stone-900">
                        {angka(i.current_stock, 2)}
                      </span>
                      <span className="ml-1 text-xs text-stone-400">{i.unit}</span>
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums text-stone-500">
                      {angka(i.min_stock, 2)}
                    </td>

                    <td className="px-3 py-2.5">
                      <Badge tone={TONE[i.status_tone] ?? 'neutral'}>{i.status_label}</Badge>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      {i.days_remaining === null ? (
                        <span className="text-xs text-stone-300">—</span>
                      ) : (
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            i.days_remaining <= 2
                              ? 'text-red-600'
                              : i.days_remaining <= 7
                                ? 'text-amber-600'
                                : 'text-stone-500'
                          }`}
                        >
                          ± {i.days_remaining} hari
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums text-stone-700">
                      {rupiah(i.stock_value)}
                    </td>

                    {bolehSesuaikan && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSesuaikan(i)}
                          className="rounded-lg p-2 text-stone-400 transition hover:bg-yellow-50 hover:text-yellow-700"
                          aria-label={`Sesuaikan stok ${i.name}`}
                          title="Penyesuaian stok manual"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-stone-200 bg-stone-50">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right text-sm font-bold text-stone-700">
                    {terlihat.length === items.length
                      ? `Total ${items.length} barang`
                      : `${terlihat.length} dari ${items.length} barang`}
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums text-stone-900">
                    {rupiah(nilaiTotal)}
                  </td>
                  {bolehSesuaikan && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Status dihitung ulang setiap kali halaman dimuat, dari stok saat ini dibanding batas
        minimum. Mengubah batas minimum sebuah barang di Master Data langsung mengubah statusnya
        di sini.
      </p>

      <StockAdjustmentModal
        open={!!sesuaikan}
        item={sesuaikan}
        onClose={() => setSesuaikan(null)}
        onAdjusted={() => void muat()}
      />
    </div>
  );
};
