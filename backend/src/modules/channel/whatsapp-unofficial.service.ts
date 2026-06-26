import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  Browsers,
} from '@whiskeysockets/baileys';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';
import { contactService } from '../contact/contact.routes';
import { ConversationService } from '../conversation/conversation.service';
import logger from '../../utils/logger';
import { Boom } from '@hapi/boom';
import { proto } from '@whiskeysockets/baileys';
import path from 'path';

const conversationService = new ConversationService();
const AUTH_DIR = './wa_auth_unofficial';
const QR_TIMEOUT = 60000;

interface ClientInstance {
  sock: WASocket;
  channelId: string;
  companyId: string;
}

function jidToPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
}

function getMessageBody(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return '';
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentWithCaptionMessage?.message?.documentMessage?.caption) return m.documentWithCaptionMessage.message.documentMessage.caption;
  if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
  if (m.listResponseMessage?.title) return m.listResponseMessage.title;
  if (m.templateButtonReplyMessage?.selectedDisplayText) return m.templateButtonReplyMessage.selectedDisplayText;
  return '';
}

function getMessageType(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage || m.documentWithCaptionMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.conversation || m.extendedTextMessage) return 'text';
  return null;
}

function getMediaMessage(msg: WAMessage): proto.Message.IImageMessage | proto.Message.IVideoMessage | proto.Message.IAudioMessage | proto.Message.IDocumentMessage | null {
  const m = msg.message;
  if (!m) return null;
  if (m.imageMessage) return m.imageMessage;
  if (m.videoMessage) return m.videoMessage;
  if (m.audioMessage) return m.audioMessage;
  if (m.documentMessage) return m.documentMessage;
  if (m.documentWithCaptionMessage?.message?.documentMessage) return m.documentWithCaptionMessage.message.documentMessage;
  return null;
}

class WhatsAppUnofficialService {
  private clients: Map<string, ClientInstance> = new Map();

  async initQR(channelId: string, companyId: string, userId: string): Promise<{ qr: string }> {
    const existing = this.clients.get(channelId);
    if (existing) {
      try { existing.sock.end(new Error('Reconnecting')); } catch {}
      this.clients.delete(channelId);
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');

    const io = getIO();

    const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_DIR, channelId));

    let qrReject: ((err: Error) => void) | null = null;
    let qrDisplayed = false;
    let qrPromiseResolved = false;

