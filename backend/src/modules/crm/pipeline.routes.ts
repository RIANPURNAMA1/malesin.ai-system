import { Router, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { pipelineService, Viewer, AUTO_RULES } from './pipeline.service';
import { classifyDeal } from './pipeline.automation';

const router = Router();
router.use(authenticate);
const admin = authorize('OWNER', 'ADMIN');
const viewer = (req: AuthRequest): Viewer => ({ companyId: req.user!.companyId, userId: req.user!.userId, role: req.user!.role });
const h = (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => { fn(req as AuthRequest, res).catch(next); };
const ok = (fn: (req: AuthRequest) => Promise<unknown>, msg?: string) => h(async (req, res) => success(res, await fn(req), msg));

// --- Pipeline & tahap ---
router.get('/pipelines', ok(req => pipelineService.list(req.user!.companyId)));
router.get('/auto-rules', ok(async () => AUTO_RULES));
router.post('/pipelines', admin, ok(req => pipelineService.create(req.user!.companyId, req.body.name), 'Pipeline dibuat'));
router.put('/pipelines/:id', admin, ok(req => pipelineService.update(req.user!.companyId, req.params.id, req.body), 'Pipeline disimpan'));
router.put('/pipelines/:id/stages', admin, ok(req => pipelineService.saveStages(req.user!.companyId, req.params.id, req.body.stages), 'Tahap disimpan'));
router.delete('/pipelines/:id', admin, ok(async req => { await pipelineService.remove(req.user!.companyId, req.params.id); return null; }, 'Pipeline dihapus'));
router.get('/pipelines/:id/board', ok(req => pipelineService.board(viewer(req), req.params.id, req.query as { search?: string; ownerId?: string })));

// --- Deal ---
router.get('/contacts/:contactId/deal', ok(req => pipelineService.dealForContact(viewer(req), req.params.contactId)));
router.post('/deals', ok(req => pipelineService.createDeal(viewer(req), req.body), 'Deal dibuat'));
router.get('/deals/:id', ok(req => pipelineService.getDeal(viewer(req), req.params.id)));
router.patch('/deals/:id', ok(req => pipelineService.updateDeal(viewer(req), req.params.id, req.body), 'Deal disimpan'));
router.post('/deals/:id/move', ok(req => pipelineService.moveDeal(viewer(req), req.params.id, req.body.stageId, req.body.lostReason)));
router.post('/deals/:id/suggestion', ok(req => pipelineService.respondSuggestion(viewer(req), req.params.id, !!req.body.accept)));
router.post('/deals/:id/notes', ok(req => pipelineService.addNote(viewer(req), req.params.id, req.body.text), 'Catatan ditambahkan'));
router.post('/deals/:id/analyze', ok(async req => {
  await pipelineService.getDeal(viewer(req), req.params.id); // cek akses
  await classifyDeal(req.params.id);
  return pipelineService.getDeal(viewer(req), req.params.id);
}));
router.delete('/deals/:id', admin, ok(async req => { await pipelineService.deleteDeal(viewer(req), req.params.id); return null; }, 'Deal dihapus'));

export default router;
