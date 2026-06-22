import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    success(res, users);
  } catch (err) { next(err); }
});

router.post('/', authorize('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password || 'changeme123', 12);
    const user = await prisma.user.create({
      data: {
        companyId: req.user!.companyId,
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        role: req.body.role || 'AGENT',
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    success(res, user, 'User created', 201);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password, ...rest } = req.body;
    const data: any = { ...rest };
    if (password) data.password = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    success(res, user, 'User updated');
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('OWNER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    success(res, null, 'User deleted');
  } catch (err) { next(err); }
});

export default router;
