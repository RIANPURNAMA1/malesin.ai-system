import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Ban, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { broadcastApi, Broadcast, errMsg } from './api';

const BTN = 'flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-gray-50 disabled:opacity-50';

/** Tombol Jeda / Lanjutkan / Batalkan / Hapus sesuai status campaign. */
export default function CampaignActions({ b, onDeleted }: { b: Broadcast; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['broadcasts'] });
    qc.invalidateQueries({ queryKey: ['broadcast', b.id] });
  };
  const act = useMutation({
    mutationFn: (a: 'pause' | 'resume' | 'cancel') => broadcastApi.action(b.id, a),
    onSuccess: refresh,
    onError: e => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => broadcastApi.remove(b.id),
    onSuccess: () => { refresh(); toast.success('Campaign dihapus'); onDeleted?.(); },
    onError: e => toast.error(errMsg(e)),
  });
  const busy = act.isPending || del.isPending;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex items-center gap-1.5" onClick={stop}>
      {(b.status === 'RUNNING' || b.status === 'SCHEDULED') && (
        <button disabled={busy} onClick={() => act.mutate('pause')} className={`${BTN} text-amber-600`}><Pause className="h-3.5 w-3.5" />Jeda</button>
      )}
      {(b.status === 'PAUSED' || b.status === 'DRAFT') && (
        <button disabled={busy} onClick={() => act.mutate('resume')} className={`${BTN} text-emerald-600`}>
          <Play className="h-3.5 w-3.5" />{b.status === 'DRAFT' ? 'Mulai' : 'Lanjutkan'}
        </button>
      )}
      {['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(b.status) && (
        <button disabled={busy} onClick={() => confirm('Batalkan campaign? Penerima yang belum terkirim akan dilewati.') && act.mutate('cancel')} className={`${BTN} text-red-500`}>
          <Ban className="h-3.5 w-3.5" />Batalkan
        </button>
      )}
      {b.status !== 'RUNNING' && (
        <button disabled={busy} onClick={() => confirm(`Hapus campaign "${b.name}"?`) && del.mutate()} className={`${BTN} text-gray-500`} aria-label="Hapus">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
