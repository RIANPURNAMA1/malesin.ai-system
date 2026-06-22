import { Router, Request, Response } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import channelRoutes from '../modules/channel/channel.routes';
import conversationRoutes from '../modules/conversation/conversation.routes';
import messageRoutes from '../modules/message/message.routes';
import contactRoutes from '../modules/contact/contact.routes';
import labelRoutes from '../modules/label/label.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';
import userRoutes from '../modules/company/user.routes';
import { handleWebhookGet, handleWebhookPost } from '../modules/webhook/webhook.handler';

const router = Router();

router.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/channels', channelRoutes);
router.use('/conversations', conversationRoutes);
router.use('/conversations/:conversationId/messages', messageRoutes);
router.use('/contacts', contactRoutes);
router.use('/labels', labelRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', userRoutes);

// WhatsApp Webhook
router.get('/webhook', handleWebhookGet);
router.post('/webhook', handleWebhookPost);

export default router;
