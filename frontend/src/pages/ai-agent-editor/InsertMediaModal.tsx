import { useRef, useState } from 'react';
import { X, Monitor, Link2, Upload, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { knowledgeFileService } from '../../services/index';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

type Uploaded = { filename: string; url: string };

const copy = (text: string, msg = 'URL disalin') =>
  navigator.clipboard.writeText(text).then(() => toast.success(msg), () => toast.error('Gagal menyalin'));

/**
 * "Sisipkan media dan file":
 * - Unggah dari komputer → gambar diupload lalu URL-nya langsung disisipkan ke editor.
 * - Ambil link URL file  → upload, lalu salin URL-nya untuk ditempel sendiri.
 * AI akan mengirim URL gambar yang ada di knowledge sebagai gambar ke chat.
 */
export default function InsertMediaModal({ onInsert, onClose }: { onInsert: (urls: string[]) => void; onClose: () => void }) {
  const [step, setStep] = useState<'menu' | 'link'>('menu');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const directInput = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | null): Promise<Uploaded[]> => {
    const files = Array.from(list ?? []).filter(f => {
      if (!ACCEPT.split(',').includes(f.type)) { toast.error(`${f.name}: format tidak didukung`); return false; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: maksimal 5MB`); return false; }
      return true;
    });
    if (!files.length) return [];
    setBusy(true);
    try {
      return await knowledgeFileService.upload(files.slice(0, 5));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengunggah file');
      return [];
    } finally {
      setBusy(false);
    }
  };

  const uploadDirect = async (list: FileList | null) => {
    const res = await upload(list);
    if (!res.length) return;
    onInsert(res.map(r => r.url));
    toast.success('Gambar disisipkan ke editor');
    onClose();
  };

  const uploadForLink = async (list: FileList | null) => {
    const res = await upload(list);
    if (res.length) setUploaded(prev => [...prev, ...res]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{step === 'menu' ? 'Sisipkan media dan file' : 'Unggah file'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {step === 'menu' ? (
          <div className="space-y-2 p-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => directInput.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Monitor className="h-5 w-5 text-primary" />}
              <span>
                <span className="block text-sm font-semibold text-gray-900">Unggah dari komputer</span>
                <span className="block text-xs text-gray-500">Didukung: Gambar (JPG, PNG, GIF, WEBP)</span>
              </span>
            </button>
            <input ref={directInput} type="file" accept={ACCEPT} multiple className="hidden"
              onChange={e => { void uploadDirect(e.target.files); e.target.value = ''; }} />

            <button
              type="button"
              onClick={() => setStep('link')}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <Link2 className="h-5 w-5 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Ambil link URL file</span>
                <span className="block text-xs text-gray-500">Unggah file dan dapatkan link URL untuk melatih AI</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <label
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); void uploadForLink(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                drag ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50/60 hover:bg-gray-50'
              }`}
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-gray-400" />}
              <span className="text-sm text-gray-600">Seret dan lepas gambar di sini, atau klik untuk memilih file</span>
              <input type="file" accept={ACCEPT} multiple className="hidden"
                onChange={e => { void uploadForLink(e.target.files); e.target.value = ''; }} />
            </label>

            {uploaded.length > 0 && (
              <>
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-gray-800">Gambar terunggah:</p>
                  <ul className="space-y-1.5">
                    {uploaded.map(u => (
                      <li key={u.url} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                        <img src={u.url} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                        <span className="min-w-0 flex-1 truncate text-gray-700">{u.filename}</span>
                        <button type="button" onClick={() => copy(u.url)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          <Copy className="h-3.5 w-3.5" /> Salin URL
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">URL gambar:</p>
                  <p className="mb-1.5 text-xs text-gray-500">
                    Tempatkan URL gambar di Pengetahuan atau Pesan Sambutan agar AI dapat mengirim gambar tersebut.
                  </p>
                  <textarea readOnly rows={Math.min(uploaded.length, 4)} value={uploaded.map(u => u.url).join('\n')}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700" />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              {uploaded.length > 0 && (
                <button type="button" onClick={() => copy(uploaded.map(u => u.url).join('\n'), 'Semua URL disalin')}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Salin semua URL
                </button>
              )}
              <button type="button" onClick={onClose} className="gradient-btn px-4 py-2 text-sm">Simpan dan tutup</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
