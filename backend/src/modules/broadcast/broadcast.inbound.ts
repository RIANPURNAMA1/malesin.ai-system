import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import logger from '../../utils/logger';
import { MessageService } from '../message/message.service';
import { OPT_IN_RE, OPT_OUT_RE, consentOf, withConsent } from './broadcast.policy';
import { checkBroadcastRisk } from './broadcast.engine';

const messageService = new MessageService();
const REPLY_WINDOW_MS = 72 * 3_600_000;

/**
 * Opt-out automation + pelacakan respons campaign untuk setiap pesan masuk.
 * Return true bila pesan adalah keyword STOP/MULAI (sudah dibalas sistem,
 * jadi AI tidak perlu membalas).
 */
export async function handleBroadcastInbound(input: {
  companyId: string;
  contactId: string;
  conversationId: string;
  text?: string | null;
}): Promise<boolean> {
  try {
    const text = input.text ?? '';
    const contact = await prisma.contact.findUnique({ where: { id: input.contactId }, select: { metadata: true } });
    if (!contact) return false;

    if (OPT_OUT_RE.test(text)) {
      const now = new Date();
      await prisma.contact.update({
        where: { id: input.contactId },
        data: { metadata: withConsent(contact.metadata, { status: 'OPTED_OUT', unsubscribedAt: now.toISOString() }) as Prisma.InputJsonValue },
      });
      // Atribusikan ke campaign terakhir yang dikirim ke kontak ini (30 hari).
      const last = await prisma.broadcastRecipient.findFirst({
        where: { contactId: input.contactId, status: 'SENT', optedOutAt: null, sentAt: { gte: new Date(Date.now() - 30 * 24 * 3_600_000) } },
        orderBy: { sentAt: 'desc' },
      });
      if (last) {
        await prisma.$transaction([
          prisma.broadcastRecipient.update({ where: { id: last.id }, data: { optedOutAt: now } }),
          prisma.broadcast.update({ where: { id: last.broadcastId }, data: { optOutCount: { increment: 1 } } }),
        ]);
        await checkBroadcastRisk(last.broadcastId);
      }
      await messageService.sendMessage(input.companyId, input.conversationId, null, {
        type: 'TEXT',
        content: 'Baik, Anda tidak akan menerima pesan broadcast dari kami lagi. Balas MULAI kapan saja untuk berlangganan kembali.',
      }).catch(() => undefined);
      return true;
    }

    if (OPT_IN_RE.test(text)) {
      await prisma.contact.update({
        where: { id: input.contactId },
        data: {
          metadata: withConsent(contact.metadata, {
            status: 'OPTED_IN', source: 'Keyword WhatsApp', category: consentOf(contact.metadata).category || 'Marketing',
            consentAt: new Date().toISOString(), unsubscribedAt: undefined,
          }) as Prisma.InputJsonValue,
        },
      });
      await messageService.sendMessage(input.companyId, input.conversationId, null, {
        type: 'TEXT',
        content: 'Terima kasih! Anda akan menerima informasi terbaru dari kami. Balas STOP kapan saja untuk berhenti.',
      }).catch(() => undefined);
      return true;
    }

    // Respons pertama terhadap campaign dalam 72 jam.
    const recent = await prisma.broadcastRecipient.findFirst({
      where: { contactId: input.contactId, status: 'SENT', repliedAt: null, sentAt: { gte: new Date(Date.now() - REPLY_WINDOW_MS) } },
      orderBy: { sentAt: 'desc' },
    });
    if (recent) {
      await prisma.$transaction([
        prisma.broadcastRecipient.update({ where: { id: recent.id }, data: { repliedAt: new Date() } }),
        prisma.broadcast.update({ where: { id: recent.broadcastId }, data: { repliedCount: { increment: 1 } } }),
      ]);
    }
  } catch (err) {
    logger.error('Broadcast inbound handling failed', err);
  }
  return false;
}
