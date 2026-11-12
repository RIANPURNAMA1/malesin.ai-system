import { Response, NextFunction } from 'express';
import { AiAgentService } from './ai-agent.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

const aiAgentService = new AiAgentService();

export class AiAgentController {
  async listProviders(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      success(res, aiAgentService.listProviders());
    } catch (err) { next(err); }
  }

  async listModels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      success(res, await aiAgentService.listModels(req.user!.companyId, req.body));
    } catch (err) { next(err); }
  }

  async testConnection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      success(res, await aiAgentService.testConnection(req.user!.companyId, req.body), 'Connection OK');
    } catch (err) { next(err); }
  }

  async testResponse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await aiAgentService.testResponse(req.user!.companyId, req.body);
      success(res, data, 'AI responded');
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await aiAgentService.create(req.user!.companyId, req.body);
      success(res, data, 'AI Agent created', 201);
    } catch (err) { next(err); }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      success(res, await aiAgentService.findAll(req.user!.companyId));
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      success(res, await aiAgentService.getById(req.user!.companyId, req.params.id));
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await aiAgentService.update(req.user!.companyId, req.params.id, req.body);
      success(res, data, 'AI Agent updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await aiAgentService.delete(req.user!.companyId, req.params.id);
      success(res, null, 'AI Agent deleted');
    } catch (err) { next(err); }
  }
}
