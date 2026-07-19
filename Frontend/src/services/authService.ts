import api from '../lib/api';
import type { ApiResponse, LoginCredentials, LoginPayload, RoleOption, User } from '../types/auth';

/**
 * Pembungkus tipis di atas endpoint autentikasi.
 *
 * Komponen tidak pernah memanggil axios langsung — semua lewat sini, sehingga
 * perubahan bentuk endpoint cukup diperbaiki di satu berkas.
 */
export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginPayload> {
    const { data } = await api.post<ApiResponse<LoginPayload>>('/auth/login', credentials);
    return data.data!;
  },

  async me(): Promise<User> {
    const { data } = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    return data.data!.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async forgotPassword(email: string): Promise<{ message: string; devResetUrl?: string }> {
    const { data } = await api.post<ApiResponse<{ dev_reset_url?: string }>>('/auth/forgot-password', {
      email,
    });
    return { message: data.message, devResetUrl: data.data?.dev_reset_url };
  },

  async resetPassword(payload: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<string> {
    const { data } = await api.post<ApiResponse>('/auth/reset-password', payload);
    return data.message;
  },

  async roles(): Promise<RoleOption[]> {
    const { data } = await api.get<ApiResponse<RoleOption[]>>('/auth/roles');
    return data.data!;
  },
};
