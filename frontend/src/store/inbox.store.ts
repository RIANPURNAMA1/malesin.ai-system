import { create } from 'zustand';
import { Conversation, Message, ConversationStatus } from '../types';

interface InboxState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
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
  setFilters: (filters: Partial<InboxState['filters']>) => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  filters: { status: 'OPEN', channelId: '', search: '', labelId: '' },

  setConversations: (convs) => set({ conversations: convs }),

  upsertConversation: (conv) => set((s) => {
    const idx = s.conversations.findIndex((c) => c.id === conv.id);
    if (idx === -1) return { conversations: [conv, ...s.conversations] };
    const updated = [...s.conversations];
    updated[idx] = conv;
    return { conversations: updated.sort((a, b) =>
      new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
    )};
  }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

  addMessage: (conversationId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] || []), msg],
      },
    })),

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
