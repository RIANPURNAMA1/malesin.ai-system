import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Daftar dampak yang ditampilkan sebagai poin (mis. data yang ikut terhapus). */
  items?: ReactNode[];
  /** Catatan kecil di bawah daftar. */
  note?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Wajib mengetik teks ini sebelum tombol konfirmasi aktif (untuk aksi permanen). */
  confirmText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Dialog konfirmasi aksi berbahaya (hapus permanen, dsb). */
export default function ConfirmDialog({
  open, title, description, items, note, confirmLabel = 'Hapus', cancelLabel = 'Batal',
  confirmText, loading, onConfirm, onClose,
}: Props) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Simpan callback terbaru di ref agar efek tidak jalan ulang tiap render.
  const closeRef = useRef(onClose);
  const loadingRef = useRef(loading);
  closeRef.current = onClose;
  loadingRef.current = loading;

  // Reset isian & fokus hanya saat dialog baru dibuka.
  useEffect(() => {
    if (!open) return;
    setTyped('');
    setTimeout(() => (confirmText ? inputRef.current : cancelRef.current)?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loadingRef.current) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const canConfirm = !loading && (!confirmText || typed.trim() === confirmText.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px] animate-fade-in" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up">
        <button onClick={onClose} disabled={loading} aria-label="Tutup"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40">
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-5 pt-6">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 id="confirm-title" className="pr-6 text-base font-semibold text-gray-900">{title}</h3>
              {description && <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>}
            </div>
          </div>

          {items && items.length > 0 && (
            <ul className="mt-4 space-y-2 rounded-xl border border-red-100 bg-red-50/50 p-3.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {note && <p className="mt-2.5 text-xs leading-relaxed text-gray-400">{note}</p>}

          {confirmText && (
            <label className="mt-4 block">
              <span className="text-xs text-gray-600">
                Ketik <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-semibold text-gray-900">{confirmText}</span> untuk konfirmasi
              </span>
              <input
                ref={inputRef}
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canConfirm) onConfirm(); }}
                disabled={loading}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition focus:border-danger/50 focus:outline-none focus:ring-2 focus:ring-danger/15"
                autoComplete="off"
              />
            </label>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button ref={cancelRef} onClick={onClose} disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={!canConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Menghapus...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
