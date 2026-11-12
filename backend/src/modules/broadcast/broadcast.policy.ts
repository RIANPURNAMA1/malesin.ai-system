/**
 * Broadcast Protection & Compliance Engine — aturan kelayakan penerima,
 * pengaturan proteksi, dan validasi konten. Murni (tanpa DB) supaya dipakai
 * bersama oleh preview audiens, pembuatan campaign, dan engine pengiriman.
 *
 * Catatan: aturan ini menurunkan risiko, bukan menjamin nomor aman dari
 * pembatasan WhatsApp. Izin penerima (opt-in) tetap syarat utama.
 */

export type ConsentStatus = 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN';
export type Eligibility = 'ELIGIBLE' | 'REVIEW' | 'SUPPRESSED';

/** Disimpan di contact.metadata.broadcast */
export interface ContactConsent {
  status?: ConsentStatus;
  category?: string;
  source?: string;
  consentAt?: string;
  blacklisted?: boolean;
  unsubscribedAt?: string;
  lastBroadcastAt?: string;
}

export interface BroadcastSettings {
  /** Hanya kirim dalam jam wajar (zona waktu `timezone`). */
  quietHours: boolean;
  sendStartHour: number;
  sendEndHour: number;
  timezone: string;
  /** Jeda antar pesan per kanal — mengatur beban, BUKAN penghilang risiko spam. */
  minDelaySec: number;
  maxDelaySec: number;
  /** Maksimal pesan broadcast per kanal dalam 24 jam bergulir. */
  dailyLimit: number;
  /** Kontak tidak menerima broadcast lagi sebelum lewat N jam. */
  frequencyCap: boolean;
  frequencyCapHours: number;
  /** Lewati kontak yang sudah menerima pesan identik dalam 7 hari. */
  duplicateProtection: boolean;
  /** Wajib opt-in. Jika false, kontak "Review" ikut dikirimi. */
  requireOptIn: boolean;
  /** Tambahkan instruksi berhenti berlangganan di akhir pesan. */
  appendOptOut: boolean;
  /** Hentikan campaign otomatis saat ada indikasi risiko. */
  autoPause: boolean;
  maxConsecutiveFailures: number;
  maxFailureRate: number;
  maxOptOutRate: number;
}

export const DEFAULT_SETTINGS: BroadcastSettings = {
  quietHours: true,
  sendStartHour: 8,
  sendEndHour: 20,
  timezone: 'Asia/Jakarta',
  minDelaySec: 20,
  maxDelaySec: 60,
  dailyLimit: 150,
  frequencyCap: true,
  frequencyCapHours: 72,
  duplicateProtection: true,
  requireOptIn: true,
  appendOptOut: true,
  autoPause: true,
  maxConsecutiveFailures: 3,
  maxFailureRate: 0.2,
  maxOptOutRate: 0.05,
};

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function normalizeSettings(raw: unknown): BroadcastSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BroadcastSettings>;
  const d = DEFAULT_SETTINGS;
  const bool = (k: keyof BroadcastSettings) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : (d[k] as boolean));
  const minDelaySec = clamp(r.minDelaySec, 5, 600, d.minDelaySec);
  return {
    quietHours: bool('quietHours'),
    sendStartHour: clamp(r.sendStartHour, 0, 23, d.sendStartHour),
    sendEndHour: clamp(r.sendEndHour, 1, 24, d.sendEndHour),
    timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : d.timezone,
    minDelaySec,
    maxDelaySec: Math.max(minDelaySec, clamp(r.maxDelaySec, 5, 900, d.maxDelaySec)),
    dailyLimit: clamp(r.dailyLimit, 1, 10000, d.dailyLimit),
    frequencyCap: bool('frequencyCap'),
    frequencyCapHours: clamp(r.frequencyCapHours, 1, 24 * 30, d.frequencyCapHours),
    duplicateProtection: bool('duplicateProtection'),
    requireOptIn: bool('requireOptIn'),
    appendOptOut: bool('appendOptOut'),
    autoPause: bool('autoPause'),
    maxConsecutiveFailures: clamp(r.maxConsecutiveFailures, 1, 50, d.maxConsecutiveFailures),
    maxFailureRate: clamp(r.maxFailureRate, 0.01, 1, d.maxFailureRate),
    maxOptOutRate: clamp(r.maxOptOutRate, 0.01, 1, d.maxOptOutRate),
  };
}

export const OPT_OUT_FOOTER = 'Balas STOP untuk berhenti menerima pesan ini.';
export const OPT_OUT_RE = /^\s*(stop|berhenti|unsubscribe|unsub)\s*[.!]?\s*$/i;
export const OPT_IN_RE = /^\s*(start|mulai|subscribe|langganan)\s*[.!]?\s*$/i;

export function consentOf(metadata: unknown): ContactConsent {
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as { broadcast?: ContactConsent };
  return m.broadcast ?? {};
}

