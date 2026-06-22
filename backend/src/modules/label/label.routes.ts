import { Router, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const labels = await prisma.label.findMany({ where: { companyId: req.user!.companyId } });
    success(res, labels);
  } catch (err) { next(err); }
});

router.post('/', authorize('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const label = await prisma.label.create({
      data: { companyId: req.user!.companyId, name: req.body.name, color: req.body.color },
    });
    success(res, label, 'Label created', 201);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.label.delete({ where: { id: req.params.id } });
    success(res, null, 'Label deleted');
  } catch (err) { next(err); }
});

export default router;
