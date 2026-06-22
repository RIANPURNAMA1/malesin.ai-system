import axios from 'axios';
import { decrypt } from '../../utils/encryption';
import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';

const WA_BASE = process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';
const WA_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';

export class InstagramPublishService {
  async getChannelToken(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw createError('Channel not found', 404);
    if (!channel.accessToken) throw createError('Channel token not configured', 400);
    const token = decrypt(channel.accessToken);
    return { channel, token };
  }

  async createMediaContainer(igAccountId: string, token: string, mediaUrl: string, caption: string, mediaType: 'IMAGE' | 'VIDEO' | 'REELS' = 'IMAGE') {
    const body: Record<string, string> = {
      media_type: mediaType === 'REELS' ? 'REELS' : mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      caption,
      ...(mediaUrl.startsWith('http') ? { url: mediaUrl } : {}),
    };

    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${igAccountId}/media`,
      body,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async publishContainer(igAccountId: string, token: string, containerId: string) {
    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${igAccountId}/media_publish`,
      { creation_id: containerId },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async getMediaStatus(igAccountId: string, token: string, containerId: string) {
    const res = await axios.get(
      `${WA_BASE}/${WA_VERSION}/${containerId}`,
      { params: { fields: 'status_code,id' }, headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }

  async publishPost(companyId: string, postId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, companyId } });
    if (!post) throw createError('Post not found', 404);

    const channel = await prisma.channel.findFirst({
      where: { companyId, type: 'INSTAGRAM', isActive: true },
    });
    if (!channel) throw createError('No active Instagram channel', 400);
    if (!channel.accessToken) throw createError('Instagram token not configured', 400);

    const token = decrypt(channel.accessToken);
    const igAccountId = channel.wabaId;
    if (!igAccountId) throw createError('Instagram Account ID not configured', 400);

    const mediaUrls: string[] = Array.isArray(post.mediaUrls) ? post.mediaUrls as string[] : [];

    let containerId = post.igContainerId;

    if (!containerId && mediaUrls.length > 0) {
      const container = await this.createMediaContainer(igAccountId, token, mediaUrls[0], post.caption || '', 'IMAGE');
      containerId = container.id;

      await prisma.post.update({ where: { id: post.id }, data: { igContainerId: containerId, status: 'PUBLISHING' } });

      let attempts = 0;
      while (attempts < 10) {
        await new Promise(r => setTimeout(r, 3000));
        const status = await this.getMediaStatus(igAccountId, token, containerId);
        if (status.status_code === 'FINISHED') break;
        if (status.status_code === 'ERROR') throw createError('Media processing failed', 500);
        attempts++;
      }
    }

    if (!containerId) throw createError('No media to publish', 400);

    const result = await this.publishContainer(igAccountId, token, containerId);

    const mediaId = result.id;
    let permalink = '';

    try {
      const mediaRes = await axios.get(`${WA_BASE}/${WA_VERSION}/${mediaId}`, {
        params: { fields: 'permalink' },
        headers: { Authorization: `Bearer ${token}` },
      });
      permalink = mediaRes.data?.permalink || '';
    } catch { /* permalink not always available */ }

    await prisma.post.update({
      where: { id: post.id },
      data: { igMediaId: mediaId, permalink, status: 'PUBLISHED', publishedAt: new Date() },
    });

    return { id: mediaId, permalink };
  }
}
