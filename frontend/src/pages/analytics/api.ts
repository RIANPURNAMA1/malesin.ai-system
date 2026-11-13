import api from '../../services/api';

export interface AnalyticsFilters { from?: string; to?: string; channelId?: string; agentId?: string }
export interface Sla { firstResponseMinutes: number; resolutionHours: number }

export interface SessionData {
  sla: Sla;
  totals: { sessions: number; first: number; returning: number };
  daily: { date: string; first: number; returning: number }[];
  source: { name: string; type: string; count: number }[];
  resolution: { closed: number; total: number; rate: number | null };
  labels: { name: string; color: string; count: number }[];
  status: Record<'OPEN' | 'PENDING' | 'CLOSED', number>;
  mau: { month: string; mau: number }[];
  performance: {
    avgSessionSec: number | null; avgAiSessionSec: number | null; avgAgentSessionSec: number | null;
    avgFirstResponseSec: number | null; slaIn: number | null; slaOut: number | null;
  };
  truncated: boolean;
}

export interface SessionListRow {
  id: string; name: string; phone?: string | null; platform: string; inbox: string; sessionNumber: number;
  agent: string | null; status: string; handledBy: string | null; createdAt: string; handedToHumanAt: string | null;
  closedAt: string | null; aiDurationSec: number | null; agentDurationSec: number | null; sla: 'MET' | 'BREACHED' | 'RUNNING';
}

export interface AiData {
  totals: {
    sessionsHandled: number; aiOnly: number; handedToHuman: number; replies: number;
    resolutionRate: number | null; handoffRate: number | null; avgFirstResponseSec: number | null; avgAiSessionSec: number | null;
  };
  daily: { date: string; replies: number }[];
  perAgent: { id: string; name: string; replies: number }[];
}

export interface HumanData {
  totals: { assigned: number; closed: number; messagesSent: number; avgFirstResponseSec: number | null; avgResolutionSec: number | null };
  agents: {
    id: string; name: string; avatar?: string | null; role: string; assigned: number; openNow: number; closed: number;
    messagesSent: number; avgFirstResponseSec: number | null; avgResolutionSec: number | null;
  }[];
}

export interface LeadsData {
  totals: {
    leads: number; auto: number; manual: number; open: number; won: number; lost: number;
    conversionRate: number | null; wonValue: number; pipelineValue: number;
  };
  daily: { date: string; leads: number; won: number }[];
  source: { name: string; type: string; count: number }[];
  stages: { name: string; color: string; kind: string; count: number }[];
  lostReasons: { name: string; count: number }[];
  truncated: boolean;
}

export interface BroadcastData {
  totals: {
    campaigns: number; recipients: number; sent: number; failed: number; replied: number; optOut: number;
    deliveryRate: number | null; replyRate: number | null; optOutRate: number | null;
  };
  daily: { date: string; sent: number; replied: number; optOut: number }[];
  campaigns: {
    id: string; name: string; status: string; createdAt: string; totalRecipients: number; sentCount: number;
    failedCount: number; skippedCount: number; repliedCount: number; optOutCount: number; channel: { name: string };
  }[];
}

const clean = (f: object) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''));
const get = <T,>(url: string, f: object) => api.get(url, { params: clean(f) }).then(r => r.data.data as T);

export const analyticsApi = {
  leads: (f: AnalyticsFilters) => get<LeadsData>('/analytics/leads', f),
  session: (f: AnalyticsFilters) => get<SessionData>('/analytics/session', f),
  sessionList: (f: AnalyticsFilters, page: number) =>
    get<{ data: SessionListRow[]; meta: { total: number; page: number; totalPages: number } }>('/analytics/session/list', { ...f, page }),
  ai: (f: AnalyticsFilters) => get<AiData>('/analytics/ai', f),
  human: (f: AnalyticsFilters) => get<HumanData>('/analytics/human', f),
  broadcast: (f: AnalyticsFilters) => get<BroadcastData>('/analytics/broadcast', f),
  sla: () => get<Sla>('/analytics/sla', {}),
  saveSla: (s: Sla) => api.put('/analytics/sla', s).then(r => r.data.data as Sla),
};

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${Math.round(n * 100)}%`);

/** 0 → "00j 00m 00d" gaya kartu performa. */
export function hms(s: number | null | undefined) {
  if (s === null || s === undefined) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = Math.round(s % 60);
  return `${String(h).padStart(2, '0')}j ${String(m).padStart(2, '0')}m ${String(d).padStart(2, '0')}d`;
}

/** "2026-11-12" → "12 Nov" */
export const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
export const shortMonth = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

export const COLORS = {
  primary: '#0E3F96',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#9ca3af',
};
export const PALETTE = [COLORS.primary, COLORS.violet, COLORS.emerald, COLORS.amber, COLORS.red, '#ec4899', '#14b8a6', COLORS.gray];

export const PLATFORM_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp', WHATSAPP_UNOFFICIAL: 'WA Unofficial', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', TIKTOK: 'TikTok',
};
