import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { encrypt, decrypt } from '../../utils/encryption';
import { createError } from '../../middlewares/error.middleware';

export interface CreateChannelDto {
  name: string;
  type: 'WHATSAPP' | 'WHATSAPP_UNOFFICIAL' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
  metadata?: Prisma.InputJsonValue;
}

export class ChannelService {
  async create(companyId: string, dto: CreateChannelDto) {
    const encryptedToken = dto.accessToken ? encrypt(dto.accessToken) : undefined;
    return prisma.channel.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type,
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        accessToken: encryptedToken,
        verifyToken: dto.verifyToken,
        metadata: dto.metadata ?? undefined,
      },
    });
  }

  async findAll(companyId: string) {
    const channels = await prisma.channel.findMany({
      where: { companyId },
      select: {
        id: true, name: true, type: true, isActive: true,
        wabaId: true, phoneNumberId: true, verifyToken: true,
        metadata: true, sessionData: true, createdAt: true, updatedAt: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return channels;
  }

  async findById(companyId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, companyId },
    });
    if (!channel) throw createError('Channel not found', 404);
    return channel;
  }

  async getDecryptedToken(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel?.accessToken) throw createError('Channel token not configured', 400);
    return decrypt(channel.accessToken);
  }

  async update(companyId: string, channelId: string, dto: Partial<CreateChannelDto>) {
    const current = await this.findById(companyId, channelId);
    const encryptedToken = dto.accessToken ? encrypt(dto.accessToken) : undefined;
    const { metadata, ...rest } = dto;
    // Metadata di-merge supaya update pengaturan kanal tidak menghapus data lain (mis. info TikTok).
    const mergedMeta = metadata !== undefined
      ? { ...((current.metadata as Record<string, unknown> | null) ?? {}), ...(metadata as Record<string, unknown>) }
      : undefined;
    return prisma.channel.update({
      where: { id: channelId },
      data: {
        ...rest,
        accessToken: encryptedToken,
        ...(mergedMeta !== undefined ? { metadata: mergedMeta as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async delete(companyId: string, channelId: string) {
    const channel = await this.findById(companyId, channelId);
    if (channel.type === 'WHATSAPP_UNOFFICIAL') {
      const { whatsAppUnofficialService } = await import('./whatsapp-unofficial.service');
      await whatsAppUnofficialService.removeSession(channelId);
    }
    // Kontak dipakai bersama antar kanal (unik per nomor). Yang dihapus hanya kontak
    // yang SELURUH percakapannya ada di kanal ini; kontak yang juga chat lewat kanal
    // lain tetap disimpan agar riwayat di kanal lain tidak rusak.
    const contactIds = (await prisma.conversation.findMany({
      where: { channelId },
      select: { contactId: true },
      distinct: ['contactId'],
    })).map(c => c.contactId);
    const sharedIds = new Set((await prisma.conversation.findMany({
      where: { contactId: { in: contactIds }, channelId: { not: channelId } },
      select: { contactId: true },
      distinct: ['contactId'],
    })).map(c => c.contactId));
    const exclusiveContactIds = contactIds.filter(id => !sharedIds.has(id));

    // Hapus data terkait dulu biar ga kena FK constraint (atomik: semua atau tidak sama sekali).
    await prisma.$transaction([
      prisma.conversationLabel.deleteMany({ where: { conversation: { channelId } } }),
      prisma.assignment.deleteMany({ where: { conversation: { channelId } } }),
      prisma.message.deleteMany({ where: { conversation: { channelId } } }),
      prisma.conversation.deleteMany({ where: { channelId } }),
      prisma.post.deleteMany({ where: { channelId } }),
      // Deal & penerima broadcast milik kontak ikut terhapus (onDelete: Cascade).
      prisma.contact.deleteMany({ where: { companyId, id: { in: exclusiveContactIds } } }),
      prisma.channel.delete({ where: { id: channelId } }),
    ]);
  }
}
