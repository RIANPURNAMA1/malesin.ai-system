import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';

export interface KnowledgeDto {
  title: string;
  content: string;
}

const STOPWORDS = new Set([
  'dan', 'yang', 'untuk', 'dengan', 'dari', 'ini', 'itu', 'ada', 'apa', 'saya', 'kamu', 'anda',
  'kah', 'nya', 'di', 'ke', 'pada', 'atau', 'juga', 'akan', 'bisa', 'tidak', 'the', 'a', 'an',
  'is', 'are', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'how', 'what', 'i', 'you',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/**
 * Retrieval sederhana berbasis kata kunci (keyword scoring) untuk RAG.
 * Cukup ringan untuk MySQL tanpa vector DB, dan mudah diganti dengan
 * embedding + vector store di masa depan tanpa mengubah pemanggilnya.
 */
export class KnowledgeService {
  async list(companyId: string, aiAgentId: string) {
    await this.assertAgent(companyId, aiAgentId);
    return prisma.aiKnowledge.findMany({
      where: { companyId, aiAgentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, aiAgentId: string, dto: KnowledgeDto) {
    await this.assertAgent(companyId, aiAgentId);
    if (!dto.title?.trim()) throw createError('Judul knowledge wajib diisi', 400);
    if (!dto.content?.trim()) throw createError('Isi knowledge wajib diisi', 400);
    return prisma.aiKnowledge.create({
      data: { companyId, aiAgentId, title: dto.title.trim(), content: dto.content.trim() },
    });
  }

  async update(companyId: string, aiAgentId: string, id: string, dto: Partial<KnowledgeDto>) {
    await this.findOwned(companyId, aiAgentId, id);
    return prisma.aiKnowledge.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
      },
    });
  }

  async delete(companyId: string, aiAgentId: string, id: string) {
    await this.findOwned(companyId, aiAgentId, id);
    await prisma.aiKnowledge.delete({ where: { id } });
  }

  /**
   * Ambil knowledge paling relevan terhadap query. Kalau tidak ada yang cocok
   * sama sekali, kembalikan beberapa knowledge terbaru sebagai konteks umum.
   */
  async retrieve(companyId: string, aiAgentId: string, query: string, limit = 5) {
    const entries = await prisma.aiKnowledge.findMany({ where: { companyId, aiAgentId } });
    return this.rank(entries, query, limit);
  }

  /** Ranking berbasis keyword yang bisa dipakai untuk knowledge tersimpan maupun belum disimpan. */
  rank<T extends { title: string; content: string }>(entries: T[], query: string, limit = 5): T[] {
    if (entries.length === 0) return [];

    const tokens = tokenize(query);
    if (tokens.length === 0) return entries.slice(0, limit);

    const scored = entries
      .map(entry => {
        const title = entry.title.toLowerCase();
        const content = entry.content.toLowerCase();
        const score = tokens.reduce(
          (sum, t) => sum + countOccurrences(title, t) * 3 + countOccurrences(content, t),
          0
        );
        return { entry, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return entries.slice(0, limit);
    return scored.slice(0, limit).map(s => s.entry);
  }

  /** Format knowledge menjadi blok konteks yang bisa ditempel ke system prompt. */
  buildContext(entries: { title: string; content: string }[]): string {
    if (entries.length === 0) return '';
    const blocks = entries.map((e, i) => `[${i + 1}] ${e.title}\n${e.content}`).join('\n\n');
    return `Knowledge base (gunakan informasi berikut bila relevan dengan pertanyaan pelanggan, jangan mengarang di luar konteks ini):\n\n${blocks}`;
  }

  private async assertAgent(companyId: string, aiAgentId: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: aiAgentId, companyId }, select: { id: true } });
    if (!agent) throw createError('AI Agent tidak ditemukan', 404);
  }

  private async findOwned(companyId: string, aiAgentId: string, id: string) {
    const item = await prisma.aiKnowledge.findFirst({ where: { id, aiAgentId, companyId } });
    if (!item) throw createError('Knowledge tidak ditemukan', 404);
    return item;
  }
}

export const knowledgeService = new KnowledgeService();
