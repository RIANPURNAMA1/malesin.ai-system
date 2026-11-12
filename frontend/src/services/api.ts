import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
});

// Endpoint auth tidak boleh memicu refresh-token / redirect otomatis.
// Contoh: login dengan password salah mengembalikan 401, itu bukan berarti
// sesi lama harus di-refresh.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url: string = original?.url || '';
    const isAuthRequest = AUTH_PATHS.some((path) => url.includes(path));

    if (status === 401 && original && !original._retry && !isAuthRequest) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const accessToken = data.data.accessToken as string;
        const newRefreshToken = data.data.refreshToken as string;

        // Sinkronkan ke store, kalau tidak socket.io tetap memakai token lama
        // yang sudah expired sehingga event realtime tidak pernah diterima.
        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().clearSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
