import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { AuthRequest } from '../../types/express.d';
import { whatsAppUnofficialService } from './whatsapp-unofficial.service';
import { success } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.post('/init', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { channelName } = req.body;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    if (!channelName) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }

    const { ChannelService } = await import('./channel.service');
    const channelService = new ChannelService();

    const channel = await channelService.create(companyId, {
      name: channelName,
      type: 'WHATSAPP_UNOFFICIAL',
    });

    whatsAppUnofficialService.initialize(channel.id, companyId, userId).catch(err => {
      console.error('WhatsApp Unofficial init error:', err);
    });

    success(res, channel, 'WhatsApp Unofficial channel created', 201);
  } catch (err) { next(err); }
});

router.get('/:channelId/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = whatsAppUnofficialService.getStatus(req.params.channelId);
    success(res, { status });
  } catch (err) { next(err); }
});

router.post('/:channelId/reconnect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    await whatsAppUnofficialService.logout(channelId);
    whatsAppUnofficialService.initialize(channelId, companyId, userId).catch(err => {
      console.error('WhatsApp Unofficial reconnect error:', err);
    });

    success(res, null, 'Reconnecting...');
  } catch (err) { next(err); }
});

router.post('/:channelId/logout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await whatsAppUnofficialService.logout(req.params.channelId);
    success(res, null, 'Logged out from WhatsApp');
  } catch (err) { next(err); }
});

export default router;
