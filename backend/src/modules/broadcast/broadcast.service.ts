import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { createError } from '../../middlewares/error.middleware';
import {
  BroadcastSettings, Eligibility, classifyContact, consentOf, normalizeSettings,
  normalizePhone, isValidPhone, validateContent, withConsent,
} from './broadcast.policy';

export interface AudienceFilter {
  /** Hanya kontak yang pernah chat di kanal pengirim (disarankan untuk WA Unofficial). */
  channelContactsOnly?: boolean;
  labelIds?: string[];
  sourceChannel?: string;
  /** Hanya kontak dengan percakapan aktif dalam N hari terakhir. */
  activeWithinDays?: number;
}

export interface CreateBroadcastDto {
  name: string;
  channelId: string;
  message: string;
  mediaUrl?: string | null;
  audience?: AudienceFilter;
  settings?: Partial<BroadcastSettings>;
  /** ISO; kosong = kirim sekarang. */
  scheduledAt?: string | null;
  /** true = simpan sebagai draft (belum dijadwalkan). */
  draft?: boolean;
}

export type ConsentAction = 'opt_in' | 'opt_out' | 'blacklist' | 'unblacklist' | 'reset';

const BROADCAST_CHANNELS = ['WHATSAPP', 'WHATSAPP_UNOFFICIAL'] as const;
const DAY = 24 * 3_600_000;

class BroadcastService {
  list(companyId: string) {
    return prisma.broadcast.findMany({
      where: { companyId },
      include: { channel: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, id: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id, companyId },
      include: {
        channel: { select: { id: true, name: true, type: true } },
        recipients: { orderBy: [{ sentAt: 'desc' }, { name: 'asc' }], take: 1000 },
      },
    });
    if (!broadcast) throw createError('Campaign tidak ditemukan', 404);
    return broadcast;
  }

  private async assertChannel(companyId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({ where: { id: channelId, companyId } });
    if (!channel) throw createError('Kanal tidak ditemukan', 404);
    if (!(BROADCAST_CHANNELS as readonly string[]).includes(channel.type)) {
      throw createError('Broadcast hanya untuk kanal WhatsApp', 400);
    }
    return channel;
  }

