// Baileys v7 hanya ESM, dan dependensinya (whatsapp-rust-bridge) hanya punya
// kondisi "import" pada field "exports" — tidak bisa di-require() oleh proyek
// CommonJS (module: commonjs). Jadi nilainya dimuat lewat dynamic import()
// agar Node memakai loader ESM asli, bukan hasil transpile tsx ke CJS.
import type { WAMessage, WASocket, proto } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';
import { contactService } from '../contact/contact.routes';
import { ConversationService } from '../conversation/conversation.service';
import logger from '../../utils/logger';
import { Boom } from '@hapi/boom';
import { rmSync } from 'fs';
import path from 'path';

type BaileysModule = typeof import('@whiskeysockets/baileys');
let baileysModule: Promise<BaileysModule> | undefined;
function loadBaileys(): Promise<BaileysModule> {
  baileysModule ??= import('@whiskeysockets/baileys');
  return baileysModule;
}

// Versi WA Web yang di-bundle Baileys cepat kedaluwarsa. Kalau versinya basi,
// server WhatsApp menolak handshake dengan 405 "Connection Failure" dan QR
// tidak pernah muncul. Jadi selalu ambil versi terbaru (di-cache per proses).
type WAVersion = [number, number, number];
let cachedWAVersion: WAVersion | undefined;

async function resolveWAVersion(baileys: BaileysModule): Promise<WAVersion | undefined> {
  if (cachedWAVersion) return cachedWAVersion;
  try {
    const { version, isLatest } = await baileys.fetchLatestBaileysVersion();
    cachedWAVersion = version as WAVersion;
    logger.info(`Baileys WA Web version: ${cachedWAVersion.join('.')} (isLatest=${isLatest})`);
  } catch (err) {
    logger.warn('Gagal mengambil versi WA Web terbaru, memakai versi default Baileys', err);
  }
  return cachedWAVersion;
}

const conversationService = new ConversationService();
const AUTH_DIR = './wa_auth_unofficial';
const QR_TIMEOUT = 60000;

interface ClientInstance {
  sock: WASocket;
  channelId: string;
  companyId: string;
}

function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && jid.endsWith('@lid');
}

function isPnJid(jid: string | null | undefined): boolean {
  return !!jid && /(@s\.whatsapp\.net|@c\.us|@hosted)$/.test(jid);
}

/**
 * LID (Linked ID) BUKAN nomor telepon. Kalau LID diubah jadi "phone", kontak
 * akan tampil dengan nomor palsu seperti 96679965528158@lid. Jadi LID selalu
 * ditolak di sini.
 */
function jidToPhone(jid: string): string {
  if (!jid || isLidJid(jid)) return '';
  return jid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@c\.us$/, '')
    .replace(/@hosted$/, '')
    .replace(/:\d+$/, '');
}

function normalizePnJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  // Event lid-mapping.update kadang mengirim JID penuh, kadang hanya nomor.
  const candidate = /^\d+$/.test(jid) ? `${jid}@s.whatsapp.net` : jid;
  if (!isPnJid(candidate)) return null;
  const phone = jidToPhone(candidate);
  return phone ? `${phone}@s.whatsapp.net` : null;
}

/**
 * Chat WhatsApp modern bisa dialamatkan memakai LID (...@lid). Nomor asli
 * diambil dari key.remoteJidAlt (disediakan Baileys v7) atau dari pemetaan
 * LID->PN di signal repository sesi. Kalau tetap tidak ketemu, phone
 * dikembalikan kosong — lebih baik null daripada menyimpan LID sebagai nomor.
 */
