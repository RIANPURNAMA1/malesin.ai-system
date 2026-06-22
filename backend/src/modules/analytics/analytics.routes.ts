import { Router, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

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
