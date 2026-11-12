import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';

/**
 * Analytics: sesi (= percakapan), AI Agent, Human Agent, Broadcast.
 * Pengelompokan per hari memakai WIB (UTC+7).
 */
const TZ_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const MAX_ROWS = 50_000;

export interface AnalyticsQuery { from?: string; to?: string; channelId?: string; agentId?: string }
export interface SlaSettings { firstResponseMinutes: number; resolutionHours: number }
export const DEFAULT_SLA: SlaSettings = { firstResponseMinutes: 5, resolutionHours: 24 };

const dayKey = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
const secs = (a?: Date | null, b?: Date | null) => (a && b ? Math.max(0, (b.getTime() - a.getTime()) / 1000) : null);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
};
const rate = (n: number, d: number) => (d ? n / d : null);

function range(q: AnalyticsQuery) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 6 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw createError('Rentang tanggal tidak valid', 400);
  if (to.getTime() - from.getTime() > 366 * DAY_MS) throw createError('Rentang maksimal 1 tahun', 400);
  const days: string[] = [];
  for (let t = from.getTime(); dayKey(new Date(t)) <= dayKey(to); t += DAY_MS) days.push(dayKey(new Date(t)));
  return { from, to, days };
}

function convWhere(companyId: string, q: AnalyticsQuery, from: Date, to: Date): Prisma.ConversationWhereInput {
  return {
    companyId,
    createdAt: { gte: from, lte: to },
    ...(q.channelId ? { channelId: q.channelId } : {}),
    ...(q.agentId ? { assignments: { some: { userId: q.agentId, unassignedAt: null } } } : {}),
  };
}

export async function getSla(companyId: string): Promise<SlaSettings> {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const sla = (c?.settings as { sla?: Partial<SlaSettings> } | null)?.sla ?? {};
  return {
    firstResponseMinutes: Number(sla.firstResponseMinutes) > 0 ? Number(sla.firstResponseMinutes) : DEFAULT_SLA.firstResponseMinutes,
    resolutionHours: Number(sla.resolutionHours) > 0 ? Number(sla.resolutionHours) : DEFAULT_SLA.resolutionHours,
  };
}

export async function setSla(companyId: string, body: Partial<SlaSettings>) {
  const firstResponseMinutes = Math.round(Number(body.firstResponseMinutes));
  const resolutionHours = Math.round(Number(body.resolutionHours));
  if (!(firstResponseMinutes >= 1 && firstResponseMinutes <= 1440)) throw createError('Target respons pertama 1–1440 menit', 400);
  if (!(resolutionHours >= 1 && resolutionHours <= 720)) throw createError('Target penyelesaian 1–720 jam', 400);
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const settings = { ...((c?.settings as Record<string, unknown>) ?? {}), sla: { firstResponseMinutes, resolutionHours } };
  await prisma.company.update({ where: { id: companyId }, data: { settings: settings as Prisma.InputJsonValue } });
  return settings.sla;
}

type SessionRow = {
  createdAt: Date; firstResponseAt: Date | null; handedToHumanAt: Date | null; closedAt: Date | null;
  status: string; handledBy: string | null;
};

/** Durasi bagian AI: dari mulai sampai diserahkan ke manusia (atau ditutup bila AI saja). */
function aiDuration(c: SessionRow) {
  const aiReplied = c.handledBy === 'AI' || (c.firstResponseAt && c.handedToHumanAt && c.firstResponseAt < c.handedToHumanAt);
  if (!aiReplied) return null;
  return secs(c.createdAt, c.handedToHumanAt ?? c.closedAt);
}
const agentDuration = (c: SessionRow) => (c.handedToHumanAt && c.closedAt ? secs(c.handedToHumanAt, c.closedAt) : null);

/** Met / Breached / Running terhadap target SLA. */
function slaStatus(c: SessionRow, sla: SlaSettings, now = new Date()) {
  const frtLimit = sla.firstResponseMinutes * 60;
  const resLimit = sla.resolutionHours * 3600;
  const frt = secs(c.createdAt, c.firstResponseAt ?? (c.status === 'CLOSED' ? c.closedAt : now))!;
  if (frt > frtLimit) return 'BREACHED';
  if (c.status === 'CLOSED') return (secs(c.createdAt, c.closedAt) ?? 0) <= resLimit ? 'MET' : 'BREACHED';
  return (secs(c.createdAt, now) ?? 0) > resLimit ? 'BREACHED' : 'RUNNING';
}

