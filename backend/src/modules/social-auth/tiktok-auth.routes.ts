import { Router } from 'express';
import { TikTokAuthController } from './tiktok-auth.controller';

const router = Router();
const ctrl = new TikTokAuthController();

router.get('/tiktok/login', ctrl.login.bind(ctrl));
router.get('/tiktok/oauth-url', ctrl.getOAuthUrl.bind(ctrl));
router.post('/tiktok/callback', ctrl.callback.bind(ctrl));

export default router;
