import prisma from '../../config/database';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt } from '../../utils/encryption';
import { createError } from '../../middlewares/error.middleware';
import { AiProviderId, AiChatMessage } from '../ai-provider/adapters/types';
import { getProvider } from '../ai-provider/ai-provider.registry';
import { aiProviderService } from '../ai-provider/ai-provider.service';
import { knowledgeService, KnowledgeWithMedia } from '../knowledge/knowledge.service';
import { aiMediaService, MediaAttachment } from '../ai-media/ai-media.service';
import { parseAiReply, AiReplyMessage, AllowedMedia, extractImageUrls, splitImageUrls } from './ai-reply';
import { extractCustomerData, buildConversationStateContext } from './ai-conversation-context';

/** Batas riwayat chat uji yang dikirim ke AI (cukup untuk konteks, hemat token). */
const TEST_HISTORY_LIMIT = 20;

export interface AdditionalInstruction {
  id: string;
  content: string;
  /** Kosong = berlaku untuk semua pipeline/pelanggan. */
  pipeline?: string | null;
}

export interface AdditionalInstructionInput {
  id?: string;
  content: string;
  pipeline?: string | null;
}

export interface CreateAiAgentDto {
  name: string;
  description?: string;
  provider: AiProviderId;
  model: string;
  apiKey: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  communicationStyle?: string;
  conversationFlow?: string;
  communicationRules?: string;
  additionalInstructions?: AdditionalInstructionInput[];
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
}

export type UpdateAiAgentDto = Partial<CreateAiAgentDto>;

export interface TestResponseDto {
  agentId?: string;
  provider?: AiProviderId;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  communicationStyle?: string;
  conversationFlow?: string;
  communicationRules?: string;
  additionalInstructions?: AdditionalInstructionInput[];
  temperature?: number;
  maxTokens?: number;
  message: string;
  useKnowledge?: boolean;
  useMedia?: boolean;
  /** Knowledge yang belum disimpan (dipakai saat menguji sebelum agent dibuat). */
  knowledge?: { title: string; content: string }[];
  /** Riwayat chat uji sebelumnya (tanpa pesan terbaru) agar AI ingat konteks. */
  history?: { role: string; content: string }[];
}

export interface AiReplyOptions {
  message: string;
  useKnowledge?: boolean;
  useMedia?: boolean;
  /** Knowledge yang belum tersimpan, hanya untuk mode test sebelum agent dibuat. */
  pendingKnowledge?: { title: string; content: string }[];
  /** Nama/tipe channel, dipakai untuk mencocokkan pipeline instruksi tambahan. */
  pipeline?: string;
  /** Riwayat percakapan (tanpa pesan terbaru) supaya AI tidak kehilangan konteks. */
  history?: AiChatMessage[];
  /** Ringkasan state percakapan: data pelanggan & topik yang sudah dibahas. */
  conversationContext?: string;
  /** Jawaban sebelumnya yang tidak boleh diulang (dipakai saat anti-loop). */
  avoidRepeat?: string;
}

export interface AiReplyResult {
  reply: string;
  messages: AiReplyMessage[];
  usedKnowledge: string[];
  /** Knowledge yang benar-benar cocok (skor > 0), dipakai untuk topic tracking. */
  matchedKnowledge: string[];
  usedMedia: string[];
  attachments: MediaAttachment[];
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AiReplyAgent {
  id: string;
  provider: AiProviderId;
  model: string;
  /** API key terenkripsi seperti yang tersimpan di database. */
  apiKey: string;
  systemPrompt: string | null;
  welcomeMessage?: string | null;
  communicationStyle?: string | null;
  conversationFlow?: string | null;
  communicationRules?: string | null;
  additionalInstructions?: Prisma.JsonValue | null;
  version?: number;
  temperature: number;
  maxTokens: number;
}

type ContextEntry = {
  title: string;
  content: string;
  media?: { id: string; altText: string | null; description: string | null; publicUrl: string; filename: string }[];
};

const MAX_INSTRUCTION_CHARS = 100;

/** Validasi & normalisasi instruksi tambahan dari form/DB. */
export function normalizeAdditionalInstructions(raw: unknown): AdditionalInstruction[] {
  if (!Array.isArray(raw)) return [];
  const result: AdditionalInstruction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const content = String(value.content ?? '').trim().slice(0, MAX_INSTRUCTION_CHARS);
    if (!content) continue;
    result.push({
      id: typeof value.id === 'string' && value.id ? value.id : randomUUID(),
      content,
      pipeline: String(value.pipeline ?? '').trim().slice(0, 120) || null,
    });
  }
  return result;
}

