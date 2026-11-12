import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useSearchParams } from 'react-router-dom';
import { Plus, Search, Settings2, Sparkles, AlertTriangle, Loader2, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../services/index';
import { useAuthStore } from '../store/auth.store';
import { useSocketStore } from '../store/socket.store';
import { Avatar } from '../components/ui/index';
import { crmApi, Deal, Stage, AUTO_MODE_LABEL, shortRupiah, ago, errMsg } from './crm/api';
import DealPanel from './crm/DealPanel';
import PipelineSettings from './crm/PipelineSettings';
import NewDealModal from './crm/NewDealModal';
import LostReasonModal from './crm/LostReasonModal';

const STALE_DAYS = 3;

/** Sub-navigasi CRM (Kontak / Pipeline). */
export function CrmTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm transition ${isActive ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`;
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      <NavLink to="/contacts" className={cls}>Kontak</NavLink>
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
    </div>
  );
}

function DealCard({ deal, stage, onOpen, onDragStart }: { deal: Deal; stage: Stage; onOpen: () => void; onDragStart: (e: React.DragEvent) => void }) {
  const stale = deal.status === 'OPEN' && Date.now() - new Date(deal.lastActivityAt).getTime() > STALE_DAYS * 86_400_000;
  return (
    <div draggable onDragStart={onDragStart} onClick={onOpen} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition hover:border-primary/40 hover:shadow active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${stage.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-gray-900">{deal.title}</p>
        <span className="flex-shrink-0 text-[10px] text-gray-400">{ago(deal.lastActivityAt)}</span>
      </div>
      {deal.title !== deal.contact.name && <p className="truncate text-xs text-gray-500">{deal.contact.name}</p>}
      <p className="truncate text-[11px] text-gray-400">{deal.contact.phone || '-'}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700">{deal.value ? shortRupiah(deal.value) : ''}</span>
        {deal.owner && <Avatar name={deal.owner.name} src={deal.owner.avatar} size="xs" />}
      </div>
      {(deal.aiSuggestion || stale || deal.lostReason) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {deal.aiSuggestion && <span className="flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"><Sparkles className="h-3 w-3" />Saran AI</span>}
          {stale && <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600"><AlertTriangle className="h-3 w-3" />Macet</span>}
          {deal.status === 'LOST' && deal.lostReason && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">{deal.lostReason}</span>}
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const qc = useQueryClient();
  const { socket } = useSocketStore();
  const isAdmin = ['OWNER', 'ADMIN'].includes(useAuthStore(s => s.user?.role) ?? '');
  const [pipelineId, setPipelineId] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [ownerId, setOwnerId] = useState('');
  // ?deal=<id> (mis. dari menu ⋮ di chat) langsung membuka panel deal.
  const [params, setParams] = useSearchParams();
  const [openId, setOpenIdState] = useState<string | null>(params.get('deal'));
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    if (!id && params.has('deal')) setParams({}, { replace: true });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDeal, setNewDeal] = useState<{ stageId?: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [lostDrop, setLostDrop] = useState<{ dealId: string; stage: Stage } | null>(null);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const { data: pipelines = [], isLoading } = useQuery({ queryKey: ['crm-pipelines'], queryFn: crmApi.pipelines });
  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['users'], queryFn: userService.list, enabled: isAdmin });
  const pipeline = pipelines.find(p => p.id === pipelineId) ?? pipelines[0];
  useEffect(() => { if (pipeline && pipeline.id !== pipelineId) setPipelineId(pipeline.id); }, [pipeline, pipelineId]);

  const boardKey = ['crm-board', pipeline?.id, q, ownerId];
  const { data: deals = [] } = useQuery({
    queryKey: boardKey,
    queryFn: () => crmApi.board(pipeline!.id, { search: q, ownerId }),
    enabled: !!pipeline,
  });

  // Realtime: kartu bergerak saat sistem/AI/agen lain memindahkan deal.
  useEffect(() => {
    if (!socket) return;
    const onDeal = ({ dealId }: { dealId: string }) => {
      qc.invalidateQueries({ queryKey: ['crm-board'] });
      qc.invalidateQueries({ queryKey: ['deal', dealId] });
    };
    socket.on('deal:updated', onDeal);
    return () => { socket.off('deal:updated', onDeal); };
  }, [socket, qc]);

  const move = useMutation({
    mutationFn: (p: { dealId: string; stageId: string; reason?: string }) => crmApi.move(p.dealId, p.stageId, p.reason),
    onMutate: async p => {
      // Optimistic: kartu langsung pindah kolom.
      await qc.cancelQueries({ queryKey: boardKey });
      const prev = qc.getQueryData<Deal[]>(boardKey);
      qc.setQueryData<Deal[]>(boardKey, list => list?.map(d => (d.id === p.dealId ? { ...d, stageId: p.stageId, aiSuggestion: null } : d)));
      return { prev };
    },
    onError: (e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(boardKey, ctx.prev); toast.error(errMsg(e)); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-board'] }),
  });

  const create = useMutation({
    mutationFn: (name: string) => crmApi.createPipeline(name),
    onSuccess: p => { qc.invalidateQueries({ queryKey: ['crm-pipelines'] }); setPipelineId(p.id); },
    onError: e => toast.error(errMsg(e)),
  });

  const columns = useMemo(() => (pipeline?.stages ?? []).map(stage => {
    const list = deals.filter(d => d.stageId === stage.id);
    return { stage, list, value: list.reduce((s, d) => s + d.value, 0) };
  }), [pipeline, deals]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!pipeline) return null;

  const open = deals.filter(d => d.status === 'OPEN');
  const won = deals.filter(d => d.status === 'WON');
  const decided = deals.filter(d => d.status !== 'OPEN').length;

  const onDrop = (stage: Stage, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const dealId = e.dataTransfer.getData('text/deal');
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stageId === stage.id) return;
    if (stage.kind === 'LOST') return setLostDrop({ dealId, stage });
    move.mutate({ dealId, stageId: stage.id });
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <CrmTabs />
            <select value={pipeline.id} onChange={e => e.target.value === '__new' ? (() => { const n = prompt('Nama pipeline baru'); if (n?.trim()) create.mutate(n.trim()); })() : setPipelineId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 focus:outline-none">
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
              {isAdmin && <option value="__new">+ Pipeline baru…</option>}
            </select>
            <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600"><Bot className="h-3.5 w-3.5" />{AUTO_MODE_LABEL[pipeline.autoMode].label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari deal / kontak" className="w-48 rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
            </div>
            {isAdmin && (
              <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none">
                <option value="">Semua pemilik</option><option value="none">Belum ada pemilik</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {isAdmin && <button onClick={() => setSettingsOpen(true)} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" aria-label="Pengaturan pipeline"><Settings2 className="h-4 w-4" /></button>}
            <button onClick={() => setNewDeal({})} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"><Plus className="h-4 w-4" />Deal</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
          <span><b className="text-gray-800">{open.length}</b> deal terbuka · {shortRupiah(open.reduce((s, d) => s + d.value, 0))}</span>
          <span><b className="text-emerald-600">{won.length}</b> closing (30 hari) · {shortRupiah(won.reduce((s, d) => s + d.value, 0))}</span>
          <span>Win rate {decided ? Math.round((won.length / decided) * 100) : 0}%</span>
          <span className="text-gray-400">Seret kartu untuk memindah tahap</span>
        </div>

        <div className="flex flex-1 gap-3 overflow-x-auto bg-gray-50 p-4">
          {columns.map(({ stage, list, value }) => (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(d => (d === stage.id ? null : d))}
              onDrop={e => onDrop(stage, e)}
              className={`flex w-72 flex-shrink-0 flex-col rounded-xl border bg-gray-100/70 transition ${dragOver === stage.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}>
              <div className="px-3 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                  <p className="truncate text-sm font-semibold text-gray-800">{stage.name}</p>
                  <span className="ml-auto rounded-full bg-white px-2 text-xs text-gray-500">{list.length}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{value ? shortRupiah(value) : 'Rp 0'}{stage.kind !== 'OPEN' ? ' · 30 hari terakhir' : ''}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {list.map(d => (
                  <DealCard key={d.id} deal={d} stage={stage} onOpen={() => setOpenId(d.id)}
                    onDragStart={e => { e.dataTransfer.setData('text/deal', d.id); e.dataTransfer.effectAllowed = 'move'; }} />
                ))}
                {stage.kind === 'OPEN' && (
                  <button onClick={() => setNewDeal({ stageId: stage.id })} className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-gray-400 hover:bg-white hover:text-gray-600">
                    <Plus className="h-3.5 w-3.5" />Tambah
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {openId && (
        <div className="fixed inset-0 z-40 bg-white lg:static lg:z-auto lg:w-[420px] lg:flex-shrink-0 lg:border-l lg:border-gray-200">
          <DealPanel id={openId} users={users} isAdmin={isAdmin} onClose={() => setOpenId(null)} />
        </div>
      )}
      {settingsOpen && <PipelineSettings pipeline={pipeline} onClose={() => setSettingsOpen(false)} />}
      {newDeal && <NewDealModal pipeline={pipeline} stageId={newDeal.stageId} users={users} isAdmin={isAdmin} onClose={() => setNewDeal(null)} />}
      {lostDrop && (
        <LostReasonModal stageName={lostDrop.stage.name} onCancel={() => setLostDrop(null)}
          onConfirm={reason => { move.mutate({ dealId: lostDrop.dealId, stageId: lostDrop.stage.id, reason }); setLostDrop(null); }} />
      )}
    </div>
  );
}
