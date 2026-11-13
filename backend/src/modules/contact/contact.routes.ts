import { Router, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { success, paginate } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { authenticate } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';
import { Prisma } from '@prisma/client';

class ContactService {
  async findAll(companyId: string, query: { search?: string; page?: number; limit?: number; sourceChannel?: string }) {
    const { search, page = 1, limit = 20, sourceChannel } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ContactWhereInput = {
      companyId,
      ...(sourceChannel && { sourceChannel }),
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
    // Jangan pernah buat kontak dengan phone kosong/LID: unique key
    // companyId_phone akan menyimpan nilai sampah.
    if (!phone || phone.includes('@lid')) {
      throw createError('Valid phone number is required', 400);
    }
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

  // --- Nomor tanpa AI: contact.metadata.aiDisabled = true ---

  listAiExcluded(companyId: string) {
    return prisma.contact.findMany({
      where: { companyId, metadata: { path: '$.aiDisabled', equals: true } },
      select: { id: true, name: true, phone: true, metadata: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async setAiDisabled(companyId: string, id: string, disabled: boolean) {
    const contact = await prisma.contact.findFirst({ where: { id, companyId }, select: { metadata: true } });
    if (!contact) throw createError('Contact not found', 404);
    const meta = { ...((contact.metadata as Record<string, unknown> | null) ?? {}), aiDisabled: disabled };
    return prisma.contact.update({
      where: { id },
      data: { metadata: meta as Prisma.InputJsonValue },
      select: { id: true, name: true, phone: true, metadata: true, updatedAt: true },
    });
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
      sourceChannel: req.query.sourceChannel as string | undefined,
    });
    paginate(res, contacts, total, page, limit);
  } catch (err) { next(err); }
});

router.get('/ai-excluded', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    success(res, await contactService.listAiExcluded(req.user!.companyId));
  } catch (err) { next(err); }
});

router.patch('/:id/ai', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const disabled = !!req.body.disabled;
    const data = await contactService.setAiDisabled(req.user!.companyId, req.params.id, disabled);
    success(res, data, disabled ? 'AI tidak akan membalas nomor ini' : 'AI kembali membalas nomor ini');
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
