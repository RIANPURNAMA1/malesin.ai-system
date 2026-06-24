import axios from 'axios';
import fs from 'fs';
import { decrypt } from '../../utils/encryption';
import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';
import logger from '../../utils/logger';

interface InitUploadResponse {
  data: {
    upload_url: string;
    publish_id: string;
  };
  error?: { code: string; message: string };
}

interface PublishResponse {
  data: {
    status: string;
    upload_url: string;
    publish_id: string;
    id?: string;
    post_id?: string;
  };
  error?: { code: string; message: string };
}

export class TikTokPublishService {
  async getChannel(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw createError('TikTok channel not found', 404);
    if (!channel.accessToken) throw createError('TikTok token not configured', 400);
    const token = decrypt(channel.accessToken);
    return { channel, token };
  }

  async getActiveChannel(companyId: string) {
    const channel = await prisma.channel.findFirst({
      where: { companyId, type: 'TIKTOK', isActive: true },
    });
    if (!channel) throw createError('No active TikTok channel. Connect TikTok first.', 400);
    if (!channel.accessToken) throw createError('TikTok token not configured', 400);
    const token = decrypt(channel.accessToken);
    return { channel, token };
  }

  async initUpload(accessToken: string, fileSize: number) {
    const res = await axios.post<InitUploadResponse>(
      'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      {
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: fileSize,
          chunk_size: fileSize,
          total_chunk_count: 1,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    if (res.data.error && res.data.error.code !== 'ok') {
      throw createError(`TikTok init upload error: ${res.data.error.message || res.data.error.code}`, 400);
    }

    return res.data.data;
  }

  async uploadFile(uploadUrl: string, filePath: string, contentType: string) {
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    const res = await axios.put(uploadUrl, fileStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return res.status === 200;
  }

  async publishVideo(accessToken: string, publishId: string, postMode: 'push_to_user' | 'direct_post' = 'push_to_user') {
    const res = await axios.post<PublishResponse>(
      'https://open.tiktokapis.com/v2/video/publish/',
      {
        publish_id: publishId,
        post_mode: postMode,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (res.data.error && res.data.error.code !== 'ok') {
      throw createError(`TikTok publish error: ${res.data.error.message || res.data.error.code}`, 400);
    }

    return res.data.data;
  }

  async postTikTokDraft(
    companyId: string,
    channelId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    caption: string
  ) {
    const { token } = await this.getChannel(channelId);

    const initData = await this.initUpload(token, fileBuffer.length);

    await axios.put(initData.upload_url, fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    logger.info(`[TikTokPublish] Draft posted, publish_id=${initData.publish_id}`);

    return {
      publish_id: initData.publish_id,
      status: 'SENT',
    };
  }

  async publishPost(companyId: string, postId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, companyId } });
    if (!post) throw createError('Post not found', 404);

    const { token } = await this.getActiveChannel(companyId);

    const mediaUrls: string[] = Array.isArray(post.mediaUrls) ? post.mediaUrls as string[] : [];
    if (mediaUrls.length === 0) throw createError('No media to upload', 400);

    const mediaUrl = mediaUrls[0];

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (mediaUrl.startsWith('http')) {
      const resp = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      fileBuffer = Buffer.from(resp.data);
      const contentType = resp.headers['content-type'] || 'video/mp4';
      mimeType = contentType;
      const urlPath = new URL(mediaUrl).pathname;
      fileName = urlPath.split('/').pop() || `video_${Date.now()}.mp4`;
    } else if (mediaUrl.startsWith('/') || mediaUrl.startsWith('.')) {
      fileBuffer = fs.readFileSync(mediaUrl);
      mimeType = 'video/mp4';
      fileName = `video_${Date.now()}.mp4`;
    } else if (mediaUrl.startsWith('data:')) {
      const matches = mediaUrl.match(/^data:(.+);base64,(.+)$/);
      if (!matches) throw createError('Invalid data URL', 400);
      mimeType = matches[1];
      fileBuffer = Buffer.from(matches[2], 'base64');
      fileName = `video_${Date.now()}.mp4`;
    } else {
      throw createError('Unsupported media URL format', 400);
    }

    const initData = await this.initUpload(token, fileBuffer.length);

    await axios.put(initData.upload_url, fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    return { publish_id: initData.publish_id };
  }
}
