import { Router } from 'express';
import { AiMediaController } from './ai-media.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router({ mergeParams: true });
const ctrl = new AiMediaController();

router.use(authenticate);

router.get('/', ctrl.list.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));
router.put('/:mediaId', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:mediaId', authorize('OWNER', 'ADMIN'), ctrl.delete.bind(ctrl));

export default router;
