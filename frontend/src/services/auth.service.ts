import api from './api';
import { ApiResponse, User } from '../types';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { companyName: string; companyEmail: string; name: string; email: string; password: string; }
export interface AuthData { accessToken: string; refreshToken: string; user: User; }

export const authService = {
  register: (payload: RegisterPayload) =>
    api.post<ApiResponse<AuthData>>('/auth/register', payload).then(r => r.data.data),

  login: (payload: LoginPayload) =>
    api.post<ApiResponse<AuthData>>('/auth/login', payload).then(r => r.data.data),

  logout: () => api.post('/auth/logout'),

  profile: () => api.get<ApiResponse<User>>('/auth/profile').then(r => r.data.data),

  updateProfile: (payload: { name?: string; email?: string }) =>
    api.put<ApiResponse<User>>('/auth/profile', payload).then(r => r.data.data),

  /** Mengembalikan token baru; sesi di perangkat lain berakhir. */
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.put<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/password', payload).then(r => r.data.data),
};
