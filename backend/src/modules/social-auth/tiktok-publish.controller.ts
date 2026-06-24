import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TikTokPublishService } from './tiktok-publish.service';
import { AuthRequest } from '../../types/express.d';
import { success } from '../../utils/response';
import { createError } from '../../middlewares/error.middleware';
import prisma from '../../config/database';

const tiktokPublish = new TikTokPublishService();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tiktok');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `tiktok_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video (MP4, MOV, AVI) and image (JPEG, PNG) files are allowed'));
    }
  },
});

export const uploadMiddleware = upload.single('video');

export class TikTokPublishController {
  async uploadAndPost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const file = req.file;
      if (!file) throw createError('No video file uploaded', 400);

      const caption = req.body.caption || '';
      const channelId = req.body.channelId;

      let targetChannelId = channelId;
      if (!targetChannelId) {
        const channel = await prisma.channel.findFirst({
          where: { companyId, type: 'TIKTOK', isActive: true },
        });
        if (!channel) throw createError('No active TikTok channel', 400);
        targetChannelId = channel.id;
      }

      const fileBuffer = fs.readFileSync(file.path);
      const result = await tiktokPublish.postTikTokDraft(
        companyId,
        targetChannelId,
        fileBuffer,
        file.originalname,
        file.mimetype,
        caption
      );

      fs.unlinkSync(file.path);

      const post = await prisma.post.create({
        data: {
          companyId,
          channelId: targetChannelId,
          platform: 'TIKTOK',
          caption,
          mediaUrls: [file.originalname],
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      success(res, { post, publish_id: result.publish_id, status: result.status }, 'Video uploaded to TikTok as draft');
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  }

  async getChannelInfo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const channel = await prisma.channel.findFirst({
        where: { companyId, type: 'TIKTOK', isActive: true },
        select: {
          id: true,
          name: true,
          wabaId: true,
          metadata: true,
          createdAt: true,
        },
      });

      if (!channel) {
        return res.json({ success: true, data: null, message: 'No TikTok channel connected' });
      }

      success(res, channel);
    } catch (err) {
      next(err);
    }
  }

  async uploadDraft(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const file = req.file;
      if (!file) throw createError('No video file uploaded', 400);

      const caption = req.body.caption || '';

      const channel = await prisma.channel.findFirst({
        where: { companyId, type: 'TIKTOK', isActive: true },
      });

      const post = await prisma.post.create({
        data: {
          companyId,
          channelId: channel?.id || null,
          platform: 'TIKTOK',
          caption,
          mediaUrls: [file.path],
          status: 'DRAFT',
        },
      });

      success(res, post, 'Draft saved');
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  }

  async publishPost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const { postId } = req.params;

      const post = await prisma.post.findFirst({ where: { id: postId, companyId } });
      if (!post) throw createError('Post not found', 404);
      if (post.platform !== 'TIKTOK') throw createError('Not a TikTok post', 400);

      const result = await tiktokPublish.publishPost(companyId, postId);
      success(res, result, 'TikTok post published');
    } catch (err) {
      next(err);
    }
  }
}
