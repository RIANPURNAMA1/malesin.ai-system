import { ImageDraft } from './types';
import { MAX_KB_IMAGES, MAX_KB_IMAGE_BYTES, KB_IMAGE_MIME, PDFJS_CDN, KB_TEXT_TITLE } from './constants';
import toast from 'react-hot-toast';

/**
 * Jenis knowledge dikenali dari judul/isinya (format yang dibuat tiap tab):
 * - doc     : isi editor "Teks" (judul KB_TEXT_TITLE)
 * - file    : "[File] nama.pdf"     - product : "[Produk] nama"
 * - web     : isi diawali "Sumber: http..."  - qa : isi diawali "Pertanyaan:"
 * - legacy  : knowledge lama berjudul bebas (digabung ke editor Teks)
 */
export type KnowledgeKind = 'doc' | 'web' | 'file' | 'qa' | 'product' | 'legacy';
export function knowledgeKind(k: { title: string; content: string }): KnowledgeKind {
  if (k.title === KB_TEXT_TITLE) return 'doc';
  if (k.title.startsWith('[File] ')) return 'file';
  if (k.title.startsWith('[Produk] ')) return 'product';
  if (/^Sumber: https?:\/\//.test(k.content)) return 'web';
  if (k.content.startsWith('Pertanyaan:')) return 'qa';
  return 'legacy';
}

export function newInstructionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ekstrak teks PDF di browser (pdf.js dimuat on-demand dari CDN). */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs: any = await import(/* @vite-ignore */ `${PDFJS_CDN}pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const { items } = await (await doc.getPage(i)).getTextContent();
    pages.push(items.map((it: any) => it.str).join(' '));
  }
  return pages.join('\n\n').trim();
}

/** Ambil isi teks halaman web (lewat reader r.jina.ai agar bebas CORS). */
export async function urlToText(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`);
  if (!res.ok) throw new Error('Gagal mengambil konten situs web');
  return (await res.text()).trim();
}

export function revokeImageDrafts(items: ImageDraft[]) {
  for (const item of items) URL.revokeObjectURL(item.preview);
}

/** Validasi file gambar di sisi client; server tetap memvalidasi ulang. */
export function createImageDrafts(files: FileList | null, current: ImageDraft[]): ImageDraft[] {
  if (!files?.length) return current;
  const next = [...current];

  for (const file of Array.from(files)) {
    if (!KB_IMAGE_MIME.includes(file.type.toLowerCase())) {
      toast.error(`${file.name}: format harus JPG, JPEG, PNG, atau WEBP`);
      continue;
    }
    if (file.size > MAX_KB_IMAGE_BYTES) {
      toast.error(`${file.name}: ukuran maksimal 5MB`);
      continue;
    }
    if (next.length >= MAX_KB_IMAGES) {
      toast.error(`Maksimal ${MAX_KB_IMAGES} gambar per knowledge`);
      break;
    }
    next.push({ file, preview: URL.createObjectURL(file) });
  }
  return next;
}


