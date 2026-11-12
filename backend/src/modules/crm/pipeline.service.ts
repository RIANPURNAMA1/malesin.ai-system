import { Prisma, Deal, PipelineStage } from '@prisma/client';
import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';
import { getIO } from '../../sockets/socket.server';

export type Actor = 'SYSTEM' | 'AI' | 'USER';
export interface Viewer { companyId: string; userId: string; role: string }
export interface StageInput { id?: string; name: string; color?: string; kind: 'OPEN' | 'WON' | 'LOST'; autoRule?: string | null; aiHint?: string | null }

export const AUTO_RULES = ['FIRST_CHAT', 'REPLIED', 'INTEREST', 'PAYMENT_SENT'] as const;

/** Template default: alur program/kelas dari lead sampai closing. */
export const DEFAULT_STAGES: StageInput[] = [
  { name: 'Lead baru', color: '#94a3b8', kind: 'OPEN', autoRule: 'FIRST_CHAT', aiHint: 'Kontak baru yang baru pertama kali menghubungi dan belum dibalas.' },
  { name: 'Follow up', color: '#18a6fc', kind: 'OPEN', autoRule: 'REPLIED', aiHint: 'Sudah dibalas; pelanggan bertanya hal umum tentang produk/program (materi, fasilitas, info umum).' },
  { name: 'Tertarik', color: '#8b5cf6', kind: 'OPEN', autoRule: 'INTEREST', aiHint: 'Pelanggan menunjukkan niat membeli: menanyakan harga, jadwal, cara daftar, cara bayar, cicilan, promo, atau minta nomor rekening.' },
  { name: 'Menunggu pembayaran', color: '#f59e0b', kind: 'OPEN', autoRule: 'PAYMENT_SENT', aiHint: 'Info pembayaran (rekening, link bayar, VA, QRIS) sudah dikirim ke pelanggan dan sedang menunggu pembayaran.' },
  { name: 'Daftar / Closing', color: '#10b981', kind: 'WON', aiHint: 'Pembayaran sudah terkonfirmasi atau pelanggan resmi terdaftar.' },
  { name: 'Batal', color: '#ef4444', kind: 'LOST', aiHint: 'Pelanggan menolak dengan jelas (tidak jadi, terlalu mahal, pilih yang lain) atau tidak merespons.' },
];

const stagesOrder = { orderBy: { position: 'asc' as const } };

export function emitDeal(companyId: string, dealId: string, pipelineId: string) {
  try { getIO().to(`company:${companyId}`).emit('deal:updated', { dealId, pipelineId }); } catch { /* socket belum siap */ }
}

/** Pipeline default company; dibuat otomatis bila belum ada. */
export async function ensureDefaultPipeline(companyId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { companyId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { stages: stagesOrder },
  });
  if (existing) return existing;
  return prisma.pipeline.create({
    data: {
      companyId, name: 'Penjualan', isDefault: true,
      stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })) },
    },
    include: { stages: stagesOrder },
  });
}

/**
 * Inti perpindahan tahap — dipakai manual, sistem, maupun AI.
 * Status deal mengikuti jenis tahap (OPEN / WON / LOST) dan tercatat di riwayat.
 */
