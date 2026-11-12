import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, ShieldCheck, Loader2, Send, AlertTriangle, MessageCircleReply, UserX, Users } from 'lucide-react';
import { useSocketStore } from '../store/socket.store';
import { broadcastApi, Broadcast, STATUS_META, fmtDate } from './broadcasts/api';
import CampaignForm from './broadcasts/CampaignForm';
import CampaignDetail, { Progress, pct } from './broadcasts/CampaignDetail';
import CampaignActions from './broadcasts/CampaignActions';
import ContactsPermission from './broadcasts/ContactsPermission';

type Tab = 'campaigns' | 'contacts';

const TABS: { id: Tab; label: string; icon: typeof Megaphone }[] = [
  { id: 'campaigns', label: 'Campaign', icon: Megaphone },
  { id: 'contacts', label: 'Kontak & Izin', icon: Users },
];

/** Broadcast Protection & Compliance Engine — campaign + izin kontak. */
export default function BroadcastsPage() {
  const qc = useQueryClient();
  const { socket } = useSocketStore();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: list = [], isLoading } = useQuery({ queryKey: ['broadcasts'], queryFn: broadcastApi.list });

  // Progres realtime dari engine pengiriman.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (b: Broadcast) => {
      qc.setQueryData<Broadcast[]>(['broadcasts'], prev => prev?.map(x => (x.id === b.id ? { ...x, ...b, channel: x.channel } : x)));
      qc.invalidateQueries({ queryKey: ['broadcast', b.id] });
    };
    socket.on('broadcast:updated', onUpdate);
    return () => { socket.off('broadcast:updated', onUpdate); };
  }, [socket, qc]);

  if (creating) return <CampaignForm onClose={() => setCreating(false)} />;

  const totals = list.reduce((a, b) => ({
    sent: a.sent + b.sentCount, failed: a.failed + b.failedCount, replied: a.replied + b.repliedCount, optOut: a.optOut + b.optOutCount,
  }), { sent: 0, failed: 0, replied: 0, optOut: 0 });

  const stats = [
    { icon: Send, label: 'Terkirim', value: totals.sent, cls: 'text-emerald-600' },
    { icon: AlertTriangle, label: 'Gagal', value: totals.failed, cls: 'text-red-500' },
    { icon: MessageCircleReply, label: 'Respons', value: totals.replied, sub: pct(totals.replied, totals.sent), cls: 'text-primary' },
    { icon: UserX, label: 'Opt-out', value: totals.optOut, sub: pct(totals.optOut, totals.sent), cls: 'text-amber-600' },
  ];

  return (
    <div className="flex h-full bg-gray-50">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + tab bergaris bawah */}
        <div className="bg-white px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold text-gray-900">Broadcasts</h1>
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5" />Broadcast Protection &amp; Compliance Engine
            </p>
          </div>
          <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active ? 'border-primary text-primary' : 'border-transparent text-gray-800 hover:text-gray-950'}`}>
                  <t.icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-white px-4 pb-5 sm:px-6">
            {/* Toolbar: ringkasan di kiri, aksi utama di kanan */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              {tab === 'campaigns' ? (
                <div className="flex flex-wrap gap-2">
                  {stats.map(s => (
                    <div key={s.label} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm">
                      <s.icon className={`h-4 w-4 ${s.cls}`} />
                      <span className="text-gray-500">{s.label}</span>
                      <span className="font-semibold text-gray-900">{s.value.toLocaleString('id-ID')}</span>
                      {s.sub && <span className="text-xs text-gray-400">{s.sub}</span>}
                    </div>
                  ))}
                </div>
              ) : <div />}
              <button onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                <Plus className="h-4 w-4" />Buat Campaign
              </button>
            </div>

            {tab === 'contacts' ? <ContactsPermission /> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="text-gray-900">
                        <th className="px-2 py-2.5 font-semibold">Nama campaign</th>
                        <th className="px-2 py-2.5 font-semibold">Kanal</th>
                        <th className="px-2 py-2.5 font-semibold">Jadwal / dibuat</th>
                        <th className="w-56 px-2 py-2.5 font-semibold">Progres</th>
                        <th className="px-2 py-2.5 font-semibold">Status</th>
                        <th className="px-2 py-2.5 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan={6} className="py-12"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></td></tr>
                      ) : !list.length ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-4 text-gray-700">
                            <p>Tidak ada data</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Catat izin kontak di tab Kontak &amp; Izin, lalu buat campaign untuk kontak yang eligible.
                            </p>
                          </td>
                        </tr>
                      ) : list.map(b => {
                        const st = STATUS_META[b.status];
                        const note = b.status === 'PAUSED' ? b.pauseReason : b.status === 'RUNNING' ? b.waitingReason : null;
                        const active = openId === b.id;
                        return (
                          <tr key={b.id} tabIndex={0} onClick={() => setOpenId(b.id)} onKeyDown={e => e.key === 'Enter' && setOpenId(b.id)}
                            className={`cursor-pointer border-t border-gray-100 align-top transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
                              active ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                            <td className="px-2 py-3">
                              <p className="font-medium text-gray-900">{b.name}</p>
                              {note && (
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{note}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-3 text-gray-700">{b.channel?.name ?? '-'}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-gray-700">
                              {b.status === 'SCHEDULED' ? `Dijadwalkan ${fmtDate(b.scheduledAt)}` : fmtDate(b.createdAt)}
                            </td>
                            <td className="px-2 py-3">
                              <Progress b={b} />
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                <span>{b.sentCount}/{b.totalRecipients} terkirim</span>
                                {b.failedCount > 0 && <span className="text-red-500">{b.failedCount} gagal</span>}
                                {b.skippedCount > 0 && <span className="text-amber-600">{b.skippedCount} dilewati</span>}
                                <span>{b.repliedCount} respons</span>
                                {b.optOutCount > 0 && <span>{b.optOutCount} opt-out</span>}
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end">
                                <CampaignActions b={b} onDeleted={() => openId === b.id && setOpenId(null)} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer seperti referensi (hanya info total, tanpa paginasi baru) */}
                <div className="mt-4 flex justify-end text-sm text-gray-700">
                  Total: {list.length.toLocaleString('id-ID')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {openId && tab === 'campaigns' && (
        <div className="fixed inset-0 z-40 bg-white lg:static lg:z-auto lg:w-[520px] lg:flex-shrink-0 lg:border-l lg:border-gray-200">
          <CampaignDetail id={openId} onClose={() => setOpenId(null)} />
        </div>
      )}
    </div>
  );
}