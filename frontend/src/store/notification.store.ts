import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Notification } from '../types';

export interface NotificationItem extends Notification {
  id: string;
  createdAt: string;
  read: boolean;
  /** Jumlah pesan yang digabung ke notifikasi ini (pesan beruntun dari chat yang sama). */
  count: number;
}

interface NotificationState {
  /** Pemilik data — ganti user = daftar dikosongkan supaya tidak bocor antar akun. */
  ownerId: string | null;
  items: NotificationItem[];
  desktop: boolean;
  bindUser: (userId: string | null) => void;
  push: (n: Notification) => void;
  markRead: (id: string) => void;
  markConversationRead: (conversationId: string) => void;
  markAllRead: () => void;
  clear: () => void;
  setDesktop: (on: boolean) => void;
}

const MAX = 100;
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useNotificationStore = create<NotificationState>()(
  persist(
    set => ({
      ownerId: null,
      items: [],
      desktop: false,

      // null (sesi belum dimuat) diabaikan supaya notifikasi tidak terhapus saat refresh.
      bindUser: userId => set(s => (!userId || s.ownerId === userId ? s : { ownerId: userId, items: [] })),

      push: n => set(s => {
        const now = new Date().toISOString();
        // Pesan baru dari chat yang sama & belum dibaca digabung, bukan menumpuk.
        if (n.type === 'NEW_MESSAGE' && n.conversationId) {
          const idx = s.items.findIndex(i => !i.read && i.type === 'NEW_MESSAGE' && i.conversationId === n.conversationId);
          if (idx >= 0) {
            const merged = { ...s.items[idx], ...n, count: s.items[idx].count + 1, createdAt: now };
            return { items: [merged, ...s.items.filter((_, i) => i !== idx)] };
          }
        }
        return { items: [{ ...n, id: newId(), createdAt: now, read: false, count: 1 }, ...s.items].slice(0, MAX) };
      }),

      markRead: id => set(s => ({ items: s.items.map(i => (i.id === id ? { ...i, read: true } : i)) })),
      markConversationRead: conversationId => set(s =>
        s.items.some(i => !i.read && i.conversationId === conversationId)
          ? { items: s.items.map(i => (i.conversationId === conversationId ? { ...i, read: true } : i)) }
          : s
      ),
      markAllRead: () => set(s => ({ items: s.items.map(i => ({ ...i, read: true })) })),
      clear: () => set({ items: [] }),
      setDesktop: on => set({ desktop: on }),
    }),
    { name: 'notifications' }
  )
);

/** Tujuan saat notifikasi diklik. */
export const notificationLink = (n: Notification) => n.link ?? (n.conversationId ? `/inbox/${n.conversationId}` : null);
