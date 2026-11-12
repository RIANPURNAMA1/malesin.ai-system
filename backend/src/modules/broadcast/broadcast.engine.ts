import prisma from '../../config/database';
import { Prisma, Broadcast } from '@prisma/client';
import logger from '../../utils/logger';
import { getIO } from '../../sockets/socket.server';
import { MessageService } from '../message/message.service';
import { ConversationService } from '../conversation/conversation.service';
import { whatsAppUnofficialService } from '../channel/whatsapp-unofficial.service';
import { buildMessage, classifyContact, insideSendWindow, normalizeSettings, withConsent } from './broadcast.policy';

/**
 * Smart Sending Engine. Satu pesan per tick per kanal, dengan alur:
 * jadwal → jam kirim → kesehatan kanal → batas harian → validasi ulang
 * penerima → kirim → evaluasi risiko (auto pause).
 * State ada di DB (penerima PENDING), jadi aman terhadap restart server.
 */
const TICK_MS = 5000;
const MAX_ATTEMPTS = 2;
const TRANSIENT_RE = /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|not initialized|connection closed|socket|rate|5\d\d/i;

const messageService = new MessageService();
const conversationService = new ConversationService();

/** Waktu paling cepat kanal boleh mengirim pesan broadcast berikutnya. */
const channelNextAt = new Map<string, number>();
/** Gagal beruntun per campaign (reset saat ada yang terkirim). */
const consecutiveFails = new Map<string, number>();
/** Alasan campaign RUNNING sedang menunggu (ditampilkan di UI). */
export const waitingReason = new Map<string, string>();

let busy = false;
let timer: NodeJS.Timeout | null = null;

function emit(b: Pick<Broadcast, 'id' | 'companyId'>) {
  void prisma.broadcast.findUnique({ where: { id: b.id } }).then(fresh => {
    if (fresh) getIO().to(`company:${b.companyId}`).emit('broadcast:updated', { ...fresh, waitingReason: waitingReason.get(b.id) ?? null });
  }).catch(() => undefined);
}

async function pauseForRisk(b: Broadcast, reason: string) {
  logger.warn(`Broadcast ${b.id} dijeda otomatis: ${reason}`);
  waitingReason.delete(b.id);
  await prisma.broadcast.update({ where: { id: b.id }, data: { status: 'PAUSED', pauseReason: `Auto pause: ${reason}` } });
  emit(b);
  getIO().to(`company:${b.companyId}`).emit('notification', {
    type: 'BROADCAST_PAUSED', title: 'Broadcast dijeda otomatis', body: `${b.name}: ${reason}`, link: '/broadcasts',
  });
}

function wait(b: Broadcast, reason: string, ms: number) {
  if (waitingReason.get(b.id) !== reason) {
    waitingReason.set(b.id, reason);
    emit(b);
  }
  channelNextAt.set(b.channelId, Date.now() + ms);
}

