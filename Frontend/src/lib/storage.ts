/**
 * Penyimpanan token.
 *
 * "Ingat Saya" dicentang  -> localStorage, sesi bertahan setelah browser ditutup.
 * "Ingat Saya" tidak      -> sessionStorage, sesi hilang saat tab ditutup.
 *
 * Semua akses token melewati berkas ini supaya aturan di atas hanya ada di
 * satu tempat dan tidak tersebar di banyak komponen.
 */

const TOKEN_KEY = 'roti.access_token';
const REMEMBER_KEY = 'roti.remember';

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  },

  set(token: string, remember: boolean): void {
    this.clear();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  },

  /** Mengganti token tanpa mengubah pilihan "Ingat Saya" (dipakai saat refresh). */
  replace(token: string): void {
    this.set(token, this.isRemembered());
  },

  isRemembered(): boolean {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

/** Email terakhir yang dipakai masuk — untuk mengisi otomatis form login. */
export const lastEmailStorage = {
  key: 'roti.last_email',
  get(): string {
    return localStorage.getItem(this.key) ?? '';
  },
  set(email: string): void {
    localStorage.setItem(this.key, email);
  },
  clear(): void {
    localStorage.removeItem(this.key);
  },
};
