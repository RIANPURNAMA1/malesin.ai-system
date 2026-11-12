import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authService, LoginPayload, RegisterPayload } from '../services/auth.service';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  /** True setelah sesi selesai divalidasi (atau dipastikan tidak ada) saat aplikasi dibuka. */
  isInitialized: boolean;
  isInitializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
  initialize: () => Promise<void>;
}

function persistTokens(accessToken: string | null, refreshToken: string | null) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  else localStorage.removeItem('accessToken');

  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  else localStorage.removeItem('refreshToken');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isInitialized: false,
      isInitializing: false,

      login: async (payload) => {
        set({ isLoading: true });
        try {
          const data = await authService.login(payload);
          persistTokens(data.accessToken, data.refreshToken);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isInitialized: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        try {
          const data = await authService.register(payload);
          persistTokens(data.accessToken, data.refreshToken);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isInitialized: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await authService.logout(); } catch { /* ignore */ }
        get().clearSession();
      },

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => {
        persistTokens(accessToken, refreshToken);
        set({ accessToken, refreshToken });
      },

      clearSession: () => {
        persistTokens(null, null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        });
      },

      initialize: async () => {
        if (get().isInitialized || get().isInitializing) return;
        set({ isInitializing: true });

        const state = get();
        const accessToken = state.accessToken || localStorage.getItem('accessToken');
        const refreshToken = state.refreshToken || localStorage.getItem('refreshToken');

        if (!accessToken) {
          get().clearSession();
          set({ isInitializing: false, isInitialized: true });
          return;
        }

        // Pastikan token di localStorage sinkron dengan state yang di-persist.
        persistTokens(accessToken, refreshToken);

        try {
          // Validasi sesi ke backend. Jangan pernah percaya data user yang
          // tersimpan di localStorage saja.
          const user = await authService.profile();

          // Token bisa saja sudah dirotasi oleh interceptor (refresh token)
          // selama request profile di atas, jadi ambil token terbaru dari store.
          const latest = get();
          persistTokens(latest.accessToken, latest.refreshToken);
          set({
            user,
            accessToken: latest.accessToken,
            refreshToken: latest.refreshToken,
            isInitializing: false,
            isInitialized: true,
          });
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            // Token/refresh token tidak valid lagi -> paksa login ulang.
            get().clearSession();
          }
          // Error lain (mis. backend sedang mati) tidak menghapus sesi,
          // supaya user tidak ter-logout hanya karena gangguan jaringan.
          set({ isInitializing: false, isInitialized: true });
        }
      },
    }),
    {
      name: 'auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) persistTokens(state.accessToken, state.refreshToken);
      },
    }
  )
);
