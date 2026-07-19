import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '../components/ui/Button';

const KETERANGAN: Record<string, { modul: string; judul: string; teks: string }> = {
  '/persediaan': {
    modul: 'Modul 2',
    judul: 'Persediaan & Ledger Stok',
    teks: 'Pemantauan stok masuk, keluar, menipis, dan habis secara real-time, dengan riwayat pergerakan yang bisa ditelusuri.',
  },
  '/pembelian': {
    modul: 'Modul 3',
    judul: 'Supplier & Pembelian',
    teks: 'Pencatatan purchase order, penerimaan barang, dan riwayat harga bahan per supplier.',
  },
  '/resep': {
    modul: 'Modul 4',
    judul: 'Resep (Bill of Materials)',
    teks: 'Komposisi bahan baku per produk beserta perhitungan biaya dan simulasi kapasitas produksi.',
  },
  '/produksi': {
    modul: 'Modul 5',
    judul: 'Produksi',
    teks: 'Eksekusi batch produksi yang otomatis memotong stok bahan sesuai resep dan menambah stok produk jadi.',
  },
  '/penjualan': {
    modul: 'Modul 6',
    judul: 'Penjualan (POS)',
    teks: 'Pencatatan penjualan harian yang langsung memotong stok produk jadi.',
  },
  '/laporan': {
    modul: 'Modul 10',
    judul: 'Laporan Laba Kotor',
    teks: 'Perhitungan HPP rata-rata tertimbang dan margin keuntungan per produk.',
  },
};

export const ComingSoonPage: React.FC = () => {
  const { pathname } = useLocation();
  const info = KETERANGAN[pathname];

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
        <Construction className="h-8 w-8 text-amber-600" aria-hidden="true" />
      </div>

      {info && (
        <span className="mb-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stone-500">
          {info.modul}
        </span>
      )}

      <h2 className="text-xl font-bold text-stone-900">{info?.judul ?? 'Segera Hadir'}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500">
        {info?.teks ?? 'Halaman ini sedang dalam pengembangan.'}
      </p>
      <p className="mt-4 max-w-md text-xs text-stone-400">
        Modul ini belum dikerjakan. Pengembangan dilakukan bertahap satu modul per iterasi agar tiap
        bagian dapat diuji dengan tuntas sebelum lanjut.
      </p>

      <Link to="/dashboard" className="mt-8">
        <Button variant="secondary" icon={ArrowLeft}>
          Kembali ke Dashboard
        </Button>
      </Link>
    </div>
  );
};
