/** Pemformatan angka, mata uang, dan satuan — dipakai seluruh halaman master data. */

export const rupiah = (nilai: number | null | undefined, denganDesimal = false): string => {
  if (nilai == null) return '—';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: denganDesimal ? 2 : 0,
    maximumFractionDigits: denganDesimal ? 2 : 0,
  }).format(nilai);
};

export const angka = (nilai: number | null | undefined, maksDesimal = 2): string => {
  if (nilai == null) return '—';

  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maksDesimal }).format(nilai);
};

export const persen = (nilai: number | null | undefined): string =>
  nilai == null ? '—' : `${angka(nilai, 1)}%`;

/**
 * Menampilkan kuantitas dalam satuan yang paling enak dibaca.
 *
 * 2000 g -> "2 kg", 500 g -> "500 g". Angka besar dalam satuan dasar sulit
 * dibaca sekilas, dan itulah sumber salah baca saat memeriksa stok.
 */
export const kuantitas = (
  jumlahDasar: number,
  satuanDasar: string,
  satuanTampilan: string,
  faktor: number,
): string => {
  if (faktor <= 1 || jumlahDasar < faktor) {
    return `${angka(jumlahDasar, 2)} ${satuanDasar}`;
  }

  return `${angka(jumlahDasar / faktor, 2)} ${satuanTampilan}`;
};

/**
 * Durasi ringkas untuk timeline tahapan: "8 mnt", "1j 30m", "2 jam".
 *
 * Menit mentah sulit dibaca begitu melewati satu jam — fermentasi 95 menit
 * lebih cepat ditangkap sebagai "1j 35m".
 */
export const durasi = (menit: number | null | undefined): string => {
  if (menit == null) return '—';
  if (menit < 1) return '<1 mnt';
  if (menit < 60) return `${Math.round(menit)} mnt`;

  const jam = Math.floor(menit / 60);
  const sisa = Math.round(menit % 60);

  return sisa === 0 ? `${jam} jam` : `${jam}j ${sisa}m`;
};

export const tanggal = (iso: string | null | undefined): string => {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const tanggalWaktu = (iso: string | null | undefined): string => {
  if (!iso) return '—';

  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Warna lencana untuk status stok, konsisten di seluruh halaman. */
export const toneStatusStok = (
  status: string,
): 'success' | 'danger' | 'warning' | 'info' | 'neutral' =>
  ({
    habis: 'danger' as const,
    kritis: 'danger' as const,
    menipis: 'warning' as const,
    aman: 'success' as const,
    berlebih: 'info' as const,
  })[status] ?? 'neutral';