async function resolveSenderJid(
  sock: WASocket,
  msg: WAMessage
): Promise<{ phone: string; lid: string | null }> {
  const rawJid = msg.key?.remoteJid || '';
  const altJid = msg.key?.remoteJidAlt;

  if (!isLidJid(rawJid)) {
    return {
      phone: jidToPhone(rawJid),
      lid: isLidJid(altJid) ? altJid! : null,
    };
  }

  const fromAlt = normalizePnJid(altJid);
  if (fromAlt) return { phone: jidToPhone(fromAlt), lid: rawJid };

  try {
    const pnJid = await sock.signalRepository.lidMapping.getPNForLID(rawJid);
    const fromStore = normalizePnJid(pnJid);
    if (fromStore) return { phone: jidToPhone(fromStore), lid: rawJid };
  } catch (err) {
    logger.warn(`Gagal resolve LID ${rawJid} ke nomor telepon`, err);
  }

  return { phone: '', lid: rawJid };
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

  async initQR(channelId: string, companyId: string, userId: string): Promise<{ qr: string | null }> {
    const existing = this.clients.get(channelId);
    if (existing) {
      try { existing.sock.end(new Error('Reconnecting')); } catch {}
      this.clients.delete(channelId);
    }
    return this.start(channelId, companyId, userId);
  }

  private async start(
    channelId: string,
    companyId: string,
    userId: string,
    isReconnect = false
  ): Promise<{ qr: string | null }> {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');

    const io = getIO();

    const baileys = await loadBaileys();
    const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = baileys;
    const version = await resolveWAVersion(baileys);
    const authDir = path.join(AUTH_DIR, channelId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let qrReject: ((err: Error) => void) | null = null;
    let qrDisplayed = false;
    let settled = false;

    return new Promise<{ qr: string | null }>((resolve, reject) => {
      const settle = (result: { qr: string | null }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        qrReject = null;
        reject(err);
      };
      qrReject = fail;

      const timeout = setTimeout(() => {
        fail(new Error(`Timeout waiting for QR code (${QR_TIMEOUT / 1000}s)`));
      }, QR_TIMEOUT);

      const sock = makeWASocket({
        auth: state,
        version,
        browser: Browsers.windows('Chrome'),
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        fireInitQueries: true,
        markOnlineOnConnect: true,
      });

      this.clients.set(channelId, { sock, channelId, companyId });

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        logger.info(
          `connection.update channel=${channelId} connection=${connection} hasQr=${!!qr} isNewLogin=${!!isNewLogin}`
        );

        if (qr) {
          clearTimeout(timeout);
          qrDisplayed = true;
          QRCode.toDataURL(qr, { width: 300, margin: 2 })
            .then((qrDataUrl) => {
              io.to(`user:${userId}`).emit('wa-unofficial:qr', { channelId, qr: qrDataUrl });
              settle({ qr: qrDataUrl });
            })
            .catch((err) => fail(err as Error));
        }

        if (connection === 'open') {
          clearTimeout(timeout);
          io.to(`user:${userId}`).emit('wa-unofficial:ready', { channelId });
          io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'connected' });
          logger.info(`WhatsApp Unofficial ready: ${channelId}`);
          settle({ qr: null }); // sudah login pakai creds lama, tidak perlu QR
          void this.syncContacts(channelId, companyId);
        }

        if (connection === 'close') {
          clearTimeout(timeout);
          const boomErr = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomErr?.output?.statusCode;
          const errMsg = boomErr?.message || 'Connection closed';
          logger.warn(`WhatsApp Unofficial disconnected: ${channelId} code=${statusCode} msg=${errMsg}`);

          // 515 = pairing QR berhasil, server minta koneksi di-restart.
          // Tanpa reconnect di sini, sesi berhenti tepat setelah scan QR dan
          // tidak pernah sampai status "open"/terhubung.
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;

          if (!isRestartRequired) {
            this.clients.delete(channelId);
            io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
          }

          if (statusCode === DisconnectReason.loggedOut) {
            // Sesi tidak valid lagi: buang creds supaya scan berikutnya bersih.
            try { rmSync(authDir, { recursive: true, force: true }); } catch {}
          }

          if (isRestartRequired) {
            logger.info(`Pairing OK, reconnect otomatis: ${channelId}`);
            void this.start(channelId, companyId, userId, true).catch((err) =>
              logger.error('Auto reconnect setelah pairing gagal', err)
            );
            settle({ qr: null });
            return;
          }

          if (!isReconnect && qrReject && !qrDisplayed) {
            qrReject(new Error(errMsg));
          } else if (qrDisplayed) {
            io.to(`user:${userId}`).emit('wa-unofficial:error', { channelId, error: errMsg });
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Mapping LID -> nomor asli tidak selalu tersedia saat pesan pertama
      // masuk. Kalau WhatsApp kemudian mengirim mapping-nya, perbarui kontak
      // yang sebelumnya tersimpan hanya dengan LID.
      sock.ev.on('lid-mapping.update', ({ lid, pn }) => {
        void this.applyLidMapping(companyId, lid, pn).catch((err) =>
          logger.warn(`Gagal menerapkan LID mapping ${lid} -> ${pn}`, err)
        );
      });

      sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          if (msg.key?.fromMe) continue;
          if (!msg.key?.remoteJid) continue;
          if (msg.key.remoteJid.endsWith('@g.us')) continue;
          if (msg.key.remoteJid.endsWith('@broadcast')) continue;
          await this.handleIncomingMessage(channelId, companyId, sock, msg);
        }
      });
    });
  }

  /**
   * Saat mapping LID -> PN baru tersedia, lengkapi kontak yang masih hanya
   * punya LID. Nomor asli hanya dipasang kalau belum dipakai kontak lain.
   */
  private async applyLidMapping(companyId: string, lid: string, pn: string) {
    const pnJid = normalizePnJid(pn);
    if (!pnJid || !isLidJid(lid)) return;
    const phone = jidToPhone(pnJid);

    const contacts = await prisma.contact.findMany({
      where: {
        companyId,
        OR: [
          { metadata: { path: '$.lid', equals: lid } },
          { metadata: { path: '$.remoteJid', equals: lid } },
          // Data lama: LID sempat tersimpan sebagai whatsappId / phone.
          { metadata: { path: '$.whatsappId', equals: lid } },
          { phone: lid },
        ],
      },
    });

    for (const contact of contacts) {
      const owner = await prisma.contact.findFirst({
        where: { companyId, phone, id: { not: contact.id } },
      });
      if (owner) continue;

      const existingMeta = (contact.metadata as Record<string, unknown> | null) || {};
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          phone,
          metadata: { ...existingMeta, whatsappId: pnJid, lid, remoteJid: lid } as any,
        },
      });
      logger.info(`LID mapping diterapkan: ${lid} -> ${phone} (contact ${contact.id})`);
    }
  }

  async handleIncomingMessage(channelId: string, companyId: string, sock: WASocket, msg: WAMessage) {
    try {
      const rawJid = msg.key!.remoteJid!;
      const pushName = msg.pushName || '';
      const { phone, lid } = await resolveSenderJid(sock, msg);
      const senderName = pushName || phone || 'Unknown';

      // whatsappId selalu PN kalau diketahui supaya balasan memakai nomor asli.
      // Identitas percakapan tetap memakai LID/JID asli, jadi pesan berikutnya
      // tetap nyambung walau nomor belum ketemu.
      const whatsappId = phone ? `${phone}@s.whatsapp.net` : rawJid;
      const metadata: Record<string, unknown> = { whatsappId, remoteJid: rawJid };
      if (lid) metadata.lid = lid;

      const existingContact = await prisma.contact.findFirst({
        where: {
          companyId,
          OR: [
            { metadata: { path: '$.whatsappId', equals: whatsappId } },
            ...(lid ? [{ metadata: { path: '$.lid', equals: lid } }] : []),
            // Data lama: LID pernah tersimpan sebagai whatsappId / phone.
            ...(lid ? [{ metadata: { path: '$.whatsappId', equals: lid } }] : []),
            ...(phone ? [{ phone }] : []),
            ...(senderName && senderName !== 'Unknown'
              ? [{ name: senderName, sourceChannel: 'WHATSAPP_UNOFFICIAL' }]
              : []),
          ],
        },
      });

      let dbContact;
      if (existingContact) {
        const phoneOwner = phone
          ? await prisma.contact.findFirst({
              where: { companyId, phone, id: { not: existingContact.id } },
            })
          : null;

        const existingMeta = (existingContact.metadata as Record<string, unknown> | null) || {};
        const nextPhone = phone && !phoneOwner
          ? phone
          : existingContact.phone?.includes('@lid') && !phone
            ? null
            : undefined;

        dbContact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
            name: senderName,
            metadata: { ...existingMeta, ...metadata } as any,
            totalMessages: { increment: 1 },
          },
        });
      } else if (phone) {
        dbContact = await contactService.upsertByPhone(companyId, phone, {
          name: senderName,
          sourceChannel: 'WHATSAPP_UNOFFICIAL',
        });
        await prisma.contact.update({
          where: { id: dbContact.id },
          data: { metadata: metadata as any },
        });
      } else {
        // Nomor belum diketahui: simpan sebagai kontak berbasis LID (phone null),
        // jangan pakai LID sebagai nomor telepon.
        dbContact = await prisma.contact.create({
          data: {
            companyId,
            phone: null,
            name: senderName,
            sourceChannel: 'WHATSAPP_UNOFFICIAL',
            metadata: metadata as any,
            totalMessages: 1,
          },
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
          const { downloadMediaMessage } = await loadBaileys();
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
