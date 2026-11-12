import prisma from '../../config/database';

/** Asal pesan keluar, disimpan di message.metadata.source. */
export type MessageSource = 'AI' | 'AGENT' | 'BROADCAST' | 'SYSTEM' | 'DEVICE';

/**
 * Catat metrik percakapan setiap ada pesan keluar:
 * - firstResponseAt: balasan pertama (bukan broadcast/sistem).
 * - handledBy: AI bila dibalas AI; HUMAN bila agen / HP membalas (menimpa AI).
 * - handedToHumanAt: balasan manusia pertama (serah terima AI → agen).
 */
export async function trackOutbound(conversationId: string, source: MessageSource, content?: string | null) {
  if (source === 'BROADCAST' || source === 'SYSTEM') return;
  // Otomasi pipeline CRM (dibalas / info pembayaran dikirim). Dynamic import: hindari circular.
  void import('../crm/pipeline.automation').then(m => m.onOutbound(conversationId, content)).catch(() => undefined);
  const human = source === 'AGENT' || source === 'DEVICE';
  const now = new Date();
  await prisma.$transaction([
    prisma.conversation.updateMany({ where: { id: conversationId, firstResponseAt: null }, data: { firstResponseAt: now } }),
    ...(human
      ? [
          prisma.conversation.updateMany({ where: { id: conversationId, NOT: { handledBy: 'HUMAN' } }, data: { handledBy: 'HUMAN' } }),
          prisma.conversation.updateMany({ where: { id: conversationId, handedToHumanAt: null }, data: { handedToHumanAt: now } }),
        ]
      : [prisma.conversation.updateMany({ where: { id: conversationId, handledBy: null }, data: { handledBy: 'AI' } })]),
  ]);
}
