import api from './api';
import { Conversation, PaginatedResponse, ApiResponse } from '../types';

export interface ConversationFilters {
  status?: string; channelId?: string; search?: string;
  page?: number; limit?: number; labelId?: string; agentId?: string;
}

export const conversationService = {
  list: (filters: ConversationFilters = {}) =>
    api.get<PaginatedResponse<Conversation>>('/conversations', { params: filters }).then(r => r.data),

  get: (id: string) =>
    api.get<ApiResponse<Conversation>>(`/conversations/${id}`).then(r => r.data.data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/conversations/${id}/status`, { status }).then(r => r.data),

  assign: (id: string, userId: string) =>
    api.post(`/conversations/${id}/assign`, { userId }).then(r => r.data),

  addLabel: (id: string, labelId: string) =>
    api.post(`/conversations/${id}/labels`, { labelId }).then(r => r.data),

  removeLabel: (id: string, labelId: string) =>
    api.delete(`/conversations/${id}/labels/${labelId}`).then(r => r.data),

  markRead: (id: string) =>
    api.post(`/conversations/${id}/read`).then(r => r.data),
};
