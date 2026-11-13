import prisma from '../../config/database';
import { AiChatMessage } from '../ai-provider/adapters/types';

/**
 * Konteks & state percakapan AI.
 *
 * Tujuan:
 * - Memberi model riwayat percakapan yang nyata (bukan hanya pesan terakhir),
 *   supaya AI tidak "lupa" dan tidak menanyakan ulang hal yang sudah dijawab.
 * - Menyimpan state ringan di `conversation.metadata.aiState` (data pelanggan,
 *   topik yang sudah dibahas, tanda loop/eskalasi).
 */

export interface CustomerData {
  name?: string;
  age?: string;
  city?: string;
  education?: string;
  program?: string;
}

export interface AiConversationState {
  customerData?: CustomerData;
  /** Judul knowledge yang sudah pernah dipakai untuk menjawab. */
  answeredTopics?: string[];
  /** Potongan jawaban AI terakhir (sudah dinormalisasi) untuk deteksi loop. */
  lastReplySignature?: string;
  lastReplyAt?: string;
  /** Jumlah balasan mirip yang berulang berturut-turut. */
  repeatCount?: number;
  escalationOfferedAt?: string;
}

const HISTORY_TAKE = 40;
const MAX_HISTORY_CHARS = 12_000;
const MAX_TURN_CHARS = 1_200;
const MAX_TOPICS = 12;

/** Normalisasi teks untuk perbandingan kemiripan jawaban. */
export function normalizeText(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/\[\[\s*media\s*:[^\]]+\]\]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(text: string, max = MAX_TURN_CHARS): string {
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function bigramCounts(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i += 1) {
    const gram = text.slice(i, i + 2);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/** Dice coefficient (0–1) berbasis bigram karakter. */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Jawaban panjang yang isinya sama namun beda salam/emoji tetap dianggap mirip.
  if (na.length > 60 && nb.length > 60 && (na.includes(nb) || nb.includes(na))) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return Math.min(1, ratio + 0.15);
  }
  const A = bigramCounts(na);
  const B = bigramCounts(nb);
  let intersection = 0;
  let total = 0;
  for (const [gram, count] of A) {
    total += count;
    intersection += Math.min(count, B.get(gram) ?? 0);
  }
  for (const count of B.values()) total += count;
  return total ? (2 * intersection) / total : 0;
}

/**
 * Cari jawaban sebelumnya yang terlalu mirip. `null` = aman dikirim.
 * Jawaban pendek (< 24 karakter setelah normalisasi) tidak dicek supaya
 * ucapan singkat seperti "Baik kak 🙏" tidak dianggap loop.
 */
export function findDuplicateReply(
  reply: string | null | undefined,
  previousReplies: string[],
  threshold = 0.9
): string | null {
  const normalized = normalizeText(reply);
  if (normalized.length < 24) return null;
  for (let i = previousReplies.length - 1; i >= 0; i -= 1) {
    const candidate = previousReplies[i];
    if (!normalizeText(candidate)) continue;
    if (textSimilarity(normalized, candidate) >= threshold) return candidate;
  }
  return null;
}

function placeholderOf(type: string, direction: string): string {
  const inbound = direction === 'INBOUND';
  switch (type) {
    case 'IMAGE':
      return inbound ? '[pelanggan mengirim gambar]' : '[gambar dikirim]';
    case 'VIDEO':
      return inbound ? '[pelanggan mengirim video]' : '[video dikirim]';
    case 'AUDIO':
      return inbound ? '[pelanggan mengirim pesan suara]' : '[pesan suara dikirim]';
    case 'DOCUMENT':
      return inbound ? '[pelanggan mengirim dokumen]' : '[dokumen dikirim]';
    case 'TEMPLATE':
      return '[pesan template]';
    default:
      return '';
  }
}

/**
 * Ambil riwayat teks terakhir percakapan, urut kronologis, siap dikirim ke
 * model. `currentMessage` dihapus dari ekor riwayat karena akan dikirim sebagai
 * pesan user terbaru (menghindari pesan yang sama dua kali).
 */
