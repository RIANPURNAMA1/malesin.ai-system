import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, Bot, Users, UserCheck, Shuffle, Gauge, Star, RefreshCw, Timer, Keyboard, Hand } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAgentService, channelService, userService } from '../services/index';
import { AiAgent, Channel } from '../types';

type Distribution = 'LEAST_ENGAGED' | 'ROUND_ROBIN';

export interface ChannelSettings {
  aiValue: string; // '' = otomatis (agent aktif pertama), 'off' = nonaktif, selain itu id agent
  agentIds: string[];
  distribution: Distribution;
  maxPerAgent: string;
  preferredAgent: boolean;
  reassignOffline: boolean;
  // Perilaku balasan AI (metadata.aiBehavior)
  replyDelayMin: string;
  replyDelayMax: string;
  typingIndicator: boolean;
  typingSpeed: string;
  humanTakeover: boolean;
  takeoverMinutes: string;
}

/** Baca pengaturan kanal dari metadata (dipakai juga untuk ringkasan di kartu). */
export function readChannelSettings(ch: Channel): ChannelSettings {
  const m = ch.metadata ?? {};
  const r = m.routing ?? {};
  const b = m.aiBehavior ?? {};
  const str = (v: unknown, def: number) => String(v ?? def);
  return {
    replyDelayMin: str(b.replyDelayMin, 2),
    replyDelayMax: str(b.replyDelayMax, 5),
    typingIndicator: b.typingIndicator !== false,
    typingSpeed: str(b.typingSpeed, 15),
    humanTakeover: b.humanTakeover !== false,
    takeoverMinutes: str(b.takeoverMinutes, 30),
    aiValue: m.aiEnabled === false ? 'off' : m.aiAgentId || '',
    agentIds: Array.isArray(r.agentIds) ? r.agentIds : [],
    distribution: r.distribution === 'ROUND_ROBIN' ? 'ROUND_ROBIN' : 'LEAST_ENGAGED',
    maxPerAgent: r.maxPerAgent ? String(r.maxPerAgent) : '',
    preferredAgent: !!r.preferredAgent,
    reassignOffline: !!r.reassignOffline,
  };
}

export const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  LEAST_ENGAGED: 'Penugasan paling sedikit lebih dulu',
  ROUND_ROBIN: 'Round robin',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, link, children }: {
  icon: typeof Bot; title: string; desc: string; link?: { label: string; onClick: () => void }; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-5 last:border-0 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-3 md:max-w-sm">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{desc}</p>
          {link && (
            <button type="button" onClick={link.onClick} className="mt-1 text-xs font-medium text-primary hover:underline">
              {link.label}
            </button>
          )}
        </div>
      </div>
      <div className="w-full md:w-80">{children}</div>
    </div>
  );
}

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20';