// ---------- Session ----------
export async function sessionAnalytics(companyId: string, q: AnalyticsQuery) {
  const { from, to, days } = range(q);
  const sla = await getSla(companyId);
  const rows = await prisma.conversation.findMany({
    where: convWhere(companyId, q, from, to),
    select: {
      id: true, contactId: true, createdAt: true, firstResponseAt: true, handedToHumanAt: true, closedAt: true,
      status: true, handledBy: true, channel: { select: { id: true, name: true, type: true } },
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
    },
    take: MAX_ROWS,
  });

  // Sesi pertama kontak (sepanjang waktu) = first customer; sisanya returning.
  const firsts = rows.length
    ? await prisma.conversation.groupBy({ by: ['contactId'], where: { companyId, contactId: { in: [...new Set(rows.map(r => r.contactId))] } }, _min: { createdAt: true } })
    : [];
  const firstAt = new Map(firsts.map(f => [f.contactId, f._min.createdAt?.getTime()]));

  const daily = new Map(days.map(d => [d, { date: d, first: 0, returning: 0 }]));
  const source = new Map<string, { name: string; type: string; count: number }>();
  const labels = new Map<string, { name: string; color: string; count: number }>();
  const status = { OPEN: 0, PENDING: 0, CLOSED: 0 } as Record<string, number>;
  for (const r of rows) {
    const d = daily.get(dayKey(r.createdAt));
    if (d) (firstAt.get(r.contactId) === r.createdAt.getTime() ? d.first++ : d.returning++);
    const s = source.get(r.channel.id) ?? { name: r.channel.name, type: r.channel.type, count: 0 };
    s.count++; source.set(r.channel.id, s);
    for (const { label } of r.labels) {
      const l = labels.get(label.id) ?? { name: label.name, color: label.color, count: 0 };
      l.count++; labels.set(label.id, l);
    }
    status[r.status] = (status[r.status] ?? 0) + 1;
  }

  const closed = rows.filter(r => r.status === 'CLOSED');
  const responded = rows.filter(r => r.firstResponseAt);
  const series = [...daily.values()];

  // MAU 12 bulan terakhir: kontak unik yang mengirim pesan.
  const mauFrom = new Date(to.getFullYear(), to.getMonth() - 11, 1);
  const mauRows = await prisma.$queryRaw<{ ym: string; mau: bigint }[]>`
    SELECT DATE_FORMAT(DATE_ADD(m.sentAt, INTERVAL 7 HOUR), '%Y-%m') AS ym, COUNT(DISTINCT c.contactId) AS mau
    FROM messages m JOIN conversations c ON c.id = m.conversationId
    WHERE c.companyId = ${companyId} AND m.direction = 'INBOUND' AND m.sentAt >= ${mauFrom}
      ${q.channelId ? Prisma.sql`AND c.channelId = ${q.channelId}` : Prisma.empty}
    GROUP BY ym ORDER BY ym`;
  const mau: { month: string; mau: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(mauFrom.getFullYear(), mauFrom.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mau.push({ month: ym, mau: Number(mauRows.find(x => x.ym === ym)?.mau ?? 0) });
  }

  return {
    range: { from, to },
    sla,
    totals: {
      sessions: rows.length,
      first: series.reduce((s, d) => s + d.first, 0),
      returning: series.reduce((s, d) => s + d.returning, 0),
    },
    daily: series,
    source: [...source.values()].sort((a, b) => b.count - a.count),
    resolution: { closed: closed.length, total: rows.length, rate: rate(closed.length, rows.length) },
    labels: [...labels.values()].sort((a, b) => b.count - a.count),
    status,
    mau,
    performance: {
      avgSessionSec: avg(closed.map(r => secs(r.createdAt, r.closedAt))),
      avgAiSessionSec: avg(rows.map(aiDuration)),
      avgAgentSessionSec: avg(closed.map(agentDuration)),
      avgFirstResponseSec: avg(responded.map(r => secs(r.createdAt, r.firstResponseAt))),
      slaIn: rate(responded.filter(r => secs(r.createdAt, r.firstResponseAt)! <= sla.firstResponseMinutes * 60).length, responded.length),
      slaOut: rate(closed.filter(r => secs(r.createdAt, r.closedAt)! <= sla.resolutionHours * 3600).length, closed.length),
    },
    truncated: rows.length >= MAX_ROWS,
  };
}

export async function sessionList(companyId: string, q: AnalyticsQuery & { page?: string }) {
  const { from, to } = range(q);
  const sla = await getSla(companyId);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = 20;
  const where = convWhere(companyId, q, from, to);
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        channel: { select: { id: true, name: true, type: true } },
        assignments: { where: { unassignedAt: null }, include: { user: { select: { id: true, name: true } } }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);
  // Nomor sesi = urutan percakapan kontak tsb.
  const contactConvs = rows.length
    ? await prisma.conversation.findMany({ where: { companyId, contactId: { in: rows.map(r => r.contactId) } }, select: { id: true, contactId: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
    : [];
  const seq = new Map<string, number>();
  const counter = new Map<string, number>();
  for (const c of contactConvs) { const n = (counter.get(c.contactId) ?? 0) + 1; counter.set(c.contactId, n); seq.set(c.id, n); }

  return {
    data: rows.map(r => ({
      id: r.id,
      name: r.contact.name,
      phone: r.contact.phone,
      platform: r.channel.type,
      inbox: r.channel.name,
      sessionNumber: seq.get(r.id) ?? 1,
      agent: r.assignments[0]?.user.name ?? null,
      status: r.status,
      handledBy: r.handledBy,
      createdAt: r.createdAt,
      handedToHumanAt: r.handedToHumanAt,
      closedAt: r.closedAt,
      aiDurationSec: aiDuration(r),
      agentDurationSec: agentDuration(r),
      sla: slaStatus(r, sla),
    })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ---------- AI Agent ----------
export async function aiAnalytics(companyId: string, q: AnalyticsQuery) {
  const { from, to, days } = range(q);
  const convs = await prisma.conversation.findMany({
    where: convWhere(companyId, q, from, to),
    select: { createdAt: true, firstResponseAt: true, handedToHumanAt: true, closedAt: true, status: true, handledBy: true },
    take: MAX_ROWS,
  });
  const aiMsgs = await prisma.message.findMany({
    where: {
      direction: 'OUTBOUND',
      sentAt: { gte: from, lte: to },
      metadata: { path: '$.source', equals: 'AI' },
      conversation: { companyId, ...(q.channelId ? { channelId: q.channelId } : {}) },
    },
    select: { sentAt: true, metadata: true },
    take: MAX_ROWS * 4,
  });
  const agents = await prisma.aiAgent.findMany({ where: { companyId }, select: { id: true, name: true } });
  const agentName = new Map(agents.map(a => [a.id, a.name]));

  const daily = new Map(days.map(d => [d, { date: d, replies: 0 }]));
  const perAgent = new Map<string, number>();
  for (const m of aiMsgs) {
    const d = daily.get(dayKey(m.sentAt));
    if (d) d.replies++;
    const id = (m.metadata as { aiAgentId?: string } | null)?.aiAgentId ?? 'unknown';
    perAgent.set(id, (perAgent.get(id) ?? 0) + 1);
  }

  const aiTouched = convs.filter(c => aiDuration(c) !== null || c.handledBy === 'AI');
  const aiOnly = convs.filter(c => c.handledBy === 'AI');
  const handed = aiTouched.filter(c => c.handedToHumanAt);
  const closed = convs.filter(c => c.status === 'CLOSED');
  // Waktu balas AI: respons pertama pada sesi yang dibalas AI lebih dulu.
  const aiFirst = aiTouched.filter(c => c.firstResponseAt && (!c.handedToHumanAt || c.firstResponseAt < c.handedToHumanAt));

  return {
    totals: {
      sessionsHandled: aiTouched.length,
      aiOnly: aiOnly.length,
      handedToHuman: handed.length,
      replies: aiMsgs.length,
      resolutionRate: rate(closed.filter(c => c.handledBy === 'AI').length, closed.length),
      handoffRate: rate(handed.length, aiTouched.length),
      avgFirstResponseSec: avg(aiFirst.map(c => secs(c.createdAt, c.firstResponseAt))),
      avgAiSessionSec: avg(aiTouched.map(aiDuration)),
    },
    daily: [...daily.values()],
    perAgent: [...perAgent.entries()]
      .map(([id, replies]) => ({ id, name: agentName.get(id) ?? (id === 'unknown' ? 'Tidak diketahui (data lama)' : 'Agent terhapus'), replies }))
      .sort((a, b) => b.replies - a.replies),
  };
}

// ---------- Human Agent ----------
export async function humanAnalytics(companyId: string, q: AnalyticsQuery) {
  const { from, to } = range(q);
  const users = await prisma.user.findMany({
    where: { companyId, isActive: true, ...(q.agentId ? { id: q.agentId } : {}) },
    select: { id: true, name: true, avatar: true, role: true },
    orderBy: { name: 'asc' },
  });
  const ids = users.map(u => u.id);
  const chan = q.channelId ? { channelId: q.channelId } : {};
  const [assignments, open, closedBy, msgs] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId: { in: ids }, assignedAt: { gte: from, lte: to }, conversation: { companyId, ...chan } },
      select: { userId: true, conversationId: true, assignedAt: true },
    }),
    prisma.assignment.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, unassignedAt: null, conversation: { companyId, status: { not: 'CLOSED' }, ...chan } },
      _count: { _all: true },
    }),
    prisma.conversation.findMany({
      where: { companyId, closedById: { in: ids }, closedAt: { gte: from, lte: to }, ...chan },
      select: { closedById: true, createdAt: true, handedToHumanAt: true, closedAt: true },
    }),
    prisma.message.findMany({
      where: { senderId: { in: ids }, direction: 'OUTBOUND', sentAt: { gte: from, lte: to }, conversation: { companyId, ...chan } },
      select: { senderId: true, conversationId: true, sentAt: true },
      orderBy: { sentAt: 'asc' },
      take: MAX_ROWS * 4,
    }),
  ]);

  // Balasan pertama agen setelah di-assign.
  const replies = new Map<string, Date[]>();
  for (const m of msgs) {
    const k = `${m.senderId}:${m.conversationId}`;
    (replies.get(k) ?? replies.set(k, []).get(k)!).push(m.sentAt);
  }

  const data = users.map(u => {
    const mine = assignments.filter(a => a.userId === u.id);
    const frt = mine.map(a => {
      const first = replies.get(`${u.id}:${a.conversationId}`)?.find(t => t >= a.assignedAt);
      return first ? secs(a.assignedAt, first) : null;
    });
    const closed = closedBy.filter(c => c.closedById === u.id);
    return {
      ...u,
      assigned: mine.length,
      openNow: open.find(o => o.userId === u.id)?._count._all ?? 0,
      closed: closed.length,
      messagesSent: msgs.filter(m => m.senderId === u.id).length,
      avgFirstResponseSec: avg(frt),
      avgResolutionSec: avg(closed.map(c => secs(c.handedToHumanAt ?? c.createdAt, c.closedAt))),
    };
  });
  const sum = (k: 'assigned' | 'closed' | 'messagesSent') => data.reduce((s, d) => s + d[k], 0);
  return {
    totals: {
      assigned: sum('assigned'),
      closed: sum('closed'),
      messagesSent: sum('messagesSent'),
      avgFirstResponseSec: avg(data.map(d => d.avgFirstResponseSec)),
      avgResolutionSec: avg(data.map(d => d.avgResolutionSec)),
    },
    agents: data.sort((a, b) => b.closed - a.closed || b.messagesSent - a.messagesSent),
  };
}

