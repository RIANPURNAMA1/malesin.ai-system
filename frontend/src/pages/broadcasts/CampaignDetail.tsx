import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { broadcastApi, STATUS_META, fmtDate, BroadcastRecipient, Broadcast } from './api';
import CampaignActions from './CampaignActions';

const RECIPIENT_META: Record<BroadcastRecipient['status'], { label: string; cls: string }> = {
  PENDING: { label: 'Antre', cls: 'text-gray-500' },
  SENT: { label: 'Terkirim', cls: 'text-emerald-600' },
  FAILED: { label: 'Gagal', cls: 'text-red-500' },
  SKIPPED: { label: 'Dilewati', cls: 'text-amber-600' },
};

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%');

export function Progress({ b }: { b: Broadcast }) {
  const done = b.sentCount + b.failedCount + b.skippedCount;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="flex h-full" style={{ width: pct(done, b.totalRecipients) }}>
        <div className="bg-emerald-500" style={{ flex: b.sentCount }} />
        <div className="bg-red-400" style={{ flex: b.failedCount }} />
        <div className="bg-amber-400" style={{ flex: b.skippedCount }} />
      </div>
    </div>
  );
}

export default function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [filter, setFilter] = useState<'ALL' | BroadcastRecipient['status']>('ALL');
  const { data: b, isLoading } = useQuery({ queryKey: ['broadcast', id], queryFn: () => broadcastApi.get(id), refetchInterval: 10_000 });

  if (isLoading || !b) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const st = STATUS_META[b.status];
  const recipients = (b.recipients ?? []).filter(r => filter === 'ALL' || r.status === filter);
  const stats = [
    { label: 'Penerima', value: b.totalRecipients },
    { label: 'Terkirim', value: b.sentCount, sub: pct(b.sentCount, b.totalRecipients) },
    { label: 'Gagal', value: b.failedCount, sub: pct(b.failedCount, b.sentCount + b.failedCount) },
    { label: 'Dilewati', value: b.skippedCount },
    { label: 'Respons', value: b.repliedCount, sub: pct(b.repliedCount, b.sentCount) },
    { label: 'Opt-out', value: b.optOutCount, sub: pct(b.optOutCount, b.sentCount) },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{b.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{b.channel?.name} · dibuat {fmtDate(b.createdAt)} · jadwal {fmtDate(b.scheduledAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <CampaignActions b={b} onDeleted={onClose} />
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {(b.pauseReason || b.waitingReason) && (
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />{b.status === 'PAUSED' ? b.pauseReason : b.waitingReason}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stats.map(s => (
            <div key={s.label} className="rounded-lg border border-gray-200 p-2.5">
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className="text-lg font-semibold text-gray-900">{s.value.toLocaleString('id-ID')}</p>
              {s.sub && <p className="text-[11px] text-gray-400">{s.sub}</p>}
            </div>
          ))}
        </div>
        <Progress b={b} />

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium text-gray-500">Pesan</p>
          {b.mediaUrl && <img src={b.mediaUrl} alt="" className="mb-2 h-24 rounded object-cover" />}
          <p className="whitespace-pre-wrap text-sm text-gray-800">{b.message}</p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(['ALL', 'PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs transition ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'ALL' ? 'Semua' : RECIPIENT_META[f].label}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr><th className="px-3 py-2">Kontak</th><th className="px-3 py-2">Status</th><th className="hidden px-3 py-2 sm:table-cell">Waktu</th><th className="px-3 py-2">Keterangan</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipients.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2"><p className="font-medium text-gray-800">{r.name}</p><p className="text-xs text-gray-400">{r.phone}</p></td>
                    <td className={`px-3 py-2 text-xs font-medium ${RECIPIENT_META[r.status].cls}`}>{RECIPIENT_META[r.status].label}</td>
                    <td className="hidden px-3 py-2 text-xs text-gray-500 sm:table-cell">{fmtDate(r.sentAt)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {r.optedOutAt ? 'Berhenti berlangganan' : r.repliedAt ? `Membalas ${fmtDate(r.repliedAt)}` : r.error || ''}
                    </td>
                  </tr>
                ))}
                {!recipients.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">Tidak ada data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
