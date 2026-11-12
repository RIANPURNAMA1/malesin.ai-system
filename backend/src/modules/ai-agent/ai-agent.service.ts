import prisma from '../../config/database';
import { encrypt, decrypt } from '../../utils/encryption';
import { createError } from '../../middlewares/error.middleware';
import { AiProviderId, AiChatMessage } from '../ai-provider/adapters/types';
import { getProvider } from '../ai-provider/ai-provider.registry';
import { aiProviderService } from '../ai-provider/ai-provider.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import { aiMediaService, MediaAttachment } from '../ai-media/ai-media.service';

export interface CreateAiAgentDto {
  name: string;
  description?: string;
  provider: AiProviderId;
  model: string;
  apiKey: string;
  systemPrompt?: string;
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
  temperature?: number;
  maxTokens?: number;
  message: string;
  useKnowledge?: boolean;
  useMedia?: boolean;
  /** Knowledge yang belum disimpan (dipakai saat menguji sebelum agent dibuat). */
  knowledge?: { title: string; content: string }[];
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

    const agent = await prisma.aiAgent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt?.trim() || null } : {}),
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

    // Retrieval knowledge untuk RAG.
    let knowledgeContext = '';
    let usedKnowledge: string[] = [];
    if (dto.useKnowledge) {
      const entries = agent
        ? await knowledgeService.retrieve(companyId, agent.id, dto.message)
        : knowledgeService.rank(dto.knowledge ?? [], dto.message);
      knowledgeContext = knowledgeService.buildContext(entries);
      usedKnowledge = entries.map(e => e.title);
    }

    // Media untuk balasan AI. Katalog di-inject ke system prompt agar AI tahu
    // gambar apa saja yang tersedia dan bisa menulis penanda [[media:<id>]].
    let mediaCatalog = '';
    let activeMedia: Awaited<ReturnType<typeof aiMediaService.activeForAgent>> = [];
    if (dto.useMedia && agent) {
      activeMedia = await aiMediaService.activeForAgent(companyId, agent.id);
      mediaCatalog = aiMediaService.buildCatalog(activeMedia);
    }

    const system = [systemPrompt, knowledgeContext, mediaCatalog].filter(Boolean).join('\n\n');
    const messages: AiChatMessage[] = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user' as const, content: dto.message.trim() },
    ];

    const result = await aiProviderService.chat(provider, apiKey, { model, messages, temperature, maxTokens });

    // Resolusi penanda [[media:<id>]] yang ditulis AI menjadi attachment siap kirim.
    let attachments: MediaAttachment[] = [];
    let usedMedia: string[] = [];
    if (dto.useMedia && agent) {
      const requestedIds = aiMediaService.extractRequestedIds(result.text);
      if (requestedIds.length) {
        const mediaMap = new Map(activeMedia.map(m => [m.id, m]));
        const seen = new Set<string>();
        for (const id of requestedIds) {
          if (seen.has(id)) continue;
          seen.add(id);
          const m = mediaMap.get(id);
          if (m) {
            attachments.push(aiMediaService.toAttachment({ id: m.id, title: m.title, mediaUrl: m.mediaUrl, caption: m.caption }));
            usedMedia.push(m.title);
          }
        }
      }
    }

    return {
      reply: dto.useMedia ? aiMediaService.stripMarkers(result.text) : result.text,
      usedKnowledge,
      usedMedia,
      attachments,
      usage: result.usage,
    };
  }
}
