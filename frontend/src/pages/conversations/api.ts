import api from '../../services/api';

export type ConvStatus = 'OPEN' | 'PENDING' | 'CLOSED';
export type MessageSource = 'AI' | 'AGENT' | 'BROADCAST' | 'SYSTEM' | 'DEVICE';

export interface ConvRow {
  id: string;
  status: ConvStatus;
  handledBy: 'AI' | 'HUMAN' | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  firstResponseAt?: string | null;
  closedAt?: string | null;
  contact: { id: string; name: string; phone?: string | null; avatar?: string | null };
  channel: { id: string; name: string; type: string };
  agent: { id: string; name: string; avatar?: string | null } | null;
  labels: { id: string; name: string; color: string }[];
  messageCount: number;
  firstResponseSec: number | null;
  durationSec: number | null;
}

export interface ConvStats {
  total: number; open: number; pending: number; closed: number;
  handledByAi: number; handledByHuman: number; unhandled: number; unassigned: number;
  aiResolutionRate: number | null; avgFirstResponseSec: number | null; avgResolutionSec: number | null;
}

export interface TranscriptMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  status: string;
  sentAt: string;
  metadata?: { source?: MessageSource } | null;
  sender?: { id: string; name: string } | null;
}

export interface Filters {
  search?: string; status?: string; channelId?: string; agentId?: string; labelId?: string;
  handledBy?: string; unassigned?: string; from?: string; to?: string; sort?: string; dir?: string;
}

const clean = (f: Filters) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''));

export const convApi = {
  list: (f: Filters, page: number) =>
    api.get('/conversations/manage', { params: { ...clean(f), page, limit: 25 } }).then(r => r.data as {
      data: ConvRow[]; meta: { total: number; page: number; limit: number; totalPages: number };
    }),
  stats: (f: Filters) => api.get('/conversations/manage/stats', { params: clean(f) }).then(r => r.data.data as ConvStats),
  transcript: (id: string) =>
    api.get(`/conversations/manage/${id}`).then(r => r.data.data as { conversation: ConvRow; messages: TranscriptMessage[] }),
  bulk: (body: { ids: string[]; action: 'status' | 'assign' | 'label'; value: string }) =>
    api.post('/conversations/manage/bulk', body).then(r => r.data.data as { updated: number }),
  exportCsv: async (f: Filters) => {
    const res = await api.get('/conversations/manage/export', { params: clean(f), responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

/** 75 → "1m 15d", 3700 → "1j 1m" */
export function fmtDuration(s: number | null | undefined) {
  if (s === null || s === undefined) return '-';
  if (s < 60) return `${s}d`;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}h ${h}j`;
  if (h) return `${h}j ${m}m`;
  return `${m}m ${s % 60}d`;
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export const STATUS_META: Record<ConvStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'bg-emerald-50 text-emerald-600' },
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-600' },
  CLOSED: { label: 'Closed', cls: 'bg-gray-100 text-gray-500' },
};

export const SOURCE_META: Record<MessageSource, { label: string; cls: string }> = {
  AI: { label: 'AI', cls: 'bg-violet-50 text-violet-600' },
  AGENT: { label: 'Agen', cls: 'bg-primary/10 text-primary' },
  BROADCAST: { label: 'Broadcast', cls: 'bg-orange-50 text-orange-600' },
  SYSTEM: { label: 'Sistem', cls: 'bg-gray-100 text-gray-500' },
  DEVICE: { label: 'HP', cls: 'bg-sky-50 text-sky-600' },
};

export const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || 'Terjadi kesalahan';