export async function changeStage(
  deal: Deal, stage: PipelineStage, actor: Actor,
  opts: { userId?: string; message?: string; lostReason?: string; metadata?: Record<string, unknown>; lockAi?: boolean } = {}
) {
  if (stage.id === deal.stageId) return deal;
  if (stage.pipelineId !== deal.pipelineId) throw createError('Tahap bukan milik pipeline deal ini', 400);
  const now = new Date();
  const status = stage.kind === 'WON' ? 'WON' : stage.kind === 'LOST' ? 'LOST' : 'OPEN';
  const [updated] = await prisma.$transaction([
    prisma.deal.update({
      where: { id: deal.id },
      data: {
        stageId: stage.id, status, stageEnteredAt: now, lastActivityAt: now, aiSuggestion: Prisma.DbNull,
        wonAt: status === 'WON' ? now : null,
        lostAt: status === 'LOST' ? now : null,
        lostReason: status === 'LOST' ? (opts.lostReason || deal.lostReason || null) : null,
        ...(opts.lockAi ? { aiLockedUntil: new Date(now.getTime() + 24 * 3_600_000) } : {}),
      },
    }),
    prisma.dealActivity.create({
      data: {
        dealId: deal.id, type: 'STAGE', actor, userId: opts.userId ?? null,
        fromStageId: deal.stageId, toStageId: stage.id,
        message: opts.message ?? (status === 'LOST' && opts.lostReason ? `Alasan: ${opts.lostReason}` : null),
        metadata: (opts.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    }),
  ]);
  emitDeal(deal.companyId, deal.id, deal.pipelineId);
  return updated;
}

function dealScope(v: Viewer): Prisma.DealWhereInput {
  // Agent hanya melihat deal miliknya + yang belum punya pemilik.
  return v.role === 'AGENT'
    ? { companyId: v.companyId, OR: [{ ownerId: v.userId }, { ownerId: null }] }
    : { companyId: v.companyId };
}

async function ownedDeal(v: Viewer, id: string) {
  const deal = await prisma.deal.findFirst({ where: { AND: [dealScope(v), { id }] } });
  if (!deal) throw createError('Deal tidak ditemukan', 404);
  return deal;
}

async function ownedPipeline(companyId: string, id: string) {
  const p = await prisma.pipeline.findFirst({ where: { id, companyId }, include: { stages: stagesOrder } });
  if (!p) throw createError('Pipeline tidak ditemukan', 404);
  return p;
}

async function assertUser(companyId: string, userId?: string | null) {
  if (!userId) return;
  const u = await prisma.user.findFirst({ where: { id: userId, companyId, isActive: true }, select: { id: true } });
  if (!u) throw createError('Pemilik deal tidak ditemukan', 404);
}

export const pipelineService = {
  async list(companyId: string) {
    await ensureDefaultPipeline(companyId);
    return prisma.pipeline.findMany({
      where: { companyId },
      include: { stages: stagesOrder, _count: { select: { deals: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  },

  async create(companyId: string, name: string) {
    if (!name?.trim()) throw createError('Nama pipeline wajib diisi', 400);
    return prisma.pipeline.create({
      data: { companyId, name: name.trim(), stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })) } },
      include: { stages: stagesOrder },
    });
  },

  async update(companyId: string, id: string, dto: { name?: string; autoMode?: string; autoCreateDeals?: boolean; lostAfterDays?: number; isDefault?: boolean }) {
    await ownedPipeline(companyId, id);
    if (dto.autoMode && !['AUTO', 'SUGGEST', 'MANUAL'].includes(dto.autoMode)) throw createError('Mode otomasi tidak valid', 400);
    const lost = dto.lostAfterDays === undefined ? undefined : Math.max(0, Math.min(365, Math.round(Number(dto.lostAfterDays) || 0)));
    return prisma.$transaction(async tx => {
      // Hanya satu pipeline default (dipakai otomasi chat masuk).
      if (dto.isDefault) await tx.pipeline.updateMany({ where: { companyId, NOT: { id } }, data: { isDefault: false } });
      return tx.pipeline.update({
        where: { id },
        data: {
          ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
          ...(dto.autoMode ? { autoMode: dto.autoMode } : {}),
          ...(typeof dto.autoCreateDeals === 'boolean' ? { autoCreateDeals: dto.autoCreateDeals } : {}),
          ...(lost !== undefined ? { lostAfterDays: lost } : {}),
          ...(dto.isDefault ? { isDefault: true } : {}),
        },
        include: { stages: stagesOrder },
      });
    });
  },

  async remove(companyId: string, id: string) {
    const p = await ownedPipeline(companyId, id);
    if (p.isDefault) throw createError('Pipeline default tidak bisa dihapus', 400);
    await prisma.pipeline.delete({ where: { id } });
  },

  /** Simpan ulang daftar tahap (urutan = posisi). Tahap yang masih berisi deal tidak boleh dihapus. */
  async saveStages(companyId: string, pipelineId: string, stages: StageInput[]) {
    const p = await ownedPipeline(companyId, pipelineId);
    if (!Array.isArray(stages) || stages.length < 3 || stages.length > 15) throw createError('Jumlah tahap 3–15', 400);
    if (stages.filter(s => s.kind === 'WON').length !== 1 || stages.filter(s => s.kind === 'LOST').length !== 1) {
      throw createError('Harus ada tepat satu tahap Menang dan satu tahap Kalah', 400);
    }
    if (!stages.some(s => s.kind === 'OPEN')) throw createError('Minimal satu tahap terbuka', 400);
    if (stages.some(s => !s.name?.trim())) throw createError('Nama tahap wajib diisi', 400);
    const rules = stages.map(s => s.autoRule).filter(Boolean);
    if (new Set(rules).size !== rules.length) throw createError('Aturan otomatis tidak boleh dipakai di dua tahap', 400);

    const keepIds = new Set(stages.map(s => s.id).filter(Boolean) as string[]);
    const removed = p.stages.filter(s => !keepIds.has(s.id));
    if (removed.length) {
      const used = await prisma.deal.count({ where: { stageId: { in: removed.map(s => s.id) } } });
      if (used) throw createError('Tahap yang masih berisi deal tidak bisa dihapus. Pindahkan deal-nya dulu.', 400);
    }
    await prisma.$transaction([
      prisma.pipelineStage.deleteMany({ where: { id: { in: removed.map(s => s.id) } } }),
      ...stages.map((s, i) => {
        const data = {
          name: s.name.trim(), color: s.color || '#18a6fc', position: i, kind: s.kind,
          autoRule: s.kind === 'OPEN' && s.autoRule && (AUTO_RULES as readonly string[]).includes(s.autoRule) ? s.autoRule : null,
          aiHint: s.aiHint?.trim() || null,
        };
        return s.id && p.stages.some(x => x.id === s.id)
          ? prisma.pipelineStage.update({ where: { id: s.id }, data })
          : prisma.pipelineStage.create({ data: { ...data, pipelineId } });
      }),
    ]);
    return ownedPipeline(companyId, pipelineId);
  },

  async board(v: Viewer, pipelineId: string, q: { search?: string; ownerId?: string }) {
    await ownedPipeline(v.companyId, pipelineId);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const s = q.search?.trim();
    return prisma.deal.findMany({
      where: {
        AND: [
          dealScope(v),
          { pipelineId },
          // Menang/kalah hanya 30 hari terakhir supaya papan tetap ringan.
          { OR: [{ status: 'OPEN' }, { updatedAt: { gte: since } }] },
          ...(q.ownerId ? [{ ownerId: q.ownerId === 'none' ? null : q.ownerId }] : []),
          ...(s ? [{ OR: [{ title: { contains: s } }, { contact: { name: { contains: s } } }, { contact: { phone: { contains: s } } }] }] : []),
        ],
      },
      include: {
        contact: { select: { id: true, name: true, phone: true, sourceChannel: true } },
        owner: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 1000,
    });
  },

  async createDeal(v: Viewer, dto: { contactId: string; pipelineId?: string; stageId?: string; title?: string; value?: number; ownerId?: string | null }) {
    const contact = await prisma.contact.findFirst({ where: { id: dto.contactId, companyId: v.companyId } });
    if (!contact) throw createError('Kontak tidak ditemukan', 404);
    const p = dto.pipelineId ? await ownedPipeline(v.companyId, dto.pipelineId) : await ensureDefaultPipeline(v.companyId);
    const stage = (dto.stageId && p.stages.find(s => s.id === dto.stageId)) || p.stages.find(s => s.kind === 'OPEN')!;
    const ownerId = v.role === 'AGENT' ? v.userId : dto.ownerId ?? v.userId;
    await assertUser(v.companyId, ownerId);
    const deal = await prisma.deal.create({
      data: {
        companyId: v.companyId, pipelineId: p.id, stageId: stage.id, contactId: contact.id, ownerId,
        title: dto.title?.trim() || contact.name, value: Math.max(0, Math.round(Number(dto.value) || 0)),
        status: stage.kind === 'WON' ? 'WON' : stage.kind === 'LOST' ? 'LOST' : 'OPEN',
        activities: { create: { type: 'CREATED', actor: 'USER', userId: v.userId, toStageId: stage.id, message: 'Deal dibuat manual' } },
      },
    });
    emitDeal(v.companyId, deal.id, p.id);
    return deal;
  },

  /** Deal terbaru milik kontak (untuk menu di Inbox). */
  async dealForContact(v: Viewer, contactId: string) {
    const find = (extra: Prisma.DealWhereInput) => prisma.deal.findFirst({
      where: { AND: [dealScope(v), { contactId }, extra] },
      orderBy: { createdAt: 'desc' },
      include: { stage: { select: { name: true, color: true } } },
    });
    // Deal terbuka didahulukan; kalau tidak ada, deal terakhir (menang/kalah).
    return (await find({ status: 'OPEN' })) ?? find({});
  },

  async getDeal(v: Viewer, id: string) {
    const deal = await prisma.deal.findFirst({
      where: { AND: [dealScope(v), { id }] },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, sourceChannel: true } },
        owner: { select: { id: true, name: true } },
        stage: true,
        pipeline: { include: { stages: stagesOrder } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!deal) throw createError('Deal tidak ditemukan', 404);
    const [conversation, users] = await Promise.all([
      prisma.conversation.findFirst({ where: { contactId: deal.contactId, companyId: v.companyId }, orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } }, select: { id: true } }),
      prisma.user.findMany({ where: { id: { in: deal.activities.map(a => a.userId).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    ]);
    const userName = new Map(users.map(u => [u.id, u.name]));
    return {
      ...deal,
      conversationId: conversation?.id ?? null,
      activities: deal.activities.map(a => ({ ...a, userName: a.userId ? userName.get(a.userId) ?? null : null })),
    };
  },

  async updateDeal(v: Viewer, id: string, dto: { title?: string; value?: number; ownerId?: string | null; expectedCloseAt?: string | null }) {
    const deal = await ownedDeal(v, id);
    if (dto.ownerId !== undefined && v.role !== 'AGENT') await assertUser(v.companyId, dto.ownerId);
    const changes: string[] = [];
    const data: Prisma.DealUncheckedUpdateInput = {};
    if (dto.title?.trim() && dto.title.trim() !== deal.title) { data.title = dto.title.trim(); changes.push('judul'); }
    if (dto.value !== undefined && Math.round(Number(dto.value) || 0) !== deal.value) { data.value = Math.max(0, Math.round(Number(dto.value) || 0)); changes.push('nilai'); }
    if (dto.ownerId !== undefined && v.role !== 'AGENT' && dto.ownerId !== deal.ownerId) { data.ownerId = dto.ownerId || null; changes.push('pemilik'); }
    if (dto.expectedCloseAt !== undefined) { data.expectedCloseAt = dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null; changes.push('perkiraan closing'); }
    if (!changes.length) return deal;
    const [updated] = await prisma.$transaction([
      prisma.deal.update({ where: { id }, data }),
      prisma.dealActivity.create({ data: { dealId: id, type: 'UPDATE', actor: 'USER', userId: v.userId, message: `Mengubah ${changes.join(', ')}` } }),
    ]);
    emitDeal(v.companyId, id, deal.pipelineId);
    return updated;
  },

  async moveDeal(v: Viewer, id: string, stageId: string, lostReason?: string) {
    const deal = await ownedDeal(v, id);
    const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: deal.pipelineId } });
    if (!stage) throw createError('Tahap tidak ditemukan', 404);
    if (stage.kind === 'LOST' && !lostReason?.trim()) throw createError('Alasan kalah wajib diisi', 400);
    // Dipindah manual → AI tidak menimpa selama 24 jam.
    return changeStage(deal, stage, 'USER', { userId: v.userId, lostReason: lostReason?.trim(), lockAi: true });
  },

  async respondSuggestion(v: Viewer, id: string, accept: boolean) {
    const deal = await ownedDeal(v, id);
    const sug = deal.aiSuggestion as { stageId?: string; reason?: string; confidence?: number } | null;
    if (!sug?.stageId) throw createError('Tidak ada saran AI', 400);
    if (!accept) {
      await prisma.$transaction([
        prisma.deal.update({ where: { id }, data: { aiSuggestion: Prisma.DbNull, aiLockedUntil: new Date(Date.now() + 24 * 3_600_000) } }),
        prisma.dealActivity.create({ data: { dealId: id, type: 'SUGGESTION', actor: 'USER', userId: v.userId, toStageId: sug.stageId, message: 'Saran AI ditolak' } }),
      ]);
      emitDeal(v.companyId, id, deal.pipelineId);
      return { accepted: false };
    }
    const stage = await prisma.pipelineStage.findFirst({ where: { id: sug.stageId, pipelineId: deal.pipelineId } });
    if (!stage) throw createError('Tahap saran sudah tidak ada', 400);
    await changeStage(deal, stage, 'USER', {
      userId: v.userId, lockAi: true,
      lostReason: stage.kind === 'LOST' ? sug.reason : undefined,
      message: `Saran AI diterima${sug.reason ? `: ${sug.reason}` : ''}`,
    });
    return { accepted: true };
  },

  async addNote(v: Viewer, id: string, text: string) {
    const deal = await ownedDeal(v, id);
    if (!text?.trim()) throw createError('Catatan kosong', 400);
    const note = await prisma.dealActivity.create({ data: { dealId: id, type: 'NOTE', actor: 'USER', userId: v.userId, message: text.trim().slice(0, 2000) } });
    emitDeal(v.companyId, id, deal.pipelineId);
    return note;
  },

  async deleteDeal(v: Viewer, id: string) {
    const deal = await ownedDeal(v, id);
    await prisma.deal.delete({ where: { id } });
    emitDeal(v.companyId, id, deal.pipelineId);
  },
};