export function withConsent(metadata: unknown, patch: Partial<ContactConsent>) {
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;
  // JSON round-trip membuang field undefined (mis. reset consentAt).
  return JSON.parse(JSON.stringify({ ...m, broadcast: { ...consentOf(metadata), ...patch } }));
}

export function isValidPhone(phone: string | null | undefined): phone is string {
  return !!phone && /^\d{8,15}$/.test(phone);
}

/** 08xx / +62xx / 62-xx → 62xx */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, '');
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  return p;
}

export interface ClassifyContext {
  settings: BroadcastSettings;
  now?: Date;
  /** Kanal resmi (Cloud API): pesan bebas hanya boleh dalam 24 jam sejak pesan masuk terakhir. */
  lastInboundAt?: Date | null;
  officialChannel?: boolean;
  /** Kontak sudah menerima pesan identik (duplicate protection). */
  duplicate?: boolean;
}

export function classifyContact(
  contact: { phone: string | null; metadata: unknown },
  ctx: ClassifyContext
): { status: Eligibility; reason: string } {
  const c = consentOf(contact.metadata);
  const now = ctx.now ?? new Date();
  if (!isValidPhone(contact.phone)) return { status: 'SUPPRESSED', reason: 'Nomor tidak valid' };
  if (c.blacklisted) return { status: 'SUPPRESSED', reason: 'Blacklist' };
  if (c.status === 'OPTED_OUT') return { status: 'SUPPRESSED', reason: 'Berhenti berlangganan' };
  if (ctx.settings.frequencyCap && c.lastBroadcastAt) {
    const hours = (now.getTime() - new Date(c.lastBroadcastAt).getTime()) / 3_600_000;
    if (hours < ctx.settings.frequencyCapHours) return { status: 'SUPPRESSED', reason: 'Batas frekuensi' };
  }
  if (ctx.settings.duplicateProtection && ctx.duplicate) return { status: 'SUPPRESSED', reason: 'Pesan duplikat' };
  if (ctx.officialChannel) {
    const fresh = ctx.lastInboundAt && now.getTime() - ctx.lastInboundAt.getTime() < 24 * 3_600_000;
    if (!fresh) return { status: 'SUPPRESSED', reason: 'Di luar jendela 24 jam (butuh template resmi)' };
  }
  if (c.status === 'OPTED_IN') return { status: 'ELIGIBLE', reason: 'Opt-in' };
  return { status: 'REVIEW', reason: 'Izin belum tercatat' };
}

/** Validasi konten: error = memblokir, warning = saran. */
export function validateContent(message: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = message.trim();
  if (!text) errors.push('Pesan wajib diisi');
  if (text.length > 4000) errors.push('Pesan maksimal 4000 karakter');
  const links = text.match(/https?:\/\/\S+/gi) ?? [];
  if (links.length > 2) warnings.push('Terlalu banyak link (lebih dari 2) — sering dianggap spam');
  if (/bit\.ly|tinyurl|s\.id\//i.test(text)) warnings.push('Hindari link pemendek (bit.ly, s.id, dll.)');
  const letters = text.replace(/[^a-z]/gi, '');
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.5) {
    warnings.push('Terlalu banyak HURUF KAPITAL');
  }
  if (!/\{\{\s*(nama|name|nama_depan|first_name)\s*\}\}/i.test(text)) {
    warnings.push('Tambahkan personalisasi seperti {{nama}} agar pesan tidak generik');
  }
  if (/(gratis|promo|diskon|menang|hadiah).{0,20}(!{2,})/i.test(text)) warnings.push('Hindari gaya promosi berlebihan (!!!)');
  return { errors, warnings };
}

export function personalize(template: string, contact: { name: string; phone: string }) {
  const name = contact.name && contact.name !== contact.phone ? contact.name.trim() : 'Kak';
  const first = name.split(/\s+/)[0] || name;
  return template
    .replace(/\{\{\s*(nama|name)\s*\}\}/gi, name)
    .replace(/\{\{\s*(nama_depan|first_name)\s*\}\}/gi, first)
    .replace(/\{\{\s*(telepon|phone)\s*\}\}/gi, contact.phone);
}

export function buildMessage(template: string, contact: { name: string; phone: string }, settings: BroadcastSettings) {
  const body = personalize(template, contact).trim();
  return settings.appendOptOut && !OPT_OUT_RE.test(body) && !/balas stop/i.test(body)
    ? `${body}\n\n${OPT_OUT_FOOTER}`
    : body;
}

export function localHour(date: Date, timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(date));
  } catch {
    return date.getHours();
  }
}

export function insideSendWindow(settings: BroadcastSettings, now = new Date()) {
  if (!settings.quietHours) return true;
  const h = localHour(now, settings.timezone);
  const { sendStartHour: s, sendEndHour: e } = settings;
  return s <= e ? h >= s && h < e : h >= s || h < e;
}
