import { Router } from 'express';
import { AiAgentController } from './ai-agent.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import knowledgeRoutes from '../knowledge/knowledge.routes';
import mediaRoutes from '../ai-media/ai-media.routes';

const router = Router();
const ctrl = new AiAgentController();

router.use(authenticate);

// Route spesifik harus di atas '/:id' biar tidak ketangkap sebagai id.
router.get('/providers', ctrl.listProviders.bind(ctrl));
router.post('/models', ctrl.listModels.bind(ctrl));
router.post('/test-connection', ctrl.testConnection.bind(ctrl));
router.post('/test-response', ctrl.testResponse.bind(ctrl));

// Knowledge base (RAG) per agent.
router.use('/:id/knowledge', knowledgeRoutes);

// Media (gambar) per agent — balasan AI.
router.use('/:id/media', mediaRoutes);

router.get('/', ctrl.findAll.bind(ctrl));
router.get('/:id', ctrl.findById.bind(ctrl));
router.post('/', authorize('OWNER', 'ADMIN'), ctrl.create.bind(ctrl));
router.put('/:id', authorize('OWNER', 'ADMIN'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('OWNER', 'ADMIN'), ctrl.delete.bind(ctrl));

export default router;
