import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';
import { deleteStoredFile } from './knowledge-upload';

export interface KnowledgeDto {
  title: string;
  content: string;
}

export interface KnowledgeMediaDto {
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  altText?: string | null;
  description?: string | null;
}

export interface KnowledgeWithMedia {
  id: string;
  companyId: string;
  aiAgentId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  media: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
    publicUrl: string;
    altText: string | null;
    description: string | null;
  }[];
}

export interface RankedKnowledge<T> {
  entry: T;
  score: number;
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

const CHUNK_CHARS = 1200;

/**
 * Pecah entri panjang menjadi beberapa potongan (gabungan paragraf ±1200
 * karakter). Paragraf dijaga utuh supaya teks dan URL gambar di bawahnya tetap
 * satu potongan. Entri pendek dikembalikan apa adanya.
 */
function splitIntoChunks<T extends { content: string }>(entry: T): T[] {
  if (entry.content.length <= CHUNK_CHARS * 1.25) return [entry];
  const paragraphs = entry.content.split(/\n\s*\n/).flatMap(p =>
    // Paragraf yang sangat panjang dipecah per baris.
    p.length > CHUNK_CHARS ? p.split('\n') : [p]
  );
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    if (current && current.length + p.length + 2 > CHUNK_CHARS) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) chunks.push(current);
  return chunks.map(content => ({ ...entry, content }));
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
      include: { media: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, aiAgentId: string, dto: KnowledgeDto) {
    await this.assertAgent(companyId, aiAgentId);
    if (!dto.title?.trim()) throw createError('Judul knowledge wajib diisi', 400);
    if (!dto.content?.trim()) throw createError('Isi knowledge wajib diisi', 400);
    return prisma.aiKnowledge.create({
      data: { companyId, aiAgentId, title: dto.title.trim(), content: dto.content.trim() },
      include: { media: true },
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
      include: { media: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async delete(companyId: string, aiAgentId: string, id: string) {
    const item = await this.findOwned(companyId, aiAgentId, id);
    const media = await prisma.aiKnowledgeMedia.findMany({ where: { knowledgeId: id } });
    for (const m of media) deleteStoredFile(m.storagePath);
    await prisma.aiKnowledge.delete({ where: { id: item.id } });
  }

  // --- Media knowledge ---

  async addMedia(companyId: string, aiAgentId: string, knowledgeId: string, items: KnowledgeMediaDto[]) {
    await this.findOwned(companyId, aiAgentId, knowledgeId);
    if (!items.length) return [];
    await prisma.aiKnowledgeMedia.createMany({
      data: items.map(media => ({
        companyId,
        knowledgeId,
        filename: media.filename,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        storagePath: media.storagePath,
        publicUrl: media.publicUrl,
        altText: media.altText?.trim() || null,
        description: media.description?.trim() || null,
      })),
    });
    return prisma.aiKnowledgeMedia.findMany({
      where: { knowledgeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMedia(
    companyId: string,
    aiAgentId: string,
    knowledgeId: string,
    mediaId: string,
    dto: { altText?: string | null; description?: string | null }
  ) {
    await this.findOwned(companyId, aiAgentId, knowledgeId);
    const media = await prisma.aiKnowledgeMedia.findFirst({
      where: { id: mediaId, knowledgeId, companyId },
    });
    if (!media) throw createError('Media knowledge tidak ditemukan', 404);
    return prisma.aiKnowledgeMedia.update({
      where: { id: mediaId },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText?.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      },
    });
  }

  async deleteMedia(companyId: string, aiAgentId: string, knowledgeId: string, mediaId: string) {
    await this.findOwned(companyId, aiAgentId, knowledgeId);
    const media = await prisma.aiKnowledgeMedia.findFirst({
      where: { id: mediaId, knowledgeId, companyId },
    });
    if (!media) throw createError('Media knowledge tidak ditemukan', 404);
    await prisma.aiKnowledgeMedia.delete({ where: { id: mediaId } });
    deleteStoredFile(media.storagePath);
    return { id: mediaId };
  }

  /**
   * Ambil knowledge paling relevan terhadap query. Kalau tidak ada yang cocok
   * sama sekali, kembalikan beberapa knowledge terbaru sebagai konteks umum.
   */
  async retrieve(companyId: string, aiAgentId: string, query: string, limit = 5): Promise<KnowledgeWithMedia[]> {
    const detailed = await this.retrieveDetailed(companyId, aiAgentId, query, limit);
    return detailed.map(d => d.entry);
  }

  /**
   * Versi retrieve yang menyertakan skor relevansi. Skor > 0 berarti benar-benar
   * cocok dengan pertanyaan; dipakai untuk relevance filtering media supaya
   * gambar tidak ikut terkirim ketika knowledge hanya dipakai sebagai fallback.
   */
  async retrieveDetailed(
    companyId: string,
    aiAgentId: string,
    query: string,
    limit = 5
  ): Promise<RankedKnowledge<KnowledgeWithMedia>[]> {
    const entries = await prisma.aiKnowledge.findMany({
      where: { companyId, aiAgentId },
      include: { media: { orderBy: { createdAt: 'asc' } } },
    });
    return this.rankDetailed(entries as KnowledgeWithMedia[], query, limit);
  }

  /** Ranking berbasis keyword yang bisa dipakai untuk knowledge tersimpan maupun belum disimpan. */
  rank<T extends { title: string; content: string }>(entries: T[], query: string, limit = 5): T[] {
    return this.rankDetailed(entries, query, limit).map(r => r.entry);
  }

  rankDetailed<T extends { title: string; content: string }>(
    entries: T[],
    query: string,
    limit = 5
  ): RankedKnowledge<T>[] {
    if (entries.length === 0) return [];
    // Dokumen panjang (mis. editor "Teks") dipecah per paragraf supaya yang
    // dikirim ke AI hanya bagian yang relevan, bukan seluruh dokumen.
    entries = entries.flatMap(e => splitIntoChunks(e));

    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return entries.slice(0, limit).map(entry => ({ entry, score: 0 }));
    }

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

    if (scored.length === 0) {
      return entries.slice(0, limit).map(entry => ({ entry, score: 0 }));
    }
    return scored.slice(0, limit);
  }

  /**
   * Format knowledge menjadi blok konteks untuk system prompt. Media hanya
   * dirujuk lewat id (bukan URL) supaya LLM tidak bisa mengarang URL; server
   * yang mengubah id menjadi URL dari database.
   */
  buildContext(
    entries: {
      title: string;
      content: string;
      media?: { id: string; filename: string; altText?: string | null; description?: string | null }[];
    }[]
  ): string {
    if (entries.length === 0) return '';
    const blocks = entries.map((e, i) => {
      const media = 'media' in e && e.media?.length
        ? `\nMedia terkait (gunakan penanda [[media:<id>]] bila perlu dikirim, jangan tulis URL):\n${e.media
            .map(m => `- media_id: ${m.id} | ${m.altText || m.filename}${m.description ? ` — ${m.description}` : ''}`)
            .join('\n')}`
        : '';
      return `[${i + 1}] ${e.title}\n${e.content}${media}`;
    }).join('\n\n');
    return `Knowledge base (gunakan informasi berikut bila relevan dengan pertanyaan pelanggan, jangan mengarang di luar konteks ini):\n\n${blocks}`;
  }

  /** Instruksi sistem untuk pemakaian media knowledge (lihat kebutuhan F). */
  buildMediaInstruction(): string {
    return [
      'Jika pelanggan meminta panduan, prosedur, alur, atau informasi yang memiliki media pendukung di Knowledge Base, gunakan gambar yang relevan.',
      'Sampaikan penjelasan singkat dan kirimkan gambar melalui media attachment.',
      'Untuk mengirim gambar, tulis penanda persis [[media:<id>]] pada posisi yang tepat. Jangan pernah menulis atau membuat URL gambar sendiri.',
      'Jangan mengirim gambar yang tidak relevan dengan pertanyaan pelanggan. Maksimal 2 gambar per balasan.',
    ].join(' ');
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
