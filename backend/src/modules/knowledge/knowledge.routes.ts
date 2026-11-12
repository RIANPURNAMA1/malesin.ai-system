import { Router } from 'express';
import { KnowledgeController } from './knowledge.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

// mergeParams: true supaya :id (AI Agent) dari router induk bisa diakses.
const router = Router({ mergeParams: true });
const ctrl = new KnowledgeController();

router.use(authenticate);

router.get('/', ctrl.list.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));
router.put('/:knowledgeId', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:knowledgeId', authorize('OWNER', 'ADMIN'), ctrl.delete.bind(ctrl));

export default router;
