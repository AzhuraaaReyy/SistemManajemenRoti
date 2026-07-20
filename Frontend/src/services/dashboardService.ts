import api from '../lib/api';
import type { ApiResponse } from '../types/auth';
import type { OwnerDashboard } from '../types/dashboard';

export const dashboardService = {
  /**
   * Seluruh isi dashboard dalam satu permintaan.
   *
   * Sengaja satu panggilan, bukan sepuluh. Dashboard yang menembakkan sepuluh
   * permintaan sekaligus menampilkan kartunya satu per satu dengan urutan acak,
   * dan tombol muat ulang tidak pernah selesai bersamaan.
   */
  async owner(days = 30): Promise<OwnerDashboard> {
    const { data } = await api.get<ApiResponse<OwnerDashboard>>('/dashboard/owner', {
      params: { days },
    });
    return data.data!;
  },
};
