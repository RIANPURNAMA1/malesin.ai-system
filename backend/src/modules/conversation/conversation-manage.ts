import { Router, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { authorize } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { ConversationService } from './conversation.service';

/**
 * Halaman Conversations (supervisor): daftar + filter lengkap, ringkasan
 * metrik, transkrip, aksi massal, dan export CSV. Agen hanya melihat
 * percakapan yang di-assign ke dirinya.
 */
const conversationService = new ConversationService();

type Viewer = { companyId: string; userId: string; role: string };
type Query = Record<string, string | undefined>;

const SORTS = ['lastMessageAt', 'createdAt', 'firstResponseAt', 'closedAt'] as const;
const sec = (a?: Date | null, b?: Date | null) => (a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000)) : null);

function buildWhere(v: Viewer, q: Query): Prisma.ConversationWhereInput {
  const and: Prisma.ConversationWhereInput[] = [{ companyId: v.companyId }];
  if (v.role === 'AGENT') and.push({ assignments: { some: { userId: v.userId, unassignedAt: null } } });
  if (q.status) and.push({ status: q.status as Prisma.EnumConversationStatusFilter['equals'] });
  if (q.channelId) and.push({ channelId: q.channelId });
  if (q.labelId) and.push({ labels: { some: { labelId: q.labelId } } });
  if (q.agentId) and.push({ assignments: { some: { userId: q.agentId, unassignedAt: null } } });
  if (q.unassigned === '1') and.push({ assignments: { none: { unassignedAt: null } } });
  if (q.handledBy === 'NONE') and.push({ handledBy: null });
  else if (q.handledBy) and.push({ handledBy: q.handledBy });
  const from = q.from ? new Date(q.from) : null;
  const to = q.to ? new Date(q.to) : null;
  if (from && !Number.isNaN(from.getTime())) and.push({ createdAt: { gte: from } });
  if (to && !Number.isNaN(to.getTime())) and.push({ createdAt: { lte: to } });
  const s = q.search?.trim();
  if (s) {
    and.push({
      OR: [
        { contact: { name: { contains: s } } },
        { contact: { phone: { contains: s } } },
        { messages: { some: { content: { contains: s } } } },
      ],
    });
  }
  return { AND: and };
}

const listInclude = {
  contact: { select: { id: true, name: true, phone: true, avatar: true } },
  channel: { select: { id: true, name: true, type: true } },
  labels: { include: { label: true } },
  assignments: {
    where: { unassignedAt: null },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    take: 1,
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationInclude;

type ListRow = Prisma.ConversationGetPayload<{ include: typeof listInclude }>;

function toRow(c: ListRow) {
  const { assignments, _count, labels, ...rest } = c;
  return {
    ...rest,
    agent: assignments[0]?.user ?? null,
    labels: labels.map(l => l.label),
    messageCount: _count.messages,
    firstResponseSec: sec(c.createdAt, c.firstResponseAt),
    durationSec: sec(c.createdAt, c.closedAt ?? null),
  };
}

async function list(v: Viewer, q: Query) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
  const sort = (SORTS as readonly string[]).includes(q.sort ?? '') ? (q.sort as (typeof SORTS)[number]) : 'lastMessageAt';
  const dir: Prisma.SortOrder = q.dir === 'asc' ? 'asc' : 'desc';
  const where = buildWhere(v, q);
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: listInclude,
      orderBy: [{ [sort]: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);
  return { data: rows.map(toRow), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

async function stats(v: Viewer, q: Query) {
  // Ringkasan mengikuti filter yang sama, kecuali status (supaya kartu Open/Pending/Closed tetap utuh).
  const where = buildWhere(v, { ...q, status: undefined });
  const [byStatus, byHandler, unassigned, timing] = await Promise.all([
    prisma.conversation.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ['handledBy'], where, _count: { _all: true } }),
    prisma.conversation.count({ where: { AND: [where, { assignments: { none: { unassignedAt: null } } }] } }),
    prisma.conversation.findMany({
      where,
      select: { createdAt: true, firstResponseAt: true, closedAt: true, status: true, handledBy: true },
      take: 50000,
    }),
  ]);
  const count = (s: string) => byStatus.find(b => b.status === s)?._count._all ?? 0;
  const handler = (h: string | null) => byHandler.find(b => b.handledBy === h)?._count._all ?? 0;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const frt = timing.map(t => sec(t.createdAt, t.firstResponseAt)).filter((x): x is number => x !== null);
  const closed = timing.filter(t => t.status === 'CLOSED');
  const resolution = closed.map(t => sec(t.createdAt, t.closedAt)).filter((x): x is number => x !== null);
  return {
    total: count('OPEN') + count('PENDING') + count('CLOSED'),
    open: count('OPEN'),
    pending: count('PENDING'),
    closed: count('CLOSED'),
    handledByAi: handler('AI'),
    handledByHuman: handler('HUMAN'),
    unhandled: handler(null),
    unassigned,
    /** Percakapan CLOSED yang hanya ditangani AI / semua CLOSED. */
    aiResolutionRate: closed.length ? closed.filter(t => t.handledBy === 'AI').length / closed.length : null,
    avgFirstResponseSec: avg(frt),
    avgResolutionSec: avg(resolution),
  };
}

async function transcript(v: Viewer, id: string) {
  const conv = await prisma.conversation.findFirst({ where: { AND: [buildWhere(v, {}), { id }] }, include: listInclude });
  if (!conv) throw createError('Percakapan tidak ditemukan', 404);
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true } }, attachments: true },
    orderBy: { sentAt: 'asc' },
    take: 1000,
  });
  return { conversation: toRow(conv), messages };
}

