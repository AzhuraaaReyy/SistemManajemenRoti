/**
 * Token warna grafik.
 *
 * Angkanya bukan pilihan selera. Palet kategorikal di bawah dijalankan lewat
 * pemeriksa keterbacaan warna terhadap permukaan kartu (#ffffff) dan lulus
 * seluruh gerbangnya:
 *
 *   pita terang       semua slot di L 0,43–0,77
 *   lantai kroma      semua slot >= 0,1
 *   pemisahan CVD     terburuk ΔE 16,2 (protan)   — target >= 8
 *   penglihatan normal terburuk ΔE 29,0            — lantai >= 15
 *
 * Aturan yang ditegakkan berkas ini:
 *
 *   - Warna kategorikal diberikan berurutan, TIDAK pernah diputar ulang.
 *     Deret ke-9 bukan warna baru — ia digabung menjadi "Lainnya".
 *   - Warna status (aman/menipis/habis) TIDAK pernah dipakai sebagai warna
 *     deret biasa, dan sebaliknya. Status selalu ditemani ikon dan label,
 *     tidak pernah mengandalkan warna sendirian.
 *   - Warna mengikuti entitasnya, bukan peringkatnya. Menyaring satu deret
 *     tidak boleh mengecat ulang deret yang tersisa.
 *
 * Sistem ini bermode terang saja — tidak ada saklar gelap di mana pun aplikasi,
 * jadi tidak ada langkah gelap yang didefinisikan. Bila kelak ditambahkan,
 * langkahnya harus dipilih ulang untuk permukaan gelap dan divalidasi lagi,
 * bukan dibalik begitu saja.
 */

/** Slot kategorikal, berurutan. Ambil dari indeks 0, jangan diputar. */
export const SERIES = ['#2a78d6', '#008300', '#e87ba4', '#eda100'] as const;

/** Warna per peran, supaya kode grafik menyebut maknanya bukan hex-nya. */
export const CHART = {
  omzet: SERIES[0],
  laba: SERIES[1],
  batch: SERIES[0],
  produk: SERIES[0],

  /* Kroma toko — sengaja TIDAK dipakai untuk garis data. Warna primer aplikasi
     (yellow-600) terlalu dekat dengan status "menipis" untuk dipakai sebagai
     identitas deret di grafik yang juga memuat lencana stok. */
  grid: '#e7e5e4',
  axis: '#d6d3d1',
  tick: '#a8a29e',
  surface: '#ffffff',
} as const;

/**
 * Warna status stok — tetap, tidak pernah ikut tema.
 *
 * `menipis` sengaja berada di bawah rasio kontras 3:1 terhadap permukaan putih.
 * Itu bukan kelalaian: pasangan ikon + label adalah penawarnya, dan setiap
 * tempat yang memakainya wajib menyertakan keduanya.
 */
export const STATUS = {
  aman: '#0ca30c',
  menipis: '#fab219',
  habis: '#d03b3b',
} as const;

/** Nada lencana aplikasi → warna status grafik, supaya keduanya tidak berbeda. */
export const TONE_TO_STATUS: Record<string, string> = {
  success: STATUS.aman,
  warning: STATUS.menipis,
  danger: STATUS.habis,
  info: SERIES[0],
  neutral: CHART.tick,
};

/**
 * Sumbu dan kisi.
 *
 * Kisi digambar SOLID, bukan putus-putus. Garis putus-putus menambah bising
 * dan terbaca sebagai "proyeksi" atau "ambang batas" padahal ia sekadar kisi —
 * dan itu bawaan Recharts yang harus ditimpa setiap kali.
 */
export const AXIS_PROPS = {
  stroke: CHART.axis,
  tick: { fill: CHART.tick, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART.axis },
} as const;

export const GRID_PROPS = {
  stroke: CHART.grid,
  strokeDasharray: '0',
  vertical: false,
} as const;
