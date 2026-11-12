import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, MessageCircle, Bot, Cpu, User, Sparkles, Trash2, Check, Trophy, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { crmApi, DealActivity, Stage, rupiah, errMsg } from './api';
import LostReasonModal from './LostReasonModal';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none';
const ACTOR_ICON = { SYSTEM: Cpu, AI: Bot, USER: User };

function ActivityItem({ a, stageName }: { a: DealActivity; stageName: (id: string | null) => string }) {
  const Icon = a.type === 'SUGGESTION' ? Sparkles : ACTOR_ICON[a.actor];
  const who = a.actor === 'USER' ? a.userName ?? 'Pengguna' : a.actor === 'AI' ? 'AI' : 'Sistem';
  const title =
    a.type === 'STAGE' ? `${stageName(a.fromStageId)} → ${stageName(a.toStageId)}`
      : a.type === 'CREATED' ? `Deal dibuat di ${stageName(a.toStageId)}`
        : a.type === 'SUGGESTION' ? (a.actor === 'AI' ? `Saran pindah ke ${stageName(a.toStageId)}` : a.message ?? 'Saran AI')
          : a.type === 'NOTE' ? 'Catatan' : a.message ?? 'Perubahan';
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${a.actor === 'AI' ? 'bg-violet-50 text-violet-600' : a.actor === 'SYSTEM' ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <p className="text-gray-800"><b className="font-medium">{who}</b> · {title}</p>
        {a.message && a.type !== 'UPDATE' && !(a.type === 'SUGGESTION' && a.actor === 'USER') && (
          <p className={`mt-0.5 whitespace-pre-wrap ${a.type === 'NOTE' ? 'rounded bg-amber-50 p-2 text-gray-700' : 'text-gray-500'}`}>{a.message}</p>
        )}
        {a.metadata?.evidence && <p className="mt-0.5 italic text-gray-400">“{a.metadata.evidence}”</p>}
        <p className="mt-0.5 text-[10px] text-gray-400">
          {new Date(a.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {a.metadata?.confidence !== undefined && ` · keyakinan ${Math.round(a.metadata.confidence * 100)}%`}
        </p>
      </div>
    </li>
  );
}

export default function DealPanel({ id, users, isAdmin, onClose }: {
  id: string; users: { id: string; name: string }[]; isAdmin: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: deal, isLoading } = useQuery({ queryKey: ['deal', id], queryFn: () => crmApi.deal(id) });
  const [form, setForm] = useState({ title: '', value: '', ownerId: '', expectedCloseAt: '' });
  const [note, setNote] = useState('');
  const [lostTarget, setLostTarget] = useState<Stage | null>(null);

  useEffect(() => {
    if (deal) setForm({
      title: deal.title, value: String(deal.value || ''), ownerId: deal.ownerId ?? '',
      expectedCloseAt: deal.expectedCloseAt ? deal.expectedCloseAt.slice(0, 10) : '',
    });
  }, [deal]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deal', id] });
    qc.invalidateQueries({ queryKey: ['crm-board'] });
  };
  const onError = (e: unknown) => toast.error(errMsg(e));
  const save = useMutation({
    mutationFn: () => crmApi.updateDeal(id, {
      title: form.title, value: Number(form.value.replace(/\D/g, '')) || 0,
      ...(isAdmin ? { ownerId: form.ownerId || null } : {}),
      expectedCloseAt: form.expectedCloseAt ? new Date(`${form.expectedCloseAt}T12:00:00`).toISOString() : null,
    }),
    onSuccess: () => { refresh(); toast.success('Deal disimpan'); }, onError,
  });
  const move = useMutation({ mutationFn: (p: { stageId: string; reason?: string }) => crmApi.move(id, p.stageId, p.reason), onSuccess: refresh, onError });
  const suggestion = useMutation({ mutationFn: (accept: boolean) => crmApi.suggestion(id, accept), onSuccess: refresh, onError });
  const addNote = useMutation({ mutationFn: () => crmApi.note(id, note), onSuccess: () => { setNote(''); refresh(); }, onError });
  const analyze = useMutation({ mutationFn: () => crmApi.analyze(id), onSuccess: () => { refresh(); toast.success('AI selesai membaca percakapan'); }, onError });
  const remove = useMutation({ mutationFn: () => crmApi.deleteDeal(id), onSuccess: () => { refresh(); onClose(); }, onError });

  if (isLoading || !deal) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const stages = deal.pipeline.stages;
  const stageName = (sid: string | null) => stages.find(s => s.id === sid)?.name ?? '–';
  const won = stages.find(s => s.kind === 'WON');
  const lost = stages.find(s => s.kind === 'LOST');
  const toStage = (s: Stage) => (s.kind === 'LOST' ? setLostTarget(s) : move.mutate({ stageId: s.id }));
  const sug = deal.aiSuggestion;
  const dirty = form.title !== deal.title || (Number(form.value.replace(/\D/g, '')) || 0) !== deal.value
    || (form.ownerId || null) !== deal.ownerId || form.expectedCloseAt !== (deal.expectedCloseAt?.slice(0, 10) ?? '');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{deal.title}</p>
          <p className="truncate text-xs text-gray-500">{deal.contact.name} · {deal.contact.phone || '-'}</p>
        </div>
        <div className="flex items-center gap-1">
          {deal.conversationId && (
            <button onClick={() => navigate(`/inbox/${deal.conversationId}`)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
              <MessageCircle className="h-3.5 w-3.5" />Chat
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Tahap */}
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            {stages.filter(s => s.kind === 'OPEN').map(s => (
              <button key={s.id} disabled={move.isPending} onClick={() => toStage(s)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${s.id === deal.stageId ? 'border-transparent font-medium text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                style={s.id === deal.stageId ? { background: s.color } : undefined}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {won && (
              <button disabled={move.isPending || deal.stageId === won.id} onClick={() => toStage(won)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Trophy className="h-3.5 w-3.5" />{deal.stageId === won.id ? won.name : `Konfirmasi ${won.name}`}
              </button>
            )}
            {lost && (
              <button disabled={move.isPending || deal.stageId === lost.id} onClick={() => toStage(lost)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Ban className="h-3.5 w-3.5" />{deal.stageId === lost.id ? `${lost.name}${deal.lostReason ? ` · ${deal.lostReason}` : ''}` : lost.name}
              </button>
            )}
          </div>
        </div>

        {/* Saran AI */}
        {sug && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-violet-700"><Sparkles className="h-3.5 w-3.5" />Saran AI: pindah ke {stageName(sug.stageId)} ({Math.round(sug.confidence * 100)}%)</p>
            {sug.reason && <p className="mt-1 text-gray-700">{sug.reason}</p>}
            {sug.evidence && <p className="mt-0.5 italic text-gray-500">“{sug.evidence}”</p>}
            <div className="mt-2 flex gap-2">
              <button disabled={suggestion.isPending} onClick={() => suggestion.mutate(true)} className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 font-medium text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />Terima</button>
              <button disabled={suggestion.isPending} onClick={() => suggestion.mutate(false)} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-gray-700 disabled:opacity-50">Tolak</button>
            </div>
          </div>
        )}

        {/* Detail */}
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600">
          <label className="col-span-2">Judul<input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={`${INPUT} mt-1`} /></label>
          <label>Nilai (Rp)
            <input inputMode="numeric" value={form.value ? Number(form.value.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={e => setForm(f => ({ ...f, value: e.target.value.replace(/\D/g, '') }))} placeholder="0" className={`${INPUT} mt-1`} />
          </label>
          <label>Perkiraan closing<input type="date" value={form.expectedCloseAt} onChange={e => setForm(f => ({ ...f, expectedCloseAt: e.target.value }))} className={`${INPUT} mt-1`} /></label>
          <label className="col-span-2">Pemilik
            <select disabled={!isAdmin} value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))} className={`${INPUT} mt-1 disabled:bg-gray-50`}>
              <option value="">Belum ada</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              {deal.owner && !users.some(u => u.id === deal.owner!.id) && <option value={deal.owner.id}>{deal.owner.name}</option>}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => analyze.mutate()} disabled={analyze.isPending || deal.status !== 'OPEN'} className="flex items-center gap-1 text-xs text-violet-600 hover:underline disabled:text-gray-400 disabled:no-underline">
            {analyze.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}Analisis chat dengan AI sekarang
          </button>
          <button disabled={!dirty || save.isPending} onClick={() => save.mutate()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">Simpan</button>
        </div>

        {/* Catatan + riwayat */}
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-900">Catatan & riwayat</p>
          <div className="mb-3 flex gap-2">
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && note.trim() && addNote.mutate()} placeholder="Tulis catatan internal…" className={INPUT} />
            <button disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()} className="rounded-lg border border-gray-300 px-3 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">Tambah</button>
          </div>
          <ul className="space-y-3">{deal.activities.map(a => <ActivityItem key={a.id} a={a} stageName={stageName} />)}</ul>
        </div>

        {isAdmin && (
          <button onClick={() => confirm(`Hapus deal "${deal.title}"?`) && remove.mutate()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />Hapus deal
          </button>
        )}
      </div>

      {lostTarget && (
        <LostReasonModal
          stageName={lostTarget.name}
          onCancel={() => setLostTarget(null)}
          onConfirm={reason => { move.mutate({ stageId: lostTarget.id, reason }); setLostTarget(null); }}
        />
      )}
    </div>
  );
}
