import { Router } from 'express';
import { KnowledgeController } from './knowledge.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { knowledgeImageUpload } from './knowledge-upload';

// mergeParams: true supaya :id (AI Agent) dari router induk bisa diakses.
const router = Router({ mergeParams: true });
const ctrl = new KnowledgeController();

router.use(authenticate);

router.get('/', ctrl.list.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));

// Media/gambar knowledge. Upload butuh multipart field bernama "files".
router.post(
  '/:knowledgeId/media',
  authorize('OWNER', 'ADMIN'),
  knowledgeImageUpload,
  ctrl.uploadMedia.bind(ctrl)
);
router.put('/:knowledgeId/media/:mediaId', authorize('OWNER', 'ADMIN'), ctrl.updateMedia.bind(ctrl));
router.delete('/:knowledgeId/media/:mediaId', authorize('OWNER', 'ADMIN'), ctrl.deleteMedia.bind(ctrl));

router.put('/:knowledgeId', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:knowledgeId', authorize('OWNER', 'ADMIN'), ctrl.delete.bind(ctrl));

export default router;