export async function loadConversationHistory(
  conversationId: string,
  currentMessage?: string
): Promise<AiChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    take: HISTORY_TAKE,
    select: { direction: true, type: true, content: true },
  });

  const turns: AiChatMessage[] = [];
  for (const row of rows.reverse()) {
    const text = clampText(row.content || '');
    const content = text || placeholderOf(row.type, row.direction);
    if (!content) continue;
    turns.push({ role: row.direction === 'INBOUND' ? 'user' : 'assistant', content });
  }

  const normCurrent = normalizeText(currentMessage);
  if (normCurrent) {
    // Buang SATU kemunculan terakhir pesan yang sedang diproses. Pemindaian
    // mencakup beberapa balasan terakhir karena pesan sambutan bisa tersimpan
    // SETELAH pesan pelanggan yang memicunya. Pesan identik sebelumnya (mis.
    // "boleh" yang dikirim dua kali) tetap terlihat oleh model.
    const floor = Math.max(0, turns.length - 6);
    for (let i = turns.length - 1; i >= floor; i -= 1) {
      const turn = turns[i];
      if (turn.role === 'assistant') continue;
      if (normalizeText(turn.content) === normCurrent) {
        turns.splice(i, 1);
        break;
      }
    }
  }

  // Batasi total karakter: buang pesan paling lama lebih dulu, lalu gabungkan
  // pesan berurutan dengan role sama (pelanggan sering mengirim beberapa pesan,
  // AI juga bisa mengirim beberapa bagian). Provider seperti Anthropic
  // mensyaratkan pergantian role dan pesan pertama adalah user.
  const merged: AiChatMessage[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n\n${turn.content}`;
    } else {
      merged.push({ ...turn });
    }
  }

  const picked: AiChatMessage[] = [];
  let chars = 0;
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    chars += merged[i].content.length;
    if (picked.length && chars > MAX_HISTORY_CHARS) break;
    picked.unshift(merged[i]);
  }
  while (picked.length && picked[0].role === 'assistant') picked.shift();
  return picked;
}

/**
 * Jawaban AI terakhir langsung dari database (bukan dari riwayat yang sudah
 * dipangkas), dipakai pembanding anti-loop. Termasuk pesan sambutan.
 */
export async function loadRecentAssistantReplies(
  conversationId: string,
  limit = 3
): Promise<string[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId, direction: 'OUTBOUND' },
    orderBy: { sentAt: 'desc' },
    take: limit,
    select: { type: true, content: true },
  });
  return rows
    .reverse()
    .map(row => clampText(row.content || '') || placeholderOf(row.type, 'OUTBOUND'))
    .filter(Boolean);
}

const FIELD_PATTERNS: { key: keyof CustomerData; pattern: RegExp }[] = [
  { key: 'name', pattern: /(?:^|\n)\s*nama(?:\s*lengkap)?\s*[:\-]\s*([^\n]+)/i },
  { key: 'age', pattern: /(?:^|\n)\s*usia\s*[:\-]\s*([^\n]+)/i },
  { key: 'city', pattern: /(?:^|\n)\s*(?:asal\s*kota|kota)\s*[:\-]\s*([^\n]+)/i },
  { key: 'education', pattern: /(?:^|\n)\s*pendidikan(?:\s*terakhir)?\s*[:\-]\s*([^\n]+)/i },
  { key: 'program', pattern: /(?:^|\n)\s*(?:minat\s*kerja|program)\s*[:\-]\s*([^\n]+)/i },
];

/**
 * Ambil data yang sudah pernah diisi pelanggan (biasanya dari formulir
 * "Nama: … / Usia: … / Asal Kota: …"). Nilai terbaru menang. Deterministik:
 * hanya membaca teks yang benar-benar dikirim pelanggan, tidak menebak.
 */
export function extractCustomerData(
  history: AiChatMessage[],
  currentMessage?: string
): CustomerData {
  const data: CustomerData = {};
  const inbound = [
    ...history.filter(message => message.role === 'user').map(message => message.content),
    ...(currentMessage?.trim() ? [currentMessage] : []),
  ];

  for (const text of inbound) {
    for (const field of FIELD_PATTERNS) {
      const match = text.match(field.pattern);
      if (!match) continue;
      const value = clampText(match[1], 80);
      if (value && normalizeText(value)) data[field.key] = value;
    }
  }
  return data;
}

export function mergeTopics(previous: string[] | undefined, added: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const title of [...(previous ?? []), ...(added ?? [])]) {
    const clean = title?.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result.slice(-MAX_TOPICS);
}

export function buildConversationStateContext(params: {
  customerData?: CustomerData;
  state?: AiConversationState;
}): string {
  const data = { ...(params.state?.customerData ?? {}), ...(params.customerData ?? {}) };
  const rows = [
    data.name ? `- Nama: ${data.name}` : '',
    data.age ? `- Usia: ${data.age}` : '',
    data.city ? `- Asal Kota: ${data.city}` : '',
    data.education ? `- Pendidikan Terakhir: ${data.education}` : '',
    data.program ? `- Minat kerja / Program: ${data.program}` : '',
  ].filter(Boolean);

  const blocks: string[] = [];
  if (rows.length) {
    blocks.push(
      `Data pelanggan yang sudah diberikan (JANGAN tanyakan lagi, gunakan data ini):\n${rows.join('\n')}`
    );
  }
  const topics = params.state?.answeredTopics ?? [];
  if (topics.length) {
    blocks.push(
      `Topik yang sudah dibahas (jangan jelaskan ulang dari awal; lanjutkan atau perdalam bila pelanggan bertanya lagi):\n` +
        topics.map(topic => `- ${topic}`).join('\n')
    );
  }
  return blocks.join('\n\n');
}

export async function readAiState(conversationId: string): Promise<AiConversationState> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true },
  });
  const state = (conversation?.metadata as Record<string, unknown> | null)?.aiState;
  return state && typeof state === 'object' ? (state as AiConversationState) : {};
}

/**
 * Simpan state tanpa menimpa metadata lain (mis. `aiPausedUntil`). Pembacaan
 * dan penulisan dilakukan per percakapan yang sudah diserialkan oleh
 * auto-reply, sehingga aman dari dua update bersamaan.
 */
export async function mergeAiState(
  conversationId: string,
  patch: Partial<AiConversationState>
): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true },
  });
  if (!conversation) return;
  const metadata = { ...((conversation.metadata as Record<string, unknown> | null) ?? {}) };
  const previous = metadata.aiState && typeof metadata.aiState === 'object'
    ? (metadata.aiState as Record<string, unknown>)
    : {};
  metadata.aiState = { ...previous, ...patch };
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { metadata: metadata as any },
  });
}
