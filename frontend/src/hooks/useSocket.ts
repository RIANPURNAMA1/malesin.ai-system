import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '../store/socket.store';
import { useInboxStore } from '../store/inbox.store';
import { useAuthStore } from '../store/auth.store';
import { Message, Conversation, Notification } from '../types';
import { useNotificationStore, notificationLink } from '../store/notification.store';
import { conversationService } from '../services/conversation.service';
import toast from 'react-hot-toast';

export function useSocket() {
  const { accessToken } = useAuthStore();
  const { connect, disconnect, socket } = useSocketStore();
  const { addMessage, upsertConversation, setTyping } = useInboxStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    connect(accessToken);
    return () => disconnect();
  }, [accessToken]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }: { conversationId: string; message: Message }) => {
      addMessage(conversationId, message);
      // Pesan masuk ke chat yang sedang dibuka langsung dianggap terbaca.
      if (message.direction === 'INBOUND' && useInboxStore.getState().activeConversationId === conversationId) {
        conversationService.markRead(conversationId).catch(() => null);
      }
    };

    const handleConversationUpdated = (conv: Conversation) => {
      upsertConversation(conv);
    };

    const handleNotification = (n: Notification) => {
      // Chat yang sedang dibuka tidak perlu toast.
      const viewing = n.conversationId && window.location.pathname === `/inbox/${n.conversationId}`;
      if (!viewing) toast(`${n.title}: ${n.body}`, { icon: n.type === 'NEW_MESSAGE' ? '💬' : '🔔', duration: 4000 });
      // Notifikasi desktop saat tab tidak sedang dilihat.
      if (document.hidden && useNotificationStore.getState().desktop && 'Notification' in window && window.Notification.permission === 'granted') {
        const desk = new window.Notification(n.title, { body: n.body, tag: n.conversationId ?? n.type, icon: '/logoM.png' });
        desk.onclick = () => { window.focus(); const link = notificationLink(n); if (link) window.location.assign(link); desk.close(); };
      }
    };

    const handleTyping = ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      setTyping(conversationId, isTyping);
    };

    // Setelah socket tersambung ulang, ambil lagi data yang mungkin terlewat.
    const handleReconnect = () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('connect', handleReconnect);
    socket.on('message:new', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('notification', handleNotification);
    socket.on('message:typing', handleTyping);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('notification', handleNotification);
      socket.off('message:typing', handleTyping);
    };
  }, [socket]);

  return { socket };
}
