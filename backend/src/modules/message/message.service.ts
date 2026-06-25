import prisma from '../../config/database';
import { WhatsAppService } from '../channel/whatsapp.service';
import { whatsAppUnofficialService } from '../channel/whatsapp-unofficial.service';
import { createError } from '../../middlewares/error.middleware';
import { getIO } from '../../sockets/socket.server';

const whatsappService = new WhatsAppService();

export class MessageService {
  async getMessages(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: { sender: { select: { id: true, name: true, avatar: true } }, attachments: true },
        orderBy: { sentAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);
    return { messages, total, page, limit };
  }

  async sendMessage(companyId: string, conversationId: string, senderId: string, body: {
    type: string; content?: string; mediaUrl?: string; fileName?: string;
  }) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: { contact: true, channel: true },
    });
    if (!conversation) throw createError('Conversation not found', 404);

    const { type, content, mediaUrl, fileName } = body;
    const contact = conversation.contact;
    const phone = contact.phone;
    if (!phone) throw createError('Contact has no phone number', 400);

    const contactMeta = contact.metadata as { whatsappId?: string } | null;
    const whatsappId = contactMeta?.whatsappId;

    let wamid: string | undefined;

    try {
      if (conversation.channel.type === 'WHATSAPP_UNOFFICIAL') {
        const target = whatsappId || phone;
        if (type === 'TEXT' && content) {
          const res = await whatsAppUnofficialService.sendTextMessage(conversation.channelId, target, content);
          wamid = res.id;
        } else if (type === 'IMAGE' && mediaUrl) {
          const res = await whatsAppUnofficialService.sendImageMessage(conversation.channelId, target, mediaUrl, content);
          wamid = res.id;
        } else if (type === 'DOCUMENT' && mediaUrl && fileName) {
          const res = await whatsAppUnofficialService.sendDocumentMessage(conversation.channelId, target, mediaUrl, fileName, content);
          wamid = res.id;
        }
      } else {
        if (type === 'TEXT' && content) {
          const res = await whatsappService.sendTextMessage(conversation.channelId, phone, content);
          wamid = res.messages?.[0]?.id;
        } else if (type === 'IMAGE' && mediaUrl) {
          const res = await whatsappService.sendImageMessage(conversation.channelId, phone, mediaUrl, content);
          wamid = res.messages?.[0]?.id;
        } else if (type === 'DOCUMENT' && mediaUrl && fileName) {
          const res = await whatsappService.sendDocumentMessage(conversation.channelId, phone, mediaUrl, fileName, content);
          wamid = res.messages?.[0]?.id;
        }
      }
    } catch (err: any) {
      const msg = await prisma.message.create({
        data: { conversationId, senderId, direction: 'OUTBOUND', type: type as any, content, mediaUrl, fileName, wamid, status: 'FAILED' },
      });
      throw createError(`WhatsApp send failed: ${err.message}`, 502);
    }

    const message = await prisma.message.create({
      data: { conversationId, senderId, direction: 'OUTBOUND', type: type as any, content, mediaUrl, fileName, wamid, status: 'SENT' },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: content || fileName || 'Media', lastMessageAt: new Date() },
    });

    const io = getIO();
    io.to(`company:${companyId}`).emit('message:new', { conversationId, message });

    return message;
  }
}
