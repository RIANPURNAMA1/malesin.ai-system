import { useState } from 'react';
import { CheckCircle2, Bot, Loader2, Upload, X, Info, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageDraft } from './types';
import { revokeImageDrafts, createImageDrafts } from './utils';

/** Input gambar + preview kecil untuk knowledge yang sudah tersimpan. */
export function KnowledgeMediaAdder({
  onAdd,
  onError,
}: {
  onAdd: (files: File[]) => Promise<void>;
  onError?: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState<ImageDraft[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!drafts.length || uploading) return;
    setUploading(true);
    try {
      await onAdd(drafts.map(d => d.file));
      revokeImageDrafts(drafts);
      setDrafts([]);
    } catch (err: any) {
      onError?.(err?.response?.data?.message || 'Gagal mengupload gambar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-white/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Upload className="w-3.5 h-3.5" />
          Pilih gambar
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            onChange={e => {
              setDrafts(prev => createImageDrafts(e.target.files, prev));
              e.target.value = '';
            }}
          />
        </label>
        {drafts.length > 0 && (
          <>
            <span className="text-xs text-gray-500">{drafts.length} gambar siap diupload</span>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="gradient-btn px-2.5 py-1.5 text-xs disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload
            </button>
            <button
              type="button"
              onClick={() => { revokeImageDrafts(drafts); setDrafts([]); }}
              disabled={uploading}
              className="text-xs text-gray-400 hover:text-danger"
            >
              Batal
            </button>
          </>
        )}
      </div>
      {drafts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {drafts.map((d, i) => (
            <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
              <img src={d.preview} alt={d.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(d.preview);
                  setDrafts(prev => prev.filter((_, idx) => idx !== i));
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                title="Hapus"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Panel info untuk section yang belum punya konfigurasi fungsional. */
export function ScaffoldSection({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
          <Clock className="h-3 w-3" /> Segera hadir
        </span>
      </div>
      <ul className="mt-5 space-y-2.5">
        {items.map(item => (
          <li key={item} className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-sm text-gray-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-1.5 text-xs text-gray-400">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Konfigurasi pada bagian ini belum aktif. Saat ini AI memakai Perilaku AI, Basis pengetahuan, dan Konfigurasi AI.
      </p>
    </section>
  );
}

/** Kartu section yang bisa dilipat (tab Perilaku AI). */
export function SectionCard({
  id, icon: Icon, title, description, open, onToggle, children,
}: {
  id: string;
  icon: typeof Bot;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
      </button>
      {open && <div className="border-t border-gray-200 p-5">{children}</div>}
    </section>
  );
}

/** Kotak field bertajuk (Gaya komunikasi, Alur percakapan, dst). */
export function FieldBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}


