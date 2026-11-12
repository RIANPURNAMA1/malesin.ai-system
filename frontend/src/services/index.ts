import api from './api';
import { Post, Message, Channel, Contact, Label, AnalyticsOverview, PaginatedResponse, ApiResponse, AiAgent, AiProvider, AiProviderInfo, AiKnowledge, AiKnowledgeMedia, AiMedia, AiMediaTrigger, AiTestResponseResult } from '../types';

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
  status: (channelId: string) =>
    api
      .get<ApiResponse<{ status: string; session?: { phone?: string | null; status?: string } | null }>>(
        `/whatsapp-unofficial/${channelId}/status`
      )
      .then(r => r.data.data),
  reconnect: (channelId: string) => api.post(`/whatsapp-unofficial/${channelId}/reconnect`),
  logout: (channelId: string) => api.post(`/whatsapp-unofficial/${channelId}/logout`),
};

export const analyticsService = {
  overview: () => api.get<ApiResponse<AnalyticsOverview>>('/analytics/overview').then(r => r.data.data),
  agents: () => api.get('/analytics/agents').then(r => r.data.data),
  channels: () => api.get('/analytics/channels').then(r => r.data.data),
};

export interface AiAgentPayload {
  name: string;
  description?: string;
  provider: AiProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  welcomeMessage?: string | null;
  communicationStyle?: string | null;
  conversationFlow?: string | null;
  communicationRules?: string | null;
  additionalInstructions?: { id: string; content: string; pipeline?: string | null }[];
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
}

export interface AiTestResponsePayload {
  agentId?: string;
  provider?: AiProvider;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  communicationStyle?: string;
  conversationFlow?: string;
  communicationRules?: string;
  additionalInstructions?: { id: string; content: string; pipeline?: string | null }[];
  temperature?: number;
  maxTokens?: number;
  message: string;
  useKnowledge?: boolean;
  useMedia?: boolean;
  knowledge?: { title: string; content: string }[];
}

export const aiAgentService = {
  list: () => api.get<ApiResponse<AiAgent[]>>('/ai-agents').then(r => r.data.data),
  get: (id: string) => api.get<ApiResponse<AiAgent>>(`/ai-agents/${id}`).then(r => r.data.data),
  providers: () => api.get<ApiResponse<AiProviderInfo[]>>('/ai-agents/providers').then(r => r.data.data),
  models: (provider: AiProvider, apiKey?: string, agentId?: string) =>
    api.post<ApiResponse<string[]>>('/ai-agents/models', { provider, apiKey, agentId }).then(r => r.data.data),
  testConnection: (provider: AiProvider, apiKey?: string, agentId?: string) =>
    api.post<ApiResponse<{ ok: boolean; modelCount: number; models: string[] }>>('/ai-agents/test-connection', { provider, apiKey, agentId }).then(r => r.data.data),
  testResponse: (payload: AiTestResponsePayload) =>
    api.post<ApiResponse<AiTestResponseResult>>('/ai-agents/test-response', payload).then(r => r.data.data),
  create: (payload: AiAgentPayload) =>
    api.post<ApiResponse<AiAgent>>('/ai-agents', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<AiAgentPayload>) =>
    api.put<ApiResponse<AiAgent>>(`/ai-agents/${id}`, payload).then(r => r.data.data),
  delete: (id: string) => api.delete(`/ai-agents/${id}`),
};

/** Upload gambar lepas → link URL publik (untuk ditempel di Knowledge / Pesan Sambutan). */
export const knowledgeFileService = {
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach(file => fd.append('files', file));
    return api
      .post<ApiResponse<{ filename: string; url: string }[]>>('/knowledge-files', fd)
      .then(r => r.data.data);
  },
};

export const knowledgeService = {
  list: (agentId: string) => api.get<ApiResponse<AiKnowledge[]>>(`/ai-agents/${agentId}/knowledge`).then(r => r.data.data),
  create: (agentId: string, payload: { title: string; content: string }) =>
    api.post<ApiResponse<AiKnowledge>>(`/ai-agents/${agentId}/knowledge`, payload).then(r => r.data.data),
  update: (agentId: string, id: string, payload: { title?: string; content?: string }) =>
    api.put<ApiResponse<AiKnowledge>>(`/ai-agents/${agentId}/knowledge/${id}`, payload).then(r => r.data.data),
  delete: (agentId: string, id: string) => api.delete(`/ai-agents/${agentId}/knowledge/${id}`),

  /** Upload satu/beberapa gambar untuk knowledge yang sudah tersimpan. */
  addMedia: (agentId: string, knowledgeId: string, files: File[], altTexts?: string[]) => {
    const fd = new FormData();
    files.forEach(file => fd.append('files', file));
    if (altTexts?.length) fd.append('altTexts', JSON.stringify(altTexts));
    return api
      .post<ApiResponse<AiKnowledgeMedia[]>>(`/ai-agents/${agentId}/knowledge/${knowledgeId}/media`, fd)
      .then(r => r.data.data);
  },
  updateMedia: (
    agentId: string,
    knowledgeId: string,
    mediaId: string,
    payload: { altText?: string | null; description?: string | null }
  ) =>
    api
      .put<ApiResponse<AiKnowledgeMedia>>(
        `/ai-agents/${agentId}/knowledge/${knowledgeId}/media/${mediaId}`,
        payload
      )
      .then(r => r.data.data),
  deleteMedia: (agentId: string, knowledgeId: string, mediaId: string) =>
    api.delete(`/ai-agents/${agentId}/knowledge/${knowledgeId}/media/${mediaId}`),
};

export interface AiMediaPayload {
  title: string;
  mediaUrl: string;
  caption?: string;
  description?: string;
  keywords?: string;
  trigger?: AiMediaTrigger;
  isActive?: boolean;
}

export const aiMediaService = {
  list: (agentId: string) =>
    api.get<ApiResponse<AiMedia[]>>(`/ai-agents/${agentId}/media`).then(r => r.data.data),
  create: (agentId: string, payload: AiMediaPayload) =>
    api.post<ApiResponse<AiMedia>>(`/ai-agents/${agentId}/media`, payload).then(r => r.data.data),
  update: (agentId: string, mediaId: string, payload: Partial<AiMediaPayload>) =>
    api.put<ApiResponse<AiMedia>>(`/ai-agents/${agentId}/media/${mediaId}`, payload).then(r => r.data.data),
  delete: (agentId: string, mediaId: string) =>
    api.delete(`/ai-agents/${agentId}/media/${mediaId}`),
};
