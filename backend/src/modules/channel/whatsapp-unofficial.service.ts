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
import { existsSync, rmSync } from 'fs';
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
// Sesi Baileys disimpan di disk (bukan di database), relatif terhadap cwd backend.
const AUTH_DIR = path.resolve(process.cwd(), 'wa_auth_unofficial');
const QR_TIMEOUT = 60000;

interface ClientInstance {
  sock: WASocket;
  channelId: string;
  companyId: string;
  userId: string;
  /** True kalau socket ditutup sengaja (logout / reconnect manual) -> jangan auto-reconnect. */
  manualClose: boolean;
  reconnectAttempts: number;
}

interface PersistedSession {
  status?: string;
  jid?: string | null;
  phone?: string | null;
  connectedAt?: string;
  updatedAt?: string;
}

// proto.WebMessageInfo.Status: 0=ERROR, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
const WA_STATUS_MAP: Record<number, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
  0: 'FAILED',
  2: 'SENT',
  3: 'DELIVERED',
  4: 'READ',
  5: 'READ',
};

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

/** Pesan dianggap baru kalau dikirim dalam beberapa menit terakhir. */
function isRecentMessage(msg: WAMessage, maxAgeMs = 5 * 60 * 1000): boolean {
  const timestamp = Number(msg.messageTimestamp || 0) * 1000;
  return timestamp > 0 && Date.now() - timestamp <= maxAgeMs;
}

class WhatsAppUnofficialService {
  private clients: Map<string, ClientInstance> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Channel yang sedang dalam proses connect/restore, supaya tidak dobel socket. */
  private connecting: Set<string> = new Set();
  /** Chat (JID) yang sudah di-subscribe presence-nya per channel. */
  private presenceSubscribed: Map<string, Set<string>> = new Map();

  private authDir(channelId: string) {
    return path.join(AUTH_DIR, channelId);
  }

  /** Sesi dianggap ada kalau file creds Baileys tersedia di disk. */
  hasSession(channelId: string) {
    return existsSync(path.join(this.authDir(channelId), 'creds.json'));
  }

  private clearReconnect(channelId: string) {
    const timer = this.reconnectTimers.get(channelId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(channelId);
    }
  }

