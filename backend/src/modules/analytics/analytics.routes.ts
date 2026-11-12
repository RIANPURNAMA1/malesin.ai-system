import { Router, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import {
  AnalyticsQuery, leadsAnalytics, sessionAnalytics, sessionList, aiAnalytics, humanAnalytics, broadcastAnalytics, getSla, setSla,
} from './analytics.service';

const router = Router();
router.use(authenticate);

// --- Analytics v2 (halaman /analytics) ---
type Handler = (req: AuthRequest) => Promise<unknown>;
const v2 = (fn: Handler) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { success(res, await fn(req)); } catch (err) { next(err); }
};
const q = (req: AuthRequest) => req.query as AnalyticsQuery & { page?: string };

router.get('/leads', v2(req => leadsAnalytics(req.user!.companyId, req.query as AnalyticsQuery & { pipelineId?: string })));
router.get('/session', v2(req => sessionAnalytics(req.user!.companyId, q(req))));
router.get('/session/list', v2(req => sessionList(req.user!.companyId, q(req))));
router.get('/ai', v2(req => aiAnalytics(req.user!.companyId, q(req))));
router.get('/human', v2(req => humanAnalytics(req.user!.companyId, q(req))));
router.get('/broadcast', v2(req => broadcastAnalytics(req.user!.companyId, q(req))));
router.get('/sla', v2(req => getSla(req.user!.companyId)));
router.put('/sla', authorize('OWNER', 'ADMIN'), v2(req => setSla(req.user!.companyId, req.body)));

router.get('/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, open, closed, pending, todayTotal] = await Promise.all([
      prisma.conversation.count({ where: { companyId } }),
      prisma.conversation.count({ where: { companyId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { companyId, status: 'CLOSED' } }),
      prisma.conversation.count({ where: { companyId, status: 'PENDING' } }),
      prisma.conversation.count({ where: { companyId, createdAt: { gte: today } } }),
    ]);

    success(res, { total, open, closed, pending, today: todayTotal });
  } catch (err) { next(err); }
});

router.get('/agents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const agents = await prisma.user.findMany({
      where: { companyId, role: { in: ['AGENT', 'ADMIN'] } },
      select: {
        id: true, name: true, avatar: true,
        assignments: {
          where: { unassignedAt: null },
          include: { conversation: { select: { status: true } } },
        },
      },
    });

    const data = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      assignedConversations: agent.assignments.length,
      closedConversations: agent.assignments.filter((a) => a.conversation.status === 'CLOSED').length,
    }));

    success(res, data);
  } catch (err) { next(err); }
});

router.get('/channels', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const channels = await prisma.channel.findMany({
      where: { companyId },
      select: {
        id: true, name: true, type: true,
        _count: { select: { conversations: true } },
      },
    });
    success(res, channels);
  } catch (err) { next(err); }
});

export default router;
