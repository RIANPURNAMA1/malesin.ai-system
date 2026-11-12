import { Router } from 'express';
import { ConversationController } from './conversation.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import manageRoutes from './conversation-manage';

const router = Router();
const ctrl = new ConversationController();

router.use(authenticate);
router.get('/', ctrl.findAll.bind(ctrl));
// Halaman Conversations (supervisor) — harus sebelum '/:id'.
router.use('/manage', manageRoutes);
router.get('/:id', ctrl.findById.bind(ctrl));
router.patch('/:id/status', ctrl.updateStatus.bind(ctrl));
router.post('/:id/assign', ctrl.assignAgent.bind(ctrl));
router.post('/:id/ai', ctrl.setAiPaused.bind(ctrl));
router.post('/:id/labels', ctrl.addLabel.bind(ctrl));
router.delete('/:id/labels/:labelId', ctrl.removeLabel.bind(ctrl));
router.post('/:id/read', ctrl.markRead.bind(ctrl));
router.post('/:id/unread', ctrl.markUnread.bind(ctrl));

export default router;