    const qrPromise = new Promise<{ qr: string }>((resolve, reject) => {
      qrReject = reject;

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for QR code (${QR_TIMEOUT / 1000}s)`));
      }, QR_TIMEOUT);

      const sock = makeWASocket({
        auth: state,
        browser: Browsers.windows('Chrome'),
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        fireInitQueries: true,
        markOnlineOnConnect: true,
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        logger.info(`connection.update channel=${channelId} connection=${connection} hasQr=${!!qr}`);

        if (qr) {
          clearTimeout(timeout);
          qrDisplayed = true;
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            io.to(`user:${userId}`).emit('wa-unofficial:qr', { channelId, qr: qrDataUrl });
            if (!qrPromiseResolved) {
              qrPromiseResolved = true;
              resolve({ qr: qrDataUrl });
            }
          } catch (err) {
            if (!qrPromiseResolved) {
              qrPromiseResolved = true;
              reject(err);
            }
          }
        }

        if (connection === 'open') {
          clearTimeout(timeout);
          io.to(`user:${userId}`).emit('wa-unofficial:ready', { channelId });
          io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'connected' });
          logger.info(`WhatsApp Unofficial ready: ${channelId}`);
          void this.syncContacts(channelId, companyId);
        }

        if (connection === 'close') {
          const boomErr = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomErr?.output?.statusCode;
          const errMsg = boomErr?.message || 'Connection closed';
          logger.warn(`WhatsApp Unofficial disconnected: ${channelId} code=${statusCode} msg=${errMsg}`);
          this.clients.delete(channelId);
          io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
          if (qrReject && !qrDisplayed) {
            qrReject(new Error(errMsg));
            qrReject = null;
          }
          if (qrDisplayed) {
            io.to(`user:${userId}`).emit('wa-unofficial:error', { channelId, error: errMsg });
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          if (msg.key?.fromMe) continue;
          if (!msg.key?.remoteJid) continue;
          if (msg.key.remoteJid.endsWith('@g.us')) continue;
          if (msg.key.remoteJid.endsWith('@broadcast')) continue;
          await this.handleIncomingMessage(channelId, companyId, sock, msg);
        }
      });

      const instance: ClientInstance = { sock, channelId, companyId };
      this.clients.set(channelId, instance);
    });

    const result = await qrPromise;
    return result;
  }

  async handleIncomingMessage(channelId: string, companyId: string, sock: WASocket, msg: WAMessage) {
    try {
      const rawJid = msg.key!.remoteJid!;
      const pushName = msg.pushName || '';
      const phone = jidToPhone(rawJid);
      const senderName = pushName || phone;

      const hasLid = rawJid.includes('@lid');
      let realWhatsAppId: string | null;

      if (hasLid) {
        realWhatsAppId = null;
      } else {
        const normalized = phone;
        realWhatsAppId = `${normalized}@s.whatsapp.net`;
      }

      const metadataWhatsAppId = realWhatsAppId || rawJid;
      const metadata: Record<string, unknown> = { whatsappId: metadataWhatsAppId };

      const existingByMeta = realWhatsAppId
        ? await prisma.contact.findFirst({
            where: { companyId, metadata: { path: '$.whatsappId', equals: realWhatsAppId } },
          })
        : null;
      const existingByJid = !existingByMeta
        ? await prisma.contact.findFirst({
            where: { companyId, metadata: { path: '$.whatsappId', equals: rawJid } },
          })
        : null;
      const existingByName = !existingByMeta && !existingByJid && senderName
        ? await prisma.contact.findFirst({
            where: { companyId, name: senderName, sourceChannel: 'WHATSAPP_UNOFFICIAL' },
          })
        : null;
      const existingContact = existingByMeta || existingByJid || existingByName;

      let dbContact;
      if (existingContact) {
        const phoneOwner = phone
          ? await prisma.contact.findFirst({ where: { companyId, phone, id: { not: existingContact.id } } })
          : null;
        dbContact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            ...(phoneOwner ? {} : { phone }),
            name: senderName || phone,
            metadata: metadata as any,
            totalMessages: { increment: 1 },
          },
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
      let content = getMessageBody(msg) || undefined;
      let mediaUrl: string | undefined;
      let fileName: string | undefined;

      const baileysType = getMessageType(msg);
      const mediaPart = getMediaMessage(msg);

      if (mediaPart && baileysType) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          mediaUrl = buffer.toString('base64');
          if (baileysType === 'image') type = 'IMAGE';
          else if (baileysType === 'video') type = 'VIDEO';
          else if (baileysType === 'audio') type = 'AUDIO';
          else if (baileysType === 'document') {
            type = 'DOCUMENT';
            fileName = (mediaPart as proto.Message.IDocumentMessage).fileName || undefined;
          }
        } catch {
          logger.warn(`Failed to download media for message ${msg.key?.id}`);
        }
      }

      if (baileysType === 'sticker') type = 'TEXT';

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
        title: `New message from ${senderName || phone}`,
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
      io.to(`company:${companyId}`).emit('wa-unofficial:sync-complete', { channelId, total: 0 });
      logger.info(`WhatsApp sync done: ${channelId}`);
    } catch (err) {
      logger.error('WhatsApp sync contacts error', err);
      const io = getIO();
      io.to(`company:${companyId}`).emit('wa-unofficial:sync-error', { channelId, error: 'Gagal sync kontak' });
    }
  }

  private toJid(to: string): string {
    if (to.includes('@')) return to;
    return `${to}@s.whatsapp.net`;
  }

  async sendTextMessage(channelId: string, to: string, text: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const jid = this.toJid(to);
    const sent = await instance.sock.sendMessage(jid, { text });
    return { id: sent?.key?.id || '' };
  }

  async sendImageMessage(channelId: string, to: string, imageBase64: string, caption?: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const jid = this.toJid(to);
    const buffer = Buffer.from(imageBase64, 'base64');
    const sent = await instance.sock.sendMessage(jid, { image: buffer, caption });
    return { id: sent?.key?.id || '' };
  }

  async sendDocumentMessage(channelId: string, to: string, documentBase64: string, filename: string, caption?: string) {
    const instance = this.clients.get(channelId);
    if (!instance) throw new Error('WhatsApp client not initialized');
    const jid = this.toJid(to);
    const buffer = Buffer.from(documentBase64, 'base64');
    const sent = await instance.sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: filename, caption });
    return { id: sent?.key?.id || '' };
  }

  getStatus(channelId: string) {
    const instance = this.clients.get(channelId);
    if (!instance) return 'disconnected';
    return instance.sock.ws?.isOpen ? 'connected' : 'connecting';
  }

  async logout(channelId: string) {
    const instance = this.clients.get(channelId);
    if (instance) {
      try { instance.sock.end(new Error('Logged out')); } catch {}
      this.clients.delete(channelId);
    }
  }
}

export const whatsAppUnofficialService = new WhatsAppUnofficialService();
