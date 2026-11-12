import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { AuthRequest } from '../../types/express.d';
import { whatsAppUnofficialService } from './whatsapp-unofficial.service';
import { success } from '../../utils/response';
import prisma from '../../config/database';
import logger from '../../utils/logger';

const router = Router();

router.use(authenticate);

function parseSession(sessionData: string | null): Record<string, unknown> | null {
  if (!sessionData) return null;
  try { return JSON.parse(sessionData) as Record<string, unknown>; } catch { return null; }
}

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

    const { qr } = await whatsAppUnofficialService.initQR(channel.id, companyId, userId);

    success(res, { channel, qr }, 'WhatsApp Unofficial channel created', 201);
  } catch (err) { next(err); }
});

router.get('/:channelId/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const channel = await prisma.channel.findFirst({
      where: { id: req.params.channelId, companyId },
      select: { id: true, sessionData: true },
    });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    let status = whatsAppUnofficialService.getStatus(channel.id);

    // Kalau client belum ada di memori (mis. backend baru restart) tapi sesi
    // masih tersimpan di disk, pulihkan otomatis tanpa perlu scan QR.
    if (status === 'disconnected') {
      void whatsAppUnofficialService.ensureConnected(channel.id, companyId, userId);
      status = whatsAppUnofficialService.getStatus(channel.id);
    }

    success(res, { status, session: parseSession(channel.sessionData) });
  } catch (err) { next(err); }
});

router.post('/:channelId/reconnect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, companyId },
      select: { id: true },
    });
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const { qr } = await whatsAppUnofficialService.initQR(channelId, companyId, userId);
    success(res, { qr }, qr ? 'Scan QR untuk menghubungkan ulang' : 'Reconnecting...');
  } catch (err) { next(err); }
});

router.post('/:channelId/logout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const channel = await prisma.channel.findFirst({
      where: { id: req.params.channelId, companyId },
      select: { id: true },
    });
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    await whatsAppUnofficialService.logout(req.params.channelId);
    success(res, null, 'Logged out from WhatsApp');
  } catch (err) {
    logger.error('WhatsApp logout error', err);
    next(err);
  }
});

export default router;