function pipelineMatches(instruction: AdditionalInstruction, pipeline?: string): boolean {
  if (!instruction.pipeline) return true;
  // Test/preview tanpa pipeline: tampilkan semua instruksi.
  if (!pipeline) return true;
  const target = instruction.pipeline.toLowerCase();
  const current = pipeline.toLowerCase();
  return current.includes(target) || target.includes(current);
}

function behaviorContext(params: {
  communicationStyle?: string | null;
  conversationFlow?: string | null;
  communicationRules?: string | null;
  additionalInstructions?: unknown;
  pipeline?: string;
}): string {
  const blocks: string[] = [];
  const style = params.communicationStyle?.trim();
  const flow = params.conversationFlow?.trim();
  const rules = params.communicationRules?.trim();
  if (style) blocks.push(`Gaya komunikasi:\n${style}`);
  if (flow) blocks.push(`Alur percakapan:\n${flow}`);
  if (rules) blocks.push(`Aturan & batasan:\n${rules}`);

  const instructions = normalizeAdditionalInstructions(params.additionalInstructions)
    .filter(item => pipelineMatches(item, params.pipeline))
    .map(item => `- ${item.content}`);
  if (instructions.length) {
    blocks.push(`Instruksi tambahan (wajib diikuti):\n${instructions.join('\n')}`);
  }
  return blocks.join('\n\n');
}

/**
 * Aturan anti-loop yang selalu disisipkan ke system prompt. Ini melengkapi
 * riwayat percakapan: riwayat memberi tahu APA yang sudah terjadi, aturan ini
 * memberi tahu APA yang tidak boleh dilakukan lagi.
 */
const CONVERSATION_ANTI_LOOP_RULES = `Aturan percakapan (WAJIB dipatuhi):
1. Baca seluruh riwayat percakapan sebelum menjawab. Riwayat adalah sumber kebenaran tentang apa yang sudah dibicarakan.
2. Jangan menanyakan ulang informasi yang sudah diberikan pelanggan (nama, usia, kota, pendidikan, minat program, dsb). Gunakan data yang sudah ada.
3. Jangan mengulang pesan sambutan, formulir, atau pertanyaan yang sudah pernah kamu kirim.
4. Jawab pertanyaan TERAKHIR pelanggan terlebih dahulu. Jangan mengulang penjelasan dari awal bila topik itu sudah dibahas.
5. Jangan kembali ke tahap atau alur sebelumnya tanpa alasan. Jika pelanggan sudah memilih program, lanjutkan dari situ.
6. Jika jawabanmu berpotensi sama dengan jawaban sebelumnya, ubah: lanjutkan ke langkah berikutnya, beri informasi baru, atau tanyakan satu hal yang belum jelas.
7. Maksimal dua kali klarifikasi. Jika pelanggan tetap tidak jelas atau tidak menjawab pertanyaanmu, tawarkan bantuan admin manusia.
8. Jangan mengarang informasi (harga, biaya, jadwal, syarat). Jika tidak ada di Knowledge Base, sampaikan bahwa informasi tersebut perlu dikonfirmasi admin.
9. Jangan menyalin template jawaban berulang kali hanya karena pelanggan membalas singkat seperti "oke", "boleh", atau "siap". Lanjutkan ke langkah berikutnya.`;

