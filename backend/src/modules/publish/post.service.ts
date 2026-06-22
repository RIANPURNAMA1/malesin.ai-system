import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';
import { InstagramPublishService } from './instagram-publish.service';

const igPublish = new InstagramPublishService();

export class PostService {
  async findAll(companyId: string, query: { platform?: string; status?: string; page?: number; limit?: number }) {
    const { platform, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { companyId };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);
    return { posts, total, page, limit };
  }

  async findById(companyId: string, id: string) {
    const post = await prisma.post.findFirst({ where: { id, companyId } });
    if (!post) throw createError('Post not found', 404);
    return post;
  }

  async create(companyId: string, data: {
    platform?: string; mediaUrls?: string[]; caption?: string;
    scheduledAt?: string; status?: string; channelId?: string;
  }) {
    return prisma.post.create({
      data: {
        companyId,
        platform: (data.platform as any) || 'INSTAGRAM',
        caption: data.caption,
        mediaUrls: data.mediaUrls || [],
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? 'SCHEDULED' : (data.status as any) || 'DRAFT',
        channelId: data.channelId || null,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    platform?: string; mediaUrls?: string[]; caption?: string;
    scheduledAt?: string; status?: string; channelId?: string;
  }) {
    await this.findById(companyId, id);
    return prisma.post.update({
      where: { id },
      data: {
        ...(data.platform && { platform: data.platform as any }),
        ...(data.caption !== undefined && { caption: data.caption }),
        ...(data.mediaUrls && { mediaUrls: data.mediaUrls }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...(data.status && { status: data.status as any }),
        ...(data.channelId !== undefined && { channelId: data.channelId }),
      },
    });
  }

  async delete(companyId: string, id: string) {
    await this.findById(companyId, id);
    await prisma.post.delete({ where: { id } });
  }

  async publishNow(companyId: string, id: string) {
    return igPublish.publishPost(companyId, id);
  }
}
