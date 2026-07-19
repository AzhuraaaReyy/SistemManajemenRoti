import api from '../lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  UserFilters,
  UserStatistics,
} from '../types/auth';

export interface UserFormData {
  name: string;
  email: string;
  role: string;
  phone?: string;
  password?: string;
  password_confirmation?: string;
  is_active?: boolean;
}

export const userService = {
  async list(filters: UserFilters = {}): Promise<PaginatedResponse<User>> {
    // Nilai kosong dibuang agar tidak dikirim sebagai ?role= yang gagal validasi.
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    );

    const { data } = await api.get<PaginatedResponse<User>>('/users', { params });
    return data;
  },

  async statistics(): Promise<UserStatistics> {
    const { data } = await api.get<ApiResponse<UserStatistics>>('/users/statistics');
    return data.data!;
  },

  async create(payload: UserFormData): Promise<{ user: User; message: string }> {
    const { data } = await api.post<ApiResponse<{ user: User }>>('/users', payload);
    return { user: data.data!.user, message: data.message };
  },

  async update(id: number, payload: UserFormData): Promise<{ user: User; message: string }> {
    const { data } = await api.put<ApiResponse<{ user: User }>>(`/users/${id}`, payload);
    return { user: data.data!.user, message: data.message };
  },

  async toggleActive(id: number): Promise<{ user: User; message: string }> {
    const { data } = await api.patch<ApiResponse<{ user: User }>>(`/users/${id}/toggle-active`);
    return { user: data.data!.user, message: data.message };
  },

  async remove(id: number): Promise<string> {
    const { data } = await api.delete<ApiResponse>(`/users/${id}`);
    return data.message;
  },
};

export const profileService = {
  async show(): Promise<User> {
    const { data } = await api.get<ApiResponse<{ user: User }>>('/profile');
    return data.data!.user;
  },

  async update(payload: {
    name: string;
    email: string;
    phone?: string;
    avatar?: File | null;
  }): Promise<{ user: User; message: string }> {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('email', payload.email);
    if (payload.phone) form.append('phone', payload.phone);
    if (payload.avatar) form.append('avatar', payload.avatar);

    const { data } = await api.post<ApiResponse<{ user: User }>>('/profile', form);
    return { user: data.data!.user, message: data.message };
  },

  async changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ access_token: string; message: string }> {
    const { data } = await api.put<ApiResponse<{ access_token: string }>>('/profile/password', payload);
    return { access_token: data.data!.access_token, message: data.message };
  },

  async deleteAvatar(): Promise<{ user: User; message: string }> {
    const { data } = await api.delete<ApiResponse<{ user: User }>>('/profile/avatar');
    return { user: data.data!.user, message: data.message };
  },
};
