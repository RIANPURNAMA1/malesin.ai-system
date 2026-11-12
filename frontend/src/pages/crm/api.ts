import api from '../../services/api';

export type StageKind = 'OPEN' | 'WON' | 'LOST';
export type AutoMode = 'AUTO' | 'SUGGEST' | 'MANUAL';

export interface Stage {
  id: string; pipelineId: string; name: string; color: string; position: number; kind: StageKind;
  autoRule: string | null; aiHint: string | null;
}
export interface Pipeline {
  id: string; name: string; isDefault: boolean; autoMode: AutoMode; autoCreateDeals: boolean; lostAfterDays: number;
  stages: Stage[]; _count?: { deals: number };
}
export interface AiSuggestion { stageId: string; confidence: number; reason: string; evidence?: string; at: string }
export interface Deal {
  id: string; pipelineId: string; stageId: string; contactId: string; ownerId: string | null; title: string; value: number;
  status: 'OPEN' | 'WON' | 'LOST'; lostReason: string | null; expectedCloseAt: string | null; stageEnteredAt: string;
  lastActivityAt: string; wonAt: string | null; lostAt: string | null; aiSuggestion: AiSuggestion | null; createdAt: string;
  contact: { id: string; name: string; phone?: string | null; email?: string | null; sourceChannel?: string | null };
  owner: { id: string; name: string; avatar?: string | null } | null;
}
export interface DealActivity {
  id: string; type: 'CREATED' | 'STAGE' | 'UPDATE' | 'NOTE' | 'SUGGESTION'; actor: 'SYSTEM' | 'AI' | 'USER';
  userName: string | null; fromStageId: string | null; toStageId: string | null; message: string | null;
  metadata: { confidence?: number; evidence?: string } | null; createdAt: string;
}
export interface DealDetail extends Deal {
  stage: Stage; pipeline: Pipeline; activities: DealActivity[]; conversationId: string | null;
}

const d = <T,>(p: Promise<{ data: { data: T } }>) => p.then(r => r.data.data);

export const crmApi = {
  pipelines: () => d<Pipeline[]>(api.get('/crm/pipelines')),
  createPipeline: (name: string) => d<Pipeline>(api.post('/crm/pipelines', { name })),
  updatePipeline: (id: string, body: Partial<Pick<Pipeline, 'name' | 'autoMode' | 'autoCreateDeals' | 'lostAfterDays' | 'isDefault'>>) =>
    d<Pipeline>(api.put(`/crm/pipelines/${id}`, body)),
  saveStages: (id: string, stages: Partial<Stage>[]) => d<Pipeline>(api.put(`/crm/pipelines/${id}/stages`, { stages })),
  deletePipeline: (id: string) => api.delete(`/crm/pipelines/${id}`),
  board: (id: string, q: { search?: string; ownerId?: string }) =>
    d<Deal[]>(api.get(`/crm/pipelines/${id}/board`, { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v)) })),
  createDeal: (body: { contactId: string; pipelineId?: string; stageId?: string; title?: string; value?: number; ownerId?: string | null }) =>
    d<Deal>(api.post('/crm/deals', body)),
  dealForContact: (contactId: string) =>
    d<(Deal & { stage: { name: string; color: string } }) | null>(api.get(`/crm/contacts/${contactId}/deal`)),
  deal: (id: string) => d<DealDetail>(api.get(`/crm/deals/${id}`)),
  updateDeal: (id: string, body: { title?: string; value?: number; ownerId?: string | null; expectedCloseAt?: string | null }) =>
    d<Deal>(api.patch(`/crm/deals/${id}`, body)),
  move: (id: string, stageId: string, lostReason?: string) => d<Deal>(api.post(`/crm/deals/${id}/move`, { stageId, lostReason })),
  suggestion: (id: string, accept: boolean) => d<{ accepted: boolean }>(api.post(`/crm/deals/${id}/suggestion`, { accept })),
  note: (id: string, text: string) => d<DealActivity>(api.post(`/crm/deals/${id}/notes`, { text })),
  analyze: (id: string) => d<DealDetail>(api.post(`/crm/deals/${id}/analyze`)),
  deleteDeal: (id: string) => api.delete(`/crm/deals/${id}`),
};

export const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
export const shortRupiah = (n: number) =>
  n >= 1e9 ? `Rp ${(n / 1e9).toFixed(1).replace('.0', '')} M` : n >= 1e6 ? `Rp ${(n / 1e6).toFixed(1).replace('.0', '')} jt` : rupiah(n);

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt`;
  if (s < 86400) return `${Math.floor(s / 3600)} j`;
  return `${Math.floor(s / 86400)} hr`;
}

export const LOST_REASONS = ['Terlalu mahal', 'Tidak merespons', 'Pilih kompetitor', 'Belum butuh sekarang', 'Tidak sesuai kebutuhan', 'Lainnya'];
export const AUTO_RULE_LABEL: Record<string, string> = {
  FIRST_CHAT: 'Chat pertama masuk',
  REPLIED: 'Pelanggan sudah dibalas',
  INTEREST: 'AI: menunjukkan minat beli',
  PAYMENT_SENT: 'Info pembayaran dikirim',
};
export const AUTO_MODE_LABEL: Record<AutoMode, { label: string; hint: string }> = {
  AUTO: { label: 'Otomatis', hint: 'Sistem & AI memindahkan kartu (Closing tetap dikonfirmasi agen)' },
  SUGGEST: { label: 'Saran saja', hint: 'Aturan sistem jalan, AI hanya memberi saran' },
  MANUAL: { label: 'Manual', hint: 'Tidak ada otomasi' },
};
export const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Terjadi kesalahan';
