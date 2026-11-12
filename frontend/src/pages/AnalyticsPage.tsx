import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { channelService, userService } from '../services/index';
import { useAuthStore } from '../store/auth.store';
import { analyticsApi, AnalyticsFilters, Sla } from './analytics/api';
import SessionTab from './analytics/SessionTab';
import LeadsTab from './analytics/LeadsTab';
import { AiTab, HumanTab, BroadcastTab } from './analytics/AgentTabs';

const TABS = [
  { id: 'leads', label: 'Leads' },
  { id: 'session', label: 'Session' },
  { id: 'ai', label: 'AI Agent' },
  { id: 'human', label: 'Human Agent' },
  { id: 'broadcast', label: 'Broadcast' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const PRESETS = [
  { id: 'today', label: 'Hari ini', days: 0 },
  { id: '7d', label: '7 hari', days: 6 },
  { id: '30d', label: '30 hari', days: 29 },
  { id: '90d', label: '90 hari', days: 89 },
  { id: 'custom', label: 'Custom', days: -1 },
] as const;
type PresetId = (typeof PRESETS)[number]['id'];

const SELECT = 'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary/50 focus:outline-none';
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AnalyticsPage() {
  const isAdmin = ['OWNER', 'ADMIN'].includes(useAuthStore(s => s.user?.role) ?? '');
  const [tab, setTab] = useState<TabId>('leads');
  const [preset, setPreset] = useState<PresetId>('7d');
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [channelId, setChannelId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [slaOpen, setSlaOpen] = useState(false);

  const { data: channels = [] } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['users'], queryFn: userService.list, enabled: isAdmin });

  const filters = useMemo<AnalyticsFilters>(() => {
    const p = PRESETS.find(x => x.id === preset)!;
    let start: Date, end: Date;
    if (p.days < 0) {
      start = new Date(`${from}T00:00:00`);
      end = new Date(`${to}T23:59:59.999`);
    } else {
      end = new Date();
      start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - p.days);
    }
    return { from: start.toISOString(), to: end.toISOString(), channelId: channelId || undefined, agentId: agentId || undefined };
    // Preset dihitung ulang saat filter berubah; "hari ini" ikut bergeser bila halaman dibuka lama.
  }, [preset, from, to, channelId, agentId]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><BarChart3 className="h-5 w-5 text-primary" />Analytics</h1>
          <div className="flex flex-wrap items-center gap-2">
            <select value={channelId} onChange={e => setChannelId(e.target.value)} className={SELECT}>
              <option value="">Semua inbox</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isAdmin && (
              <select value={agentId} onChange={e => setAgentId(e.target.value)} className={SELECT}>
                <option value="">Semua agen</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setPreset(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${preset === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{p.label}</button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={SELECT} />–
                <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={SELECT} />
              </div>
            )}
          </div>
        </div>
        <nav className="mt-3 flex gap-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`border-b-2 pb-2.5 text-sm font-medium transition ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-5">
        {tab === 'leads' && <LeadsTab filters={filters} />}
        {tab === 'session' && <SessionTab filters={filters} onEditSla={isAdmin ? () => setSlaOpen(true) : undefined} />}
        {tab === 'ai' && <AiTab filters={filters} />}
        {tab === 'human' && <HumanTab filters={filters} />}
        {tab === 'broadcast' && <BroadcastTab filters={filters} />}
      </div>

      {slaOpen && <SlaModal onClose={() => setSlaOpen(false)} />}
    </div>
  );
}

function SlaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['an-sla'], queryFn: analyticsApi.sla });
  const [form, setForm] = useState<Sla | null>(null);
  const v = form ?? data;
  const save = useMutation({
    mutationFn: (s: Sla) => analyticsApi.saveSla(s),
    onSuccess: () => {
      toast.success('Target SLA disimpan');
      qc.invalidateQueries({ queryKey: ['an-sla'] });
      qc.invalidateQueries({ queryKey: ['an-session'] });
      qc.invalidateQueries({ queryKey: ['an-session-list'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message || 'Gagal menyimpan'),
  });
  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Target SLA</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        {!v ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="space-y-3 p-5">
            <label className="block text-xs font-medium text-gray-600">SLA In — respons pertama maksimal (menit)
              <input type="number" min={1} max={1440} value={v.firstResponseMinutes} onChange={e => setForm({ ...v, firstResponseMinutes: Number(e.target.value) })} className={input} />
            </label>
            <label className="block text-xs font-medium text-gray-600">SLA Out — sesi selesai maksimal (jam)
              <input type="number" min={1} max={720} value={v.resolutionHours} onChange={e => setForm({ ...v, resolutionHours: Number(e.target.value) })} className={input} />
            </label>
            <p className="text-xs text-gray-400">Sesi dihitung "Tercapai" bila respons pertama dan penyelesaiannya di bawah target.</p>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Batal</button>
          <button disabled={!v || save.isPending} onClick={() => v && save.mutate(v)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Simpan</button>
        </div>
      </div>
    </div>
  );
}
