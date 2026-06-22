import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationService, ConversationFilters } from '../services/conversation.service';
import { messageService } from '../services/index';
import { useInboxStore } from '../store/inbox.store';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function useConversations(filters: ConversationFilters = {}) {
  const { setConversations } = useInboxStore();
  const query = useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => conversationService.list(filters),
    refetchInterval: false,
  });

  useEffect(() => {
    if (query.data?.data) setConversations(query.data.data);
  }, [query.data]);

  return query;
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationService.get(id!),
    enabled: !!id,
  });
}

export function useMessages(conversationId: string | null) {
  const { setMessages } = useInboxStore();
  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageService.list(conversationId!, 1, 50),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (query.data?.data && conversationId) setMessages(conversationId, query.data.data);
  }, [query.data, conversationId]);

  return query;
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { type: string; content?: string; mediaUrl?: string; fileName?: string }) =>
      messageService.send(conversationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: () => toast.error('Failed to send message'),
  });
}

export function useUpdateStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => conversationService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      toast.success('Status updated');
    },
  });
}

export function useAssignAgent(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => conversationService.assign(conversationId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      toast.success('Agent assigned');
    },
  });
}
