import prisma from '../../config/database';
import { encrypt, decrypt } from '../../utils/encryption';
import { createError } from '../../middlewares/error.middleware';

export interface CreateChannelDto {
  name: string;
  type: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK';
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
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
      },
    });
  }

  async findAll(companyId: string) {
    const channels = await prisma.channel.findMany({
      where: { companyId },
      select: {
        id: true, name: true, type: true, isActive: true,
        wabaId: true, phoneNumberId: true, verifyToken: true,
        createdAt: true, updatedAt: true,
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
    await this.findById(companyId, channelId);
    const encryptedToken = dto.accessToken ? encrypt(dto.accessToken) : undefined;
    return prisma.channel.update({
      where: { id: channelId },
      data: {
        ...dto,
        accessToken: encryptedToken,
      },
    });
  }

  async delete(companyId: string, channelId: string) {
    await this.findById(companyId, channelId);
    await prisma.channel.delete({ where: { id: channelId } });
  }
}
