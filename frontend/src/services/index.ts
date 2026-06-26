import api from './api';
import { Post, Message, Channel, Contact, Label, AnalyticsOverview, PaginatedResponse, ApiResponse } from '../types';

export const messageService = {
  list: (conversationId: string, page = 1, limit = 50) =>
    api.get<PaginatedResponse<Message>>(`/conversations/${conversationId}/messages`, { params: { page, limit } }).then(r => r.data),

  send: (conversationId: string, payload: { type: string; content?: string; mediaUrl?: string; fileName?: string }) =>
    api.post<ApiResponse<Message>>(`/conversations/${conversationId}/messages`, payload).then(r => r.data.data),
};

export const channelService = {
  list: () => api.get<ApiResponse<Channel[]>>('/channels').then(r => r.data.data),
  get: (id: string) => api.get<ApiResponse<Channel>>(`/channels/${id}`).then(r => r.data.data),
  create: (payload: Partial<Channel> & { accessToken?: string }) =>
    api.post<ApiResponse<Channel>>('/channels', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<Channel> & { accessToken?: string }) =>
    api.put<ApiResponse<Channel>>(`/channels/${id}`, payload).then(r => r.data.data),
  delete: (id: string) => api.delete(`/channels/${id}`),
};

export const contactService = {
  list: (params: { search?: string; page?: number; limit?: number; sourceChannel?: string } = {}) =>
    api.get<PaginatedResponse<Contact>>('/contacts', { params }).then(r => r.data),
  get: (id: string) => api.get<ApiResponse<Contact>>(`/contacts/${id}`).then(r => r.data.data),
  update: (id: string, payload: Partial<Contact>) =>
    api.put<ApiResponse<Contact>>(`/contacts/${id}`, payload).then(r => r.data.data),
};

export const labelService = {
  list: () => api.get<ApiResponse<Label[]>>('/labels').then(r => r.data.data),
  create: (payload: { name: string; color: string }) =>
    api.post<ApiResponse<Label>>('/labels', payload).then(r => r.data.data),
  delete: (id: string) => api.delete(`/labels/${id}`),
};

export const userService = {
  list: () => api.get('/users').then(r => r.data.data),
  create: (payload: unknown) => api.post('/users', payload).then(r => r.data.data),
  update: (id: string, payload: unknown) => api.put(`/users/${id}`, payload).then(r => r.data.data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export const postService = {
  list: (params: { platform?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<{ posts: Post[]; total: number; page: number; limit: number }>>('/posts', { params }).then(r => r.data.data),
  get: (id: string) => api.get<ApiResponse<Post>>(`/posts/${id}`).then(r => r.data.data),
  create: (payload: { platform?: string; caption?: string; mediaUrls?: string[]; scheduledAt?: string; status?: string; channelId?: string }) =>
    api.post<ApiResponse<Post>>('/posts', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<Post>) =>
    api.put<ApiResponse<Post>>(`/posts/${id}`, payload).then(r => r.data.data),
  delete: (id: string) => api.delete(`/posts/${id}`),
  publishNow: (id: string) => api.post<ApiResponse<{ id: string; permalink: string }>>(`/posts/${id}/publish`).then(r => r.data.data),
};

export const whatsappUnofficialService = {
  status: (channelId: string) => api.get<ApiResponse<{ status: string }>>(`/whatsapp-unofficial/${channelId}/status`).then(r => r.data.data),
  reconnect: (channelId: string) => api.post(`/whatsapp-unofficial/${channelId}/reconnect`),
  logout: (channelId: string) => api.post(`/whatsapp-unofficial/${channelId}/logout`),
};

export const analyticsService = {
  overview: () => api.get<ApiResponse<AnalyticsOverview>>('/analytics/overview').then(r => r.data.data),
  agents: () => api.get('/analytics/agents').then(r => r.data.data),
  channels: () => api.get('/analytics/channels').then(r => r.data.data),
};
