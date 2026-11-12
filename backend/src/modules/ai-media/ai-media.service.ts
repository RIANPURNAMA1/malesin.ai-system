import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';

export type AiMediaTrigger = 'KEYWORD' | 'AI';

export interface AiMediaDto {
  title: string;
  mediaUrl: string;
  caption?: string;
  description?: string;
  keywords?: string;
  trigger?: AiMediaTrigger;
  isActive?: boolean;
}

export interface MediaAttachment {
  id: string;
  title: string;
  mediaUrl: string;
  caption?: string | null;
  /** IMAGE default; disiapkan untuk VIDEO/DOCUMENT di masa depan. */
  type: 'IMAGE';
}

const MARKER_RE = /\[\[\s*media\s*:\s*([a-zA-Z0-9-]+)\s*\]\]/g;

/** Pisahkan string keywords (dipisah koma / baris baru) menjadi array bersih. */
export function parseKeywords(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeKeywords(raw?: string | null): string | null {
  const list = parseKeywords(raw);
  return list.length ? list.join(', ') : null;
}

export class AiMediaService {
  async list(companyId: string, aiAgentId: string) {
    await this.assertAgent(companyId, aiAgentId);
    return prisma.aiMedia.findMany({
      where: { companyId, aiAgentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, aiAgentId: string, dto: AiMediaDto) {
    await this.assertAgent(companyId, aiAgentId);
    if (!dto.title?.trim()) throw createError('Judul media wajib diisi', 400);
    if (!dto.mediaUrl?.trim()) throw createError('Gambar/URL media wajib diisi', 400);
    if (dto.trigger && !['KEYWORD', 'AI'].includes(dto.trigger)) throw createError('Trigger tidak valid', 400);
    return prisma.aiMedia.create({
      data: {
        companyId,
        aiAgentId,
        title: dto.title.trim(),
        mediaUrl: dto.mediaUrl.trim(),
        caption: dto.caption?.trim() || null,
        description: dto.description?.trim() || null,
        keywords: normalizeKeywords(dto.keywords),
        trigger: dto.trigger ?? 'KEYWORD',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(companyId: string, aiAgentId: string, id: string, dto: Partial<AiMediaDto>) {
    await this.findOwned(companyId, aiAgentId, id);
    if (dto.trigger && !['KEYWORD', 'AI'].includes(dto.trigger)) throw createError('Trigger tidak valid', 400);
    return prisma.aiMedia.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl.trim() } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption?.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.keywords !== undefined ? { keywords: normalizeKeywords(dto.keywords) } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async delete(companyId: string, aiAgentId: string, id: string) {
    await this.findOwned(companyId, aiAgentId, id);
    await prisma.aiMedia.delete({ where: { id } });
  }

  // --- Retrieval / orchestration helpers (dipakai oleh AI Agent service) ---

  /** Semua media aktif milik agent. */
  async activeForAgent(companyId: string, aiAgentId: string) {
    return prisma.aiMedia.findMany({ where: { companyId, aiAgentId, isActive: true } });
  }

  /** Media bertipe KEYWORD yang salah satu katanya muncul di pesan pelanggan. */
  matchByKeywords<T extends { trigger: string; keywords: string | null }>(media: T[], message: string): T[] {
    const text = (message || '').toLowerCase();
    if (!text) return [];
    return media.filter(m => {
      if (m.trigger !== 'KEYWORD') return false;
      const keys = parseKeywords(m.keywords);
      return keys.some(k => text.includes(k));
    });
  }

  /**
   * Bangun katalog media untuk disuntikkan ke system prompt supaya AI bisa
   * memilih gambar sendiri (trigger = AI). AI diminta menulis penanda
   * [[media:<id>]] di jawabannya.
   */
  buildCatalog(media: { id: string; title: string; description: string | null; trigger: string }[]): string {
    const aiMedia = media.filter(m => m.trigger === 'AI');
    if (aiMedia.length === 0) return '';
    const lines = aiMedia.map(m => `- id: ${m.id} | ${m.title}${m.description ? ` — ${m.description}` : ''}`).join('\n');
    return [
      'Kamu dapat mengirim GAMBAR kepada pelanggan bila relevan dengan pertanyaan mereka.',
      'Pilih dari daftar media berikut dan tulis penanda persis [[media:<id>]] pada jawabanmu di posisi yang tepat.',
      'Jangan menjelaskan penanda tersebut; cukup tulis penanda bila ingin mengirim gambar. Maksimal 1-2 gambar per balasan.',
      '',
      lines,
    ].join('\n');
  }

  /** Ambil id media yang diminta AI lewat penanda [[media:id]]. */
  extractRequestedIds(text: string): string[] {
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    MARKER_RE.lastIndex = 0;
    while ((m = MARKER_RE.exec(text || '')) !== null) ids.push(m[1]);
    return ids;
  }

  /** Buang penanda [[media:id]] dari teks balasan. */
  stripMarkers(text: string): string {
    return (text || '').replace(MARKER_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Ubah entri media menjadi attachment yang siap dikirim. */
  toAttachment(m: { id: string; title: string; mediaUrl: string; caption: string | null }): MediaAttachment {
    return { id: m.id, title: m.title, mediaUrl: m.mediaUrl, caption: m.caption, type: 'IMAGE' };
  }

  private async assertAgent(companyId: string, aiAgentId: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: aiAgentId, companyId }, select: { id: true } });
    if (!agent) throw createError('AI Agent tidak ditemukan', 404);
  }

  private async findOwned(companyId: string, aiAgentId: string, id: string) {
    const item = await prisma.aiMedia.findFirst({ where: { id, aiAgentId, companyId } });
    if (!item) throw createError('Media tidak ditemukan', 404);
    return item;
  }
}

export const aiMediaService = new AiMediaService();
