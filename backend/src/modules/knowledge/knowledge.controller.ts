import { Response, NextFunction } from 'express';
import { knowledgeService } from './knowledge.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

export class KnowledgeController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.list(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.create(req.user!.companyId, req.params.id, req.body);
      success(res, data, 'Knowledge added', 201);
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.update(req.user!.companyId, req.params.id, req.params.knowledgeId, req.body);
      success(res, data, 'Knowledge updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await knowledgeService.delete(req.user!.companyId, req.params.id, req.params.knowledgeId);
      success(res, null, 'Knowledge deleted');
    } catch (err) { next(err); }
  }
}
