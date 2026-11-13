import { Request, Response } from 'express';
import prisma from '../../config/database';
import { contactService } from '../contact/contact.routes';
import { ConversationService } from '../conversation/conversation.service';
import { getIO } from '../../sockets/socket.server';
import logger from '../../utils/logger';
import { aiAutoReplyService } from '../ai-agent/ai-auto-reply.service';
import { applyMessageStatus } from '../message/message-status';

const conversationService = new ConversationService();

interface WAMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type: string };
  video?: { id: string; caption?: string; mime_type: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; caption?: string; filename: string; mime_type: string };
  reaction?: { message_id: string; emoji: string };
}

export async function handleWebhookGet(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe') {
    // Find channel with matching verifyToken
    const channel = await prisma.channel.findFirst({ where: { verifyToken: token as string } });
    if (channel) {
      logger.info(`Webhook verified for channel ${channel.id}`);
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
}

export async function handleWebhookPost(req: Request, res: Response) {
  // Respond immediately to Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        const channel = await prisma.channel.findFirst({ where: { phoneNumberId } });
        if (!channel) continue;

        // Handle status updates
        // Status centang (sent/delivered/read/failed) → realtime ke frontend.
        for (const status of value.statuses || []) {
          const mapped = ({ sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' } as const)[
            status.status as 'sent' | 'delivered' | 'read' | 'failed'
          ];
          if (!status.id || !mapped) continue;
          await applyMessageStatus(channel.companyId, status.id, mapped).catch(err =>
            logger.warn(`Gagal update status pesan ${status.id}`, err)
          );
        }

        // Handle incoming messages
        for (const waMsg of (value.messages || []) as WAMessage[]) {
          await processIncomingMessage(channel.id, channel.companyId, waMsg);
        }
      }
    }
  } catch (err) {
    logger.error('Webhook processing error', err);
  }
}

async function processIncomingMessage(channelId: string, companyId: string, waMsg: WAMessage) {
  const phone = waMsg.from;
  const senderName = waMsg.from; // WhatsApp doesn't send name in webhook

  // Upsert contact
  const contact = await contactService.upsertByPhone(companyId, phone, {
    sourceChannel: 'WHATSAPP',
  });

  // Find or create conversation
  const conversation = await conversationService.findOrCreateByContact(companyId, channelId, contact.id);

  // Build message data
  let type: string = waMsg.type.toUpperCase();
  if (!['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'REACTION'].includes(type)) {
    type = 'TEXT';
  }

  let content: string | undefined;
  let mediaUrl: string | undefined;
  let fileName: string | undefined;
  let reactionEmoji: string | undefined;

  if (waMsg.text) content = waMsg.text.body;
  if (waMsg.image) { content = waMsg.image.caption; }
  if (waMsg.video) { content = waMsg.video.caption; }
  if (waMsg.audio) { /* audio */ }
  if (waMsg.document) { content = waMsg.document.caption; fileName = waMsg.document.filename; }
  if (waMsg.reaction) { reactionEmoji = waMsg.reaction.emoji; content = waMsg.reaction.emoji; }

  // Check for duplicate
  const existing = await prisma.message.findUnique({ where: { wamid: waMsg.id } });
  if (existing) return;

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: type as any,
      content,
      mediaUrl,
      fileName,
      reactionEmoji,
      wamid: waMsg.id,
      status: 'DELIVERED',
    },
    include: { attachments: true },
  });

  // Update conversation
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content || fileName || 'Media',
      lastMessageAt: new Date(),
      isRead: false,
      status: 'OPEN',
    },
  });

  // Update contact message count
  await prisma.contact.update({ where: { id: contact.id }, data: { totalMessages: { increment: 1 } } });

  // Emit real-time event
  const io = getIO();
  const fullConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: {
      contact: true,
      channel: { select: { id: true, name: true, type: true } },
      labels: { include: { label: true } },
      assignments: { where: { unassignedAt: null }, include: { user: { select: { id: true, name: true } } } },
      _count: { select: { messages: { where: { isRead: false, direction: 'INBOUND' } } } },
    },
  });

  io.to(`company:${companyId}`).emit('message:new', { conversationId: conversation.id, message });
  io.to(`company:${companyId}`).emit('conversation:updated', fullConversation);
  io.to(`company:${companyId}`).emit('notification', {
    type: 'NEW_MESSAGE',
    title: `Pesan baru dari ${contact.name}`,
    body: content || 'Media message',
    conversationId: conversation.id,
  });

  // Auto-reply AI Agent (hanya pesan teks masuk, bukan grup). Dijalankan di
  // background supaya webhook tetap cepat walaupun provider AI lambat.
  void import('../crm/pipeline.automation')
    .then(m => m.onInbound({ companyId, contactId: contact.id, conversationId: conversation.id, text: content }))
    .catch(() => undefined);

  if (waMsg.type === 'text' && content?.trim()) {
    // Keyword STOP/MULAI ditangani sistem broadcast; AI tidak ikut membalas.
    const { handleBroadcastInbound } = await import('../broadcast/broadcast.inbound');
    if (await handleBroadcastInbound({ companyId, contactId: contact.id, conversationId: conversation.id, text: content })) return;
    void aiAutoReplyService
      .maybeAutoReply({
        companyId,
        channelId,
        conversationId: conversation.id,
        text: content,
        remoteJid: waMsg.from,
      })
      .catch(err => logger.error('AI auto-reply failed', err));
  }
}
