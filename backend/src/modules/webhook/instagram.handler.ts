import { Request, Response } from 'express';
import prisma from '../../config/database';
import { contactService } from '../contact/contact.routes';
import { ConversationService } from '../conversation/conversation.service';
import { getIO } from '../../sockets/socket.server';
import logger from '../../utils/logger';

const conversationService = new ConversationService();

export async function handleInstagramWebhookGet(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[IG WEBHOOK GET] mode:', mode, 'token:', token);

  if (mode === 'subscribe') {
    const channel = await prisma.channel.findFirst({
      where: { type: 'INSTAGRAM', verifyToken: token as string },
    });
    if (channel) {
      console.log('[IG WEBHOOK] Verified OK for channel', channel.id);
      return res.status(200).send(challenge);
    }
    console.log('[IG WEBHOOK] No channel found for token:', token);
    return res.sendStatus(403);
  }
  res.sendStatus(400);
}

export async function handleInstagramWebhookPost(req: Request, res: Response) {
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('[IG WEBHOOK POST] Received body:', JSON.stringify(body).substring(0, 2000));

    if (body.object !== 'instagram') {
      console.log('[IG WEBHOOK] Not instagram object:', body.object);
      return;
    }

    for (const entry of body.entry || []) {
      console.log('[IG WEBHOOK] Entry id:', entry.id, 'keys:', Object.keys(entry));

      const igAccountId = entry.id;
      const channel = await prisma.channel.findFirst({
        where: { type: 'INSTAGRAM', wabaId: igAccountId },
      });

      if (!channel) {
        console.log('[IG WEBHOOK] No channel found for igAccountId:', igAccountId);
        const allIg = await prisma.channel.findMany({ where: { type: 'INSTAGRAM' } });
        console.log('[IG WEBHOOK] Available IG channels:', allIg.map(c => ({ id: c.id, wabaId: c.wabaId, name: c.name })));
        continue;
      }

      console.log('[IG WEBHOOK] Found channel:', channel.id, channel.name);

      // Try messaging format
      const messagingList = entry.messaging || [];
      console.log('[IG WEBHOOK] messaging entries:', messagingList.length);

      for (const messaging of messagingList) {
        console.log('[IG WEBHOOK] Messaging:', JSON.stringify(messaging).substring(0, 500));
        const senderId = messaging.sender?.id;
        const message = messaging.message;
        if (!senderId || !message) {
          console.log('[IG WEBHOOK] Skip - no sender or message');
          continue;
        }

        await processIgMessage(channel, senderId, message);
      }

      // Try changes format (alternate webhook format)
      const changes = entry.changes || [];
      console.log('[IG WEBHOOK] changes entries:', changes.length);

      for (const change of changes) {
        console.log('[IG WEBHOOK] Change field:', change.field, 'value:', JSON.stringify(change.value).substring(0, 500));
        if (change.field === 'messages') {
          const val = change.value;
          const senderId = val?.sender?.id || val?.from?.id;
          const message = val?.message;
          if (senderId && message) {
            await processIgMessage(channel, senderId, message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[IG WEBHOOK ERROR]', err);
    logger.error('Instagram webhook processing error', err);
  }
}

async function processIgMessage(channel: any, senderId: string, message: any) {
  console.log('[IG WEBHOOK] Processing message from:', senderId, 'msg:', JSON.stringify(message).substring(0, 300));

  const contact = await contactService.upsertByPhone(channel.companyId, senderId, {
    name: senderId,
    sourceChannel: 'INSTAGRAM',
  });

  const conversation = await conversationService.findOrCreateByContact(
    channel.companyId, channel.id, contact.id
  );

  const wamid = message.mid || message.id;
  if (!wamid) {
    console.log('[IG WEBHOOK] No message id, skip');
    return;
  }

  const existing = await prisma.message.findUnique({ where: { wamid } });
  if (existing) {
    console.log('[IG WEBHOOK] Duplicate message, skip');
    return;
  }

  let type = 'TEXT';
  let content: string | undefined;
  let mediaUrl: string | undefined;
  let fileName: string | undefined;

  if (message.text) {
    content = typeof message.text === 'string' ? message.text : message.text.body || message.text.text;
    console.log('[IG WEBHOOK] Text content:', content);
  } else if (message.attachments) {
    const att = message.attachments[0];
    if (att) {
      if (att.type === 'image') { type = 'IMAGE'; mediaUrl = att.payload?.url; content = att.payload?.sticker_id ? undefined : att.title; }
      else if (att.type === 'video') { type = 'VIDEO'; mediaUrl = att.payload?.url; }
      else if (att.type === 'audio') { type = 'AUDIO'; mediaUrl = att.payload?.url; }
      else if (att.type === 'file') { type = 'DOCUMENT'; mediaUrl = att.payload?.url; fileName = att.payload?.filename || att.title; }
    }
  } else if (message.sticker) {
    type = 'IMAGE';
    mediaUrl = message.sticker;
  }

  const newMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: type as any,
      content,
      mediaUrl,
      fileName,
      wamid,
      status: 'DELIVERED',
    },
  });

  console.log('[IG WEBHOOK] Message saved:', newMessage.id, content);

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content || fileName || 'Media',
      lastMessageAt: new Date(),
      isRead: false,
      status: 'OPEN',
    },
  });

  await prisma.contact.update({
    where: { id: contact.id },
    data: { totalMessages: { increment: 1 } },
  });

  const io = getIO();
  const fullConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: {
      contact: true,
      channel: { select: { id: true, name: true, type: true } },
      labels: { include: { label: true } },
      assignments: {
        where: { unassignedAt: null },
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { messages: { where: { isRead: false, direction: 'INBOUND' } } } },
    },
  });

  io.to(`company:${channel.companyId}`).emit('message:new', {
    conversationId: conversation.id,
    message: newMessage,
  });
  io.to(`company:${channel.companyId}`).emit('conversation:updated', fullConversation);
  io.to(`company:${channel.companyId}`).emit('notification', {
    type: 'NEW_MESSAGE',
    title: `New message from ${contact.name}`,
    body: content || 'Media message',
    conversationId: conversation.id,
  });

  console.log('[IG WEBHOOK] Done processing, socket emitted');
}
