import { MediaAttachment } from '../ai-media/ai-media.service';

export interface AllowedMedia {
  id: string;
  title: string;
  url: string;
  caption?: string | null;
}

export type AiReplyMessage =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; caption?: string | null; mediaId: string; title: string };

export interface ParsedAiReply {
  messages: AiReplyMessage[];
  reply: string;
  attachments: MediaAttachment[];
  usedMedia: string[];
}

const MARKER_RE = /\[\[\s*media\s*:\s*([a-zA-Z0-9-]+)\s*\]\]/g;
const MAX_IMAGES = 2;
const IMAGE_URL_RE = /https?:\/\/[^\s<>"'()[\]]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"'()[\]]*)?(?=$|[\s<>"'()[\].,!?;:])/gi;

/** Semua URL gambar (png/jpg/gif/webp) di dalam teks. */
export function extractImageUrls(text: string | null | undefined): string[] {
  return [...new Set((text || '').match(IMAGE_URL_RE) ?? [])];
}

function fileNameOf(url: string): string {
  const name = url.split('?')[0].split('/').pop() || 'gambar';
  try { return decodeURIComponent(name); } catch { return name; }
}

/**
 * URL gambar di teks balasan diubah jadi pesan gambar terpisah (teks dulu, lalu
 * gambar). Hanya URL yang ada di `allowed` (berasal dari knowledge / pesan
 * sambutan) yang dikirim, jadi AI tidak bisa mengirim gambar dari URL karangan.
 */
export function splitImageUrls(messages: AiReplyMessage[], allowed: Set<string>, maxImages = 3): AiReplyMessage[] {
  if (!allowed.size) return messages;
  let count = messages.filter(m => m.type === 'image').length;
  const out: AiReplyMessage[] = [];
  for (const m of messages) {
    if (m.type !== 'text') { out.push(m); continue; }
    const images: AiReplyMessage[] = [];
    const text = m.content
      .replace(IMAGE_URL_RE, url => {
        if (!allowed.has(url) || count >= maxImages) return url;
        count += 1;
        images.push({ type: 'image', url, caption: null, mediaId: url, title: fileNameOf(url) });
        return '';
      })
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text) out.push({ type: 'text', content: text });
    out.push(...images);
  }
  return out;
}

function uniqueMedia(list: AllowedMedia[]): AllowedMedia[] {
  const seen = new Set<string>();
  const out: AllowedMedia[] = [];
  for (const item of list) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function buildIndex(allowed: AllowedMedia[]) {
  const byId = new Map<string, AllowedMedia>();
  const byUrl = new Map<string, AllowedMedia>();
  for (const item of uniqueMedia(allowed)) {
    byId.set(item.id, item);
    byUrl.set(item.url.trim().toLowerCase(), item);
  }
  return { byId, byUrl };
}

function asImageMessage(media: AllowedMedia, caption?: string | null): AiReplyMessage {
  return {
    type: 'image',
    url: media.url,
    caption: caption?.trim() || media.caption || null,
    mediaId: media.id,
    title: media.title,
  };
}

/** Pecah teks berdasarkan penanda [[media:<id>]] sambil menjaga urutannya. */
function parseMarkers(text: string, allowed: AllowedMedia[], maxImages: number): AiReplyMessage[] {
  const index = buildIndex(allowed);
  const messages: AiReplyMessage[] = [];
  let lastIndex = 0;
  let imageCount = 0;
  let match: RegExpExecArray | null;

  MARKER_RE.lastIndex = 0;
  while ((match = MARKER_RE.exec(text || '')) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) messages.push({ type: 'text', content: before });

    // Hanya URL yang berasal dari database yang boleh dipakai.
    const media = index.byId.get(match[1]);
    if (media && imageCount < maxImages) {
      messages.push(asImageMessage(media));
      imageCount += 1;
    }
    lastIndex = match.index + match[0].length;
  }

  const after = text.slice(lastIndex).trim();
  if (after) messages.push({ type: 'text', content: after });
  return messages;
}

/**
 * Coba baca format terstruktur:
 * { "messages": [{ "type": "text", "content": "..." }, { "type": "image", "url": "...", "caption": "..." }] }
 * Model kadang membungkus JSON dengan code fence atau kalimat tambahan.
 */
function tryParseJson(text: string): unknown | null {
  const raw = (text || '').trim();
  if (!raw) return null;

  const candidates = new Set<string>([raw]);
  for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    candidates.add(m[1].trim());
  }
  // Ambil blok {...} terluar yang mengandung "messages".
  const objMatch = raw.match(/\{[\s\S]*"messages"[\s\S]*\}/);
  if (objMatch) candidates.add(objMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  return null;
}

function parseJsonMessages(
  payload: unknown,
  allowed: AllowedMedia[],
  maxImages: number
): AiReplyMessage[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return null;

  const index = buildIndex(allowed);
  const result: AiReplyMessage[] = [];
  let imageCount = 0;

  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const type = String(item.type || '').toLowerCase();

    if (type === 'text') {
      const content = String(item.content ?? '').trim();
      if (!content) continue;
      // Teks JSON juga boleh mengandung penanda media.
      const prevLen = result.length;
      result.push(...parseMarkers(content, allowed, maxImages - imageCount));
      imageCount += result.slice(prevLen).filter(m => m.type === 'image').length;
      continue;
    }

    if (type === 'image' || type === 'media') {
      if (imageCount >= maxImages) continue;
      const id = String(item.mediaId ?? item.media_id ?? item.id ?? '').trim();
      const url = String(item.url ?? item.publicUrl ?? item.public_url ?? '').trim().toLowerCase();
      // Validasi ketat: id atau URL harus ada di database.
      const media = (id && index.byId.get(id)) || (url && index.byUrl.get(url));
      if (!media) continue;
      const caption = item.caption === undefined ? undefined : String(item.caption ?? '');
      result.push(asImageMessage(media, caption));
      imageCount += 1;
    }
  }

  return result;
}

/**
 * Ubah teks mentah dari LLM menjadi daftar pesan siap kirim (TEXT/IMAGE).
 * Semua gambar divalidasi terhadap `allowed` (data dari database).
 */
export function parseAiReply(text: string, allowed: AllowedMedia[]): ParsedAiReply {
  const json = tryParseJson(text);
  const jsonMessages = json ? parseJsonMessages(json, allowed, MAX_IMAGES) : null;
  let messages = jsonMessages ?? parseMarkers(text || '', allowed, MAX_IMAGES);

  // Jaga-jaga bila model hanya mengembalikan teks kosong (bukan JSON).
  if (messages.length === 0 && !json) {
    const cleaned = (text || '').replace(MARKER_RE, '').trim();
    if (cleaned) messages = [{ type: 'text', content: cleaned }];
  }

  const deduped: AiReplyMessage[] = [];
  const seenImages = new Set<string>();
  for (const msg of messages) {
    if (msg.type === 'image') {
      if (seenImages.has(msg.mediaId)) continue;
      seenImages.add(msg.mediaId);
    }
    deduped.push(msg);
  }

  const reply = deduped
    .filter((m): m is Extract<AiReplyMessage, { type: 'text' }> => m.type === 'text')
    .map(m => m.content)
    .join('\n\n');

  const images = deduped.filter(
    (m): m is Extract<AiReplyMessage, { type: 'image' }> => m.type === 'image'
  );

  return {
    messages: deduped,
    reply,
    attachments: images.map(img => ({
      id: img.mediaId,
      title: img.title,
      mediaUrl: img.url,
      caption: img.caption ?? null,
      type: 'IMAGE' as const,
    })),
    usedMedia: images.map(img => img.title),
  };
}
