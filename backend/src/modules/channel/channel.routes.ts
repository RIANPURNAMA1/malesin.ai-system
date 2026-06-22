import { Router } from 'express';
import { ChannelController } from './channel.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const ctrl = new ChannelController();

router.use(authenticate);
router.get('/', ctrl.findAll.bind(ctrl));
router.get('/:id', ctrl.findById.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));
router.put('/:id', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('OWNER'), ctrl.delete.bind(ctrl));

export default router;
