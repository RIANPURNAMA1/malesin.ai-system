import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ShieldCheck, Users, MessageSquareText, CalendarClock, ImagePlus, Loader2, AlertTriangle, ChevronLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { channelService, labelService, knowledgeFileService } from '../../services/index';
import { broadcastApi, BroadcastSettings, CampaignPayload, AudienceFilter, PreviewResult, errMsg } from './api';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20';
const VARS = ['{{nama}}', '{{nama_depan}}'];
const OPT_OUT_FOOTER = 'Balas STOP untuk berhenti menerima pesan ini.';

function Toggle({ checked, onChange, label, hint, children }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-gray-800">{label}</span>
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </label>
      {checked && children && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">{children}</div>}
    </div>
  );
}

const Num = ({ value, onChange, min, max, w = 'w-20' }: { value: number; onChange: (v: number) => void; min: number; max: number; w?: string }) => (
  <input type="number" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className={`${INPUT} ${w} py-1`} />
);

function Section({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function CampaignForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: channels = [] } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const { data: labels = [] } = useQuery({ queryKey: ['labels'], queryFn: labelService.list });
  const { data: defaults } = useQuery({ queryKey: ['broadcast-defaults'], queryFn: broadcastApi.defaults, staleTime: Infinity });
  const waChannels = channels.filter(c => c.type === 'WHATSAPP' || c.type === 'WHATSAPP_UNOFFICIAL');

  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('Halo {{nama_depan}}! 👋\n\n');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudienceFilter>({ channelContactsOnly: true });
  const [settings, setSettings] = useState<BroadcastSettings | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (defaults && !settings) setSettings(defaults); }, [defaults, settings]);
  useEffect(() => { if (!channelId && waChannels[0]) setChannelId(waChannels[0].id); }, [waChannels, channelId]);

  const set = <K extends keyof BroadcastSettings>(k: K, v: BroadcastSettings[K]) => setSettings(s => (s ? { ...s, [k]: v } : s));
  const channel = waChannels.find(c => c.id === channelId);

  const payload = useMemo<CampaignPayload | null>(() => settings && channelId ? {
    name, channelId, message, mediaUrl, audience, settings,
    scheduledAt: scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
  } : null, [name, channelId, message, mediaUrl, audience, settings, scheduleMode, scheduledAt]);

  // Preview audiens + validasi konten (debounce 500ms).
  useEffect(() => {
    if (!payload) return;
    setPreviewing(true);
    const t = setTimeout(() => {
      broadcastApi.preview(payload).then(setPreview).catch(() => setPreview(null)).finally(() => setPreviewing(false));
    }, 500);
    return () => clearTimeout(t);
  }, [payload]);

  const create = useMutation({
    mutationFn: (draft: boolean) => broadcastApi.create({ ...payload!, draft }),
    onSuccess: (_b, draft) => {
      qc.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success(draft ? 'Draft disimpan' : scheduleMode === 'later' ? 'Campaign dijadwalkan' : 'Campaign dimulai');
      onClose();
    },
    onError: e => toast.error(errMsg(e)),
  });

  const insertVar = (v: string) => {
    const el = textRef.current;
    const pos = el?.selectionStart ?? message.length;
    setMessage(m => m.slice(0, pos) + v + m.slice(el?.selectionEnd ?? pos));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + v.length, pos + v.length); });
  };

  const uploadImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Maksimal 5MB');
    setUploading(true);
    try {
      const [up] = await knowledgeFileService.upload([file]);
      setMediaUrl(up.url);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const sample = message.replace(/\{\{\s*(nama|name)\s*\}\}/gi, 'Budi Santoso').replace(/\{\{\s*(nama_depan|first_name)\s*\}\}/gi, 'Budi');
  const finalSample = settings?.appendOptOut && !/balas stop/i.test(sample) ? `${sample.trim()}\n\n${OPT_OUT_FOOTER}` : sample.trim();
  const s = preview?.summary;
  const canReview = !!payload && name.trim() && message.trim() && !preview?.errors.length && (s?.willSend ?? 0) > 0
    && (scheduleMode === 'now' || !!scheduledAt);

  if (!settings) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          {step === 'review' && (
            <button onClick={() => setStep('form')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Kembali"><ChevronLeft className="h-4 w-4" /></button>
          )}
          <h2 className="text-base font-semibold text-gray-900">{step === 'form' ? 'Buat Broadcast Campaign' : 'Review Campaign'}</h2>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"><ShieldCheck className="h-3 w-3" />Smart Mode</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
      </div>

      {step === 'form' ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <Section icon={MessageSquareText} title="Campaign">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-600">Nama campaign
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Promo Program November 2026" className={`${INPUT} mt-1`} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Kanal WhatsApp
                    <select value={channelId} onChange={e => setChannelId(e.target.value)} className={`${INPUT} mt-1`}>
                      {!waChannels.length && <option value="">Belum ada kanal WhatsApp</option>}
                      {waChannels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.type === 'WHATSAPP' ? 'Cloud API (resmi)' : 'Unofficial'}</option>)}
                    </select>
                  </label>
                </div>
                {channel?.type === 'WHATSAPP_UNOFFICIAL' && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    WhatsApp Unofficial berisiko lebih tinggi untuk broadcast. Kirim hanya ke kontak yang sudah memberi izin. Tidak ada sistem yang menjamin nomor bebas dari pembatasan.
                  </p>
                )}
              </Section>

              <Section icon={Users} title="Audiens">
                <Toggle
                  checked={!!audience.channelContactsOnly}
                  onChange={v => setAudience(a => ({ ...a, channelContactsOnly: v }))}
                  label="Hanya kontak yang pernah chat di kanal ini"
                  hint="Lebih relevan dan lebih aman daripada mengirim ke semua kontak"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-600">Aktif dalam
                    <select
                      value={audience.activeWithinDays ?? ''}
                      onChange={e => setAudience(a => ({ ...a, activeWithinDays: e.target.value ? Number(e.target.value) : undefined }))}
                      className={`${INPUT} mt-1`}
                    >
                      <option value="">Semua waktu</option>
                      {[7, 30, 90, 180].map(d => <option key={d} value={d}>{d} hari terakhir</option>)}
                    </select>
                  </label>
                  <div className="text-xs font-medium text-gray-600">Segmen (label percakapan)
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {!labels.length && <span className="py-2 font-normal text-gray-400">Belum ada label</span>}
                      {labels.map(l => {
                        const on = audience.labelIds?.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setAudience(a => ({ ...a, labelIds: on ? a.labelIds?.filter(x => x !== l.id) : [...(a.labelIds ?? []), l.id] }))}
                            className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-transparent text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                            style={on ? { background: l.color } : undefined}
                          >{l.name}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Section>

              <Section icon={MessageSquareText} title="Pesan">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  Personalisasi:
                  {VARS.map(v => <button key={v} type="button" onClick={() => insertVar(v)} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-700 hover:bg-gray-200">{v}</button>)}
                </div>
                <textarea ref={textRef} value={message} onChange={e => setMessage(e.target.value)} rows={7} className={`${INPUT} resize-y`} placeholder="Tulis pesan yang relevan untuk penerima…" />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{message.length.toLocaleString('id-ID')} / 4.000 karakter</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => uploadImage(e.target.files)} />
                  {!mediaUrl && (
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Lampirkan gambar
                    </button>
                  )}
                </div>
                {mediaUrl && (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                    <img src={mediaUrl} alt="" className="h-14 w-14 rounded object-cover" />
                    <span className="flex-1 truncate text-xs text-gray-500">Gambar dikirim dengan pesan sebagai caption</span>
                    <button onClick={() => setMediaUrl(null)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Hapus gambar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </Section>

              <Section icon={CalendarClock} title="Jadwal pengiriman">
                <div className="flex gap-2">
                  {(['now', 'later'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setScheduleMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${scheduleMode === m ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {m === 'now' ? 'Kirim sekarang' : 'Jadwalkan'}
                    </button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={INPUT} />
                )}
              </Section>

              <Section icon={ShieldCheck} title="Protection Settings">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle checked={settings.requireOptIn} onChange={v => set('requireOptIn', v)} label="Opt-in validation" hint="Hanya kirim ke kontak yang tercatat memberi izin" />
                  <Toggle checked={settings.duplicateProtection} onChange={v => set('duplicateProtection', v)} label="Duplicate protection" hint="Lewati kontak yang menerima pesan identik 7 hari terakhir" />
                  <Toggle checked={settings.frequencyCap} onChange={v => set('frequencyCap', v)} label="Frequency cap" hint="Batasi frekuensi broadcast per kontak">
                    Maks. 1 broadcast per <Num value={settings.frequencyCapHours} onChange={v => set('frequencyCapHours', v)} min={1} max={720} /> jam
                  </Toggle>
                  <Toggle checked={settings.quietHours} onChange={v => set('quietHours', v)} label="Quiet hours" hint="Kirim hanya pada jam komunikasi wajar (WIB)">
                    Jam <Num value={settings.sendStartHour} onChange={v => set('sendStartHour', v)} min={0} max={23} w="w-16" /> s/d
                    <Num value={settings.sendEndHour} onChange={v => set('sendEndHour', v)} min={1} max={24} w="w-16" />
                  </Toggle>
                  <Toggle checked={settings.autoPause} onChange={v => set('autoPause', v)} label="Auto pause on risk" hint={`Jeda bila ${settings.maxConsecutiveFailures}× gagal beruntun, gagal >${Math.round(settings.maxFailureRate * 100)}%, atau opt-out >${Math.round(settings.maxOptOutRate * 100)}%`} />
                  <Toggle checked={settings.appendOptOut} onChange={v => set('appendOptOut', v)} label="Instruksi berhenti berlangganan" hint="Tambahkan “Balas STOP…” di akhir pesan" />
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  Jeda antar pesan <Num value={settings.minDelaySec} onChange={v => set('minDelaySec', v)} min={5} max={600} w="w-16" /> –
                  <Num value={settings.maxDelaySec} onChange={v => set('maxDelaySec', v)} min={5} max={900} w="w-16" /> detik · batas
                  <Num value={settings.dailyLimit} onChange={v => set('dailyLimit', v)} min={1} max={10000} /> pesan/kanal/24 jam
                  <p className="w-full text-xs text-gray-400">Jeda hanya mengatur beban pengiriman, bukan jaminan nomor bebas dari pembatasan.</p>
                </div>
              </Section>
            </div>

            {/* Ringkasan + pratinjau */}
            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <AudienceSummary preview={preview} loading={previewing} requireOptIn={settings.requireOptIn} />
              <div className="rounded-xl border border-gray-200 bg-[#efeae2] p-4">
                <p className="mb-2 text-xs font-medium text-gray-500">Pratinjau pesan</p>
                <div className="ml-auto max-w-[90%] rounded-lg rounded-tr-none bg-[#d9fdd3] p-2 text-sm text-gray-800 shadow-sm">
                  {mediaUrl && <img src={mediaUrl} alt="" className="mb-1.5 w-full rounded" />}
                  <p className="whitespace-pre-wrap break-words">{finalSample || '…'}</p>
                </div>
              </div>
              {!!preview?.warnings.length && (
                <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {preview.warnings.map(w => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{w}</li>)}
                </ul>
              )}
              {!!preview?.errors.length && (
                <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{preview.errors.map(e => <li key={e}>{e}</li>)}</ul>
              )}
            </aside>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <dl className="grid grid-cols-[140px_1fr] gap-y-2">
                <dt className="text-gray-500">Campaign</dt><dd className="font-medium text-gray-900">{name}</dd>
                <dt className="text-gray-500">Kanal</dt><dd>{channel?.name}</dd>
                <dt className="text-gray-500">Jadwal</dt><dd>{scheduleMode === 'now' ? 'Kirim sekarang' : new Date(scheduledAt).toLocaleString('id-ID')}</dd>
                <dt className="text-gray-500">Penerima</dt><dd><b>{s?.willSend ?? 0}</b> kontak (dari {s?.total ?? 0}; {s?.suppressed ?? 0} suppressed)</dd>
                <dt className="text-gray-500">Perkiraan durasi</dt>
                <dd>±{Math.ceil(((s?.willSend ?? 0) * (settings.minDelaySec + settings.maxDelaySec)) / 2 / 60)} menit{(s?.willSend ?? 0) > settings.dailyLimit ? ` · ${Math.ceil((s?.willSend ?? 0) / settings.dailyLimit)} hari (batas harian)` : ''}</dd>
              </dl>
            </div>
            {!!preview?.warnings.length && (
              <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {preview.warnings.map(w => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{w}</li>)}
              </ul>
            )}
            <label className="flex cursor-pointer gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
              Saya menyatakan penerima campaign ini telah memberikan izin menerima pesan, dan isi pesan sesuai Kebijakan Pesan Bisnis WhatsApp.
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
        {step === 'form' ? (
          <>
            <button onClick={() => create.mutate(true)} disabled={!canReview || create.isPending} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Simpan draft</button>
            <button onClick={() => { setConfirmed(false); setStep('review'); }} disabled={!canReview} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Review Campaign</button>
          </>
        ) : (
          <button onClick={() => create.mutate(false)} disabled={!confirmed || create.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {scheduleMode === 'now' ? 'Mulai Campaign' : 'Jadwalkan Campaign'}
          </button>
        )}
      </div>
    </div>
  );
}

function AudienceSummary({ preview, loading, requireOptIn }: { preview: PreviewResult | null; loading: boolean; requireOptIn: boolean }) {
  const s = preview?.summary;
  const card = (label: string, value: number | undefined, cls: string) => (
    <div className="rounded-lg bg-gray-50 p-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${cls}`}>{value?.toLocaleString('id-ID') ?? '–'}</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
        Audiens {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {card('Total kontak', s?.total, 'text-gray-900')}
        {card('Akan dikirim', s?.willSend, 'text-primary')}
        {card('Eligible', s?.eligible, 'text-emerald-600')}
        {card('Review / Suppressed', s ? s.review + s.suppressed : undefined, 'text-amber-600')}
      </div>
      {s && Object.keys(s.reasons).length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-500">
          {Object.entries(s.reasons).map(([r, n]) => <li key={r} className="flex justify-between"><span>{r}</span><span>{n}</span></li>)}
        </ul>
      )}
      {s && s.review > 0 && requireOptIn && (
        <p className="mt-3 text-xs text-gray-500">Kontak “Review” belum tercatat izinnya. Catat opt-in di tab <b>Kontak &amp; Izin</b> agar bisa dikirimi.</p>
      )}
    </div>
  );
}
