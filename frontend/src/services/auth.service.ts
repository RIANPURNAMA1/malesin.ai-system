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
};
