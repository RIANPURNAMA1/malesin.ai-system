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
}

export interface AiReplyOptions {
  message: string;
  useKnowledge?: boolean;
  useMedia?: boolean;
  /** Knowledge yang belum tersimpan, hanya untuk mode test sebelum agent dibuat. */
  pendingKnowledge?: { title: string; content: string }[];
  /** Nama/tipe channel, dipakai untuk mencocokkan pipeline instruksi tambahan. */
  pipeline?: string;
}

export interface AiReplyResult {
  reply: string;
  messages: AiReplyMessage[];
  usedKnowledge: string[];
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

export class AiAgentService {
  listProviders() {
    return aiProviderService.listProviders();
  }

  /** Ambil API key: dari input form, atau dari agent tersimpan (terdekripsi). */
  private async resolveApiKey(companyId: string, apiKey?: string, agentId?: string) {
    if (apiKey?.trim()) return apiKey.trim();
    if (agentId) {
      const agent = await this.findById(companyId, agentId);
      return decrypt(agent.apiKey);
    }
    return '';
  }

  async listModels(companyId: string, dto: { provider: string; apiKey?: string; agentId?: string }) {
    const apiKey = await this.resolveApiKey(companyId, dto.apiKey, dto.agentId);
    return aiProviderService.listModels(dto.provider, apiKey || undefined);
  }

  async testConnection(companyId: string, dto: { provider: string; apiKey?: string; agentId?: string }) {
    const apiKey = await this.resolveApiKey(companyId, dto.apiKey, dto.agentId);
    if (!apiKey) throw createError('API key wajib diisi', 400);
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

    const apiKey = dto.apiKey?.trim() || (agent ? decrypt(agent.apiKey) : '');
    if (!apiKey) throw createError('API key wajib diisi', 400);

    const systemPrompt = (dto.systemPrompt !== undefined ? dto.systemPrompt : agent?.systemPrompt) || '';
    const temperature = dto.temperature ?? agent?.temperature ?? 0.7;
    const maxTokens = dto.maxTokens ?? agent?.maxTokens ?? 1024;

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
      } else {
        const ranked = knowledgeService.rankDetailed(params.pendingKnowledge ?? [], message);
        knowledgeEntries = ranked.map(r => ({ title: r.entry.title, content: r.entry.content, media: [] }));
        usedKnowledge = ranked.map(r => r.entry.title);
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
    // URL gambar yang ditempel di isi knowledge boleh dikirim AI sebagai gambar.
    const knowledgeImageUrls = new Set(extractImageUrls(knowledgeContext));
    const imageUrlInstruction = knowledgeImageUrls.size
      ? 'Jika informasi di atas berisi URL gambar (png/jpg/gif/webp) yang relevan dengan pertanyaan pelanggan, ' +
        'sertakan URL tersebut apa adanya pada baris tersendiri di jawabanmu. Sistem akan mengirimnya sebagai gambar. ' +
        'Jangan pernah membuat URL gambar sendiri.'
      : '';
    const system = [params.systemPrompt, behavior, knowledgeContext, imageUrlInstruction, mediaInstruction, mediaCatalog]
      .filter(Boolean)
      .join('\n\n');

    const messages: AiChatMessage[] = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user' as const, content: message.trim() },
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
      usedMedia: images.map(img => img.title),
      attachments,
      usage: result.usage,
    };
  }
}

export const aiAgentService = new AiAgentService();
