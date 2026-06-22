import { Router } from 'express';
import { PostController } from './post.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const ctrl = new PostController();

router.use(authenticate);
router.get('/', ctrl.findAll.bind(ctrl));
router.get('/:id', ctrl.findById.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));
router.put('/:id', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('OWNER', 'ADMIN'), ctrl.delete.bind(ctrl));
router.post('/:id/publish', authorize('OWNER', 'ADMIN'), ctrl.publishNow.bind(ctrl));

export default router;
