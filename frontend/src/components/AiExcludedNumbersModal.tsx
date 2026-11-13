import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, MessageSquareOff, Plus, Trash2, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactService } from '../services/index';
import { Contact } from '../types';

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20';

const displayPhone = (c: Contact) =>
  (c.phone || (c.metadata?.whatsappId as string) || '').replace(/@(c\.us|s\.whatsapp\.net|lid)$/, '');

/** Daftar nomor yang tidak dibalas AI (berlaku di semua kanal). */
export default function AiExcludedNumbersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['ai-excluded'],
    queryFn: contactService.listAiExcluded,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ai-excluded'] });
    qc.invalidateQueries({ queryKey: ['conversation'] });
  };

  const add = useMutation({
    mutationFn: () => contactService.addAiExcluded(phone, name),
    onSuccess: () => { refresh(); setPhone(''); setName(''); toast.success('Nomor ditambahkan, AI tidak akan membalas'); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message || 'Gagal menambahkan nomor'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => contactService.setAiDisabled(id, false),
    onSuccess: () => { refresh(); toast.success('AI kembali membalas nomor ini'); },
    onError: () => toast.error('Gagal menghapus nomor'),
  });

  if (!open) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter(c => c.name.toLowerCase().includes(q) || displayPhone(c).includes(q.replace(/\D/g, '') || q))
    : list;

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

        <form
          className="space-y-2 border-b border-gray-100 px-5 py-4"
          onSubmit={e => { e.preventDefault(); if (phone.trim()) add.mutate(); }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nomor, mis. 0812xxxx / 62812xxxx" inputMode="tel" className={FIELD} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama (opsional)" className={`${FIELD} sm:w-40`} />
          </div>
          <button type="submit" disabled={!phone.trim() || add.isPending} className="gradient-btn w-full justify-center px-4 py-2 text-sm disabled:opacity-50">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah nomor
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {list.length > 5 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau nomor…" className={`${FIELD} pl-9`} />
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{list.length ? 'Nomor tidak ditemukan.' : 'Belum ada nomor. AI membalas semua chat.'}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map(c => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="truncate font-mono text-xs text-gray-500">{displayPhone(c) || '—'}</p>
                  </div>
                  <button
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending && remove.variables === c.id}
                    title="Hapus dari daftar (AI membalas lagi)"
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    {remove.isPending && remove.variables === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-400">{list.length} nomor dikecualikan</div>
      </div>
    </div>
  );
}