async function processOne(b: Broadcast) {
  const settings = normalizeSettings(b.settings);

  if (!insideSendWindow(settings)) {
    return wait(b, `Di luar jam kirim (${settings.sendStartHour}:00–${settings.sendEndHour}:00)`, 60_000);
  }

  // Kesehatan kanal
  const channel = await prisma.channel.findUnique({ where: { id: b.channelId } });
  if (!channel || !channel.isActive) return pauseForRisk(b, 'kanal nonaktif');
  if (channel.type === 'WHATSAPP_UNOFFICIAL') {
    const st = whatsAppUnofficialService.getStatus(b.channelId);
    if (st === 'connecting') return wait(b, 'Menunggu WhatsApp tersambung', 15_000);
    if (st !== 'connected') return pauseForRisk(b, 'WhatsApp terputus');
  }

  // Batas harian per kanal (24 jam bergulir)
  const sent24h = await prisma.broadcastRecipient.count({
    where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 24 * 3_600_000) }, broadcast: { channelId: b.channelId } },
  });
  if (sent24h >= settings.dailyLimit) {
    return wait(b, `Batas harian ${settings.dailyLimit} pesan/kanal tercapai, dilanjutkan otomatis`, 10 * 60_000);
  }

  const r = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: b.id, status: 'PENDING' },
    include: { contact: { select: { id: true, name: true, phone: true, metadata: true } } },
    orderBy: [{ attempts: 'asc' }, { name: 'asc' }],
  });
  if (!r) {
    waitingReason.delete(b.id);
    await prisma.broadcast.update({ where: { id: b.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    return emit(b);
  }
  waitingReason.delete(b.id);

  // Validasi ulang: izin bisa berubah sejak campaign dibuat.
  let lastInboundAt: Date | null = null;
  if (channel.type === 'WHATSAPP') {
    const last = await prisma.message.findFirst({
      where: { direction: 'INBOUND', conversation: { channelId: b.channelId, contactId: r.contactId } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    lastInboundAt = last?.sentAt ?? null;
  }
  const check = classifyContact(r.contact, { settings, officialChannel: channel.type === 'WHATSAPP', lastInboundAt });
  if (check.status === 'SUPPRESSED' || (check.status === 'REVIEW' && settings.requireOptIn)) {
    await prisma.$transaction([
      prisma.broadcastRecipient.update({ where: { id: r.id }, data: { status: 'SKIPPED', error: check.reason } }),
      prisma.broadcast.update({ where: { id: b.id }, data: { skippedCount: { increment: 1 } } }),
    ]);
    return emit(b);
  }

  const delayMs = (settings.minDelaySec + Math.random() * (settings.maxDelaySec - settings.minDelaySec)) * 1000;
  channelNextAt.set(b.channelId, Date.now() + delayMs);

  try {
    const conversation = await conversationService.findOrCreateByContact(b.companyId, b.channelId, r.contactId);
    const text = buildMessage(b.message, { name: r.contact.name, phone: r.phone }, settings);
    await messageService.sendMessage(
      b.companyId,
      conversation.id,
      null,
      b.mediaUrl ? { type: 'IMAGE', content: text, mediaUrl: b.mediaUrl } : { type: 'TEXT', content: text },
      'BROADCAST'
    );
    const now = new Date();
    await prisma.$transaction([
      prisma.broadcastRecipient.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: now, attempts: { increment: 1 }, error: null } }),
      prisma.broadcast.update({ where: { id: b.id }, data: { sentCount: { increment: 1 } } }),
      prisma.contact.update({
        where: { id: r.contactId },
        data: { metadata: withConsent(r.contact.metadata, { lastBroadcastAt: now.toISOString() }) as Prisma.InputJsonValue },
      }),
    ]);
    consecutiveFails.set(b.id, 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retry = TRANSIENT_RE.test(msg) && r.attempts + 1 < MAX_ATTEMPTS;
    await prisma.$transaction([
      prisma.broadcastRecipient.update({
        where: { id: r.id },
        data: { attempts: { increment: 1 }, error: msg.slice(0, 500), ...(retry ? {} : { status: 'FAILED' }) },
      }),
      ...(retry ? [] : [prisma.broadcast.update({ where: { id: b.id }, data: { failedCount: { increment: 1 } } })]),
    ]);
    consecutiveFails.set(b.id, (consecutiveFails.get(b.id) ?? 0) + 1);
  }

  await evaluateRisk(b.id);
  emit(b);
}

/** Auto pause bila gagal beruntun, rasio gagal, atau rasio opt-out melewati ambang. */
async function evaluateRisk(id: string) {
  const b = await prisma.broadcast.findUnique({ where: { id } });
  if (!b || b.status !== 'RUNNING') return;
  const s = normalizeSettings(b.settings);
  if (!s.autoPause) return;
  const attempted = b.sentCount + b.failedCount;
  if ((consecutiveFails.get(id) ?? 0) >= s.maxConsecutiveFailures) {
    consecutiveFails.set(id, 0);
    return pauseForRisk(b, `${s.maxConsecutiveFailures} pengiriman gagal berturut-turut`);
  }
  if (attempted >= 10 && b.failedCount / attempted > s.maxFailureRate) {
    return pauseForRisk(b, `rasio gagal ${Math.round((b.failedCount / attempted) * 100)}%`);
  }
  if (b.sentCount >= 20 && b.optOutCount / b.sentCount > s.maxOptOutRate) {
    return pauseForRisk(b, `rasio berhenti berlangganan ${Math.round((b.optOutCount / b.sentCount) * 100)}%`);
  }
}

/** Dipanggil saat kontak opt-out supaya campaign berisiko langsung berhenti. */
export const checkBroadcastRisk = evaluateRisk;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const now = new Date();
    const due = await prisma.broadcast.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } } });
    for (const b of due) {
      await prisma.broadcast.update({ where: { id: b.id }, data: { status: 'RUNNING', startedAt: b.startedAt ?? now, pauseReason: null } });
      emit(b);
    }

    const running = await prisma.broadcast.findMany({ where: { status: 'RUNNING' }, orderBy: { startedAt: 'asc' } });
    const handled = new Set<string>();
    for (const b of running) {
      // Satu kanal hanya memproses satu campaign per tick (antrean terkontrol).
      if (handled.has(b.channelId) || (channelNextAt.get(b.channelId) ?? 0) > Date.now()) continue;
      handled.add(b.channelId);
      await processOne(b).catch(err => logger.error(`Broadcast ${b.id} error`, err));
    }
  } catch (err) {
    logger.error('Broadcast engine tick failed', err);
  } finally {
    busy = false;
  }
}

export function startBroadcastEngine() {
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  logger.info('Broadcast engine started');
}
