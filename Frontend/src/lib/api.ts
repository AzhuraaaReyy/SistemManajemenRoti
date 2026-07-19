import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types/auth';
import { tokenStorage } from './storage';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1',
  headers: { Accept: 'application/json' },
  timeout: 20000,
});

/* -------------------------------------------------------------------------- */
/* Request: sisipkan token                                                     */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* -------------------------------------------------------------------------- */
/* Response: perbarui token yang kedaluwarsa secara diam-diam                  */
/* -------------------------------------------------------------------------- */

/**
 * Dipanggil ketika sesi benar-benar tidak bisa diselamatkan. AuthContext
 * memasang penanganannya agar berkas ini tidak perlu tahu soal React.
 */
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

/** Rute yang memang boleh menjawab 401 tanpa dianggap sesi berakhir. */
const RUTE_PUBLIK = ['/auth/login', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh'];

let sedangRefresh = false;
let antrean: { resolve: (token: string) => void; reject: (error: unknown) => void }[] = [];

const prosesAntrean = (error: unknown, token: string | null) => {
  antrean.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(error)));
  antrean = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    const bolehRefresh =
      status === 401 && original && !original._retry && !RUTE_PUBLIK.some((r) => url.includes(r));

    if (bolehRefresh) {
      // Permintaan lain yang gagal bersamaan ikut mengantre, agar tidak ada
      // beberapa panggilan refresh sekaligus yang saling membatalkan token.
      if (sedangRefresh) {
        return new Promise((resolve, reject) => {
          antrean.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      sedangRefresh = true;

      try {
        const { data } = await axios.post<ApiResponse<{ access_token: string }>>(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { headers: { Accept: 'application/json', Authorization: `Bearer ${tokenStorage.get()}` } },
        );

        const tokenBaru = data.data!.access_token;
        tokenStorage.replace(tokenBaru);
        prosesAntrean(null, tokenBaru);

        original.headers.Authorization = `Bearer ${tokenBaru}`;
        return api(original);
      } catch (refreshError) {
        prosesAntrean(refreshError, null);
        tokenStorage.clear();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      } finally {
        sedangRefresh = false;
      }
    }

    return Promise.reject(error);
  },
);

/* -------------------------------------------------------------------------- */
/* Bantuan pembacaan error                                                     */
/* -------------------------------------------------------------------------- */

/** Mengambil pesan yang layak ditampilkan dari bentuk error apa pun. */
export const pesanError = (error: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string => {
  if (axios.isAxiosError<ApiResponse>(error)) {
    if (error.code === 'ECONNABORTED') return 'Permintaan terlalu lama. Periksa koneksi Anda.';
    if (!error.response) return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    return error.response.data?.message ?? fallback;
  }
  return fallback;
};

/** Error validasi per-field, untuk disalurkan ke setError React Hook Form. */
export const errorValidasi = (error: unknown): Record<string, string[]> | null => {
  if (axios.isAxiosError<ApiResponse>(error)) {
    return error.response?.data?.errors ?? null;
  }
  return null;
};

export default api;
