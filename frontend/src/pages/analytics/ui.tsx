import { ReactNode } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { PALETTE } from './api';

export function Card({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {right && <span className="text-xs text-gray-500">{right}</span>}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold" style={{ color: accent ?? '#111827' }}>{value}</p>
      {sub && <p className="truncate text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

export const Loading = () => <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

export function Empty({ text = 'Belum ada data pada rentang ini' }: { text?: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-gray-400">
      <BarChart3 className="mb-2 h-7 w-7 opacity-40" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

const axis = { fontSize: 11, fill: '#9ca3af' };
const tooltip = { contentStyle: { borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 } };

/** Grafik batang bertumpuk/berkelompok per hari. */
export function DailyBars<T extends object>({ data, x, series, stacked = true, height = 220 }: {
  data: T[]; x: keyof T & string; series: { key: keyof T & string; name: string; color: string }[]; stacked?: boolean; height?: number;
}) {
  const hasData = data.some(d => series.some(s => Number(d[s.key]) > 0));
  if (!hasData) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} minTickGap={12} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltip} cursor={{ fill: '#f9fafb' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            radius={stacked && i < series.length - 1 ? 0 : [3, 3, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea<T extends object>({ data, x, y, name, color, height = 220 }: {
  data: T[]; x: keyof T & string; y: keyof T & string; name: string; color: string; height?: number;
}) {
  if (!data.some(d => Number(d[y]) > 0)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${y}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltip} />
        <Area type="monotone" dataKey={y} name={name} stroke={color} strokeWidth={2} fill={`url(#g-${y})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Donut + legenda dengan angka & persen. */
export function Donut({ data, center }: { data: { name: string; value: number; color?: string }[]; center?: ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d, i) => <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {center ?? <><span className="text-lg font-semibold text-gray-900">{total}</span><span className="text-[10px] text-gray-400">total</span></>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} />
            <span className="truncate text-gray-600">{d.name}</span>
            <span className="ml-auto font-medium text-gray-900">{d.value}</span>
            <span className="w-9 text-right text-gray-400">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Daftar batang horizontal (mis. label, per AI Agent). */
export function BarList({ items }: { items: { name: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it.name} className="text-xs">
          <div className="mb-1 flex justify-between"><span className="truncate text-gray-600">{it.name}</span><span className="font-medium text-gray-900">{it.value}</span></div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? PALETTE[i % PALETTE.length] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
