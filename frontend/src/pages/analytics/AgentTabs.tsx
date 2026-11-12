import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Avatar } from '../../components/ui/index';
import { analyticsApi, AnalyticsFilters, COLORS, hms, pct, shortDate } from './api';
import { Card, Stat, Loading, DailyBars, Donut, BarList, Empty } from './ui';

export function AiTab({ filters }: { filters: AnalyticsFilters }) {
  const { data, isLoading } = useQuery({ queryKey: ['an-ai', filters], queryFn: () => analyticsApi.ai(filters), placeholderData: keepPreviousData });
  if (isLoading || !data) return <Loading />;
  const t = data.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Sesi ditangani AI" value={t.sessionsHandled} sub={`${t.aiOnly} selesai tanpa manusia`} accent={COLORS.violet} />
        <Stat label="Balasan AI" value={t.replies.toLocaleString('id-ID')} sub="pesan terkirim oleh AI" />
        <Stat label="AI resolution rate" value={pct(t.resolutionRate)} sub="sesi Closed yang hanya ditangani AI" accent={COLORS.emerald} />
        <Stat label="Handoff ke manusia" value={pct(t.handoffRate)} sub={`${t.handedToHuman} sesi diambil alih`} accent={COLORS.amber} />
        <Stat label="Rata-rata respons AI" value={hms(t.avgFirstResponseSec)} sub="respons pertama" />
        <Stat label="Rata-rata durasi sesi AI" value={hms(t.avgAiSessionSec)} sub="sampai diserahkan / ditutup" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Balasan AI per hari" right={`${t.replies} balasan`} className="lg:col-span-2">
          <DailyBars data={data.daily.map(d => ({ ...d, label: shortDate(d.date) }))} x="label" series={[{ key: 'replies', name: 'Balasan AI', color: COLORS.violet }]} />
        </Card>
        <Card title="Penanganan sesi AI">
          <Donut data={[
            { name: 'Selesai oleh AI saja', value: t.aiOnly, color: COLORS.violet },
            { name: 'Diserahkan ke manusia', value: t.handedToHuman, color: COLORS.amber },
          ]} />
        </Card>
      </div>
      <Card title="Balasan per AI Agent">
        <BarList items={data.perAgent.map(a => ({ name: a.name, value: a.replies }))} />
      </Card>
      <p className="text-xs text-gray-400">Data AI dicatat sejak fitur penanda sumber pesan aktif; balasan AI yang lebih lama tidak terhitung.</p>
    </div>
  );
}

export function HumanTab({ filters }: { filters: AnalyticsFilters }) {
  const { data, isLoading } = useQuery({ queryKey: ['an-human', filters], queryFn: () => analyticsApi.human(filters), placeholderData: keepPreviousData });
  if (isLoading || !data) return <Loading />;
  const t = data.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Sesi di-assign" value={t.assigned} />
        <Stat label="Sesi ditutup" value={t.closed} accent={COLORS.emerald} />
        <Stat label="Pesan dikirim" value={t.messagesSent.toLocaleString('id-ID')} />
        <Stat label="Rata-rata respons pertama" value={hms(t.avgFirstResponseSec)} sub="sejak di-assign" />
        <Stat label="Rata-rata penyelesaian" value={hms(t.avgResolutionSec)} sub="sejak ditangani agen" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sesi ditutup per agen">
          <BarList items={data.agents.filter(a => a.closed).map(a => ({ name: a.name, value: a.closed, color: COLORS.emerald }))} />
        </Card>
        <Card title="Pesan dikirim per agen">
          <BarList items={data.agents.filter(a => a.messagesSent).map(a => ({ name: a.name, value: a.messagesSent, color: COLORS.primary }))} />
        </Card>
      </div>
      <Card title="Performa agen" right={`${data.agents.length} agen`}>
        {!data.agents.length ? <Empty text="Belum ada agen" /> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>{['Agen', 'Di-assign', 'Sedang ditangani', 'Ditutup', 'Pesan', 'Respons pertama', 'Penyelesaian'].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.agents.map(a => (
                  <tr key={a.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={a.name} src={a.avatar ?? undefined} size="sm" />
                        <div><p className="font-medium text-gray-800">{a.name}</p><p className="text-[11px] text-gray-400">{a.role}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{a.assigned}</td>
                    <td className="px-4 py-2 text-gray-700">{a.openNow}</td>
                    <td className="px-4 py-2 text-gray-700">{a.closed}</td>
                    <td className="px-4 py-2 text-gray-700">{a.messagesSent}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{hms(a.avgFirstResponseSec)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{hms(a.avgResolutionSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const BC_STATUS: Record<string, string> = {
  DRAFT: 'Draft', SCHEDULED: 'Terjadwal', RUNNING: 'Berjalan', PAUSED: 'Dijeda', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
};

export function BroadcastTab({ filters }: { filters: AnalyticsFilters }) {
  const { data, isLoading } = useQuery({ queryKey: ['an-bc', filters], queryFn: () => analyticsApi.broadcast(filters), placeholderData: keepPreviousData });
  if (isLoading || !data) return <Loading />;
  const t = data.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Campaign" value={t.campaigns} sub={`${t.recipients} penerima`} />
        <Stat label="Terkirim" value={t.sent} sub={`${pct(t.deliveryRate)} berhasil`} accent={COLORS.emerald} />
        <Stat label="Gagal" value={t.failed} accent={COLORS.red} />
        <Stat label="Respons" value={t.replied} sub={`${pct(t.replyRate)} dari terkirim`} accent={COLORS.primary} />
        <Stat label="Opt-out" value={t.optOut} sub={`${pct(t.optOutRate)} dari terkirim`} accent={COLORS.amber} />
      </div>
      <Card title="Pengiriman broadcast per hari">
        <DailyBars
          data={data.daily.map(d => ({ ...d, label: shortDate(d.date) }))}
          x="label"
          stacked={false}
          series={[
            { key: 'sent', name: 'Terkirim', color: COLORS.emerald },
            { key: 'replied', name: 'Membalas', color: COLORS.primary },
            { key: 'optOut', name: 'Opt-out', color: COLORS.amber },
          ]}
        />
      </Card>
      <Card title="Campaign" right={`${data.campaigns.length} campaign`}>
        {!data.campaigns.length ? <Empty text="Belum ada campaign pada rentang ini" /> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>{['Campaign', 'Kanal', 'Status', 'Penerima', 'Terkirim', 'Gagal', 'Respons', 'Opt-out'].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.campaigns.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-2"><p className="font-medium text-gray-800">{c.name}</p><p className="text-[11px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('id-ID')}</p></td>
                    <td className="px-4 py-2 text-xs text-gray-600">{c.channel.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{BC_STATUS[c.status] ?? c.status}</td>
                    <td className="px-4 py-2 text-gray-700">{c.totalRecipients}</td>
                    <td className="px-4 py-2 text-gray-700">{c.sentCount}</td>
                    <td className="px-4 py-2 text-gray-700">{c.failedCount}</td>
                    <td className="px-4 py-2 text-gray-700">{c.repliedCount} <span className="text-xs text-gray-400">{pct(c.sentCount ? c.repliedCount / c.sentCount : null)}</span></td>
                    <td className="px-4 py-2 text-gray-700">{c.optOutCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