// ---------- Broadcast ----------
export async function broadcastAnalytics(companyId: string, q: AnalyticsQuery) {
  const { from, to, days } = range(q);
  const chan = q.channelId ? { channelId: q.channelId } : {};
  const [campaigns, sent] = await Promise.all([
    prisma.broadcast.findMany({
      where: { companyId, createdAt: { gte: from, lte: to }, ...chan },
      select: {
        id: true, name: true, status: true, createdAt: true, totalRecipients: true, sentCount: true,
        failedCount: true, skippedCount: true, repliedCount: true, optOutCount: true, channel: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.broadcastRecipient.findMany({
      where: { status: 'SENT', sentAt: { gte: from, lte: to }, broadcast: { companyId, ...chan } },
      select: { sentAt: true, repliedAt: true, optedOutAt: true },
      take: MAX_ROWS * 4,
    }),
  ]);
  const daily = new Map(days.map(d => [d, { date: d, sent: 0, replied: 0, optOut: 0 }]));
  for (const r of sent) {
    const d = daily.get(dayKey(r.sentAt!));
    if (!d) continue;
    d.sent++;
    if (r.repliedAt) d.replied++;
    if (r.optedOutAt) d.optOut++;
  }
  const t = campaigns.reduce((a, c) => ({
    recipients: a.recipients + c.totalRecipients, sent: a.sent + c.sentCount, failed: a.failed + c.failedCount,
    replied: a.replied + c.repliedCount, optOut: a.optOut + c.optOutCount,
  }), { recipients: 0, sent: 0, failed: 0, replied: 0, optOut: 0 });
  return {
    totals: {
      campaigns: campaigns.length, ...t,
      deliveryRate: rate(t.sent, t.sent + t.failed),
      replyRate: rate(t.replied, t.sent),
      optOutRate: rate(t.optOut, t.sent),
    },
    daily: [...daily.values()],
    campaigns,
  };
}

// ---------- Leads (deal pipeline yang masuk) ----------
export async function leadsAnalytics(companyId: string, q: AnalyticsQuery & { pipelineId?: string }) {
  const { from, to, days } = range(q);
  const deals = await prisma.deal.findMany({
    where: {
      companyId,
      createdAt: { gte: from, lte: to },
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.agentId ? { ownerId: q.agentId } : {}),
      ...(q.channelId ? { contact: { conversations: { some: { channelId: q.channelId } } } } : {}),
    },
    select: {
      id: true, status: true, value: true, createdAt: true, wonAt: true, lostReason: true, stageId: true,
      contact: { select: { sourceChannel: true, conversations: { select: { channel: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: 'asc' }, take: 1 } } },
      activities: { where: { type: 'CREATED' }, select: { actor: true }, take: 1 },
    },
    take: MAX_ROWS,
  });

  const stages = await prisma.pipelineStage.findMany({
    where: { pipeline: { companyId, ...(q.pipelineId ? { id: q.pipelineId } : {}) } },
    select: { id: true, name: true, color: true, position: true, kind: true, pipeline: { select: { name: true } } },
    orderBy: [{ pipelineId: 'asc' }, { position: 'asc' }],
  });

  const daily = new Map(days.map(d => [d, { date: d, leads: 0, won: 0 }]));
  const source = new Map<string, { name: string; type: string; count: number }>();
  const byStage = new Map<string, number>();
  const lostReasons = new Map<string, number>();
  let auto = 0;
  for (const d of deals) {
    const day = daily.get(dayKey(d.createdAt));
    if (day) day.leads++;
    if (d.wonAt) { const w = daily.get(dayKey(d.wonAt)); if (w) w.won++; }
    const ch = d.contact.conversations[0]?.channel;
    const key = ch?.id ?? `src:${d.contact.sourceChannel ?? 'MANUAL'}`;
    const s = source.get(key) ?? { name: ch?.name ?? (d.contact.sourceChannel === 'IMPORT' ? 'Impor kontak' : 'Manual'), type: ch?.type ?? d.contact.sourceChannel ?? 'MANUAL', count: 0 };
    s.count++; source.set(key, s);
    byStage.set(d.stageId, (byStage.get(d.stageId) ?? 0) + 1);
    if (d.status === 'LOST') lostReasons.set(d.lostReason || 'Tanpa alasan', (lostReasons.get(d.lostReason || 'Tanpa alasan') ?? 0) + 1);
    if (d.activities[0]?.actor === 'SYSTEM') auto++;
  }

  const won = deals.filter(d => d.status === 'WON');
  const lost = deals.filter(d => d.status === 'LOST');
  const multiPipeline = new Set(stages.map(s => s.pipeline.name)).size > 1;
  return {
    totals: {
      leads: deals.length,
      auto,
      manual: deals.length - auto,
      open: deals.length - won.length - lost.length,
      won: won.length,
      lost: lost.length,
      conversionRate: rate(won.length, deals.length),
      wonValue: won.reduce((s, d) => s + d.value, 0),
      pipelineValue: deals.filter(d => d.status === 'OPEN').reduce((s, d) => s + d.value, 0),
    },
    daily: [...daily.values()],
    source: [...source.values()].sort((a, b) => b.count - a.count),
    // Posisi tahap SAAT INI dari lead yang masuk di rentang ini (funnel).
    stages: stages.map(s => ({
      name: multiPipeline ? `${s.pipeline.name} · ${s.name}` : s.name, color: s.color, kind: s.kind, count: byStage.get(s.id) ?? 0,
    })),
    lostReasons: [...lostReasons.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    truncated: deals.length >= MAX_ROWS,
  };
}
