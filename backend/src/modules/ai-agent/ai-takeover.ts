import prisma from '../../config/database';
import { getIO } from '../../sockets/socket.server';

/** Pengaturan perilaku balasan AI per kanal, disimpan di `channel.metadata.aiBehavior`. */
export interface AiBehavior {
  /** Jeda acak (detik) sejak pesan masuk sebelum AI mulai membalas. */
  replyDelayMin: number;
  replyDelayMax: number;
  /** Tampilkan "sedang mengetik..." di WhatsApp sebelum tiap balasan dikirim. */
  typingIndicator: boolean;
  /** Kecepatan mengetik (karakter/detik) untuk menghitung lama animasi mengetik. */
  typingSpeed: number;
  /** AI berhenti membalas saat manusia (agen) membalas/mengetik di percakapan. */
  humanTakeover: boolean;
  /** Lama AI dijeda setelah aktivitas manusia (menit). 0 = sampai diaktifkan lagi manual. */
  takeoverMinutes: number;
}

const num = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function aiBehaviorOf(channelMetadata: unknown): AiBehavior {
  const b = ((channelMetadata as any)?.aiBehavior ?? {}) as Partial<AiBehavior>;
  const replyDelayMin = num(b.replyDelayMin, 2, 0, 120);
  return {
    replyDelayMin,
    replyDelayMax: Math.max(replyDelayMin, num(b.replyDelayMax, 5, 0, 120)),
    typingIndicator: b.typingIndicator !== false,
    typingSpeed: num(b.typingSpeed, 15, 3, 100),
    humanTakeover: b.humanTakeover !== false,
    takeoverMinutes: num(b.takeoverMinutes, 30, 0, 7 * 24 * 60),
  };
}

/** `aiPausedUntil` di metadata percakapan: ISO date, atau 'manual' (sampai diaktifkan lagi). */
export function isAiPaused(conversationMetadata: unknown): boolean {
  const until = (conversationMetadata as any)?.aiPausedUntil;
  if (!until) return false;
  if (until === 'manual') return true;
  return new Date(until).getTime() > Date.now();
}

async function writePause(conversationId: string, value: string | null) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { companyId: true, metadata: true },
  });
  if (!conv) return null;
  const meta = { ...((conv.metadata as Record<string, unknown> | null) ?? {}), aiPausedUntil: value };
  await prisma.conversation.update({ where: { id: conversationId }, data: { metadata: meta as any } });
  getIO().to(`company:${conv.companyId}`).emit('conversation:ai-status', {
    conversationId,
    aiPausedUntil: value,
  });
  return value;
}

/**
 * Dipanggil saat manusia membalas / mengetik di percakapan. Kalau kanal
 * mengaktifkan human takeover, AI dijeda untuk percakapan ini.
 */
export async function markHumanActivity(conversationId: string, companyId?: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { companyId: true, metadata: true, channel: { select: { metadata: true } } },
  });
  if (!conv || (companyId && conv.companyId !== companyId)) return;
  const behavior = aiBehaviorOf(conv.channel.metadata);
  if (!behavior.humanTakeover) return;

  const next = behavior.takeoverMinutes > 0
    ? new Date(Date.now() + behavior.takeoverMinutes * 60_000).toISOString()
    : 'manual';
  // Jangan menulis ulang tiap ketikan kalau jeda manual sudah aktif.
  if ((conv.metadata as any)?.aiPausedUntil === 'manual' && next === 'manual') return;
  await writePause(conversationId, next);
}

/** Jeda / lanjutkan AI secara manual dari dashboard. */
export function setAiPaused(conversationId: string, paused: boolean) {
  return writePause(conversationId, paused ? 'manual' : null);
}
