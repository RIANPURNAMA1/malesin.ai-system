import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Notification } from '../types';
import { useNotificationStore } from './notification.store';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  connect: (token) => {
    const existing = get().socket;
    // Pakai ulang socket yang ada: cukup perbarui token & sambungkan lagi.
    // (Sebelumnya socket lama ditinggal begitu saja saat token refresh,
    // sehingga listener realtime berhenti bekerja.)
    if (existing) {
      existing.auth = { token };
      if (!existing.connected) existing.connect();
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL;
    const isRelative = !apiUrl || apiUrl.startsWith('/');
    // API relatif = backend satu origin dengan frontend (proxy Vite / reverse proxy
    // production meneruskan /socket.io). Jangan hardcode localhost: di production
    // itu menunjuk ke komputer user sendiri sehingga realtime tidak pernah jalan.
    const socketUrl = isRelative ? window.location.origin : apiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    // Disimpan di notification store (persist per user) untuk panel lonceng.
    socket.on('notification', (n: Notification) => useNotificationStore.getState().push(n));

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },

}));