function antiRepeatContext(avoidRepeat?: string): string {
  const previous = avoidRepeat?.trim();
  if (!previous) return '';
  return `PENTING — jawaban berikut sudah pernah kamu kirim dan TIDAK BOLEH diulang atau diparafrase mirip:\n"""${previous.slice(0, 700)}"""\nSusun jawaban yang benar-benar berbeda: jawab pertanyaan terbaru pelanggan, lanjutkan ke langkah berikutnya, atau tawarkan bantuan admin manusia. Jangan menyalin kalimat di atas.`;
}

export class AiAgentService {
  listProviders() {
    return aiProviderService.listProviders();
  }

  /**
   * Ambil API key: dari input form, atau dari agent tersimpan (terdekripsi).
   * Key tersimpan hanya dipakai kalau provider-nya sama; kalau user baru mengganti
   * provider di form, key lama tidak boleh dipakai ke provider baru.
   */
  private async resolveApiKey(companyId: string, provider: string, apiKey?: string, agentId?: string) {
    if (apiKey?.trim()) return apiKey.trim();
    if (agentId) {
      const agent = await this.findById(companyId, agentId);
      if (agent.provider !== provider) return '';
      return decrypt(agent.apiKey);
    }
    return '';
  }

  async listModels(companyId: string, dto: { provider: string; apiKey?: string; agentId?: string }) {
    const apiKey = await this.resolveApiKey(companyId, dto.provider, dto.apiKey, dto.agentId);
    return aiProviderService.listModels(dto.provider, apiKey || undefined);
  }

  async testConnection(companyId: string, dto: { provider: string; apiKey?: string; agentId?: string }) {
    const apiKey = await this.resolveApiKey(companyId, dto.provider, dto.apiKey, dto.agentId);
    if (!apiKey) {
      throw createError(
        'API key wajib diisi untuk provider ini. Key tersimpan hanya berlaku untuk provider yang sama dengan agent.',
        400
      );
    }
    return aiProviderService.testConnection(dto.provider, apiKey);
  }

  private sanitize<T extends { apiKey: string }>(agent: T) {
    const { apiKey, ...rest } = agent;
    return { ...rest, hasApiKey: Boolean(apiKey) };
  }

  private validate(dto: CreateAiAgentDto) {
    if (!dto.name?.trim()) throw createError('Nama agent wajib diisi', 400);
    if (!getProvider(dto.provider)) throw createError('Provider tidak dikenal', 400);
    if (!dto.model?.trim()) throw createError('Model wajib dipilih', 400);
    if (!dto.apiKey?.trim()) throw createError('API key wajib diisi', 400);
  }