  /**
   * Hitung audiens + kelayakan tiap kontak (Eligible / Review / Suppressed).
   * Dipakai preview di UI dan saat campaign dibuat (snapshot penerima).
   */
  async evaluateAudience(companyId: string, channelId: string, audience: AudienceFilter = {}, settingsRaw?: unknown, message = '') {
    const channel = await this.assertChannel(companyId, channelId);
    const settings = normalizeSettings(settingsRaw);
    const convFilter: Prisma.ConversationWhereInput = {
      ...(audience.channelContactsOnly ? { channelId } : {}),
      ...(audience.labelIds?.length ? { labels: { some: { labelId: { in: audience.labelIds } } } } : {}),
      ...(audience.activeWithinDays ? { lastMessageAt: { gte: new Date(Date.now() - audience.activeWithinDays * DAY) } } : {}),
    };
    const contacts = await prisma.contact.findMany({
      where: {
        companyId,
        phone: { not: null },
        ...(audience.sourceChannel ? { sourceChannel: audience.sourceChannel } : {}),
        ...(Object.keys(convFilter).length ? { conversations: { some: convFilter } } : {}),
      },
      select: { id: true, name: true, phone: true, metadata: true },
      orderBy: { name: 'asc' },
      take: 20000,
    });
    const ids = contacts.map(c => c.id);

    // Duplicate protection: pesan identik yang sudah terkirim dalam 7 hari.
    const dupSet = new Set<string>();
    if (settings.duplicateProtection && message.trim() && ids.length) {
      const dups = await prisma.broadcastRecipient.findMany({
        where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 7 * DAY) }, broadcast: { companyId, message: message.trim() } },
        select: { contactId: true },
      });
      dups.forEach(d => dupSet.add(d.contactId));
    }

    // Kanal resmi: pesan bebas hanya dalam 24 jam sejak pesan masuk terakhir.
    const official = channel.type === 'WHATSAPP';
    const lastInbound = new Map<string, Date>();
    if (official && ids.length) {
      const convs = await prisma.conversation.findMany({ where: { channelId, contactId: { in: ids } }, select: { id: true, contactId: true } });
      const grouped = await prisma.message.groupBy({
        by: ['conversationId'],
        where: { conversationId: { in: convs.map(c => c.id) }, direction: 'INBOUND' },
        _max: { sentAt: true },
      });
      const byConv = new Map(convs.map(c => [c.id, c.contactId]));
      for (const g of grouped) {
        const contactId = byConv.get(g.conversationId)!;
        const at = g._max.sentAt;
        if (at && (!lastInbound.has(contactId) || lastInbound.get(contactId)! < at)) lastInbound.set(contactId, at);
      }
    }

    const evaluated = contacts.map(c => ({
      ...c,
      ...classifyContact(c, {
        settings,
        officialChannel: official,
        lastInboundAt: lastInbound.get(c.id),
        duplicate: dupSet.has(c.id),
      }),
    }));
    const count = (s: Eligibility) => evaluated.filter(e => e.status === s).length;
    const reasons: Record<string, number> = {};
    evaluated.filter(e => e.status !== 'ELIGIBLE').forEach(e => { reasons[e.reason] = (reasons[e.reason] ?? 0) + 1; });

    return {
      channel,
      settings,
      evaluated,
      summary: {
        total: evaluated.length,
        eligible: count('ELIGIBLE'),
        review: count('REVIEW'),
        suppressed: count('SUPPRESSED'),
        willSend: count('ELIGIBLE') + (settings.requireOptIn ? 0 : count('REVIEW')),
        reasons,
      },
    };
  }

  async preview(companyId: string, dto: CreateBroadcastDto) {
    const { summary, settings, channel } = await this.evaluateAudience(companyId, dto.channelId, dto.audience, dto.settings, dto.message);
    const content = validateContent(dto.message ?? '');
    const warnings = [...content.warnings];
    if (channel.type === 'WHATSAPP_UNOFFICIAL') {
      warnings.push('WhatsApp Unofficial (Baileys) berisiko lebih tinggi untuk broadcast. Gunakan hanya untuk kontak yang sudah memberi izin; WhatsApp Cloud API lebih disarankan.');
    }
    if (!settings.requireOptIn && summary.review) warnings.push(`${summary.review} kontak belum tercatat izinnya tetapi akan ikut dikirimi.`);
    if (summary.willSend > settings.dailyLimit) {
      warnings.push(`Penerima (${summary.willSend}) melebihi batas harian ${settings.dailyLimit}; pengiriman otomatis dilanjutkan esok hari.`);
    }
    return { summary, errors: content.errors, warnings };
  }

  async create(companyId: string, userId: string, dto: CreateBroadcastDto) {
    if (!dto.name?.trim()) throw createError('Nama campaign wajib diisi', 400);
    const { errors } = validateContent(dto.message ?? '');
    if (errors.length) throw createError(errors.join(', '), 400);
    const { evaluated, settings } = await this.evaluateAudience(companyId, dto.channelId, dto.audience, dto.settings, dto.message);
    const targets = evaluated.filter(e => e.status === 'ELIGIBLE' || (!settings.requireOptIn && e.status === 'REVIEW'));
    if (!targets.length) throw createError('Tidak ada kontak yang layak menerima campaign ini', 400);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) throw createError('Jadwal tidak valid', 400);

    return prisma.$transaction(async tx => {
      const broadcast = await tx.broadcast.create({
        data: {
          companyId,
          channelId: dto.channelId,
          createdById: userId,
          name: dto.name.trim(),
          message: dto.message.trim(),
          mediaUrl: dto.mediaUrl?.trim() || null,
          status: dto.draft ? 'DRAFT' : 'SCHEDULED',
          audience: (dto.audience ?? {}) as Prisma.InputJsonValue,
          settings: settings as unknown as Prisma.InputJsonValue,
          scheduledAt,
          totalRecipients: targets.length,
        },
      });
      await tx.broadcastRecipient.createMany({
        data: targets.map(t => ({ broadcastId: broadcast.id, contactId: t.id, phone: t.phone!, name: t.name })),
        skipDuplicates: true,
      });
      return broadcast;
    });
  }

  private async setStatus(companyId: string, id: string, from: string[], data: Prisma.BroadcastUpdateInput) {
    const b = await prisma.broadcast.findFirst({ where: { id, companyId } });
    if (!b) throw createError('Campaign tidak ditemukan', 404);
    if (!from.includes(b.status)) throw createError(`Campaign berstatus ${b.status} tidak bisa diubah`, 400);
    return prisma.broadcast.update({ where: { id }, data });
  }

  pause(companyId: string, id: string) {
    return this.setStatus(companyId, id, ['SCHEDULED', 'RUNNING'], { status: 'PAUSED', pauseReason: 'Dijeda manual' });
  }

  resume(companyId: string, id: string) {
    return this.setStatus(companyId, id, ['PAUSED', 'DRAFT'], { status: 'SCHEDULED', pauseReason: null });
  }

  async cancel(companyId: string, id: string) {
    const b = await this.setStatus(companyId, id, ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'], { status: 'CANCELLED', completedAt: new Date() });
    const { count } = await prisma.broadcastRecipient.updateMany({
      where: { broadcastId: id, status: 'PENDING' },
      data: { status: 'SKIPPED', error: 'Campaign dibatalkan' },
    });
    return prisma.broadcast.update({ where: { id: b.id }, data: { skippedCount: { increment: count } } });
  }

  async remove(companyId: string, id: string) {
    const b = await prisma.broadcast.findFirst({ where: { id, companyId } });
    if (!b) throw createError('Campaign tidak ditemukan', 404);
    if (b.status === 'RUNNING') throw createError('Jeda atau batalkan campaign sebelum menghapus', 400);
    await prisma.broadcast.delete({ where: { id } });
  }

  // --- Contact Health & Permission ---

  async contacts(companyId: string, q: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 25));
    const settings = normalizeSettings({});
    const rows = await prisma.contact.findMany({
      where: {
        companyId,
        ...(q.search ? { OR: [{ name: { contains: q.search } }, { phone: { contains: q.search } }] } : {}),
      },
      select: { id: true, name: true, phone: true, sourceChannel: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20000,
    });
    const all = rows.map(r => {
      const { metadata, ...rest } = r;
      return { ...rest, consent: consentOf(metadata), ...classifyContact(r, { settings }) };
    });
    const counts = {
      all: all.length,
      eligible: all.filter(a => a.status === 'ELIGIBLE').length,
      review: all.filter(a => a.status === 'REVIEW').length,
      suppressed: all.filter(a => a.status === 'SUPPRESSED').length,
    };
    const filtered = q.status && q.status !== 'all' ? all.filter(a => a.status === q.status!.toUpperCase()) : all;
    return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, counts };
  }

  async updateConsent(companyId: string, contactIds: string[], action: ConsentAction, source?: string, category?: string) {
    if (!contactIds?.length) throw createError('Pilih minimal satu kontak', 400);
    const now = new Date().toISOString();
    const patch: Record<ConsentAction, Parameters<typeof withConsent>[1]> = {
      opt_in: { status: 'OPTED_IN', source: source || 'Manual', category: category || 'Marketing', consentAt: now, unsubscribedAt: undefined },
      opt_out: { status: 'OPTED_OUT', unsubscribedAt: now },
      blacklist: { blacklisted: true },
      unblacklist: { blacklisted: false },
      reset: { status: 'UNKNOWN', source: undefined, consentAt: undefined },
    };
    const contacts = await prisma.contact.findMany({ where: { companyId, id: { in: contactIds } }, select: { id: true, metadata: true } });
    await prisma.$transaction(
      contacts.map(c => prisma.contact.update({ where: { id: c.id }, data: { metadata: withConsent(c.metadata, patch[action]) as Prisma.InputJsonValue } }))
    );
    return { updated: contacts.length };
  }

  /** Impor kontak opt-in: satu baris "nomor,nama" (nama opsional). */
  async importOptIn(companyId: string, text: string, source?: string, category?: string) {
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) throw createError('Isi daftar kontak', 400);
    if (lines.length > 5000) throw createError('Maksimal 5000 baris per impor', 400);
    const consent = { status: 'OPTED_IN' as const, source: source?.trim() || 'Impor', category: category || 'Marketing', consentAt: new Date().toISOString() };
    let imported = 0;
    const invalid: string[] = [];
    for (const line of lines) {
      const [rawPhone, ...nameParts] = line.split(/[,;\t]/);
      const phone = normalizePhone(rawPhone ?? '');
      if (!isValidPhone(phone)) { invalid.push(line); continue; }
      const name = nameParts.join(' ').trim() || phone;
      const existing = await prisma.contact.findUnique({ where: { companyId_phone: { companyId, phone } } });
      if (existing) {
        // Jangan menimpa opt-out / blacklist yang sudah tercatat.
        const c = consentOf(existing.metadata);
        if (c.status === 'OPTED_OUT' || c.blacklisted) { invalid.push(`${line} (sudah berhenti/blacklist)`); continue; }
        await prisma.contact.update({ where: { id: existing.id }, data: { metadata: withConsent(existing.metadata, consent) as Prisma.InputJsonValue } });
      } else {
        await prisma.contact.create({ data: { companyId, phone, name, sourceChannel: 'IMPORT', metadata: withConsent({}, consent) as Prisma.InputJsonValue } });
      }
      imported++;
    }
    return { imported, invalid };
  }
}

export const broadcastService = new BroadcastService();
