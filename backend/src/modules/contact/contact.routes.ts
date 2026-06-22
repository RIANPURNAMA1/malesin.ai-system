import { Router, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { success, paginate } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';
import { Prisma } from '@prisma/client';

class ContactService {
  async findAll(companyId: string, query: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ContactWhereInput = {
      companyId,
      ...(search && { OR: [{ name: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } }] }),
    };
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.contact.count({ where }),
    ]);
    return { contacts, total, page, limit };
  }

  async findById(companyId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, companyId },
      include: { conversations: { include: { channel: { select: { id: true, name: true, type: true } } }, orderBy: { lastMessageAt: 'desc' }, take: 10 } },
    });
    if (!contact) throw createError('Contact not found', 404);
    return contact;
  }

  async upsertByPhone(companyId: string, phone: string, data: { name?: string; sourceChannel?: string }) {
    return prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone } },
      create: { companyId, phone, name: data.name || phone, sourceChannel: data.sourceChannel },
      update: { totalMessages: { increment: 1 } },
    });
  }

  async update(companyId: string, id: string, data: Partial<{ name: string; email: string; phone: string }>) {
    await this.findById(companyId, id);
    return prisma.contact.update({ where: { id }, data });
  }
}

const contactService = new ContactService();
const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contacts, total, page, limit } = await contactService.findAll(req.user!.companyId, {
      search: req.query.search as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    paginate(res, contacts, total, page, limit);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await contactService.findById(req.user!.companyId, req.params.id);
    success(res, data);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await contactService.update(req.user!.companyId, req.params.id, req.body);
    success(res, data, 'Contact updated');
  } catch (err) { next(err); }
});

export { contactService };
export default router;
