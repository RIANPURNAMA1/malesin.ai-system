import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Notification } from '../types';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  notifications: Notification[];
  connect: (token: string) => void;
  disconnect: () => void;
  addNotification: (n: Notification) => void;
  clearNotifications: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  notifications: [],

  connect: (token) => {
    const existing = get().socket;
    if (existing?.connected) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '') || '/';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('notification', (n: Notification) => {
      set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) }));
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },

  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
  clearNotifications: () => set({ notifications: [] }),
}));
