import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { PaymentModal } from '../../components/sales/PaymentModal';
import { ReceiptModal } from '../../components/sales/ReceiptModal';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { salesService } from '../../services/salesService';
import type {
  CartLine,
  Calculation,
  CatalogProduct,
  DiscountType,
  PosCatalog,
  Sale,
} from '../../types/sales';

/**
 * Halaman kasir.
 *
 * Tata letak dua kolom: grid produk di kiri, keranjang menetap di kanan.
 * Keranjang tidak ikut menggulung karena kasir harus selalu melihat totalnya —
 * itu angka yang diucapkan ke pelanggan.
 *
 * Keranjang hanya hidup di sisi klien. Tidak ada "draft transaksi" yang
 * tersimpan di basis data: pelanggan yang berubah pikiran di depan meja tidak
 * boleh meninggalkan sampah.
 */
export const PosPage: React.FC = () => {
  const toast = useToast();

  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [proses, setProses] = useState(false);

  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState<number | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('');

  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [bayarOpen, setBayarOpen] = useState(false);
  const [struk, setStruk] = useState<Sale | null>(null);

  const kotakCari = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef('');

  const muat = useCallback(async () => {
    try {
      setCatalog(await salesService.catalog());
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat katalog produk.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  // Fokus otomatis ke kotak cari: alur tercepat di meja kasir adalah mengetik
  // nama produk, bukan menggerakkan tetikus ke grid.
  useEffect(() => {
    if (!loading) kotakCari.current?.focus();
  }, [loading]);

  const subtotal = useMemo(
    () => cart.reduce((t, l) => t + l.product.selling_price * l.quantity, 0),
    [cart],
  );

  /*
  | Perhitungan pajak dan diskon dilakukan SERVER, bukan di sini.
  |
  | Menghitungnya dua kali di dua bahasa adalah cara pasti membuat angka di
  | layar berbeda dari angka di struk — dan pelanggan yang menemukan selisihnya
  | akan selalu benar. Server memakai kode yang sama untuk pratinjau dan
  | penyimpanan.
  */
  useEffect(() => {
    if (subtotal <= 0) {
      setCalculation(null);
      return;
    }

    const timer = window.setTimeout(() => {
      salesService
        .calculate(subtotal, discountType, Number(discountValue) || 0)
        .then(setCalculation)
        .catch(() => {
          // Diskon melebihi batas ditolak server. Keranjang tetap utuh, hanya
          // ringkasannya yang belum bisa ditampilkan.
          setCalculation(null);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [subtotal, discountType, discountValue]);

  const terlihat = useMemo(() => {
    if (!catalog) return [];

    const kata = cari.trim().toLowerCase();

    return catalog.products.filter((p) => {
      const cocokKata =
        !kata || p.name.toLowerCase().includes(kata) || p.code.toLowerCase().includes(kata);
      const cocokKategori = kategori === null || p.category_id === kategori;

      return cocokKata && cocokKategori;
    });
  }, [catalog, cari, kategori]);

  /* ---------------------------------------------------------------------- */

  const tambah = (p: CatalogProduct) => {
    if (!p.sellable) return;

    setCart((lama) => {
      const ada = lama.find((l) => l.product.id === p.id);

      // Batas stok ditegakkan di sini juga, bukan hanya di server. Kasir perlu
      // tahu saat menekan tombol, bukan setelah pelanggan menyerahkan uang.
      if (ada) {
        if (ada.quantity + 1 > p.current_stock) {
          toast.warning(`Stok ${p.name} hanya ${angka(p.current_stock)} ${p.unit}.`);
          return lama;
        }

        return lama.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }

      return [...lama, { product: p, quantity: 1 }];
    });
  };

  const ubahJumlah = (id: number, jumlah: number) => {
    setCart((lama) =>
      lama
        .map((l) => {
          if (l.product.id !== id) return l;

          const dibatasi = Math.min(Math.max(jumlah, 0), l.product.current_stock);

          if (jumlah > l.product.current_stock) {
            toast.warning(
              `Stok ${l.product.name} hanya ${angka(l.product.current_stock)} ${l.product.unit}.`,
            );
          }

          return { ...l, quantity: dibatasi };
        })
        .filter((l) => l.quantity > 0),
    );
  };

  const hapus = (id: number) => setCart((lama) => lama.filter((l) => l.product.id !== id));

  const kosongkan = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountValue('');
    kotakCari.current?.focus();
  };

  const bukaPembayaran = () => {
    if (cart.length === 0) {
      toast.warning('Keranjang masih kosong.');
      return;
    }

    if (!calculation) {
      toast.warning('Perhitungan belum siap. Periksa nilai diskon.');
      return;
    }

    // Kunci dibuat sekali per pembukaan dialog, bukan per pengiriman. Dengan
    // begitu tekan-dua-kali karena jaringan lambat memakai kunci yang sama dan
    // server mengenalinya sebagai permintaan yang sama.
    idempotencyKey.current = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setBayarOpen(true);
  };

  const simpan = async (payload: {
    payment_method: 'cash' | 'qris' | 'transfer';
    paid_amount: number;
    customer_name: string | null;
    notes: string | null;
  }) => {
    setProses(true);

    try {
      const { sale, message } = await salesService.store({
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        ...payload,
        idempotency_key: idempotencyKey.current,
      });

      toast.success(message);
      setBayarOpen(false);
      setStruk(sale);
      kosongkan();

      // Katalog dimuat ulang agar sisa stok di grid langsung benar untuk
      // pelanggan berikutnya.
      await muat();
    } catch (error) {
      const validasi = errorValidasi(error);
      toast.error(validasi ? Object.values(validasi)[0][0] : pesanError(error));
    } finally {
      setProses(false);
    }
  };

  if (loading) return <LoadingScreen label="Menyiapkan kasir…" />;
  if (!catalog) return null;

  const jumlahItem = cart.reduce((t, l) => t + l.quantity, 0);

  return (
    <div className="flex flex-col gap-5 lg:h-[calc(100vh-9rem)] lg:flex-row">
      {/* ---------------- Kiri: katalog produk ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-stone-200 p-4">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                ref={kotakCari}
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari produk atau kode… (ketik langsung)"
                aria-label="Cari produk"
                className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
            </div>

            <button
              type="button"
              onClick={() => void muat()}
              className="shrink-0 rounded-lg border border-stone-300 p-2.5 text-stone-500 transition hover:bg-stone-50"
              aria-label="Muat ulang stok"
              title="Muat ulang stok"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {catalog.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKategori(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  kategori === null
                    ? 'bg-yellow-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Semua
              </button>

              {catalog.categories.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKategori(k.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    kategori === k.value
                      ? 'bg-yellow-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {terlihat.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
              Tidak ada produk yang cocok.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {terlihat.map((p) => {
                const diKeranjang = cart.find((l) => l.product.id === p.id)?.quantity ?? 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => tambah(p)}
                    disabled={!p.sellable}
                    className={`relative flex flex-col rounded-xl border-2 p-3 text-left transition ${
                      !p.sellable
                        ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-60'
                        : diKeranjang > 0
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-stone-200 hover:border-yellow-400 hover:bg-yellow-50/40'
                    }`}
                  >
                    {diKeranjang > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-yellow-600 px-1.5 text-xs font-bold text-white shadow">
                        {angka(diKeranjang)}
                      </span>
                    )}

                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-stone-800">
                      {p.name}
                    </p>

                    <p className="mt-1 text-base font-bold tabular-nums text-yellow-700">
                      {rupiah(p.selling_price)}
                    </p>

                    <p
                      className={`mt-0.5 text-xs tabular-nums ${
                        !p.sellable
                          ? 'font-semibold text-red-600'
                          : p.stock_status_tone === 'danger' || p.stock_status_tone === 'warning'
                            ? 'text-amber-600'
                            : 'text-stone-400'
                      }`}
                    >
                      {p.sellable ? `stok ${angka(p.current_stock)} ${p.unit}` : 'STOK HABIS'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Kanan: keranjang ---------------- */}
      <div className="flex w-full shrink-0 flex-col rounded-xl border border-stone-200 bg-white shadow-sm lg:w-[24rem]">
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <ShoppingCart className="h-5 w-5 text-stone-400" />
            Keranjang
            {jumlahItem > 0 && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                {angka(jumlahItem)}
              </span>
            )}
          </h2>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={kosongkan}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kosongkan
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center p-6 text-center">
              <ShoppingCart className="mb-3 h-10 w-10 text-stone-200" />
              <p className="text-sm text-stone-500">Keranjang masih kosong.</p>
              <p className="mt-1 text-xs text-stone-400">
                Ketuk produk di sebelah kiri untuk menambahkannya.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {cart.map((l) => (
                <li key={l.product.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">
                        {l.product.name}
                      </p>
                      <p className="text-xs tabular-nums text-stone-500">
                        {rupiah(l.product.selling_price)} / {l.product.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => hapus(l.product.id)}
                      className="shrink-0 rounded p-1 text-stone-300 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus ${l.product.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => ubahJumlah(l.product.id, l.quantity - 1)}
                        className="rounded-lg border border-stone-300 p-1.5 text-stone-600 transition hover:bg-stone-50"
                        aria-label="Kurangi"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <input
                        type="number"
                        min={0}
                        max={l.product.current_stock}
                        value={l.quantity}
                        onChange={(e) => ubahJumlah(l.product.id, Number(e.target.value))}
                        aria-label={`Jumlah ${l.product.name}`}
                        className="w-14 rounded-lg border border-stone-300 px-2 py-1 text-center text-sm tabular-nums focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                      />

                      <button
                        type="button"
                        onClick={() => ubahJumlah(l.product.id, l.quantity + 1)}
                        className="rounded-lg border border-stone-300 p-1.5 text-stone-600 transition hover:bg-stone-50"
                        aria-label="Tambah"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <span className="font-bold tabular-nums text-stone-900">
                      {rupiah(l.product.selling_price * l.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ringkasan dan tombol bayar */}
        <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 shrink-0 text-stone-400" />

            <select
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value as DiscountType);
                setDiscountValue('');
              }}
              aria-label="Jenis diskon"
              className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs shadow-sm focus:border-yellow-500 focus:outline-none"
            >
              <option value="none">Tanpa diskon</option>
              <option value="percent">Diskon %</option>
              <option value="amount">Diskon Rp</option>
            </select>

            {discountType !== 'none' && (
              <input
                type="number"
                min={0}
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '10' : '5000'}
                aria-label="Nilai diskon"
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm tabular-nums shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-200"
              />
            )}
          </div>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd className="tabular-nums text-stone-700">{rupiah(subtotal)}</dd>
            </div>

            {calculation && calculation.discount_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Diskon</dt>
                <dd className="tabular-nums text-amber-700">
                  −{rupiah(calculation.discount_amount)}
                </dd>
              </div>
            )}

            {calculation && calculation.tax_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Pajak {angka(calculation.tax_percent)}%</dt>
                <dd className="tabular-nums text-stone-700">{rupiah(calculation.tax_amount)}</dd>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
              <dt className="font-bold text-stone-800">Total</dt>
              <dd className="text-xl font-bold tabular-nums text-stone-900">
                {rupiah(calculation?.total ?? subtotal)}
              </dd>
            </div>
          </dl>

          <Button fullWidth size="lg" onClick={bukaPembayaran} disabled={cart.length === 0}>
            Bayar
          </Button>
        </div>
      </div>

      <PaymentModal
        open={bayarOpen}
        calculation={calculation}
        methods={catalog.payment_methods}
        processing={proses}
        onClose={() => setBayarOpen(false)}
        onConfirm={(p) => void simpan(p)}
      />

      <ReceiptModal
        open={!!struk}
        sale={struk}
        settings={catalog.settings}
        onClose={() => setStruk(null)}
        onNewSale={() => {
          setStruk(null);
          kotakCari.current?.focus();
        }}
      />
    </div>
  );
};
