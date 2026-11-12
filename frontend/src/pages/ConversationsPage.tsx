import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  MessageSquare, Search, Download, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, Bot, User, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { channelService, labelService, userService } from '../services/index';
import { useAuthStore } from '../store/auth.store';
import { convApi, Filters, ConvRow, fmtDate, fmtDuration, STATUS_META, errMsg } from './conversations/api';
import TranscriptPanel from './conversations/TranscriptPanel';

const SELECT = 'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary/50 focus:outline-none';
const RANGES = [
  { id: 'today', label: 'Hari ini', days: 0 },
  { id: '7d', label: '7 hari', days: 7 },
  { id: '30d', label: '30 hari', days: 30 },
  { id: 'all', label: 'Semua', days: -1 },
  { id: 'custom', label: 'Custom', days: -2 },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

function rangeToDates(range: RangeId, from: string, to: string): Pick<Filters, 'from' | 'to'> {
  const r = RANGES.find(x => x.id === range)!;
  if (r.days === -1) return {};
  if (r.days === -2) {
    return {
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - r.days);
  return { from: start.toISOString() };
}

/** Halaman Conversations: pemantauan & pengelolaan semua percakapan lintas kanal. */
export default function ConversationsPage() {
  const qc = useQueryClient();
  const isAdmin = ['OWNER', 'ADMIN'].includes(useAuthStore(s => s.user?.role) ?? '');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [range, setRange] = useState<RangeId>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [f, setF] = useState<Filters>({ sort: 'lastMessageAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // ?open=<id> (mis. dari menu ⋮ di chat) langsung membuka transkrip.
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open'));
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 400); return () => clearTimeout(t); }, [search]);

  const filters = useMemo<Filters>(
    () => ({ ...f, search: debounced, ...rangeToDates(range, customFrom, customTo) }),
    [f, debounced, range, customFrom, customTo]
  );
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filters]);

  const { data: channels = [] } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const { data: labels = [] } = useQuery({ queryKey: ['labels'], queryFn: labelService.list });
  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['users'], queryFn: userService.list, enabled: isAdmin });
  const { data: stats } = useQuery({ queryKey: ['conv-stats', filters], queryFn: () => convApi.stats(filters), placeholderData: keepPreviousData });
  const { data, isFetching } = useQuery({
    queryKey: ['conv-manage', filters, page],
    queryFn: () => convApi.list(filters, page),
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];

  const bulk = useMutation({
    mutationFn: (p: { action: 'status' | 'assign' | 'label'; value: string }) => convApi.bulk({ ids: [...selected], ...p }),
    onSuccess: r => {
      toast.success(`${r.updated} percakapan diperbarui`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['conv-manage'] });
      qc.invalidateQueries({ queryKey: ['conv-stats'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: e => toast.error(errMsg(e)),
  });

  const set = (k: keyof Filters, v: string) => setF(p => ({ ...p, [k]: v || undefined }));
  const sortBy = (col: string) => setF(p => ({ ...p, sort: col, dir: p.sort === col && p.dir === 'desc' ? 'asc' : 'desc' }));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every(r => selected.has(r.id));
  const activeFilters = ['status', 'channelId', 'agentId', 'labelId', 'handledBy', 'unassigned'].some(k => f[k as keyof Filters]);

  const doExport = async () => {
    setExporting(true);
    try { await convApi.exportCsv(filters); } catch (e) { toast.error(errMsg(e)); } finally { setExporting(false); }
  };

  const pct = (n: number | null | undefined) => (n === null || n === undefined ? '-' : `${Math.round(n * 100)}%`);
  const cards = [
    { label: 'Total', value: stats?.total, sub: `${stats?.unassigned ?? 0} belum di-assign` },
    { label: 'Open', value: stats?.open, onClick: () => set('status', f.status === 'OPEN' ? '' : 'OPEN'), active: f.status === 'OPEN' },
    { label: 'Pending', value: stats?.pending, onClick: () => set('status', f.status === 'PENDING' ? '' : 'PENDING'), active: f.status === 'PENDING' },
    { label: 'Closed', value: stats?.closed, onClick: () => set('status', f.status === 'CLOSED' ? '' : 'CLOSED'), active: f.status === 'CLOSED' },
    { label: 'Selesai oleh AI', value: pct(stats?.aiResolutionRate), sub: `${stats?.handledByAi ?? 0} AI · ${stats?.handledByHuman ?? 0} manusia` },
    { label: 'Respons pertama', value: fmtDuration(stats?.avgFirstResponseSec), sub: 'rata-rata' },
    { label: 'Durasi selesai', value: fmtDuration(stats?.avgResolutionSec), sub: 'rata-rata' },
  ];

  const SortTh = ({ col, children, className = '' }: { col: string; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 ${className}`}>
      <button onClick={() => sortBy(col)} className={`flex items-center gap-1 hover:text-gray-800 ${f.sort === col ? 'text-gray-800' : ''}`}>
        {children}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><MessageSquare className="h-5 w-5 text-primary" />Conversations</h1>
            <p className="text-xs text-gray-500">Pantau dan kelola semua percakapan lintas kanal</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {RANGES.map(r => (
                <button key={r.id} onClick={() => setRange(r.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${range === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{r.label}</button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={SELECT} />–
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={SELECT} />
              </div>
            )}
            <button onClick={doExport} disabled={exporting} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export CSV
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {cards.map(c => (
              <button key={c.label} type="button" onClick={c.onClick} disabled={!c.onClick}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-default ${c.active ? 'border-primary bg-primary/5' : 'border-gray-200'} ${c.onClick ? 'hover:border-primary/40' : ''}`}>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="mt-0.5 text-xl font-semibold text-gray-900">{c.value ?? '–'}</p>
                {c.sub && <p className="truncate text-[11px] text-gray-400">{c.sub}</p>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, nomor, atau isi pesan"
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
            </div>
            <select value={f.status ?? ''} onChange={e => set('status', e.target.value)} className={SELECT}>
              <option value="">Semua status</option><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="CLOSED">Closed</option>
            </select>
            <select value={f.channelId ?? ''} onChange={e => set('channelId', e.target.value)} className={SELECT}>
              <option value="">Semua kanal</option>{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={f.handledBy ?? ''} onChange={e => set('handledBy', e.target.value)} className={SELECT}>
              <option value="">Semua penanganan</option><option value="AI">Ditangani AI</option><option value="HUMAN">Ditangani manusia</option><option value="NONE">Belum dibalas</option>
            </select>
            {isAdmin && (
              <select value={f.unassigned ? '__none' : f.agentId ?? ''} onChange={e => setF(p => ({
                ...p, agentId: e.target.value && e.target.value !== '__none' ? e.target.value : undefined, unassigned: e.target.value === '__none' ? '1' : undefined,
              }))} className={SELECT}>
                <option value="">Semua agen</option><option value="__none">Belum di-assign</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select value={f.labelId ?? ''} onChange={e => set('labelId', e.target.value)} className={SELECT}>
              <option value="">Semua label</option>{labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {activeFilters && (
              <button onClick={() => setF({ sort: f.sort, dir: f.dir })} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><X className="h-3.5 w-3.5" />Reset</button>
            )}
          </div>

          {isAdmin && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
              <span className="font-medium text-gray-800">{selected.size} dipilih</span>
              <select value="" disabled={bulk.isPending} onChange={e => e.target.value && bulk.mutate({ action: 'status', value: e.target.value })} className={SELECT}>
                <option value="">Ubah status…</option><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="CLOSED">Closed</option>
              </select>
              <select value="" disabled={bulk.isPending} onChange={e => e.target.value && bulk.mutate({ action: 'assign', value: e.target.value })} className={SELECT}>
                <option value="">Assign ke…</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value="" disabled={bulk.isPending} onChange={e => e.target.value && bulk.mutate({ action: 'label', value: e.target.value })} className={SELECT}>
                <option value="">Tambah label…</option>{labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {bulk.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Batal</button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  {isAdmin && (
                    <th className="w-10 px-3 py-2">
                      <input type="checkbox" checked={allOnPage} onChange={() => setSelected(s => {
                        const n = new Set(s);
                        rows.forEach(r => (allOnPage ? n.delete(r.id) : n.add(r.id)));
                        return n;
                      })} />
                    </th>
                  )}
                  <th className="px-3 py-2">Kontak</th>
                  <th className="px-3 py-2">Kanal</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ditangani</th>
                  <th className="px-3 py-2">Agen</th>
                  <th className="px-3 py-2">Pesan</th>
                  <SortTh col="firstResponseAt">Respons</SortTh>
                  <th className="px-3 py-2">Durasi</th>
                  <SortTh col="createdAt">Dibuat</SortTh>
                  <SortTh col="lastMessageAt">Aktivitas</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: ConvRow) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer transition hover:bg-gray-50 ${openId === r.id ? 'bg-primary/5' : ''}`}>
                    {isAdmin && (
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                    )}
                    <td className="max-w-[240px] px-3 py-2">
                      <p className="truncate font-medium text-gray-800">{r.contact.name}</p>
                      <p className="truncate text-xs text-gray-400">{r.lastMessage || r.contact.phone || '-'}</p>
                      {r.labels.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.labels.map(l => <span key={l.id} className="rounded-full px-1.5 text-[10px] text-white" style={{ background: l.color }}>{l.name}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.channel.name}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span></td>
                    <td className="px-3 py-2 text-xs">
                      {r.handledBy === 'AI' ? <span className="flex items-center gap-1 text-violet-600"><Bot className="h-3.5 w-3.5" />AI</span>
                        : r.handledBy === 'HUMAN' ? <span className="flex items-center gap-1 text-primary"><User className="h-3.5 w-3.5" />Manusia</span>
                        : <span className="text-gray-400">Belum dibalas</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.agent?.name ?? <span className="text-gray-400">-</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.messageCount}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{fmtDuration(r.firstResponseSec)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.closedAt ? fmtDuration(r.durationSec) : '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(r.lastMessageAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={isAdmin ? 11 : 10} className="px-3 py-12 text-center text-xs text-gray-400">{isFetching ? 'Memuat…' : 'Tidak ada percakapan'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.meta.total > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{data.meta.total.toLocaleString('id-ID')} percakapan {isFetching && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</span>
              <div className="flex items-center gap-2">
                Halaman {page} / {Math.max(1, data.meta.totalPages)}
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {openId && (
        <div className="fixed inset-0 z-40 bg-white lg:static lg:z-auto lg:w-[460px] lg:flex-shrink-0 lg:border-l lg:border-gray-200">
          <TranscriptPanel id={openId} onClose={() => setOpenId(null)} />
        </div>
      )}
    </div>
  );
}
