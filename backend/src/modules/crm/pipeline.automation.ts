import { Prisma, PipelineStage } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { decrypt } from '../../utils/encryption';
import { aiProviderService } from '../ai-provider/ai-provider.service';
import { getIO } from '../../sockets/socket.server';
import { changeStage, ensureDefaultPipeline, emitDeal } from './pipeline.service';

/**
 * Otomasi pipeline:
 * - Kejadian sistem (pasti): chat pertama → Lead baru, dibalas → Follow up,
 *   info pembayaran dikirim → Menunggu pembayaran, tidak aktif N hari → Kalah.
 * - Pembacaan AI: setelah percakapan diam 2 menit / 5 pesan baru. Keyakinan
 *   ≥ 80% & maju ≤ 2 tahap → pindah otomatis; 50–80% atau menuju Menang/Kalah → saran.
 * Pengaman: hanya maju otomatis, Menang tidak pernah oleh AI, deal yang dipindah
 * manual dikunci dari AI 24 jam, dan semua tercatat di riwayat.
 */
const AI_DEBOUNCE_MS = 2 * 60_000;
const AI_BURST = 5;
const AUTO_CONFIDENCE = 0.8;
const SUGGEST_CONFIDENCE = 0.5;
const MAX_AUTO_JUMP = 2;
const STALE_CHECK_MS = 10 * 60_000;
const PAYMENT_RE = /\b(no\.?\s?rek(ening)?|rekening|transfer ke|virtual account|kode va|\bva\b|qris|link pembayaran|link bayar|bayar(nya)? (ke|via|melalui)|payment link|invoice)\b/i;

const timers = new Map<string, { timer: NodeJS.Timeout; count: number }>();

async function defaultPipeline(companyId: string) {
  const p = await ensureDefaultPipeline(companyId);
  return p.autoMode === 'MANUAL' ? null : p;
}

const byRule = (stages: PipelineStage[], rule: string) => stages.find(s => s.autoRule === rule);

/** Pesan masuk dari pelanggan. */
export async function onInbound(input: { companyId: string; contactId: string; conversationId: string; text?: string | null }) {
  try {
    const p = await defaultPipeline(input.companyId);
    if (!p) return;
    const deal = await prisma.deal.findFirst({ where: { pipelineId: p.id, contactId: input.contactId }, orderBy: { createdAt: 'desc' } });

    if (!deal) {
      if (!p.autoCreateDeals) return;
      const stage = byRule(p.stages, 'FIRST_CHAT') ?? p.stages.find(s => s.kind === 'OPEN')!;
      const [contact, assignment] = await Promise.all([
        prisma.contact.findUnique({ where: { id: input.contactId }, select: { name: true } }),
        prisma.assignment.findFirst({ where: { conversationId: input.conversationId, unassignedAt: null }, select: { userId: true } }),
      ]);
      const created = await prisma.deal.create({
        data: {
          companyId: input.companyId, pipelineId: p.id, stageId: stage.id, contactId: input.contactId,
          ownerId: assignment?.userId ?? null, title: contact?.name ?? 'Lead baru',
          activities: { create: { type: 'CREATED', actor: 'SYSTEM', toStageId: stage.id, message: 'Kontak baru menghubungi' } },
        },
      });
      emitDeal(input.companyId, created.id, p.id);
      return scheduleAi(created.id, input.text);
    }

    if (deal.status === 'WON') return; // pelanggan lama: tidak diubah otomatis
    if (deal.status === 'LOST') {
      // Kontak yang sudah Batal chat lagi → kembali ke Follow up.
      const back = byRule(p.stages, 'REPLIED') ?? p.stages.find(s => s.kind === 'OPEN');
      if (back) await changeStage(deal, back, 'SYSTEM', { message: 'Kontak kembali menghubungi' });
      return scheduleAi(deal.id, input.text);
    }
    await prisma.deal.update({ where: { id: deal.id }, data: { lastActivityAt: new Date() } });
    scheduleAi(deal.id, input.text);
  } catch (err) {
    logger.error('Pipeline onInbound failed', err);
  }
}