async function bulk(v: Viewer, body: { ids?: string[]; action?: string; value?: string }) {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500) : [];
  if (!ids.length) throw createError('Pilih minimal satu percakapan', 400);
  if (!body.value) throw createError('Nilai aksi wajib diisi', 400);
  const owned = await prisma.conversation.findMany({ where: { AND: [buildWhere(v, {}), { id: { in: ids } }] }, select: { id: true } });
  if (body.action === 'label') {
    const label = await prisma.label.findFirst({ where: { id: body.value, companyId: v.companyId } });
    if (!label) throw createError('Label tidak ditemukan', 404);
  }
  if (body.action === 'assign') {
    const user = await prisma.user.findFirst({ where: { id: body.value, companyId: v.companyId, isActive: true } });
    if (!user) throw createError('Agen tidak ditemukan', 404);
  }
  for (const { id } of owned) {
    if (body.action === 'status') await conversationService.updateStatus(v.companyId, id, body.value, v.userId);
    else if (body.action === 'assign') await conversationService.assignAgent(v.companyId, id, body.value);
    else if (body.action === 'label') await conversationService.addLabel(id, body.value);
    else throw createError('Aksi tidak dikenal', 400);
  }
  return { updated: owned.length };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Cegah CSV/formula injection saat dibuka di Excel.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

async function exportCsv(v: Viewer, q: Query) {
  const rows = await prisma.conversation.findMany({
    where: buildWhere(v, q),
    include: listInclude,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
  const head = ['ID', 'Kontak', 'Nomor', 'Kanal', 'Status', 'Ditangani', 'Agen', 'Label', 'Jumlah pesan',
    'Dibuat', 'Respons pertama (detik)', 'Ditutup', 'Durasi (detik)', 'Pesan terakhir'];
  const lines = rows.map(toRow).map(r => [
    r.id, r.contact.name, r.contact.phone, r.channel.name, r.status, r.handledBy ?? '-', r.agent?.name ?? '-',
    r.labels.map(l => l.name).join(', '), r.messageCount, r.createdAt.toISOString(), r.firstResponseSec ?? '',
    r.closedAt?.toISOString() ?? '', r.durationSec ?? '', r.lastMessage ?? '',
  ].map(csvCell).join(','));
  return `﻿${[head.join(','), ...lines].join('\r\n')}`;
}

// --- Router (di-mount di /conversations/manage) ---
const router = Router();
const viewer = (req: AuthRequest): Viewer => ({ companyId: req.user!.companyId, userId: req.user!.userId, role: req.user!.role });
const h = (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => { fn(req as AuthRequest, res).catch(next); };

router.get('/', h(async (req, res) => { res.json({ success: true, ...(await list(viewer(req), req.query as Query)) }); }));
router.get('/stats', h(async (req, res) => success(res, await stats(viewer(req), req.query as Query))));
router.get('/export', h(async (req, res) => {
  const csv = await exportCsv(viewer(req), req.query as Query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="conversations-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));
router.post('/bulk', authorize('OWNER', 'ADMIN'), h(async (req, res) => success(res, await bulk(viewer(req), req.body), 'Percakapan diperbarui')));
router.get('/:id', h(async (req, res) => success(res, await transcript(viewer(req), req.params.id))));

export default router;
