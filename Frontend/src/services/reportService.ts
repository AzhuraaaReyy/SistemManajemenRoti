import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type {
  ReportFilters,
  ReportResult,
  ReportTypeKey,
  ReportTypesResponse,
} from '../types/reports';

const bersihkan = (filters: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

/**
 * Mengunduh berkas dari endpoint yang dijaga token.
 *
 * Tautan <a href> biasa tidak bisa dipakai karena tidak membawa header
 * Authorization. Berkasnya diambil sebagai blob lewat axios, lalu diserahkan
 * ke browser sebagai unduhan.
 *
 * Nama berkas diambil dari header Content-Disposition yang dikirim server —
 * dengan begitu penamaannya hanya ditentukan di satu tempat, dan berkas yang
 * diunduh selalu bernama sama dengan yang tercatat di log ekspor.
 */
const unduh = async (
  url: string,
  params: Record<string, unknown>,
  namaCadangan: string,
): Promise<void> => {
  const respons = await api.get<Blob>(url, {
    params: bersihkan(params),
    responseType: 'blob',
  });

  const disposisi = String(respons.headers['content-disposition'] ?? '');
  const cocok = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposisi);
  const nama = cocok ? decodeURIComponent(cocok[1]) : namaCadangan;

  const tautan = document.createElement('a');
  const objekUrl = URL.createObjectURL(respons.data);

  tautan.href = objekUrl;
  tautan.download = nama;
  document.body.appendChild(tautan);
  tautan.click();

  // Dilepas supaya objek blob tidak menggantung di memori sampai halaman
  // ditutup — mengekspor berulang kali akan menumpuk kalau tidak dibersihkan.
  document.body.removeChild(tautan);
  URL.revokeObjectURL(objekUrl);
};

const cap = () => new Date().toISOString().slice(0, 10);

export const reportService = {
  /** Definisi ketujuh laporan beserta isi setiap filternya. Dipanggil sekali. */
  async types(): Promise<ReportTypesResponse> {
    const { data } = await api.get<ApiResponse<ReportTypesResponse>>('/reports/types');
    return data.data!;
  },

  /**
   * Pratinjau satu halaman laporan.
   *
   * Ringkasan dan baris TOTAL yang ikut terkirim selalu dihitung dari seluruh
   * baris laporan, bukan dari sepuluh baris di halaman ini.
   */
  async preview(
    type: ReportTypeKey,
    filters: ReportFilters = {},
    page = 1,
  ): Promise<ReportResult> {
    const { data } = await api.get<ApiResponse<ReportResult>>(`/reports/${type}`, {
      params: { ...bersihkan(filters as Record<string, unknown>), page },
    });
    return data.data!;
  },

  exportExcel(type: ReportTypeKey, filters: ReportFilters = {}): Promise<void> {
    return unduh(
      `/reports/${type}/export/excel`,
      filters as Record<string, unknown>,
      `laporan-${type}-${cap()}.xlsx`,
    );
  },

  exportPdf(type: ReportTypeKey, filters: ReportFilters = {}): Promise<void> {
    return unduh(
      `/reports/${type}/export/pdf`,
      filters as Record<string, unknown>,
      `laporan-${type}-${cap()}.pdf`,
    );
  },
};