/** Pesan keluar (AI / agen / HP) — aturan "dibalas" dan "info pembayaran dikirim". */
export async function onOutbound(conversationId: string, content?: string | null) {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { companyId: true, contactId: true } });
    if (!conv) return;
    const p = await defaultPipeline(conv.companyId);
    if (!p) return;
    const deal = await prisma.deal.findFirst({ where: { pipelineId: p.id, contactId: conv.contactId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
    if (!deal) return;
    const current = p.stages.find(s => s.id === deal.stageId);
    if (!current) return;

    const payment = byRule(p.stages, 'PAYMENT_SENT');
    if (content && PAYMENT_RE.test(content) && payment && payment.position > current.position) {
      return void (await changeStage(deal, payment, 'SYSTEM', { message: 'Info pembayaran dikirim ke pelanggan', metadata: { evidence: content.slice(0, 200) } }));
    }
    const replied = byRule(p.stages, 'REPLIED');
    if (current.autoRule === 'FIRST_CHAT' && replied && replied.position > current.position) {
      return void (await changeStage(deal, replied, 'SYSTEM', { message: 'Pelanggan sudah dibalas' }));
    }
    await prisma.deal.update({ where: { id: deal.id }, data: { lastActivityAt: new Date() } });
  } catch (err) {
    logger.error('Pipeline onOutbound failed', err);
  }
}

function scheduleAi(dealId: string, text?: string | null) {
  if (!text?.trim()) return;
  const entry = timers.get(dealId);
  if (entry) clearTimeout(entry.timer);
  const count = (entry?.count ?? 0) + 1;
  const run = () => { timers.delete(dealId); void classifyDeal(dealId).catch(err => logger.error('Pipeline AI failed', err)); };
  if (count >= AI_BURST) return run();
  timers.set(dealId, { timer: setTimeout(run, AI_DEBOUNCE_MS), count });
}

async function pickAgent(companyId: string, channelId?: string) {
  const channel = channelId ? await prisma.channel.findUnique({ where: { id: channelId }, select: { metadata: true } }) : null;
  const agentId = (channel?.metadata as { aiAgentId?: string } | null)?.aiAgentId;
  return (agentId && await prisma.aiAgent.findFirst({ where: { id: agentId, companyId, isActive: true } }))
    || prisma.aiAgent.findFirst({ where: { companyId, isActive: true }, orderBy: { createdAt: 'asc' } });
}

/** AI membaca percakapan terakhir dan menentukan tahap. */
export async function classifyDeal(dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { pipeline: { include: { stages: { orderBy: { position: 'asc' } } } } } });
  if (!deal || deal.status !== 'OPEN' || deal.pipeline.autoMode === 'MANUAL') return;
  const stages = deal.pipeline.stages;
  const current = stages.find(s => s.id === deal.stageId);
  if (!current) return;

  const conv = await prisma.conversation.findFirst({
    where: { contactId: deal.contactId, companyId: deal.companyId },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    select: { id: true, channelId: true },
  });
  if (!conv) return;
  const msgs = (await prisma.message.findMany({
    where: { conversationId: conv.id, content: { not: null } },
    orderBy: { sentAt: 'desc' }, take: 20,
    select: { direction: true, content: true, metadata: true },
  })).reverse();
  const transcript = msgs
    .filter(m => !['BROADCAST', 'SYSTEM'].includes((m.metadata as { source?: string } | null)?.source ?? ''))
    .map(m => `${m.direction === 'INBOUND' ? 'Pelanggan' : 'Bisnis'}: ${m.content!.slice(0, 500)}`)
    .join('\n');
  if (!transcript) return;

  const agent = await pickAgent(deal.companyId, conv.channelId);
  if (!agent) return;

  const keys = stages.map((s, i) => ({ key: `S${i + 1}`, stage: s }));
  const system = [
    'Kamu adalah analis CRM. Tentukan tahap pipeline penjualan pelanggan berdasarkan percakapan.',
    'Daftar tahap:',
    ...keys.map(k => `${k.key} = ${k.stage.name} (${k.stage.kind === 'WON' ? 'menang/closing' : k.stage.kind === 'LOST' ? 'kalah/batal' : 'terbuka'}): ${k.stage.aiHint || '-'}`),
    `Tahap saat ini: ${keys.find(k => k.stage.id === current.id)!.key}.`,
    'Nilai berdasarkan bukti nyata di percakapan, bukan dugaan. Jika tidak ada perubahan, pilih tahap saat ini.',
    'Balas HANYA JSON tanpa teks lain: {"stage":"S?","confidence":0-1,"reason":"alasan singkat bahasa Indonesia","evidence":"kutipan kalimat pelanggan"}',
  ].join('\n');

  const result = await aiProviderService.chat(agent.provider, decrypt(agent.apiKey), {
    model: agent.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: `Percakapan:\n${transcript}` }],
    temperature: 0,
    maxTokens: 300,
  });
  const json = result.text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return;
  let out: { stage?: string; confidence?: number; reason?: string; evidence?: string };
  try { out = JSON.parse(json); } catch { return; }
  const target = keys.find(k => k.key === String(out.stage).trim().toUpperCase())?.stage;
  const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
  if (!target || target.id === current.id || confidence < SUGGEST_CONFIDENCE) return;

  const forward = target.position > current.position;
  if (target.kind === 'OPEN' && !forward) return; // mundur hanya manual

  const reason = String(out.reason ?? '').slice(0, 300);
  const evidence = String(out.evidence ?? '').slice(0, 300);
  const fresh = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!fresh || fresh.status !== 'OPEN' || fresh.stageId !== current.id) return; // sudah berubah saat AI berpikir

  const locked = fresh.aiLockedUntil && fresh.aiLockedUntil > new Date();
  const autoAllowed = deal.pipeline.autoMode === 'AUTO' && !locked && target.kind === 'OPEN'
    && confidence >= AUTO_CONFIDENCE && target.position - current.position <= MAX_AUTO_JUMP;

  if (autoAllowed) {
    await changeStage(fresh, target, 'AI', { message: reason, metadata: { confidence, evidence } });
    return;
  }
  // Selain itu jadi saran untuk dikonfirmasi agen (termasuk Menang/Kalah).
  const suggestion = { stageId: target.id, confidence, reason, evidence, at: new Date().toISOString() };
  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: { aiSuggestion: suggestion as Prisma.InputJsonValue } }),
    prisma.dealActivity.create({
      data: { dealId, type: 'SUGGESTION', actor: 'AI', fromStageId: current.id, toStageId: target.id, message: reason, metadata: { confidence, evidence } },
    }),
  ]);
  emitDeal(deal.companyId, dealId, deal.pipelineId);
  getIO().to(`company:${deal.companyId}`).emit('notification', {
    type: 'DEAL_SUGGESTION', title: 'Saran AI di Pipeline',
    body: `${deal.title}: pindah ke ${target.name} (${Math.round(confidence * 100)}%)`, link: `/pipeline?deal=${dealId}`,
  });
}

/** Deal tanpa aktivitas selama `lostAfterDays` hari → tahap Kalah. */
async function sweepStale() {
  const pipelines = await prisma.pipeline.findMany({
    where: { autoMode: { not: 'MANUAL' }, lostAfterDays: { gt: 0 } },
    include: { stages: true },
  });
  for (const p of pipelines) {
    const lost = p.stages.find(s => s.kind === 'LOST');
    if (!lost) continue;
    const stale = await prisma.deal.findMany({
      where: { pipelineId: p.id, status: 'OPEN', lastActivityAt: { lt: new Date(Date.now() - p.lostAfterDays * 86_400_000) } },
      take: 200,
    });
    for (const d of stale) {
      await changeStage(d, lost, 'SYSTEM', { lostReason: 'Tidak merespons', message: `Tidak ada aktivitas ${p.lostAfterDays} hari` })
        .catch(err => logger.error(`Stale deal ${d.id}`, err));
    }
  }
}

let staleTimer: NodeJS.Timeout | null = null;
export function startPipelineAutomation() {
  if (staleTimer) return;
  staleTimer = setInterval(() => void sweepStale().catch(err => logger.error('Pipeline sweep failed', err)), STALE_CHECK_MS);
  logger.info('Pipeline automation started');
}
