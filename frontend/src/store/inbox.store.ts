import { create } from 'zustand';
import { Conversation, Message, ConversationStatus } from '../types';

interface InboxState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  typing: Record<string, boolean>;
  filters: {
    status: ConversationStatus | '';
    channelId: string;
    search: string;
    labelId: string;
  };
  setConversations: (convs: Conversation[]) => void;
  upsertConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  prependMessages: (conversationId: string, msgs: Message[]) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  setFilters: (filters: Partial<InboxState['filters']>) => void;
}

/**
 * WhatsApp tidak selalu mengirim event "paused" (mis. teks dihapus, app
 * ditutup, atau koneksi HP putus), jadi status "typing…" kedaluwarsa sendiri
 * bila tidak diperbarui. Selama pelanggan masih mengetik, HP mengirim ulang
 * "composing" sehingga timer terus diperpanjang.
 */
const TYPING_TTL_MS = 10_000;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useInboxStore = create<InboxState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typing: {},
  filters: { status: 'OPEN', channelId: '', search: '', labelId: '' },

  setConversations: (convs) => set((s) => ({
    conversations: convs.map((c) => (c.id === s.activeConversationId ? { ...c, _count: { ...c._count, messages: 0 } } : c)),
  })),

  upsertConversation: (incoming) => set((s) => {
    // Chat yang sedang dibuka dianggap sudah dibaca: jangan tampilkan badge.
    const conv = incoming.id === s.activeConversationId
      ? { ...incoming, _count: { ...incoming._count, messages: 0 } }
      : incoming;
    const idx = s.conversations.findIndex((c) => c.id === conv.id);
    if (idx === -1) return { conversations: [conv, ...s.conversations] };
    const updated = [...s.conversations];
    updated[idx] = conv;
    return { conversations: updated.sort((a, b) =>
      new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
    )};
  }),

  setActiveConversation: (id) => set((s) => ({
    activeConversationId: id,
    conversations: id
      ? s.conversations.map((c) => (c.id === id ? { ...c, _count: { ...c._count, messages: 0 } } : c))
      : s.conversations,
  })),

  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

  addMessage: (conversationId, msg) =>
    set((s) => {
      const list = s.messages[conversationId] || [];
      // Event socket + refetch setelah kirim bisa membawa pesan yang sama.
      if (list.some((m) => m.id === msg.id)) return s;
      // Pesan pelanggan sudah masuk berarti ia selesai mengetik.
      const typing = msg.direction === 'INBOUND' && s.typing[conversationId]
        ? { ...s.typing, [conversationId]: false }
        : s.typing;
      return { messages: { ...s.messages, [conversationId]: [...list, msg] }, typing };
    }),

  /** Tambahkan pesan lama di atas daftar (saat memuat halaman sebelumnya). */
  prependMessages: (conversationId, msgs) =>
    set((s) => {
      const list = s.messages[conversationId] || [];
      const existing = new Set(list.map((m) => m.id));
      const fresh = msgs.filter((m) => !existing.has(m.id));
      if (!fresh.length) return s;
      return { messages: { ...s.messages, [conversationId]: [...fresh, ...list] } };
    }),

  setTyping: (conversationId, isTyping) => {
    clearTimeout(typingTimers.get(conversationId));
    typingTimers.delete(conversationId);
    if (isTyping) {
      typingTimers.set(conversationId, setTimeout(() => {
        typingTimers.delete(conversationId);
        set((s) => ({ typing: { ...s.typing, [conversationId]: false } }));
      }, TYPING_TTL_MS));
    }
    set((s) => ({ typing: { ...s.typing, [conversationId]: isTyping } }));
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
