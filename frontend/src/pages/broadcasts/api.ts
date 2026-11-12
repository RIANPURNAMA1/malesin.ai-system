import api from '../../services/api';

export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type Eligibility = 'ELIGIBLE' | 'REVIEW' | 'SUPPRESSED';

export interface BroadcastSettings {
  quietHours: boolean;
  sendStartHour: number;
  sendEndHour: number;
  timezone: string;
  minDelaySec: number;
  maxDelaySec: number;
  dailyLimit: number;
  frequencyCap: boolean;
  frequencyCapHours: number;
  duplicateProtection: boolean;
  requireOptIn: boolean;
  appendOptOut: boolean;
  autoPause: boolean;
  maxConsecutiveFailures: number;
  maxFailureRate: number;
  maxOptOutRate: number;
}

export interface AudienceFilter {
  channelContactsOnly?: boolean;
  labelIds?: string[];
  sourceChannel?: string;
  activeWithinDays?: number;
}

export interface Broadcast {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string | null;
  status: BroadcastStatus;
  channelId: string;
  channel?: { id: string; name: string; type: string };
  audience?: AudienceFilter;
  settings?: BroadcastSettings;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  pauseReason?: string | null;
  waitingReason?: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  repliedCount: number;
  optOutCount: number;
  createdAt: string;
  recipients?: BroadcastRecipient[];
}

export interface BroadcastRecipient {
  id: string;
  contactId: string;
  name: string;
  phone: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  error?: string | null;
  sentAt?: string | null;
  repliedAt?: string | null;
  optedOutAt?: string | null;
}

export interface CampaignPayload {
  name: string;
  channelId: string;
  message: string;
  mediaUrl?: string | null;
  audience: AudienceFilter;
  settings: BroadcastSettings;
  scheduledAt?: string | null;
  draft?: boolean;
}

export interface PreviewResult {
  summary: { total: number; eligible: number; review: number; suppressed: number; willSend: number; reasons: Record<string, number> };
  errors: string[];
  warnings: string[];
}

export interface PermissionContact {
  id: string;
  name: string;
  phone: string | null;
  sourceChannel?: string | null;
  status: Eligibility;
  reason: string;
  consent: { status?: string; source?: string; category?: string; consentAt?: string; blacklisted?: boolean; unsubscribedAt?: string; lastBroadcastAt?: string };
}

export type ConsentAction = 'opt_in' | 'opt_out' | 'blacklist' | 'unblacklist' | 'reset';

const data = <T,>(p: Promise<{ data: { data: T } }>) => p.then(r => r.data.data);

export const broadcastApi = {
  defaults: () => data<BroadcastSettings>(api.get('/broadcasts/defaults')),
  list: () => data<Broadcast[]>(api.get('/broadcasts')),
  get: (id: string) => data<Broadcast>(api.get(`/broadcasts/${id}`)),
  preview: (p: CampaignPayload) => data<PreviewResult>(api.post('/broadcasts/preview', p)),
  create: (p: CampaignPayload) => data<Broadcast>(api.post('/broadcasts', p)),
  action: (id: string, action: 'pause' | 'resume' | 'cancel') => data<Broadcast>(api.post(`/broadcasts/${id}/${action}`)),
  remove: (id: string) => api.delete(`/broadcasts/${id}`),
  contacts: (params: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/broadcasts/contacts', { params }).then(r => r.data as {
      data: PermissionContact[];
      counts: { all: number; eligible: number; review: number; suppressed: number };
      meta: { total: number; page: number; limit: number; totalPages: number };
    }),
  updateConsent: (body: { contactIds: string[]; action: ConsentAction; source?: string; category?: string }) =>
    data<{ updated: number }>(api.patch('/broadcasts/contacts/consent', body)),
  importOptIn: (body: { text: string; source?: string; category?: string }) =>
    data<{ imported: number; invalid: string[] }>(api.post('/broadcasts/contacts/import', body)),
};

export const STATUS_META: Record<BroadcastStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  SCHEDULED: { label: 'Terjadwal', cls: 'bg-blue-50 text-blue-600' },
  RUNNING: { label: 'Berjalan', cls: 'bg-emerald-50 text-emerald-600' },
  PAUSED: { label: 'Dijeda', cls: 'bg-amber-50 text-amber-600' },
  COMPLETED: { label: 'Selesai', cls: 'bg-primary/10 text-primary' },
  CANCELLED: { label: 'Dibatalkan', cls: 'bg-red-50 text-red-500' },
};

export const ELIGIBILITY_META: Record<Eligibility, { label: string; cls: string }> = {
  ELIGIBLE: { label: 'Eligible', cls: 'bg-emerald-50 text-emerald-600' },
  REVIEW: { label: 'Review', cls: 'bg-amber-50 text-amber-600' },
  SUPPRESSED: { label: 'Suppressed', cls: 'bg-red-50 text-red-500' },
};

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || 'Terjadi kesalahan';
