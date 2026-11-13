import prisma from '../../config/database';
import logger from '../../utils/logger';
import { MessageService } from '../message/message.service';
import { aiAgentService, AiReplyResult } from './ai-agent.service';
import { extractImageUrls, splitImageUrls } from './ai-reply';
import { AiBehavior, aiBehaviorOf, isAiPaused } from './ai-takeover';
import { whatsAppUnofficialService } from '../channel/whatsapp-unofficial.service';
import {
  buildConversationStateContext,
  extractCustomerData,
  findDuplicateReply,
  loadConversationHistory,
  loadRecentAssistantReplies,
  mergeAiState,
  mergeTopics,
  normalizeText,
  readAiState,
} from './ai-conversation-context';

export interface AutoReplyInput {
  companyId: string;
  channelId: string;
  conversationId: string;
  /** Teks pesan masuk dari pelanggan. */
  text?: string | null;
  /** JID asal pesan (dipakai untuk mendeteksi grup). */
  remoteJid?: string | null;
}

export interface AutoReplyOutcome {
  replied: boolean;
  reason?: string;
  welcomeSent?: boolean;
  imagesSent: number;
  imagesFailed: number;
  result?: AiReplyResult;
}

function channelFlags(metadata: unknown) {
  const meta = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;
  return {
    aiAgentId: typeof meta.aiAgentId === 'string' && meta.aiAgentId.trim() ? meta.aiAgentId.trim() : null,
    // false = AI dinonaktifkan untuk kanal ini (pengaturan kanal).
    aiEnabled: meta.aiEnabled !== false,
    // Default aktif; channel bisa mematikan lewat metadata.
    useKnowledge: meta.aiUseKnowledge !== false,
    useMedia: meta.aiUseMedia !== false,
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mengatur ritme balasan supaya terasa manusiawi: jeda awal acak, lalu animasi
 * "sedang mengetik..." (WhatsApp Unofficial) yang lamanya sebanding panjang pesan.
 * Sebelum tiap pesan dikirim, status jeda dicek ulang: kalau manusia mengambil
 * alih di tengah jalan, AI berhenti.
 */
function createPacer(opts: {
  channelId: string;
  channelType: string;
  conversationId: string;
  target: string | null;
  behavior: AiBehavior;
  startedAt: number;
}) {
  const { behavior: b } = opts;
  const isWa = opts.channelType === 'WHATSAPP_UNOFFICIAL' && !!opts.target;
  let first = true;

  const presence = (state: 'composing' | 'paused') =>
    isWa
      ? whatsAppUnofficialService.sendPresence(opts.channelId, opts.target!, state).catch(() => undefined)
      : Promise.resolve();

  const paused = async () => {
    const conv = await prisma.conversation.findUnique({ where: { id: opts.conversationId }, select: { metadata: true } });
    return isAiPaused(conv?.metadata);
  };

  return {
    /** Tunggu giliran kirim. false = berhenti karena manusia mengambil alih. */
    async beforeSend(text: string): Promise<boolean> {
      if (first) {
        first = false;
        const delayMs = (b.replyDelayMin + Math.random() * (b.replyDelayMax - b.replyDelayMin)) * 1000;
        await sleep(Math.max(0, delayMs - (Date.now() - opts.startedAt)));
      }
      if (await paused()) { await presence('paused'); return false; }

      if (isWa && b.typingIndicator) {
        // Status "mengetik" di WA kedaluwarsa ±10 detik, jadi dikirim ulang tiap 8 detik.
        let remaining = Math.min(15_000, Math.max(1_200, (text.length / b.typingSpeed) * 1000));
        while (remaining > 0) {
          await presence('composing');
          const step = Math.min(remaining, 8_000);
          await sleep(step);
          remaining -= step;
        }
        if (await paused()) { await presence('paused'); return false; }
      }
      return true;
    },
    done: () => presence('paused'),
  };
}

/**
 * Pesan eskalasi deterministik: dikirim kalau AI tetap mengulang jawaban yang
 * sama setelah satu kali percobaan ulang.
 */
const ESCALATION_REPLY =
  'Mohon maaf kak 🙏 Sepertinya saya perlu bantuan admin untuk menjawab ini dengan tepat. ' +
  'Saya sambungkan ke admin kami ya, mohon ditunggu sebentar. Terima kasih 🙏';

/**
 * Antrean per percakapan. Dua pesan WhatsApp yang masuk hampir bersamaan tidak
 * boleh diproses paralel: proses kedua bisa membaca konteks sebelum balasan
 * pertama tersimpan, lalu mengulang jawaban yang sama.
 */
const conversationQueues = new Map<string, Promise<AutoReplyOutcome>>();
const latestInputs = new Map<string, { seq: number; input: AutoReplyInput }>();
let inputSeq = 0;

/** Jendela penggabungan pesan beruntun (pelanggan sering mengirim 2–3 pesan). */
const BURST_WINDOW_MS = 1_200;

const skipped = (reason: string): AutoReplyOutcome => ({
  replied: false,
  reason,
  imagesSent: 0,
  imagesFailed: 0,
});

/**
 * Auto-reply AI Agent untuk pesan masuk.
 *
 * Aturan penting:
 * - Hanya pesan masuk (bukan pesan kita sendiri) dan bukan grup.
 * - Agent dipilih dari `channel.metadata.aiAgentId`; kalau tidak diset, pakai
 *   agent aktif pertama milik company (backward compatible).
 * - Pesan teks dikirim lebih dulu, lalu gambar satu per satu. Kegagalan gambar
 *   tidak membatalkan pesan teks dan tidak melempar error ke webhook.
 */
class AiAutoReplyService {
  async maybeAutoReply(input: AutoReplyInput): Promise<AutoReplyOutcome> {
    const { conversationId } = input;
    const mySeq = ++inputSeq;
    latestInputs.set(conversationId, { seq: mySeq, input });

    const run = async (): Promise<AutoReplyOutcome> => {
      // Beri jeda singkat supaya pesan yang dikirim beruntun bisa digabung.
      // Pesan terbaru tetap memuat seluruh riwayat, jadi cukup satu balasan.
      await sleep(BURST_WINDOW_MS);
      const latest = latestInputs.get(conversationId);
      if (latest && latest.seq > mySeq) return skipped('superseded');
      return this.handle(latest?.input ?? input);
    };

    const previous = conversationQueues.get(conversationId) ?? Promise.resolve(skipped('idle'));
    const next = previous.catch(() => skipped('failed')).then(run);
    conversationQueues.set(conversationId, next);
    try {
      return await next;
    } finally {
      if (conversationQueues.get(conversationId) === next) {
        conversationQueues.delete(conversationId);
        latestInputs.delete(conversationId);
      }
    }
  }

  private async handle(input: AutoReplyInput): Promise<AutoReplyOutcome> {
    const startedAt = Date.now();
    const text = input.text?.trim();
    if (!text) return { replied: false, reason: 'no-text', imagesSent: 0, imagesFailed: 0 };
    if (input.remoteJid && /@(g\.us|broadcast)$/i.test(input.remoteJid)) {
      return { replied: false, reason: 'group-or-broadcast', imagesSent: 0, imagesFailed: 0 };
    }

    const channel = await prisma.channel.findFirst({
      where: { id: input.channelId, companyId: input.companyId },
      select: { id: true, name: true, type: true, metadata: true },
    });
    if (!channel) return { replied: false, reason: 'channel-not-found', imagesSent: 0, imagesFailed: 0 };

    const flags = channelFlags(channel.metadata);
    if (!flags.aiEnabled) return { replied: false, reason: 'ai-disabled', imagesSent: 0, imagesFailed: 0 };
    const agent = flags.aiAgentId
      ? await prisma.aiAgent.findFirst({
          where: { id: flags.aiAgentId, companyId: input.companyId, isActive: true },
        })
      : await prisma.aiAgent.findFirst({
          where: { companyId: input.companyId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

    if (!agent) return { replied: false, reason: 'no-active-agent', imagesSent: 0, imagesFailed: 0 };

    // Human takeover: percakapan sedang ditangani manusia → AI diam.
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { metadata: true, contact: { select: { phone: true, metadata: true } } },
    });
    // Nomor yang dikecualikan dari AI (pengaturan per kontak, berlaku di semua kanal).
    if ((conversation?.contact.metadata as { aiDisabled?: boolean } | null)?.aiDisabled === true) {
      return { replied: false, reason: 'contact-excluded', imagesSent: 0, imagesFailed: 0 };
    }
    if (isAiPaused(conversation?.metadata)) {
      return { replied: false, reason: 'human-takeover', imagesSent: 0, imagesFailed: 0 };
    }
    const pacer = createPacer({
      channelId: channel.id,
      channelType: channel.type,
      conversationId: input.conversationId,
      target: (conversation?.contact.metadata as { whatsappId?: string } | null)?.whatsappId || conversation?.contact.phone || null,
      behavior: aiBehaviorOf(channel.metadata),
      startedAt,
    });

    const messageServiceInstance = new MessageService();

    // Pesan sambutan hanya dikirim sekali, saat belum ada pesan keluar sama sekali.
    let welcomeSent = false;
    const welcome = agent.welcomeMessage?.trim();
    if (welcome) {
      const outboundCount = await prisma.message.count({
        where: { conversationId: input.conversationId, direction: 'OUTBOUND' },
      });
      if (outboundCount === 0) {
        try {
          // URL gambar di pesan sambutan dikirim sebagai gambar setelah teksnya.
          const parts = splitImageUrls([{ type: 'text', content: welcome }], new Set(extractImageUrls(welcome)));
          for (const part of parts) {
            if (!(await pacer.beforeSend(part.type === 'text' ? part.content : part.caption || ''))) {
              return { replied: welcomeSent, reason: 'human-takeover', welcomeSent, imagesSent: 0, imagesFailed: 0 };
            }
            await messageServiceInstance.sendMessage(input.companyId, input.conversationId, null,
              part.type === 'text'
                ? { type: 'TEXT', content: part.content }
                : { type: 'IMAGE', mediaUrl: part.url, fileName: part.title }, { source: 'AI', aiAgentId: agent.id });
          }
          welcomeSent = true;
        } catch (err) {
          logger.error('AI welcome message send failed', {
            companyId: input.companyId,
            channelId: input.channelId,
            conversationId: input.conversationId,
            agentId: agent.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const pipeline = `${channel.name} ${channel.type}`;

    // --- Konteks & state percakapan (anti-loop) ---
    // Dimuat SETELAH pesan sambutan dikirim supaya sambutan ikut dihitung
    // sebagai jawaban sebelumnya (AI tidak boleh mengulanginya).
    const history = await loadConversationHistory(input.conversationId, text);
    const state = await readAiState(input.conversationId);
    const customerData = extractCustomerData(history, text);
    const previousReplies = await loadRecentAssistantReplies(input.conversationId, 2);
    const conversationContext = buildConversationStateContext({ customerData, state });

    const agentConfig = {
      id: agent.id,
      provider: agent.provider,
      model: agent.model,
      apiKey: agent.apiKey,
      systemPrompt: agent.systemPrompt,
      welcomeMessage: agent.welcomeMessage,
      communicationStyle: agent.communicationStyle,
      conversationFlow: agent.conversationFlow,
      communicationRules: agent.communicationRules,
      additionalInstructions: agent.additionalInstructions,
      version: agent.version,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    };
    const generate = (avoidRepeat?: string) =>
      aiAgentService.replyForAgent(input.companyId, agentConfig, {
        message: text,
        useKnowledge: flags.useKnowledge,
        useMedia: flags.useMedia,
        pipeline,
        history,
        conversationContext,
        avoidRepeat,
      });

    let result: AiReplyResult;
    let repeated = false;
    let escalated = false;
    try {
      result = await generate();

      // Anti-loop deterministik: bandingkan dengan jawaban AI sebelumnya.
      const duplicateOf = findDuplicateReply(result.reply, previousReplies);
      if (duplicateOf) {
        repeated = true;
        logger.warn('AI reply mirip jawaban sebelumnya, menyusun ulang', {
          companyId: input.companyId,
          conversationId: input.conversationId,
          previousReplyChars: duplicateOf.length,
        });
        const retry = await generate(duplicateOf);
        if (retry.reply.trim() || retry.messages.length) result = retry;
      }

      if (findDuplicateReply(result.reply, previousReplies)) {
        // Tetap mengulang → jangan kirim jawaban duplikat; tawarkan admin.
        escalated = true;
        logger.warn('AI masih mengulang jawaban, dialihkan ke eskalasi admin', {
          companyId: input.companyId,
          conversationId: input.conversationId,
        });
        result = {
          ...result,
          reply: ESCALATION_REPLY,
          messages: [{ type: 'text', content: ESCALATION_REPLY }],
        };
      }
    } catch (err) {
      logger.error('AI auto-reply generation failed', {
        companyId: input.companyId,
        channelId: input.channelId,
        agentId: agent.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { replied: false, reason: 'generation-failed', welcomeSent, imagesSent: 0, imagesFailed: 0 };
    }

    // Kirim berurutan sesuai output AI: teks dulu, lalu gambar.
    // Gambar yang gagal tidak membatalkan pesan lain.
    let imagesSent = 0;
    let imagesFailed = 0;
    let textSent = false;

    for (const item of result.messages) {
      const preview = item.type === 'text' ? item.content.trim() : item.caption || '';
      if (item.type === 'text' && !preview) continue;
      if (!(await pacer.beforeSend(preview))) {
        logger.info('AI auto-reply dihentikan: percakapan diambil alih manusia', { conversationId: input.conversationId });
        break;
      }
      try {
        if (item.type === 'text') {
          const content = item.content.trim();
          if (!content) continue;
          await messageServiceInstance.sendMessage(input.companyId, input.conversationId, null, {
            type: 'TEXT',
            content,
          }, { source: 'AI', aiAgentId: agent.id });
          textSent = true;
        } else {
          await messageServiceInstance.sendMessage(input.companyId, input.conversationId, null, {
            type: 'IMAGE',
            mediaUrl: item.url,
            content: item.caption || undefined,
            fileName: item.title,
          }, { source: 'AI', aiAgentId: agent.id });
          imagesSent += 1;
        }
      } catch (err) {
        if (item.type === 'image') {
          imagesFailed += 1;
          logger.error('AI auto-reply image send failed', {
            companyId: input.companyId,
            channelId: input.channelId,
            conversationId: input.conversationId,
            mediaUrl: item.url,
            mediaId: item.mediaId,
            error: err instanceof Error ? err.message : String(err),
          });
        } else {
          logger.error('AI auto-reply text send failed', {
            companyId: input.companyId,
            channelId: input.channelId,
            conversationId: input.conversationId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await pacer.done();

    // State diperbarui setelah balasan berhasil diproses. Ini yang membuat
    // percakapan berikutnya tahu data & topik yang sudah diberikan.
    if (textSent || imagesSent > 0) {
      try {
        await mergeAiState(input.conversationId, {
          customerData: { ...(state.customerData ?? {}), ...customerData },
          answeredTopics: mergeTopics(state.answeredTopics, result.matchedKnowledge ?? []),
          lastReplySignature: normalizeText(result.reply).slice(0, 400),
          lastReplyAt: new Date().toISOString(),
          repeatCount: repeated ? (state.repeatCount ?? 0) + 1 : 0,
          ...(escalated ? { escalationOfferedAt: new Date().toISOString() } : {}),
        });
      } catch (err) {
        logger.error('Gagal menyimpan state percakapan AI', {
          companyId: input.companyId,
          conversationId: input.conversationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('AI auto-reply processed', {
      companyId: input.companyId,
      channelId: input.channelId,
      conversationId: input.conversationId,
      agentId: agent.id,
      welcomeSent,
      textSent,
      imagesSent,
      imagesFailed,
      usedKnowledge: result.usedKnowledge,
      repeated,
      escalated,
    });

    return { replied: textSent || imagesSent > 0 || welcomeSent, welcomeSent, imagesSent, imagesFailed, result };
  }
}

export const aiAutoReplyService = new AiAutoReplyService();
