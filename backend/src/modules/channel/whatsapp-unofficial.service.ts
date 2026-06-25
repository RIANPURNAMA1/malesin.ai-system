import { Client, Message as WAMessage, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';
import { contactService } from '../contact/contact.routes';
import { ConversationService } from '../conversation/conversation.service';
import logger from '../../utils/logger';

puppeteer.use(StealthPlugin());

const conversationService = new ConversationService();

let sharedBrowser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
let browserRefCount = 0;

async function getBrowserWsEndpoint() {
  browserRefCount++;
  if (sharedBrowser?.connected) return sharedBrowser.wsEndpoint();
  const { executablePath: getChromePath } = await import('puppeteer');
  sharedBrowser = await puppeteer.launch({
    headless: true,
    executablePath: await getChromePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--window-size=800,600',
    ],
  });
  return sharedBrowser.wsEndpoint();
}

async function releaseBrowser() {
  browserRefCount--;
  if (browserRefCount <= 0 && sharedBrowser) {
    try { await sharedBrowser.close(); } catch {}
    sharedBrowser = null;
    browserRefCount = 0;
  }
}

interface ClientInstance {
  client: Client;
  channelId: string;
  companyId: string;
}

class WhatsAppUnofficialService {
  private clients: Map<string, ClientInstance> = new Map();

