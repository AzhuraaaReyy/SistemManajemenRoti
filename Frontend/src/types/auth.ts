export type UserRole = 'owner' | 'admin_produksi' | 'kasir';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  role_label: string;
  allowed_menus: string[];
  phone: string | null;
  avatar_url: string | null;
  initials: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
}

/** Bentuk respons seragam dari seluruh endpoint API. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  data: T[];
  meta: PaginationMeta;
}

export interface LoginPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: UserRole | '';
  status?: 'aktif' | 'nonaktif' | '';
  sort_by?: 'name' | 'email' | 'role' | 'created_at' | 'last_login_at';
  sort_dir?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface UserStatistics {
  total: number;
  aktif: number;
  nonaktif: number;
  per_peran: { role: UserRole; label: string; jumlah: number }[];
}
