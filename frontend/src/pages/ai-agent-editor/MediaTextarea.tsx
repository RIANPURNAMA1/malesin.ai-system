import { useRef, useState } from 'react';
import { Image, X } from 'lucide-react';
import InsertMediaModal from './InsertMediaModal';
import { TEXTAREA_CLS } from './constants';

const IMAGE_URL_RE = /https?:\/\/[^\s<>"'()[\]]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"'()[\]]*)?(?=$|[\s<>"'()[\].,!?;:])/gi;

/** URL gambar unik di dalam teks (sama dengan aturan backend). */
const imageUrlsOf = (text: string) => [...new Set(text.match(IMAGE_URL_RE) ?? [])];

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * Textarea + "Sisipkan gambar". URL gambar disisipkan di posisi kursor pada
 * baris tersendiri; saat membalas, AI mengirim URL itu sebagai pesan gambar
 * (sama seperti gambar di Knowledge).
 */
export default function MediaTextarea({ value, onChange, rows = 3, placeholder, maxLength, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const images = imageUrlsOf(value);

  const clamp = (v: string) => (maxLength ? v.slice(0, maxLength) : v);

  const insert = (urls: string[]) => {
    if (!urls.length) return;
    const pos = caret.current ?? value.length;
    const before = value.slice(0, pos).replace(/[ \t]+$/, '');
    const after = value.slice(pos).replace(/^[ \t]+/, '');
    const block = urls.join('\n');
    const next = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${block}${after && !after.startsWith('\n') ? '\n' : ''}${after}`;
    onChange(clamp(next));
    caret.current = null;
  };

  const removeImage = (url: string) => {
    onChange(value.split(url).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
  };

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(clamp(e.target.value))}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className={className ?? TEXTAREA_CLS}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { caret.current = ref.current?.selectionStart ?? null; setOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <Image className="h-4 w-4" /> Sisipkan gambar
        </button>
        {images.map(url => (
          <div key={url} className="group relative h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50" title={url}>
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute right-0.5 top-0.5 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:block"
              aria-label="Hapus gambar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {open && <InsertMediaModal onClose={() => setOpen(false)} onInsert={insert} />}
    </div>
  );
}
