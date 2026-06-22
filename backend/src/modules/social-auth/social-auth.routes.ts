import { Router } from 'express';
import { SocialAuthController } from './social-auth.controller';

const router = Router();
const ctrl = new SocialAuthController();

router.get('/facebook', ctrl.facebookLogin.bind(ctrl));
router.get('/facebook/callback', ctrl.facebookCallback.bind(ctrl));

export default router;