  async create(companyId: string, dto: CreateAiAgentDto) {
    this.validate(dto);
    const agent = await prisma.aiAgent.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        provider: dto.provider,
        model: dto.model.trim(),
        apiKey: encrypt(dto.apiKey.trim()),
        systemPrompt: dto.systemPrompt?.trim() || null,
        welcomeMessage: dto.welcomeMessage?.trim() || null,
        communicationStyle: dto.communicationStyle?.trim() || null,
        conversationFlow: dto.conversationFlow?.trim() || null,
        communicationRules: dto.communicationRules?.trim() || null,
        additionalInstructions: normalizeAdditionalInstructions(dto.additionalInstructions) as unknown as Prisma.InputJsonValue,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1024,
        isActive: dto.isActive ?? true,
      },
    });
    return this.sanitize(agent);
  }

  async findAll(companyId: string) {
    const agents = await prisma.aiAgent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { knowledge: true } } },
    });
    return agents.map(a => this.sanitize(a));
  }

  async findById(companyId: string, id: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id, companyId } });
    if (!agent) throw createError('AI Agent tidak ditemukan', 404);
    return agent;
  }

  async getById(companyId: string, id: string) {
    return this.sanitize(await this.findById(companyId, id));
  }

  async update(companyId: string, id: string, dto: UpdateAiAgentDto) {
    await this.findById(companyId, id);
    if (dto.provider && !getProvider(dto.provider)) throw createError('Provider tidak dikenal', 400);

    const instructions = dto.additionalInstructions !== undefined
      ? normalizeAdditionalInstructions(dto.additionalInstructions)
      : undefined;

    const agent = await prisma.aiAgent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt?.trim() || null } : {}),
        ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage?.trim() || null } : {}),
        ...(dto.communicationStyle !== undefined ? { communicationStyle: dto.communicationStyle?.trim() || null } : {}),
        ...(dto.conversationFlow !== undefined ? { conversationFlow: dto.conversationFlow?.trim() || null } : {}),
        ...(dto.communicationRules !== undefined ? { communicationRules: dto.communicationRules?.trim() || null } : {}),
        ...(dto.additionalInstructions !== undefined
          ? {
              additionalInstructions: (instructions?.length ? instructions : Prisma.DbNull) as unknown as Prisma.InputJsonValue,
            }
          : {}),
        version: { increment: 1 },
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        // API key hanya di-update kalau user mengisi nilai baru.
        ...(dto.apiKey?.trim() ? { apiKey: encrypt(dto.apiKey.trim()) } : {}),
      },
    });
    return this.sanitize(agent);
  }

  async delete(companyId: string, id: string) {
    await this.findById(companyId, id);
    await prisma.aiAgent.delete({ where: { id } });
  }

  /**
   * Uji jawaban agent (dipakai tombol "Test AI Response").
   * Bisa memakai agent yang sudah tersimpan (agentId) atau konfigurasi mentah
   * dari form sebelum disimpan. RAG diaktifkan lewat useKnowledge.
   */
  async testResponse(companyId: string, dto: TestResponseDto) {
    if (!dto.message?.trim()) throw createError('Pesan uji wajib diisi', 400);

    let agent: Awaited<ReturnType<typeof this.findById>> | null = null;
    if (dto.agentId) agent = await this.findById(companyId, dto.agentId);

    const provider = dto.provider ?? agent?.provider;
    const model = dto.model?.trim() || agent?.model;
    if (!provider) throw createError('Provider belum dipilih', 400);
    if (!model) throw createError('Model belum dipilih', 400);

    const apiKey = dto.apiKey?.trim() || (agent && agent.provider === provider ? decrypt(agent.apiKey) : '');
    if (!apiKey) throw createError('API key wajib diisi untuk provider ini', 400);

    const systemPrompt = (dto.systemPrompt !== undefined ? dto.systemPrompt : agent?.systemPrompt) || '';
    const temperature = dto.temperature ?? agent?.temperature ?? 0.7;
    const maxTokens = dto.maxTokens ?? agent?.maxTokens ?? 1024;

    // Samakan dengan auto-reply WhatsApp: kirim riwayat + data pelanggan yang
    // sudah diisi, supaya AI tidak menanyakan ulang data diri di tiap pesan.
    const history: AiChatMessage[] = (Array.isArray(dto.history) ? dto.history : [])
      .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-TEST_HISTORY_LIMIT)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 4000) }));
    const conversationContext = buildConversationStateContext({
      customerData: extractCustomerData(history, dto.message),
    });

    return this.generateReply({
      companyId,
      agentId: agent?.id,
      provider,
      model,
      apiKey,
      systemPrompt,
      temperature,
      maxTokens,
      message: dto.message,
      useKnowledge: dto.useKnowledge,
      useMedia: dto.useMedia,
      pendingKnowledge: dto.knowledge,
      history,
      conversationContext: conversationContext || undefined,
      communicationStyle: dto.communicationStyle !== undefined ? dto.communicationStyle : agent?.communicationStyle,
      conversationFlow: dto.conversationFlow !== undefined ? dto.conversationFlow : agent?.conversationFlow,
      communicationRules: dto.communicationRules !== undefined ? dto.communicationRules : agent?.communicationRules,
      additionalInstructions: dto.additionalInstructions !== undefined ? dto.additionalInstructions : agent?.additionalInstructions,
    });
  }

  /**
   * Dipakai auto-reply channel (WhatsApp, dsb). Agent harus sudah tersimpan
   * karena API key diambil dari database.
   */
  async replyForAgent(companyId: string, agent: AiReplyAgent, options: AiReplyOptions): Promise<AiReplyResult> {
    return this.generateReply({
      companyId,
      agentId: agent.id,
      provider: agent.provider,
      model: agent.model,
      apiKey: decrypt(agent.apiKey),
      systemPrompt: agent.systemPrompt || '',
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      message: options.message,
      useKnowledge: options.useKnowledge ?? true,
      useMedia: options.useMedia ?? true,
      pendingKnowledge: options.pendingKnowledge,
      pipeline: options.pipeline,
      history: options.history,
      conversationContext: options.conversationContext,
      avoidRepeat: options.avoidRepeat,
      communicationStyle: agent.communicationStyle,
      conversationFlow: agent.conversationFlow,
      communicationRules: agent.communicationRules,
      additionalInstructions: agent.additionalInstructions,
    });
  }

  private async generateReply(params: {
    companyId: string;
    agentId?: string;
    provider: string;
    model: string;
    apiKey: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    message: string;
    useKnowledge?: boolean;
    useMedia?: boolean;
    pendingKnowledge?: { title: string; content: string }[];
    pipeline?: string;
    history?: AiChatMessage[];
    conversationContext?: string;
    avoidRepeat?: string;
    communicationStyle?: string | null;
    conversationFlow?: string | null;
    communicationRules?: string | null;
    additionalInstructions?: unknown;
  }): Promise<AiReplyResult> {
    const { companyId, agentId, message } = params;

    // --- Retrieval knowledge (RAG) + media yang menempel pada knowledge ---
    let knowledgeEntries: ContextEntry[] = [];
    let relevantKnowledge: KnowledgeWithMedia[] = [];
    let usedKnowledge: string[] = [];
    let matchedKnowledge: string[] = [];

    if (params.useKnowledge) {
      if (agentId) {
        const detailed = await knowledgeService.retrieveDetailed(companyId, agentId, message);
        // Media hanya ditawarkan untuk knowledge yang benar-benar cocok (skor > 0).
        knowledgeEntries = detailed.map(d => ({
          ...d.entry,
          media: d.score > 0 ? d.entry.media : [],
        }));
        relevantKnowledge = detailed.filter(d => d.score > 0).map(d => d.entry);
        usedKnowledge = detailed.map(d => d.entry.title);
        matchedKnowledge = detailed.filter(d => d.score > 0).map(d => d.entry.title);
      } else {
        const ranked = knowledgeService.rankDetailed(params.pendingKnowledge ?? [], message);
        knowledgeEntries = ranked.map(r => ({ title: r.entry.title, content: r.entry.content, media: [] }));
        usedKnowledge = ranked.map(r => r.entry.title);
        matchedKnowledge = ranked.filter(r => r.score > 0).map(r => r.entry.title);
      }
    }

    const knowledgeContext = knowledgeService.buildContext(knowledgeEntries);

    // --- Katalog media untuk balasan AI ---
    const allowedMedia: AllowedMedia[] = [];
    let mediaCatalog = '';

    // Media dari knowledge yang relevan.
    for (const entry of relevantKnowledge) {
      for (const m of entry.media ?? []) {
        allowedMedia.push({
          id: m.id,
          title: `${entry.title} — ${m.altText || m.filename}`,
          url: m.publicUrl,
          caption: m.altText || m.description || entry.title,
        });
      }
    }

    // Media manual (tab Media) yang aktif untuk agent.
    let keywordMedia: Awaited<ReturnType<typeof aiMediaService.activeForAgent>> = [];
    if (params.useMedia && agentId) {
      const activeMedia = await aiMediaService.activeForAgent(companyId, agentId);
      keywordMedia = aiMediaService.matchByKeywords(activeMedia, message);
      for (const m of activeMedia) {
        allowedMedia.push({
          id: m.id,
          title: m.title,
          url: m.mediaUrl,
          caption: m.caption || m.title,
        });
      }
      mediaCatalog = aiMediaService.buildCatalog(activeMedia);
    }

    const mediaInstruction = allowedMedia.length ? knowledgeService.buildMediaInstruction() : '';
    const behavior = behaviorContext({
      communicationStyle: params.communicationStyle,
      conversationFlow: params.conversationFlow,
      communicationRules: params.communicationRules,
      additionalInstructions: params.additionalInstructions,
      pipeline: params.pipeline,
    });
    // URL gambar yang ditempel di knowledge maupun di Perilaku AI (gaya, alur,
    // aturan, instruksi tambahan) boleh dikirim AI sebagai pesan gambar.
    const knowledgeImageUrls = new Set([...extractImageUrls(knowledgeContext), ...extractImageUrls(behavior)]);
    const imageUrlInstruction = knowledgeImageUrls.size
      ? 'Jika instruksi atau informasi di atas berisi URL gambar (png/jpg/gif/webp) yang relevan dengan pertanyaan pelanggan ' +
        'atau dengan langkah alur percakapan saat ini, sertakan URL tersebut apa adanya pada baris tersendiri di jawabanmu. ' +
        'Sistem akan mengirimnya sebagai gambar. Jangan pernah membuat URL gambar sendiri.'
      : '';
    const system = [
      params.systemPrompt,
      CONVERSATION_ANTI_LOOP_RULES,
      params.conversationContext,
      behavior,
      antiRepeatContext(params.avoidRepeat),
      knowledgeContext,
      imageUrlInstruction,
      mediaInstruction,
      mediaCatalog,
    ]
      .filter(Boolean)
      .join('\n\n');

    const conversation = [...(params.history ?? [])];
    const current: AiChatMessage = { role: 'user', content: message.trim() };
    const last = conversation[conversation.length - 1];
    if (last?.role === 'user') {
      // Penggabungan menjaga pergantian role yang valid untuk semua provider.
      conversation[conversation.length - 1] = {
        role: 'user',
        content: `${last.content}\n\n${current.content}`,
      };
    } else {
      conversation.push(current);
    }

    const messages: AiChatMessage[] = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...conversation,
    ];

    const result = await aiProviderService.chat(params.provider, params.apiKey, {
      model: params.model,
      messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    const parsed = parseAiReply(result.text, allowedMedia);

    // Media keyword yang cocok otomatis dikirim (maksimal total 2 gambar).
    const finalMessages: AiReplyMessage[] = splitImageUrls(parsed.messages, knowledgeImageUrls);
    const imageIds = new Set(
      finalMessages.filter((m): m is Extract<AiReplyMessage, { type: 'image' }> => m.type === 'image')
        .map(m => m.mediaId)
    );
    for (const m of keywordMedia) {
      if (imageIds.has(m.id)) continue;
      if (imageIds.size >= 2) break;
      imageIds.add(m.id);
      finalMessages.push({
        type: 'image',
        url: m.mediaUrl,
        caption: m.caption || m.title,
        mediaId: m.id,
        title: m.title,
      });
    }

    const images = finalMessages.filter(
      (m): m is Extract<AiReplyMessage, { type: 'image' }> => m.type === 'image'
    );
    const reply = finalMessages
      .filter((m): m is Extract<AiReplyMessage, { type: 'text' }> => m.type === 'text')
      .map(m => m.content)
      .join('\n\n');

    const attachments: MediaAttachment[] = images.map(img => ({
      id: img.mediaId,
      title: img.title,
      mediaUrl: img.url,
      caption: img.caption ?? null,
      type: 'IMAGE',
    }));

    return {
      reply,
      messages: finalMessages,
      usedKnowledge,
      matchedKnowledge,
      usedMedia: images.map(img => img.title),
      attachments,
      usage: result.usage,
    };
  }
}

export const aiAgentService = new AiAgentService();
