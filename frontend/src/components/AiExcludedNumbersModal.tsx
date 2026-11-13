import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { X, MessageSquareOff, Plus, Trash2, Loader2, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactService } from '../services/index';
import { Contact } from '../types';
import { Avatar } from './ui/index';

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20';

const displayPhone = (c: Contact) =>
  (c.phone || (c.metadata?.whatsappId as string) || '').replace(/@(c\.us|s\.whatsapp\.net|lid)$/, '');

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Daftar nomor yang tidak dibalas AI (berlaku di semua kanal), dipilih dari data kontak. */
export default function AiExcludedNumbersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const { data: excluded = [], isLoading } = useQuery({
    queryKey: ['ai-excluded'],
    queryFn: contactService.listAiExcluded,
    enabled: open,
  });

  // Kontak dari halaman Kontak; dicari berdasarkan nama/nomor.
  const { data: contactsRes, isFetching: searching } = useQuery({
    queryKey: ['contacts', 'ai-picker', q],
    queryFn: () => contactService.list({ search: q || undefined, limit: 20 }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const contacts = contactsRes?.data ?? [];
  const excludedIds = new Set(excluded.map(c => c.id));

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggle = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) => contactService.setAiDisabled(id, disabled),
    onSuccess: (_r, { disabled }) => {
      qc.invalidateQueries({ queryKey: ['ai-excluded'] });
      qc.invalidateQueries({ queryKey: ['conversation'] });
      toast.success(disabled ? 'AI tidak akan membalas nomor ini' : 'AI kembali membalas nomor ini');
    },
    onError: () => toast.error('Gagal mengubah pengaturan AI'),
  });
  const busy = (id: string) => toggle.isPending && toggle.variables?.id === id;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <MessageSquareOff className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Nomor tanpa AI</h2>
              <p className="text-xs text-gray-500">Chat dari nomor ini tetap masuk ke inbox, tapi tidak dibalas AI di semua kanal.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Pilih dari kontak */}
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pilih dari kontak</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau nomor kontak…" className={`${FIELD} pl-9 pr-9`} autoFocus />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
              {contacts.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-gray-400">{searching ? 'Mencari…' : 'Kontak tidak ditemukan.'}</li>
              ) : contacts.map(c => {
                const isExcluded = excludedIds.has(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="truncate font-mono text-xs text-gray-500">{displayPhone(c) || '—'}</p>
                    </div>
                    {isExcluded ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                        <Check className="h-3.5 w-3.5" /> Tanpa AI
                      </span>
                    ) : (
                      <button
                        onClick={() => toggle.mutate({ id: c.id, disabled: true })}
                        disabled={busy(c.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        {busy(c.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Tambah
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Daftar yang dikecualikan */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tidak dibalas AI ({excluded.length})</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : excluded.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Belum ada nomor. AI membalas semua chat.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {excluded.map(c => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="truncate font-mono text-xs text-gray-500">{displayPhone(c) || '—'}</p>
                    </div>
                    <button
                      onClick={() => toggle.mutate({ id: c.id, disabled: false })}
                      disabled={busy(c.id)}
                      title="Hapus dari daftar (AI membalas lagi)"
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      {busy(c.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
