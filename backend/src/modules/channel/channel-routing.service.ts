import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';
import logger from '../../utils/logger';

/** Pengaturan routing per kanal, disimpan di `channel.metadata.routing`. */
export interface RoutingSettings {
  agentIds: string[];
  distribution: 'LEAST_ENGAGED' | 'ROUND_ROBIN';
  maxPerAgent: number | null;
  preferredAgent: boolean;
  reassignOffline: boolean;
}

export function routingOf(metadata: unknown): RoutingSettings {
  const r = ((metadata as any)?.routing ?? {}) as Partial<RoutingSettings>;
  return {
    agentIds: Array.isArray(r.agentIds) ? r.agentIds.filter(id => typeof id === 'string') : [],
    distribution: r.distribution === 'ROUND_ROBIN' ? 'ROUND_ROBIN' : 'LEAST_ENGAGED',
    maxPerAgent: Number(r.maxPerAgent) > 0 ? Number(r.maxPerAgent) : null,
    preferredAgent: !!r.preferredAgent,
    reassignOffline: !!r.reassignOffline,
  };
}

async function isOnline(userId: string): Promise<boolean> {
  try {
    return (await getIO().in(`user:${userId}`).fetchSockets()).length > 0;
  } catch {
    return true; // socket belum siap: jangan blokir penugasan
  }
}

/**
 * Tugaskan percakapan ke agen manusia sesuai pengaturan kanal.
 * Mengembalikan userId yang dipilih, atau null kalau tidak ada yang memenuhi.
 */
export async function autoAssign(conversationId: string, excludeUserId?: string): Promise<string | null> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { companyId: true, channelId: true, contactId: true, channel: { select: { metadata: true } } },
  });
  if (!conv) return null;
  const r = routingOf(conv.channel.metadata);
  if (!r.agentIds.length) return null;

  const users = await prisma.user.findMany({
    where: { companyId: conv.companyId, id: { in: r.agentIds }, isActive: true },
    select: { id: true },
  });
  let candidates = users.map(u => u.id).filter(id => id !== excludeUserId);
  if (r.reassignOffline) {
    const online = await Promise.all(candidates.map(isOnline));
    candidates = candidates.filter((_, i) => online[i]);
  }

  // Jumlah chat aktif per agen untuk batas maksimum & "paling sedikit".
  const load = new Map(candidates.map(id => [id, 0]));
  const active = await prisma.assignment.groupBy({
    by: ['userId'],
    where: { userId: { in: candidates }, unassignedAt: null, conversation: { status: { in: ['OPEN', 'PENDING'] } } },
    _count: { _all: true },
  });
  active.forEach(a => load.set(a.userId, a._count._all));
  const available = candidates.filter(id => r.maxPerAgent === null || (load.get(id) ?? 0) < r.maxPerAgent);
  if (!available.length) return null;

  let pick: string | undefined;
  if (r.preferredAgent) {
    const last = await prisma.assignment.findFirst({
      where: { userId: { in: available }, conversation: { channelId: conv.channelId, contactId: conv.contactId, id: { not: conversationId } } },
      orderBy: { assignedAt: 'desc' },
      select: { userId: true },
    });
    pick = last?.userId;
  }
  if (!pick && r.distribution === 'ROUND_ROBIN') {
    const last = await prisma.assignment.findFirst({
      where: { conversation: { channelId: conv.channelId }, userId: { in: r.agentIds } },
      orderBy: { assignedAt: 'desc' },
      select: { userId: true },
    });
    const start = last ? r.agentIds.indexOf(last.userId) : -1;
    for (let i = 1; i <= r.agentIds.length && !pick; i++) {
      const id = r.agentIds[(start + i) % r.agentIds.length];
      if (available.includes(id)) pick = id;
    }
  }
  pick ??= available.reduce((a, b) => ((load.get(b) ?? 0) < (load.get(a) ?? 0) ? b : a));

  await prisma.assignment.updateMany({ where: { conversationId, unassignedAt: null }, data: { unassignedAt: new Date() } });
  await prisma.assignment.create({ data: { conversationId, userId: pick } });
  return pick;
}

/**
 * Dipanggil saat socket agen putus. Diberi jeda supaya refresh halaman tidak
 * dianggap offline; kalau setelah jeda masih offline, chat aktifnya dialihkan.
 */
export function scheduleOfflineReassign(userId: string, delayMs = 60_000) {
  setTimeout(async () => {
    try {
      if (await isOnline(userId)) return;
      const assignments = await prisma.assignment.findMany({
        where: { userId, unassignedAt: null, conversation: { status: { in: ['OPEN', 'PENDING'] } } },
        select: { conversationId: true, conversation: { select: { companyId: true, channel: { select: { metadata: true } } } } },
      });
      for (const a of assignments) {
        if (!routingOf(a.conversation.channel.metadata).reassignOffline) continue;
        const to = await autoAssign(a.conversationId, userId);
        if (to) getIO().to(`company:${a.conversation.companyId}`).emit('conversation:reassigned', { conversationId: a.conversationId, userId: to });
      }
    } catch (err) {
      logger.warn(`Gagal reassign chat agen offline ${userId}`, err);
    }
  }, delayMs);
}