export default function ChannelSettingsModal({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [s, setS] = useState<ChannelSettings>(() => readChannelSettings(channel));
  const [active, setActive] = useState(channel.isActive);
  const set = <K extends keyof ChannelSettings>(k: K, v: ChannelSettings[K]) => setS(p => ({ ...p, [k]: v }));

  const { data: agents = [] } = useQuery({ queryKey: ['ai-agents'], queryFn: aiAgentService.list });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: userService.list });
  const humanAgents = (Array.isArray(users) ? users : []) as { id: string; name: string; role: string; isActive: boolean }[];

  const save = useMutation({
    mutationFn: () =>
      channelService.update(channel.id, {
        isActive: active,
        metadata: {
          aiEnabled: s.aiValue !== 'off',
          aiAgentId: s.aiValue && s.aiValue !== 'off' ? s.aiValue : null,
          routing: {
            agentIds: s.agentIds,
            distribution: s.distribution,
            maxPerAgent: Number(s.maxPerAgent) > 0 ? Number(s.maxPerAgent) : null,
            preferredAgent: s.preferredAgent,
            reassignOffline: s.reassignOffline,
          },
          aiBehavior: {
            replyDelayMin: Math.max(0, Number(s.replyDelayMin) || 0),
            replyDelayMax: Math.max(Number(s.replyDelayMin) || 0, Number(s.replyDelayMax) || 0),
            typingIndicator: s.typingIndicator,
            typingSpeed: Math.max(3, Number(s.typingSpeed) || 15),
            humanTakeover: s.humanTakeover,
            takeoverMinutes: Math.max(0, Number(s.takeoverMinutes) || 0),
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Pengaturan kanal disimpan');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menyimpan pengaturan'),
  });

  const toggleAgent = (id: string) =>
    set('agentIds', s.agentIds.includes(id) ? s.agentIds.filter(x => x !== id) : [...s.agentIds, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900">{channel.name}</h2>
            <p className="text-xs text-gray-500">{channel.type.replace(/_/g, ' ')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">Dasar</span>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Toggle checked={active} onChange={setActive} /> {active ? 'Aktif' : 'Nonaktif'}
            </label>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="pt-5">
            <h3 className="text-base font-semibold text-gray-900">Pengaturan dasar</h3>
            <p className="text-xs text-gray-500">Atur AI, agen, dan routing percakapan untuk kanal ini.</p>
          </div>

          <Row icon={Bot} title="AI Agent" desc="Pilih AI Agent yang merespons pesan masuk di kanal ini."
            link={{ label: 'Kelola AI Agent', onClick: () => navigate('/ai-agents') }}>
            <select value={s.aiValue} onChange={e => set('aiValue', e.target.value)} className={FIELD}>
              <option value="off">Nonaktif (AI tidak membalas)</option>
              <option value="">Otomatis (agent aktif pertama)</option>
              {(agents as AiAgent[]).map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.isActive ? '' : ' (nonaktif)'}</option>
              ))}
            </select>
          </Row>

          <Row icon={Timer} title="Jeda sebelum membalas" desc="AI menunggu acak di antara nilai ini (detik) sejak pesan masuk, supaya tidak membalas terlalu cepat.">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={120} value={s.replyDelayMin} onChange={e => set('replyDelayMin', e.target.value)} className={FIELD} />
              <span className="text-xs text-gray-400">s/d</span>
              <input type="number" min={0} max={120} value={s.replyDelayMax} onChange={e => set('replyDelayMax', e.target.value)} className={FIELD} />
              <span className="text-xs text-gray-400">detik</span>
            </div>
          </Row>

          <Row icon={Keyboard} title="Animasi mengetik" desc='Tampilkan "sedang mengetik..." di WhatsApp sebelum tiap balasan. Lamanya menyesuaikan panjang pesan (khusus WhatsApp Unofficial).'>
            <div className="space-y-2">
              <Toggle checked={s.typingIndicator} onChange={v => set('typingIndicator', v)} />
              {s.typingIndicator && (
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Kecepatan
                  <input type="number" min={3} max={100} value={s.typingSpeed} onChange={e => set('typingSpeed', e.target.value)} className={`${FIELD} w-24`} />
                  karakter/detik
                </label>
              )}
            </div>
          </Row>

          <Row icon={Hand} title="Berhenti saat manusia mengambil alih" desc="AI berhenti membalas percakapan ketika agen mengetik/membalas dari dashboard atau membalas langsung dari HP.">
            <div className="space-y-2">
              <Toggle checked={s.humanTakeover} onChange={v => set('humanTakeover', v)} />
              {s.humanTakeover && (
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  AI dijeda selama
                  <input type="number" min={0} value={s.takeoverMinutes} onChange={e => set('takeoverMinutes', e.target.value)} className={`${FIELD} w-24`} />
                  menit (0 = sampai diaktifkan lagi)
                </label>
              )}
            </div>
          </Row>

          <Row icon={Users} title="Tim" desc="Pilih tim atau departemen yang mengelola antrean percakapan ini.">
            <select disabled className={`${FIELD} cursor-not-allowed bg-gray-50 text-gray-400`}>
              <option>Fitur tim belum tersedia</option>
            </select>
          </Row>

          <Row icon={UserCheck} title="Agen manusia" desc="Agen yang menerima percakapan baru secara otomatis. Kosongkan untuk tidak menugaskan otomatis."
            link={{ label: 'Kelola agen', onClick: () => navigate('/settings') }}>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-gray-300 p-2">
              {humanAgents.filter(u => u.isActive !== false).length === 0 && (
                <p className="px-1 py-2 text-xs text-gray-400">Belum ada agen.</p>
              )}
              {humanAgents.filter(u => u.isActive !== false).map(u => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input type="checkbox" checked={s.agentIds.includes(u.id)} onChange={() => toggleAgent(u.id)} className="rounded" />
                  <span className="flex-1 truncate text-gray-800">{u.name}</span>
                  <span className="text-[11px] text-gray-400">{u.role}</span>
                </label>
              ))}
            </div>
          </Row>

          <Row icon={Shuffle} title="Metode distribusi chat" desc="Cara percakapan baru dibagikan ke agen.">
            <div className="space-y-2">
              {([
                ['LEAST_ENGAGED', 'Tugaskan ke agen dengan chat aktif paling sedikit.'],
                ['ROUND_ROBIN', 'Bagikan percakapan bergiliran ke semua agen.'],
              ] as [Distribution, string][]).map(([v, d]) => (
                <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${s.distribution === v ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                  <input type="radio" checked={s.distribution === v} onChange={() => set('distribution', v)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{DISTRIBUTION_LABEL[v]}</span>
                    <span className="block text-xs text-gray-500">{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </Row>

          <Row icon={Gauge} title="Maksimum percakapan per agen" desc="Batas chat aktif yang bisa diterima tiap agen. Kosongkan untuk tanpa batas.">
            <input type="number" min={1} value={s.maxPerAgent} onChange={e => set('maxPerAgent', e.target.value)} placeholder="Tanpa batas" className={FIELD} />
          </Row>

          <Row icon={Star} title="Agen pilihan" desc="Pelanggan yang kembali otomatis dialihkan ke agen yang terakhir menanganinya di kanal ini.">
            <Toggle checked={s.preferredAgent} onChange={v => set('preferredAgent', v)} />
          </Row>

          <Row icon={RefreshCw} title="Tugaskan ulang chat saat agen offline" desc="Chat aktif dialihkan otomatis jika agen yang ditugaskan offline lebih dari 1 menit.">
            <Toggle checked={s.reassignOffline} onChange={v => set('reassignOffline', v)} />
          </Row>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-btn px-6 py-2.5 text-sm disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
