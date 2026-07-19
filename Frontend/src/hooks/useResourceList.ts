import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginationMeta } from '../types/auth';
import type { BaseFilters, PaginatedResult } from '../types/master';
import { pesanError } from '../lib/api';
import { useToast } from '../context/ToastContext';

interface Options<T> {
  /** Pemanggil API daftar; harus stabil (bungkus dengan useCallback bila perlu). */
  fetcher: (filters: BaseFilters) => Promise<PaginatedResult<T>>;
  initialFilters?: BaseFilters;
  /** Jeda sebelum permintaan dikirim setelah pengetikan berhenti (ms). */
  debounceMs?: number;
  errorMessage?: string;
}

interface Result<T> {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  filters: BaseFilters;
  setFilter: (patch: BaseFilters) => void;
  resetFilters: () => void;
  goToPage: (page: number) => void;
  reload: () => Promise<void>;
  hasActiveFilters: boolean;
}

const FILTER_DASAR: BaseFilters = {
  search: '',
  status: '',
  sort_by: 'name',
  sort_dir: 'asc',
  per_page: 10,
  page: 1,
};

/**
 * Mengelola daftar berhalaman: filter, pencarian dengan jeda, paginasi,
 * dan pemuatan ulang.
 *
 * Kelima halaman master data memakai pola yang sama, jadi logikanya dikumpulkan
 * di satu tempat — halamannya sendiri tinggal mengurus kolom tabel dan formnya.
 */
export function useResourceList<T>({
  fetcher,
  initialFilters = {},
  debounceMs = 400,
  errorMessage = 'Gagal memuat data.',
}: Options<T>): Result<T> {
  const toast = useToast();

  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BaseFilters>({ ...FILTER_DASAR, ...initialFilters });

  // Menyimpan nomor permintaan agar respons yang datang terlambat tidak
  // menimpa hasil permintaan yang lebih baru.
  const permintaanKe = useRef(0);
  const pertamaKali = useRef(true);

  const ambilData = useCallback(async () => {
    const nomor = ++permintaanKe.current;
    setLoading(true);

    try {
      const hasil = await fetcher(filters);

      if (nomor === permintaanKe.current) {
        setItems(hasil.data);
        setMeta(hasil.meta);
      }
    } catch (error) {
      if (nomor === permintaanKe.current) {
        toast.error(pesanError(error, errorMessage));
        setItems([]);
        setMeta(null);
      }
    } finally {
      if (nomor === permintaanKe.current) setLoading(false);
    }
  }, [fetcher, filters, toast, errorMessage]);

  useEffect(() => {
    // Pemuatan pertama tidak perlu ditunda — halaman baru dibuka.
    if (pertamaKali.current) {
      pertamaKali.current = false;
      void ambilData();
      return;
    }

    const timer = window.setTimeout(() => void ambilData(), debounceMs);
    return () => window.clearTimeout(timer);
  }, [ambilData, debounceMs]);

  const setFilter = useCallback((patch: BaseFilters) => {
    // Mengubah filter selalu kembali ke halaman pertama, kecuali yang diubah
    // memang nomor halamannya — kalau tidak, pengguna bisa terdampar di
    // halaman 5 dari hasil pencarian yang cuma punya 1 halaman.
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...FILTER_DASAR, ...initialFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters((f) => ({ ...f, page }));
  }, []);

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) =>
      !['sort_by', 'sort_dir', 'per_page', 'page'].includes(key) && value !== '' && value != null,
  );

  return {
    items,
    meta,
    loading,
    filters,
    setFilter,
    resetFilters,
    goToPage,
    reload: ambilData,
    hasActiveFilters,
  };
}
