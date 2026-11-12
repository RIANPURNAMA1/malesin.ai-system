import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi, AnalyticsFilters, COLORS, PLATFORM_LABEL, pct, shortDate } from './api';
import { Card, Stat, Loading, DailyBars, Donut, BarList, Empty } from './ui';

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/** Leads = deal yang masuk ke Pipeline (otomatis saat kontak baru chat pertama kali, atau manual). */
export default function LeadsTab({ filters }: { filters: AnalyticsFilters }) {
  const { data, isLoading } = useQuery({ queryKey: ['an-leads', filters], queryFn: () => analyticsApi.leads(filters), placeholderData: keepPreviousData });
  if (isLoading || !data) return <Loading />;
  const t = data.totals;
  const daily = data.daily.map(d => ({ ...d, label: shortDate(d.date) }));
  const funnelMax = Math.max(1, ...data.stages.map(s => s.count));

  return (
    <div className="space-y-4">
      {data.truncated && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Data terlalu banyak; persempit rentang tanggal.</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Leads masuk" value={t.leads.toLocaleString('id-ID')} sub={`${t.auto} otomatis · ${t.manual} manual`} accent={COLORS.primary} />
        <Stat label="Masih berjalan" value={t.open} sub={t.pipelineValue ? `nilai ${rupiah(t.pipelineValue)}` : 'deal terbuka'} />
        <Stat label="Closing" value={t.won} sub={t.wonValue ? rupiah(t.wonValue) : undefined} accent={COLORS.emerald} />
        <Stat label="Batal" value={t.lost} accent={COLORS.red} />
        <Stat label="Konversi" value={pct(t.conversionRate)} sub="leads → closing" accent={COLORS.violet} />
        <Stat label="Rata-rata / hari" value={(t.leads / Math.max(1, data.daily.length)).toFixed(1).replace('.0', '')} sub="leads masuk" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads masuk per hari" right={`${t.leads} leads`} className="lg:col-span-2">
          <DailyBars data={daily} x="label" stacked={false} series={[
            { key: 'leads', name: 'Leads masuk', color: COLORS.primary },
            { key: 'won', name: 'Closing', color: COLORS.emerald },
          ]} />
        </Card>
        <Card title="Sumber leads">
          <Donut data={data.source.map(s => ({ name: `${s.name}${PLATFORM_LABEL[s.type] && PLATFORM_LABEL[s.type] !== s.name ? ` (${PLATFORM_LABEL[s.type]})` : ''}`, value: s.count }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Posisi leads saat ini" right={<Link to="/pipeline" className="text-primary hover:underline">Buka Pipeline →</Link>} className="lg:col-span-2">
          {!t.leads ? <Empty /> : (
            <ul className="space-y-2">
              {data.stages.map(s => (
                <li key={s.name} className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 truncate text-gray-600"><span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <div className="h-5 rounded bg-gray-100">
                    <div className="h-5 rounded" style={{ width: `${(s.count / funnelMax) * 100}%`, background: s.color, minWidth: s.count ? 6 : 0 }} />
                  </div>
                  <span className="w-16 text-right font-medium text-gray-900">{s.count} <span className="font-normal text-gray-400">{pct(t.leads ? s.count / t.leads : null)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Alasan batal">
          <BarList items={data.lostReasons.map(r => ({ name: r.name, value: r.count, color: COLORS.red }))} />
        </Card>
      </div>

      <p className="text-xs text-gray-400">
        Leads dihitung dari deal yang masuk ke Pipeline pada rentang tanggal terpilih. Deal dibuat otomatis saat kontak baru chat pertama kali (bisa diatur di pengaturan Pipeline).
      </p>
    </div>
  );
}
