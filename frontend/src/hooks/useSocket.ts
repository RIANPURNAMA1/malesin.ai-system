import { useEffect } from 'react';
import { useSocketStore } from '../store/socket.store';
import { useInboxStore } from '../store/inbox.store';
import { useAuthStore } from '../store/auth.store';
import { Message, Conversation } from '../types';
import toast from 'react-hot-toast';

export function useSocket() {
  const { accessToken } = useAuthStore();
  const { connect, disconnect, socket } = useSocketStore();
  const { addMessage, upsertConversation, setTyping } = useInboxStore();

  useEffect(() => {
    if (!accessToken) return;
    connect(accessToken);
    return () => disconnect();
  }, [accessToken]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }: { conversationId: string; message: Message }) => {
      addMessage(conversationId, message);
    };

    const handleConversationUpdated = (conv: Conversation) => {
      upsertConversation(conv);
    };

    const handleNotification = (n: { title: string; body: string }) => {
      toast(n.body, { icon: '💬', duration: 4000 });
    };

    const handleTyping = ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      setTyping(conversationId, isTyping);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('notification', handleNotification);
    socket.on('message:typing', handleTyping);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('notification', handleNotification);
      socket.off('message:typing', handleTyping);
    };
  }, [socket]);

  return { socket };
}
