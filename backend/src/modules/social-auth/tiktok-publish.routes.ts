import { Router } from 'express';
import { TikTokPublishController, uploadMiddleware } from './tiktok-publish.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();
const ctrl = new TikTokPublishController();

router.use(authenticate);
router.get('/tiktok/channel', ctrl.getChannelInfo.bind(ctrl));
router.post('/tiktok/upload', uploadMiddleware, ctrl.uploadAndPost.bind(ctrl));
router.post('/tiktok/publish/:postId', ctrl.publishPost.bind(ctrl));

export default router;
