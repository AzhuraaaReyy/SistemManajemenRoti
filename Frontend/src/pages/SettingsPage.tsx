import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Save, Store, Wallet } from 'lucide-react';
import { PageHeader } from '../components/data/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingScreen } from '../components/ui/Feedback';
import { useToast } from '../context/ToastContext';
import { errorValidasi, pesanError } from '../lib/api';
import { settingsService } from '../services/salesService';
import type { SettingField } from '../types/sales';

const IKON_GRUP: Record<string, React.ElementType> = {
  toko: Store,
  penjualan: Wallet,
  struk: Receipt,
};

const JUDUL_GRUP: Record<string, string> = {
  toko: 'Identitas Toko',
  penjualan: 'Penjualan & Pajak',
  struk: 'Struk',
};

const KETERANGAN_GRUP: Record<string, string> = {
  toko: 'Tampil di kepala struk yang diterima pelanggan.',
  penjualan: 'Berlaku untuk transaksi berikutnya. Transaksi lama tidak ikut berubah.',
  struk: 'Catatan penutup di bagian bawah struk.',
};

/**
 * Pengaturan aplikasi — khusus Owner.
 *
 * Tarif pajak yang diubah di sini langsung berlaku pada transaksi berikutnya,
 * tetapi TIDAK mengubah transaksi yang sudah tersimpan: tarif dibekukan di
 * setiap baris penjualan, sehingga struk bulan lalu tetap menunjukkan angka
 * yang benar-benar dibayar pelanggan saat itu.
 */
export const SettingsPage: React.FC = () => {
  const toast = useToast();

  const [groups, setGroups] = useState<Record<string, SettingField[]>>({});
  const [nilai, setNilai] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [proses, setProses] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);

    try {
      const hasil = await settingsService.all();
      setGroups(hasil.groups);

      const awal: Record<string, string | number | boolean> = {};

      Object.values(hasil.groups)
        .flat()
        .forEach((f) => {
          awal[f.key] = f.type === 'boolean' ? Boolean(f.value) : (f.value ?? '');
        });

      setNilai(awal);
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat pengaturan.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const simpan = async () => {
    setProses(true);

    try {
      const { message } = await settingsService.update(nilai);
      toast.success(message);
      await muat();
    } catch (error) {
      const validasi = errorValidasi(error);
      toast.error(validasi ? Object.values(validasi)[0][0] : pesanError(error));
    } finally {
      setProses(false);
    }
  };

  if (loading) return <LoadingScreen label="Memuat pengaturan…" />;

  const pajakAktif = Boolean(nilai.tax_enabled);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Identitas toko, pajak, dan tampilan struk."
        action={
          <Button icon={Save} onClick={() => void simpan()} loading={proses}>
            Simpan Perubahan
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(groups).map(([grup, fields]) => {
          const Ikon = IKON_GRUP[grup] ?? Store;

          return (
            <div key={grup} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Ikon className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {JUDUL_GRUP[grup] ?? grup}
                  </h3>
                  <p className="mt-0.5 text-sm text-stone-500">{KETERANGAN_GRUP[grup]}</p>
                </div>
              </div>

              <div className="space-y-4">
                {fields.map((f) => {
                  if (f.type === 'boolean') {
                    return (
                      <label
                        key={f.key}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 transition hover:bg-stone-50"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(nilai[f.key])}
                          onChange={(e) =>
                            setNilai((v) => ({ ...v, [f.key]: e.target.checked }))
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-yellow-600 focus:ring-yellow-500"
                        />

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800">{f.label}</p>
                          {f.description && (
                            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                              {f.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  }

                  const angkaField = f.type === 'decimal' || f.type === 'integer';

                  // Tarif pajak tidak berguna saat pajak dimatikan — dinonaktifkan
                  // agar tidak terlihat seolah sedang berlaku.
                  const nonaktif = f.key === 'tax_percent' && !pajakAktif;

                  return (
                    <Input
                      key={f.key}
                      label={f.label}
                      type={angkaField ? 'number' : 'text'}
                      step={f.type === 'decimal' ? 'any' : undefined}
                      min={angkaField ? 0 : undefined}
                      disabled={nonaktif}
                      value={String(nilai[f.key] ?? '')}
                      onChange={(e) =>
                        setNilai((v) => ({
                          ...v,
                          [f.key]: angkaField ? Number(e.target.value) : e.target.value,
                        }))
                      }
                      hint={nonaktif ? 'Aktifkan pajak terlebih dahulu.' : (f.description ?? undefined)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-500 shadow-sm">
        Perubahan tarif pajak dan batas diskon berlaku untuk transaksi{' '}
        <strong className="text-stone-700">berikutnya</strong>. Transaksi yang sudah tersimpan
        membekukan tarifnya masing-masing, sehingga struk lama tetap menampilkan angka yang
        benar-benar dibayar pelanggan saat itu.
      </p>
    </div>
  );
};