  async initialize(channelId: string, companyId: string, userId: string) {
    const existing = this.clients.get(channelId);
    if (existing) {
      try { await existing.client.destroy(); } catch {}
      this.clients.delete(channelId);
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');

    const io = getIO();
    const wsEndpoint = await getBrowserWsEndpoint();

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: channelId }),
      puppeteer: { browserWSEndpoint: wsEndpoint },
    });

    client.on('qr', async (qr: string) => {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        io.to(`user:${userId}`).emit('wa-unofficial:qr', { channelId, qr: qrDataUrl });
      } catch (err) {
        logger.error('QR generation error', err);
      }
    });

    client.on('ready', () => {
      logger.info(`WhatsApp Unofficial ready: ${channelId}`);
      io.to(`user:${userId}`).emit('wa-unofficial:ready', { channelId });
      io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'connected' });
      // Sync contacts setelah koneksi sukses
      void this.syncContacts(channelId, companyId);
    });

    client.on('disconnected', (reason: string) => {
      logger.warn(`WhatsApp Unofficial disconnected: ${channelId} reason: ${reason}`);
      this.clients.delete(channelId);
      releaseBrowser();
      io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
    });

    client.on('message', async (msg: WAMessage) => {
      await this.handleIncomingMessage(channelId, companyId, msg);
    });

    const instance: ClientInstance = { client, channelId, companyId };
    this.clients.set(channelId, instance);

    try {
      await Promise.race([
        client.initialize(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout initializing WhatsApp client (90s)')), 90000)
        ),
      ]);
    } catch (err) {
      this.clients.delete(channelId);
      releaseBrowser();
      const errorMsg = err instanceof Error ? err.message : 'Gagal initialize WhatsApp client';
      io.to(`user:${userId}`).emit('wa-unofficial:error', { channelId, error: errorMsg });
      throw err;
    }
  }

  private normalizePhone(num: string | undefined | null): string | null {
    if (!num) return null;
    const digits = num.replace(/\D/g, '');
    if (/^62\d{8,13}$/.test(digits)) return digits;
    if (/^0\d{9,13}$/.test(digits)) return `62${digits.slice(1)}`;
    if (/^8\d{8,13}$/.test(digits)) return `62${digits}`;
    if (/^\d{10,15}$/.test(digits)) return digits;
    return null;
  }

  private extractPhoneOrLid(raw: string): { lid?: string; phone?: string } {
    const cleaned = raw.replace(/@(c\.us|s\.whatsapp\.net|lid|g\.us|broadcast)$/, '');
    const server = raw.includes('@lid') ? 'lid' : raw.includes('@c.us') || raw.includes('@s.whatsapp.net') ? 'c.us' : 'unknown';
    if (server === 'lid') return { lid: cleaned };
    return { phone: cleaned };
  }

  async handleIncomingMessage(channelId: string, companyId: string, msg: WAMessage) {
    try {
      const rawId = msg.from;
      const senderName = (msg as any)._data?.notifyName || '';

      const waContact = await msg.getContact();
      const rawNumber = waContact.number;

      // Normalisasi nomor: WhatsApp kadang return tanpa country code (8169044586717)
      // atau LID user ID (26332528402659). Deteksi dan perbaiki otomatis.
      const normalized = this.normalizePhone(rawNumber);
      const isLikelyPhone = !!normalized;
      const phone = normalized || (() => {
        const extracted = this.extractPhoneOrLid(rawId);
        return extracted.phone || extracted.lid || rawId;
      })();

      const realWhatsAppId = normalized ? `${normalized}@c.us` : null;
      const metadataWhatsAppId = realWhatsAppId || rawId;
      const metadata: Record<string, unknown> = { whatsappId: metadataWhatsAppId };

      // Cari kontak existing — prioritas: WhatsApp ID asli > LID lama > pushname
      const existingByMeta = realWhatsAppId
        ? await prisma.contact.findFirst({
            where: { companyId, metadata: { path: '$.whatsappId', equals: realWhatsAppId } },
          })
        : null;
      const existingByLid = !existingByMeta
        ? await prisma.contact.findFirst({
            where: { companyId, metadata: { path: '$.whatsappId', equals: rawId } },
          })
        : null;
      const existingByName = !existingByMeta && !existingByLid && senderName
        ? await prisma.contact.findFirst({
            where: { companyId, name: senderName, sourceChannel: 'WHATSAPP_UNOFFICIAL' },
          })
        : null;
      const existingContact = existingByMeta || existingByLid || existingByName;

      let dbContact;
      if (existingContact) {
        dbContact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            phone,
            name: senderName || phone,
            metadata: metadata as any,
            totalMessages: { increment: 1 },
          },
        });
      } else if (isLikelyPhone) {
        dbContact = await contactService.upsertByPhone(companyId, phone, {
          name: senderName || phone,
          sourceChannel: 'WHATSAPP_UNOFFICIAL',
        });
        await prisma.contact.update({
          where: { id: dbContact.id },
          data: { metadata: metadata as any },
        });
      } else {
        dbContact = await contactService.upsertByPhone(companyId, phone, {
          name: senderName || phone,
          sourceChannel: 'WHATSAPP_UNOFFICIAL',
        });
        await prisma.contact.update({
          where: { id: dbContact.id },
          data: { metadata: metadata as any },
        });
      }

      const conversation = await conversationService.findOrCreateByContact(companyId, channelId, dbContact.id);

      let type = 'TEXT';
      let content = msg.body || undefined;
      let mediaUrl: string | undefined;
      let fileName: string | undefined;

      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if (media) {
          mediaUrl = media.data;
          if (msg.type === 'image') type = 'IMAGE';
          else if (msg.type === 'video') type = 'VIDEO';
          else if (msg.type === 'audio') type = 'AUDIO';
          else if (msg.type === 'document') { type = 'DOCUMENT'; fileName = media.filename || undefined; }
        }
      }

      if (msg.type === 'sticker') type = 'TEXT';

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: type as any,
          content,
          mediaUrl,
          fileName,
          status: 'DELIVERED',
        },
        include: { attachments: true },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: content || fileName || 'Media',
          lastMessageAt: new Date(),
          isRead: false,
          status: 'OPEN',
        },
      });

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
        title: `New message from ${waContact.name || phone}`,
        body: content || 'Media message',
        conversationId: conversation.id,
      });
    } catch (err) {
      logger.error('WhatsApp Unofficial incoming message error', err);
    }
  }

  private async syncContacts(channelId: string, companyId: string) {
    try {
      const instance = this.clients.get(channelId);
      if (!instance) return;

      const io = getIO();
      io.to(`company:${companyId}`).emit('wa-unofficial:sync-start', { channelId });

      const waContacts = await instance.client.getContacts();
      const individual = waContacts.filter((c) => c.id.server === 'c.us' && c.number);

      let synced = 0;
      const BATCH = 50;

      for (let i = 0; i < individual.length; i += BATCH) {
        const batch = individual.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (wa) => {
            const phone = wa.number!;
            const name = wa.name || wa.pushname || phone;
            await prisma.contact.upsert({
              where: { companyId_phone: { companyId, phone } },
              create: {
                companyId,
                phone,
                name,
                sourceChannel: 'WHATSAPP_UNOFFICIAL',
                metadata: { whatsappId: wa.id._serialized } as any,
              },
              update: {
                name,
                metadata: { whatsappId: wa.id._serialized } as any,
              },
            });
            synced++;
          })
        );
      }

      io.to(`company:${companyId}`).emit('wa-unofficial:sync-complete', { channelId, total: synced });
      logger.info(`WhatsApp sync done: ${channelId} — ${synced} contacts`);
    } catch (err) {
      logger.error('WhatsApp sync contacts error', err);
      const io = getIO();
      io.to(`company:${companyId}`).emit('wa-unofficial:sync-error', { channelId, error: 'Gagal sync kontak' });
    }
  }

  private toChatId(to: string): string {
    if (to.includes('@')) return to;
    return `${to}@c.us`;
  }

  async sendTextMessage(channelId: string, to: string, text: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const chatId = this.toChatId(to);
    const sent = await instance.client.sendMessage(chatId, text);
    return { id: sent.id._serialized };
  }

  async sendImageMessage(channelId: string, to: string, imageBase64: string, caption?: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const { MessageMedia } = await import('whatsapp-web.js');
    const chatId = this.toChatId(to);
    const media = new MessageMedia('image/png', imageBase64);
    const sent = await instance.client.sendMessage(chatId, media, { caption });
    return { id: sent.id._serialized };
  }

  async sendDocumentMessage(channelId: string, to: string, documentBase64: string, filename: string, caption?: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const { MessageMedia } = await import('whatsapp-web.js');
    const chatId = this.toChatId(to);
    const media = new MessageMedia('application/octet-stream', documentBase64, filename);
    const sent = await instance.client.sendMessage(chatId, media, { caption });
    return { id: sent.id._serialized };
  }

  getStatus(channelId: string) {
    const instance = this.clients.get(channelId);
    if (!instance) return 'disconnected';
    const state = (instance.client as any).info?.wid ? 'connected' : 'connecting';
    return state;
  }

  async logout(channelId: string) {
    const instance = this.clients.get(channelId);
    if (instance) {
      try { await instance.client.destroy(); } catch {}
      this.clients.delete(channelId);
    }
    releaseBrowser();
  }
}

export const whatsAppUnofficialService = new WhatsAppUnofficialService();
