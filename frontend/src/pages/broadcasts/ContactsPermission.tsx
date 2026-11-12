import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Upload, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { broadcastApi, ConsentAction, ELIGIBILITY_META, PermissionContact, fmtDate, errMsg } from './api';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20';
const SOURCES = ['Website Form', 'Chat WhatsApp', 'Formulir Offline', 'Event', 'Manual'];
const CONSENT_LABEL: Record<string, string> = { OPTED_IN: 'Opted-in', OPTED_OUT: 'Opted-out', UNKNOWN: 'Belum ada' };

/** Contact Health & Permission: status Eligible / Review / Suppressed + kelola izin. */
export default function ContactsPermission() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState(SOURCES[0]);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ['broadcast-contacts', q, status, page],
    queryFn: () => broadcastApi.contacts({ search: q || undefined, status, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];

  const update = useMutation({
    mutationFn: (action: ConsentAction) => broadcastApi.updateConsent({ contactIds: [...selected], action, source }),
    onSuccess: r => {
      toast.success(`${r.updated} kontak diperbarui`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['broadcast-contacts'] });
    },
    onError: e => toast.error(errMsg(e)),
  });

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every(r => selected.has(r.id));
  const tabs = [
    { id: 'all', label: 'Semua', n: data?.counts.all },
    { id: 'eligible', label: 'Eligible', n: data?.counts.eligible },
    { id: 'review', label: 'Review', n: data?.counts.review },
    { id: 'suppressed', label: 'Suppressed', n: data?.counts.suppressed },
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        Nomor yang tersimpan tidak otomatis boleh menerima promosi. Catat izin (opt-in) beserta sumbernya. Kontak yang membalas <b>STOP / BERHENTI / UNSUBSCRIBE</b> otomatis menjadi Suppressed; balasan <b>MULAI</b> mencatat opt-in kembali.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setStatus(t.id); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${status === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label} {t.n !== undefined && <span className="text-gray-400">{t.n}</span>}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor" className={`${INPUT} pl-9`} />
        </div>
        <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <Upload className="h-4 w-4" />Impor opt-in
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
          <span className="font-medium text-gray-800">{selected.size} dipilih</span>
          <select value={source} onChange={e => setSource(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
          {([
            ['opt_in', 'Tandai opt-in', 'bg-emerald-600 text-white'],
            ['opt_out', 'Opt-out', 'bg-white text-gray-700 border border-gray-300'],
            ['blacklist', 'Blacklist', 'bg-white text-red-600 border border-red-200'],
            ['unblacklist', 'Hapus blacklist', 'bg-white text-gray-700 border border-gray-300'],
            ['reset', 'Reset', 'bg-white text-gray-500 border border-gray-300'],
          ] as [ConsentAction, string, string][]).map(([a, label, cls]) => (
            <button key={a} disabled={update.isPending} onClick={() => update.mutate(a)} className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${cls}`}>{label}</button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Batal</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={allOnPage} onChange={() => setSelected(s => {
                  const n = new Set(s);
                  rows.forEach(r => (allOnPage ? n.delete(r.id) : n.add(r.id)));
                  return n;
                })} />
              </th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Izin</th>
              <th className="px-3 py-2">Sumber</th>
              <th className="px-3 py-2">Broadcast terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c: PermissionContact) => (
              <tr key={c.id} className="hover:bg-gray-50/60">
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td className="px-3 py-2"><p className="font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.phone || '-'}</p></td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ELIGIBILITY_META[c.status].cls}`}>{ELIGIBILITY_META[c.status].label}</span>
                  {c.status !== 'ELIGIBLE' && <p className="mt-0.5 text-[11px] text-gray-400">{c.reason}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {CONSENT_LABEL[c.consent.status ?? 'UNKNOWN']}{c.consent.blacklisted && <span className="ml-1 text-red-500">· Blacklist</span>}
                  {c.consent.consentAt && <p className="text-[11px] text-gray-400">{fmtDate(c.consent.consentAt)}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.consent.source || '-'}{c.consent.category && <p className="text-[11px] text-gray-400">{c.consent.category}</p>}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(c.consent.lastBroadcastAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-400">{isFetching ? 'Memuat…' : 'Tidak ada kontak'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
          Halaman {page} / {data.meta.totalPages}
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [category, setCategory] = useState('Marketing');
  const [agree, setAgree] = useState(false);
  const run = useMutation({
    mutationFn: () => broadcastApi.importOptIn({ text, source, category }),
    onSuccess: r => {
      toast.success(`${r.imported} kontak opt-in diimpor`);
      if (r.invalid.length) toast.error(`${r.invalid.length} baris dilewati: ${r.invalid.slice(0, 3).join('; ')}`);
      qc.invalidateQueries({ queryKey: ['broadcast-contacts'] });
      onClose();
    },
    onError: e => toast.error(errMsg(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Impor kontak opt-in</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <label className="block text-xs font-medium text-gray-600">Satu kontak per baris: <code>nomor,nama</code>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder={'08123456789,Budi Santoso\n628987654321,Siti'} className={`${INPUT} mt-1 font-mono`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600">Sumber persetujuan
              <select value={source} onChange={e => setSource(e.target.value)} className={`${INPUT} mt-1`}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="text-xs font-medium text-gray-600">Kategori
              <select value={category} onChange={e => setCategory(e.target.value)} className={`${INPUT} mt-1`}>
                {['Marketing', 'Informasi', 'Transaksional'].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="flex gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
            Saya menyatakan seluruh kontak ini telah memberikan izin menerima pesan dari bisnis kami. Kontak yang sudah berhenti berlangganan atau di-blacklist tidak akan diubah.
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Batal</button>
          <button disabled={!agree || !text.trim() || run.isPending} onClick={() => run.mutate()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Impor
          </button>
        </div>
      </div>
    </div>
  );
}
