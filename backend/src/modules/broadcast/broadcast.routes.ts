import { Router, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { broadcastService } from './broadcast.service';
import { waitingReason } from './broadcast.engine';
import { DEFAULT_SETTINGS } from './broadcast.policy';

const router = Router();
router.use(authenticate);
const admin = authorize('OWNER', 'ADMIN');

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
const h = (fn: Handler): RequestHandler => (req, res, next: NextFunction) => {
  fn(req as AuthRequest, res).catch(next);
};

router.get('/defaults', h(async (_req, res) => success(res, DEFAULT_SETTINGS)));

// --- Contact Health & Permission ---
router.get('/contacts', h(async (req, res) => {
  const r = await broadcastService.contacts(req.user!.companyId, {
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
  });
  res.json({ success: true, data: r.data, counts: r.counts, meta: { total: r.total, page: r.page, limit: r.limit, totalPages: Math.ceil(r.total / r.limit) } });
}));
router.patch('/contacts/consent', admin, h(async (req, res) => {
  const { contactIds, action, source, category } = req.body;
  success(res, await broadcastService.updateConsent(req.user!.companyId, contactIds, action, source, category), 'Izin kontak diperbarui');
}));
router.post('/contacts/import', admin, h(async (req, res) => {
  const { text, source, category } = req.body;
  success(res, await broadcastService.importOptIn(req.user!.companyId, text, source, category), 'Kontak diimpor');
}));

// --- Campaign ---
router.get('/', h(async (req, res) => {
  const list = await broadcastService.list(req.user!.companyId);
  success(res, list.map(b => ({ ...b, waitingReason: waitingReason.get(b.id) ?? null })));
}));
router.post('/preview', admin, h(async (req, res) => success(res, await broadcastService.preview(req.user!.companyId, req.body))));
router.post('/', admin, h(async (req, res) => {
  success(res, await broadcastService.create(req.user!.companyId, req.user!.userId, req.body), 'Campaign dibuat', 201);
}));
router.get('/:id', h(async (req, res) => {
  const b = await broadcastService.get(req.user!.companyId, req.params.id);
  success(res, { ...b, waitingReason: waitingReason.get(b.id) ?? null });
}));
router.post('/:id/pause', admin, h(async (req, res) => success(res, await broadcastService.pause(req.user!.companyId, req.params.id), 'Campaign dijeda')));
router.post('/:id/resume', admin, h(async (req, res) => success(res, await broadcastService.resume(req.user!.companyId, req.params.id), 'Campaign dilanjutkan')));
router.post('/:id/cancel', admin, h(async (req, res) => success(res, await broadcastService.cancel(req.user!.companyId, req.params.id), 'Campaign dibatalkan')));
router.delete('/:id', admin, h(async (req, res) => {
  await broadcastService.remove(req.user!.companyId, req.params.id);
  success(res, null, 'Campaign dihapus');
}));

export default router;
