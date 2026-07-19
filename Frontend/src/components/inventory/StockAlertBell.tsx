import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, PackageX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tanggalWaktu } from '../../lib/format';
import { stockAlertService } from '../../services/inventoryService';
import type { StockAlert } from '../../types/inventory';

/** Jeda penyegaran. Cukup jarang agar tidak membebani, cukup sering agar berguna. */
const JEDA_MS = 60_000;

const WARNA: Record<string, string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  neutral: 'bg-stone-400',
};

/**
 * Lonceng peringatan stok di bilah atas.
 *
 * Isinya berasal dari tabel `stock_alerts` yang diisi saat stok BERGERAK —
 * membuka lonceng ini tidak pernah membuat peringatan baru.
 */
export const StockAlertBell: React.FC = () => {
  const { user } = useAuth();
  const [buka, setBuka] = useState(false);
  const [jumlah, setJumlah] = useState(0);
  const [items, setItems] = useState<StockAlert[]>([]);
  const [proses, setProses] = useState(false);

  const wadah = useRef<HTMLDivElement>(null);

  // Hanya peran yang punya menu persediaan yang boleh memanggil endpointnya —
  // memanggilnya sebagai Kasir hanya akan menghasilkan 403 berulang.
  const berhak = user?.allowed_menus.includes('persediaan') ?? false;

  const muat = useCallback(async () => {
    if (!berhak) return;

    try {
      const hasil = await stockAlertService.unread();
      setJumlah(hasil.count);
      setItems(hasil.items);
    } catch {
      // Kegagalan mengambil notifikasi tidak perlu diberitahukan — ia pelengkap,
      // dan pesan galat yang muncul sendiri tiap menit justru mengganggu.
    }
  }, [berhak]);

  useEffect(() => {
    void muat();

    const timer = setInterval(() => void muat(), JEDA_MS);

    return () => clearInterval(timer);
  }, [muat]);

  // Tutup saat mengeklik di luar panel.
  useEffect(() => {
    if (!buka) return;

    const onClick = (e: MouseEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false);
    };

    document.addEventListener('mousedown', onClick);

    return () => document.removeEventListener('mousedown', onClick);
  }, [buka]);

  if (!berhak) return null;

  const tandaiSatu = async (id: number) => {
    try {
      const sisa = await stockAlertService.markRead(id);
      setJumlah(sisa);
      setItems((daftar) => daftar.filter((a) => a.id !== id));
    } catch {
      /* diabaikan — akan dimuat ulang pada penyegaran berikutnya */
    }
  };

  const tandaiSemua = async () => {
    setProses(true);

    try {
      await stockAlertService.markAllRead();
      setJumlah(0);
      setItems([]);
    } catch {
      /* diabaikan */
    } finally {
      setProses(false);
    }
  };

  return (
    <div ref={wadah} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        className="relative rounded-lg p-2 text-stone-600 transition hover:bg-stone-100"
        aria-label={jumlah > 0 ? `${jumlah} peringatan stok belum dibaca` : 'Peringatan stok'}
        aria-expanded={buka}
      >
        <Bell className="h-5 w-5" />

        {jumlah > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {jumlah > 9 ? '9+' : jumlah}
          </span>
        )}
      </button>

      {buka && (
        <div className="absolute right-0 z-40 mt-2 w-[21rem] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-sm font-bold text-stone-900">Peringatan Stok</h3>

            {jumlah > 0 && (
              <button
                type="button"
                onClick={() => void tandaiSemua()}
                disabled={proses}
                className="text-xs font-semibold text-yellow-700 transition hover:text-yellow-800 disabled:opacity-50"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <PackageX className="mx-auto mb-2 h-8 w-8 text-stone-300" />
                <p className="text-sm text-stone-500">Tidak ada peringatan baru.</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  Peringatan muncul saat status stok berubah menjadi lebih genting.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {items.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${WARNA[a.to_status_tone] ?? 'bg-stone-400'}`}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-stone-800">{a.message}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Sisa {a.stock_at_alert} · minimum {a.min_stock_at_alert}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-400">{tanggalWaktu(a.created_at)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void tandaiSatu(a.id)}
                      className="shrink-0 rounded-lg p-1.5 text-stone-300 transition hover:bg-emerald-50 hover:text-emerald-600"
                      aria-label="Tandai sudah dibaca"
                      title="Tandai sudah dibaca"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/persediaan/stok"
            onClick={() => setBuka(false)}
            className="block border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-center text-xs font-semibold text-stone-600 transition hover:bg-stone-100"
          >
            Buka daftar stok
          </Link>
        </div>
      )}
    </div>
  );
};
