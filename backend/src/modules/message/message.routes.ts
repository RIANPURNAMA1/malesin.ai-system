import { Router, Response, NextFunction } from 'express';
import { MessageService } from './message.service';
import { success, paginate } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate } from '../../middlewares/auth.middleware';

const messageService = new MessageService();
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { messages, total, page, limit } = await messageService.getMessages(
      req.params.conversationId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 50
    );
    paginate(res, messages, total, page, limit);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const msg = await messageService.sendMessage(
      req.user!.companyId,
      req.params.conversationId,
      req.user!.userId,
      req.body
    );
    success(res, msg, 'Message sent', 201);
  } catch (err) { next(err); }
});

export default router;