  private scheduleReconnect(
    channelId: string,
    companyId: string,
    userId: string,
    attempt: number,
    immediate = false
  ) {
    if (this.reconnectTimers.has(channelId)) return;
    const delay = immediate ? 500 : Math.min(30000, 2000 * 2 ** Math.min(attempt, 4));
    logger.info(`Menjadwalkan reconnect WhatsApp ${channelId} dalam ${delay}ms (percobaan ${attempt})`);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(channelId);
      const current = this.clients.get(channelId);
      if (current?.sock?.ws?.isOpen) return;

      void this.start(channelId, companyId, userId, true, false).catch((err) => {
        logger.warn(`Reconnect WhatsApp gagal (percobaan ${attempt}): ${channelId}`, err);
        this.scheduleReconnect(channelId, companyId, userId, attempt + 1);
      });
    }, delay);

    this.reconnectTimers.set(channelId, timer);
  }

  /** Simpan status/identitas device ke kolom Channel.sessionData (bukan kredensial). */
  private async persistSession(channelId: string, data: Partial<PersistedSession>) {
    try {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { sessionData: true },
      });

      let previous: PersistedSession = {};
      if (channel?.sessionData) {
        try { previous = JSON.parse(channel.sessionData) as PersistedSession; } catch { /* ignore */ }
      }

      await prisma.channel.update({
        where: { id: channelId },
        data: {
          sessionData: JSON.stringify({
            ...previous,
            ...data,
            updatedAt: new Date().toISOString(),
          }),
        },
      });
    } catch (err) {
      logger.warn(`Gagal menyimpan sessionData channel ${channelId}`, err);
    }
  }

  async initQR(channelId: string, companyId: string, userId: string): Promise<{ qr: string | null }> {
    this.clearReconnect(channelId);
    const existing = this.clients.get(channelId);
    if (existing) {
      existing.manualClose = true;
      try { existing.sock.end(new Error('Reconnecting')); } catch {}
      this.clients.delete(channelId);
    }
    return this.start(channelId, companyId, userId, false, true);
  }

  /**
   * Pulihkan sesi yang sudah ada tanpa menampilkan QR. Dipakai saat server
   * restart atau saat halaman channel dibuka lagi, supaya device yang sudah
   * terhubung tidak tampil "kosong/disconnected".
   */
  async ensureConnected(channelId: string, companyId: string, userId: string): Promise<void> {
    if (this.clients.has(channelId) || this.reconnectTimers.has(channelId) || this.connecting.has(channelId)) {
      return;
    }
    if (!this.hasSession(channelId)) return;

    this.connecting.add(channelId);
    try {
      await this.start(channelId, companyId, userId, true, false);
    } catch (err) {
      logger.warn(`Gagal memulihkan sesi WhatsApp ${channelId}`, err);
    } finally {
      this.connecting.delete(channelId);
    }
  }

  /** Restore semua sesi WhatsApp Unofficial yang kredensialnya masih ada di disk. */
  async restoreAll(): Promise<void> {
    const channels = await prisma.channel.findMany({
      where: { type: 'WHATSAPP_UNOFFICIAL' },
      select: { id: true, companyId: true },
    });

    const withSession = channels.filter((ch) => this.hasSession(ch.id));
    if (!withSession.length) {
      logger.info('Tidak ada sesi WhatsApp Unofficial yang perlu dipulihkan');
      return;
    }

    logger.info(`Memulihkan ${withSession.length} sesi WhatsApp Unofficial...`);

    await Promise.allSettled(
      withSession.map(async (ch) => {
        const owner = await prisma.user.findFirst({
          where: { companyId: ch.companyId, role: 'OWNER', isActive: true },
          select: { id: true },
        });
        await this.ensureConnected(ch.id, ch.companyId, owner?.id || '');
      })
    );
  }

  private async start(
    channelId: string,
    companyId: string,
    userId: string,
    isReconnect = false,
    allowQR = true
  ): Promise<{ qr: string | null }> {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');

    const io = getIO();

    const baileys = await loadBaileys();
    const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = baileys;
    const version = await resolveWAVersion(baileys);
    const authDir = this.authDir(channelId);
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

      const instance: ClientInstance = {
        sock,
        channelId,
        companyId,
        userId,
        manualClose: false,
        reconnectAttempts: isReconnect ? 1 : 0,
      };
      this.clients.set(channelId, instance);

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        logger.info(
          `connection.update channel=${channelId} connection=${connection} hasQr=${!!qr} isNewLogin=${!!isNewLogin}`
        );

        if (qr) {
          clearTimeout(timeout);

          // Saat restore/reconnect otomatis kita tidak ingin menunggu scan QR.
          // Kalau creds ternyata tidak valid, tandai disconnected dan berhenti;
          // user bisa pairing ulang lewat tombol Reconnect.
          if (!allowQR) {
            logger.warn(`Sesi WhatsApp ${channelId} tidak valid, perlu pairing ulang`);
            instance.manualClose = true;
            try { sock.end(new Error('Pairing required')); } catch {}
            if (this.clients.get(channelId) === instance) this.clients.delete(channelId);
            void this.persistSession(channelId, { status: 'disconnected' });
            io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
            settle({ qr: null });
            return;
          }

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
          instance.reconnectAttempts = 0;

          const jid = sock.user?.id || null;
          const phone = jid ? jidToPhone(jid) : null;
          void this.persistSession(channelId, {
            status: 'connected',
            jid,
            phone,
            connectedAt: new Date().toISOString(),
          });

          io.to(`user:${userId}`).emit('wa-unofficial:ready', { channelId });
          io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'connected' });
          logger.info(`WhatsApp Unofficial ready: ${channelId} (${phone || 'unknown'})`);
          settle({ qr: null }); // sudah login pakai creds lama, tidak perlu QR
          void this.syncContacts(channelId, companyId);
        }

        if (connection === 'close') {
          clearTimeout(timeout);
          // Socket baru saat reconnect -> presence harus di-subscribe ulang.
          this.presenceSubscribed.delete(channelId);
          const boomErr = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomErr?.output?.statusCode;
          const errMsg = boomErr?.message || 'Connection closed';
          logger.warn(`WhatsApp Unofficial disconnected: ${channelId} code=${statusCode} msg=${errMsg}`);

          // 515 = pairing QR berhasil, server minta koneksi di-restart.
          // Tanpa reconnect di sini, sesi berhenti tepat setelah scan QR dan
          // tidak pernah sampai status "open"/terhubung.
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          // Kalau socket ini sudah digantikan socket baru (mis. reconnect manual),
          // abaikan event close-nya supaya tidak menimpa status "connected".
          if (this.clients.get(channelId) !== instance && !isLoggedOut) {
            logger.info(`Abaikan close dari socket lama: ${channelId}`);
            settle({ qr: null });
            return;
          }

          if (isLoggedOut) {
            // Sesi tidak valid lagi: buang creds supaya scan berikutnya bersih.
            instance.manualClose = true;
            try { rmSync(authDir, { recursive: true, force: true }); } catch {}
          }

          if (this.clients.get(channelId) === instance) this.clients.delete(channelId);

          if (isRestartRequired) {
            logger.info(`Pairing OK, reconnect otomatis: ${channelId}`);
            settle({ qr: null });
            this.scheduleReconnect(channelId, companyId, userId, 0, true);
            return;
          }

          if (isLoggedOut || instance.manualClose) {
            void this.persistSession(channelId, { status: 'disconnected' });
            io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
            if (!isReconnect && qrReject && !qrDisplayed) {
              qrReject(new Error(errMsg));
            } else {
              settle({ qr: null });
            }
            return;
          }

          // Putus koneksi tak terduga (jaringan, HP offline, dll):
          // jangan biarkan device mati permanen, coba reconnect dengan backoff.
          if (!isReconnect && qrReject && !qrDisplayed) {
            qrReject(new Error(errMsg));
          } else if (qrDisplayed) {
            io.to(`user:${userId}`).emit('wa-unofficial:error', { channelId, error: errMsg });
          }

          void this.persistSession(channelId, { status: 'disconnected' });
          io.to(`company:${companyId}`).emit('wa-unofficial:status', { channelId, status: 'disconnected' });
          settle({ qr: null });
          this.scheduleReconnect(channelId, companyId, userId, instance.reconnectAttempts + 1);
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

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
          const jid = msg.key?.remoteJid;
          if (!jid) continue;
          if (jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;

          // 'notify' = pesan baru realtime (termasuk yang dikirim dari HP).
          // 'append' = history sync / pesan tertunda; hanya ambil yang masih
          // baru supaya aktivitas dari HP tetap masuk tanpa membanjiri inbox
          // dengan riwayat lama.
          if (type !== 'notify' && !isRecentMessage(msg)) continue;

          await this.handleMessage(channelId, companyId, sock, msg);
        }
      });

      // Status "sedang mengetik" dari customer diteruskan ke dashboard secara
      // realtime, jadi aktivitas di HP ikut terlihat di sini.
      sock.ev.on('presence.update', ({ id, presences }) => {
        for (const presence of Object.values(presences)) {
          void this.handlePresence(companyId, channelId, id, presence.lastKnownPresence).catch((err) =>
            logger.warn(`Gagal memproses presence ${id}`, err)
          );
        }
      });

      // Centang pesan keluar (terkirim/dibaca) juga berlaku untuk pesan yang
      // dikirim dari HP, bukan hanya dari aplikasi ini.
      sock.ev.on('messages.update', async (updates) => {
        for (const { key, update } of updates) {
          if (!key?.fromMe || !key.id) continue;
          const status = WA_STATUS_MAP[update.status as number];
          if (!status) continue;
          await this.syncMessageStatus(companyId, key.id, status).catch((err) =>
            logger.warn(`Gagal update status pesan ${key.id}`, err)
          );
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

  /**
   * Menangani pesan baru dua arah secara realtime:
   * - INBOUND  : pesan masuk dari customer.
   * - OUTBOUND : pesan yang dikirim dari HP / device lain milik akun ini,
   *              supaya aktivitas di HP ikut tampil di inbox.
   * Pesan yang dikirim dari aplikasi ini tidak di-echo Baileys
   * (emitOwnEvents: false), jadi tidak akan duplikat.
   */
  async handleMessage(channelId: string, companyId: string, sock: WASocket, msg: WAMessage) {
    try {
      const wamid = msg.key?.id;
      if (!wamid) return;

      // Idempoten: pesan yang sama bisa dikirim ulang saat reconnect.
      const duplicated = await prisma.message.findUnique({
        where: { wamid },
        select: { id: true },
      });
      if (duplicated) return;

      const isOutbound = !!msg.key?.fromMe;
      const rawJid = msg.key!.remoteJid!;
      const { phone, lid } = await resolveSenderJid(sock, msg);
      // Pastikan WhatsApp mengirim status typing untuk chat ini.
      void this.subscribePresence(channelId, sock, rawJid);
      // pushName pada pesan fromMe adalah nama akun kita sendiri, bukan customer.
      const pushName = isOutbound ? '' : msg.pushName || '';
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
            ...(!isOutbound && senderName !== 'Unknown' ? { name: senderName } : {}),
            metadata: { ...existingMeta, ...metadata } as any,
            ...(isOutbound ? {} : { totalMessages: { increment: 1 } }),
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
            totalMessages: isOutbound ? 0 : 1,
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

      // Reaction / protocol (hapus, edit, read receipt) bukan pesan chat.
      if (!baileysType && !content) return;

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

      const sentAt = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000)
        : new Date();

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
          type: type as any,
          content,
          mediaUrl,
          fileName,
          wamid,
          status: isOutbound ? 'SENT' : 'DELIVERED',
          isRead: isOutbound,
          sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
        },
        include: { attachments: true },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: content || fileName || 'Media',
          lastMessageAt: message.sentAt,
          ...(isOutbound ? {} : { isRead: false, status: 'OPEN' }),
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
      if (!isOutbound) {
        io.to(`company:${companyId}`).emit('notification', {
          type: 'NEW_MESSAGE',
          title: `New message from ${senderName || phone}`,
          body: content || 'Media message',
          conversationId: conversation.id,
        });
      }
    } catch (err) {
      logger.error('WhatsApp Unofficial message handling error', err);
    }
  }

  /**
   * Teruskan indikator "sedang mengetik/merekam" dari customer ke dashboard
   * secara realtime supaya aktivitas di HP ikut terlihat.
   */
  private async handlePresence(
    companyId: string,
    channelId: string,
    jid: string,
    presence: string | undefined
  ) {
    if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) return;

    const phone = jidToPhone(jid);
    const contact = await prisma.contact.findFirst({
      where: {
        companyId,
        OR: [
          { metadata: { path: '$.remoteJid', equals: jid } },
          ...(phone
            ? [
                { metadata: { path: '$.whatsappId', equals: `${phone}@s.whatsapp.net` } },
                { phone },
              ]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!contact) return;

    const conversation = await prisma.conversation.findFirst({
      where: { companyId, channelId, contactId: contact.id },
      select: { id: true },
    });
    if (!conversation) return;

    getIO().to(`company:${companyId}`).emit('message:typing', {
      conversationId: conversation.id,
      isTyping: presence === 'composing' || presence === 'recording',
    });
  }

  /** Subscribe presence sekali per chat supaya WhatsApp mengirim event typing. */
  private async subscribePresence(channelId: string, sock: WASocket, jid: string) {
    let subscribed = this.presenceSubscribed.get(channelId);
    if (!subscribed) {
      subscribed = new Set();
      this.presenceSubscribed.set(channelId, subscribed);
    }
    if (subscribed.has(jid)) return;

    subscribed.add(jid);
    try {
      await sock.presenceSubscribe(jid);
    } catch (err) {
      subscribed.delete(jid);
      logger.warn(`Gagal subscribe presence ${jid}`, err);
    }
  }

  /** Update status pesan keluar (centang) dan beri tahu frontend secara realtime. */
  private async syncMessageStatus(
    companyId: string,
    wamid: string,
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  ) {
    const existing = await prisma.message.findUnique({
      where: { wamid },
      select: { id: true, conversationId: true, status: true },
    });
    if (!existing || existing.status === status) return;

    await prisma.message.update({
      where: { id: existing.id },
      data: {
        status,
        ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(status === 'READ' ? { readAt: new Date() } : {}),
      },
    });

    getIO().to(`company:${companyId}`).emit('message:status', {
      conversationId: existing.conversationId,
      messageId: existing.id,
      status,
    });
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
    if (this.connecting.has(channelId)) return 'connecting';
    const instance = this.clients.get(channelId);
    if (!instance) return 'disconnected';
    return instance.sock.ws?.isOpen ? 'connected' : 'connecting';
  }

  async logout(channelId: string) {
    this.clearReconnect(channelId);
    this.presenceSubscribed.delete(channelId);
    const instance = this.clients.get(channelId);
    if (instance) {
      instance.manualClose = true;
      try { instance.sock.end(new Error('Logged out')); } catch {}
      this.clients.delete(channelId);
    }
    await this.persistSession(channelId, { status: 'disconnected' });
  }

  /** Hapus sesi device (dipakai saat channel dihapus) termasuk kredensial di disk. */
  async removeSession(channelId: string) {
    this.clearReconnect(channelId);
    this.presenceSubscribed.delete(channelId);
    const instance = this.clients.get(channelId);
    if (instance) {
      instance.manualClose = true;
      try { instance.sock.end(new Error('Session removed')); } catch {}
      this.clients.delete(channelId);
    }
    try { rmSync(this.authDir(channelId), { recursive: true, force: true }); } catch {}
  }
}

export const whatsAppUnofficialService = new WhatsAppUnofficialService();
