import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { analyticsApi, AnalyticsFilters, COLORS, PLATFORM_LABEL, hms, pct, shortDate, shortMonth } from './api';
import { Card, Stat, Loading, DailyBars, TrendArea, Donut, BarList } from './ui';
import TranscriptPanel from '../conversations/TranscriptPanel';

const SLA_META = {
  MET: { label: 'Tercapai', cls: 'bg-emerald-50 text-emerald-600' },
  BREACHED: { label: 'Terlewat', cls: 'bg-red-50 text-red-500' },
  RUNNING: { label: 'Berjalan', cls: 'bg-blue-50 text-blue-600' },
};
const STATUS_COLOR = { OPEN: COLORS.emerald, PENDING: COLORS.amber, CLOSED: COLORS.gray };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

export default function SessionTab({ filters, onEditSla }: { filters: AnalyticsFilters; onEditSla?: () => void }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => setPage(1), [filters]);
  const { data, isLoading } = useQuery({ queryKey: ['an-session', filters], queryFn: () => analyticsApi.session(filters), placeholderData: keepPreviousData });
  const { data: list } = useQuery({
    queryKey: ['an-session-list', filters, page],
    queryFn: () => analyticsApi.sessionList(filters, page),
    placeholderData: keepPreviousData,
  });

  if (isLoading || !data) return <Loading />;
  const p = data.performance;
  const daily = data.daily.map(d => ({ ...d, label: shortDate(d.date) }));

  return (
    <div className="space-y-4">
      {data.truncated && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Data terlalu banyak; hanya 50.000 sesi pertama yang dihitung. Persempit rentang tanggal.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="First Customer Session" right={`${data.totals.first} sesi`}>
          <DailyBars data={daily} x="label" series={[{ key: 'first', name: 'Pelanggan baru', color: COLORS.primary }]} />
        </Card>
        <Card title="Returning Customer Session" right={`${data.totals.returning} sesi`}>
          <DailyBars data={daily} x="label" series={[{ key: 'returning', name: 'Pelanggan kembali', color: COLORS.violet }]} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Session Source" right={`${data.totals.sessions} sesi`}>
          <Donut data={data.source.map(s => ({ name: `${s.name} (${PLATFORM_LABEL[s.type] ?? s.type})`, value: s.count }))} />
        </Card>
        <Card title="Session Resolution Rate" right={`${data.resolution.closed}/${data.resolution.total} selesai`}>
          <Donut
            data={[
              { name: 'Selesai (Closed)', value: data.resolution.closed, color: COLORS.emerald },
              { name: 'Belum selesai', value: data.resolution.total - data.resolution.closed, color: '#e5e7eb' },
            ]}
            center={<><span className="text-lg font-semibold text-gray-900">{pct(data.resolution.rate)}</span><span className="text-[10px] text-gray-400">resolved</span></>}
          />
        </Card>
        <Card title="Session Label" right={`${data.labels.reduce((s, l) => s + l.count, 0)} label dipasang`}>
          <BarList items={data.labels.map(l => ({ name: l.name, value: l.count, color: l.color }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Historical MAU" right="kontak unik yang mengirim pesan / bulan" className="lg:col-span-2">
          <TrendArea data={data.mau.map(m => ({ ...m, label: shortMonth(m.month) }))} x="label" y="mau" name="MAU" color={COLORS.primary} />
        </Card>
        <Card title="Session Status" right={`${data.totals.sessions} sesi`}>
          <Donut data={(['OPEN', 'PENDING', 'CLOSED'] as const).map(s => ({ name: s[0] + s.slice(1).toLowerCase(), value: data.status[s] ?? 0, color: STATUS_COLOR[s] }))} />
        </Card>
      </div>

      <Card
        title="Session Performance"
        right={
          <button onClick={onEditSla} disabled={!onEditSla} className="flex items-center gap-1 text-primary hover:underline disabled:text-gray-500 disabled:no-underline">
            <Settings2 className="h-3.5 w-3.5" />SLA: respons ≤ {data.sla.firstResponseMinutes} mnt · selesai ≤ {data.sla.resolutionHours} jam
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Rata-rata durasi sesi" value={hms(p.avgSessionSec)} sub="sesi yang sudah Closed" />
          <Stat label="Rata-rata durasi sesi AI" value={hms(p.avgAiSessionSec)} sub="sampai diserahkan / ditutup" />
          <Stat label="Rata-rata durasi sesi agen" value={hms(p.avgAgentSessionSec)} sub="sejak diserahkan ke manusia" />
          <Stat label="Rata-rata respons pertama" value={hms(p.avgFirstResponseSec)} />
          <Stat label="SLA In" value={pct(p.slaIn)} sub="respons pertama tepat waktu" accent={COLORS.emerald} />
          <Stat label="SLA Out" value={pct(p.slaOut)} sub="selesai tepat waktu" accent={COLORS.primary} />
        </div>
      </Card>

      <Card title="Session List" right={list ? `${list.meta.total} sesi` : undefined}>
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                {['Nama', 'Platform', 'Inbox', 'Telepon', 'Sesi ke', 'Agen', 'Dibuat', 'Diserahkan ke agen', 'Selesai', 'Durasi AI', 'Durasi agen', 'SLA'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list?.data.map(r => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-800">{r.name}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{PLATFORM_LABEL[r.platform] ?? r.platform}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{r.inbox}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{r.phone || '-'}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">#{r.sessionNumber}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{r.agent ?? '-'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{fmt(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{fmt(r.handedToHumanAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{fmt(r.closedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{hms(r.aiDurationSec)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{hms(r.agentDurationSec)}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SLA_META[r.sla].cls}`}>{SLA_META[r.sla].label}</span></td>
                </tr>
              ))}
              {list && !list.data.length && <tr><td colSpan={12} className="py-10 text-center text-xs text-gray-400">Belum ada sesi pada rentang ini</td></tr>}
            </tbody>
          </table>
        </div>
        {list && list.meta.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-500">
            Halaman {page} / {list.meta.totalPages}
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={page >= list.meta.totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-gray-200 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </Card>

      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpenId(null)}>
          <div className="h-full w-full max-w-md bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <TranscriptPanel id={openId} onClose={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
