import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';

export type OutboundStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

/** Urutan centang: status hanya boleh naik (event WhatsApp bisa datang tidak berurutan). */
const RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/**
 * Perbarui status pesan keluar (centang 1 / centang 2 / dibaca) berdasarkan ID
 * pesan WhatsApp, lalu kirim ke frontend secara realtime lewat `message:status`.
 */
export async function applyMessageStatus(companyId: string, wamid: string, status: OutboundStatus) {
  const existing = await prisma.message.findUnique({
    where: { wamid },
    select: { id: true, conversationId: true, status: true, deliveredAt: true },
  });
  if (!existing || existing.status === status) return;
  // Jangan turunkan status (mis. READ tertimpa DELIVERED yang telat datang).
  if (status !== 'FAILED' && (RANK[existing.status] ?? 0) > RANK[status]) return;
  if (status === 'FAILED' && existing.status === 'READ') return;

  const now = new Date();
  await prisma.message.update({
    where: { id: existing.id },
    data: {
      status,
      ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
      // Dibaca berarti juga sudah sampai.
      ...(status === 'READ' ? { readAt: now, ...(existing.deliveredAt ? {} : { deliveredAt: now }) } : {}),
    },
  });

  getIO().to(`company:${companyId}`).emit('message:status', {
    conversationId: existing.conversationId,
    messageId: existing.id,
    status,
  });
}
