import { Response, NextFunction } from 'express';
import { aiMediaService, normalizeKeywords, AiMediaDto } from './ai-media.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { createError } from '../../middlewares/error.middleware';

export class AiMediaController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await aiMediaService.list(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as AiMediaDto;
      const data = await aiMediaService.create(req.user!.companyId, req.params.id, body);
      success(res, data, 'Media added', 201);
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as Partial<AiMediaDto>;
      const data = await aiMediaService.update(req.user!.companyId, req.params.id, req.params.mediaId, body);
      success(res, data, 'Media updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await aiMediaService.delete(req.user!.companyId, req.params.id, req.params.mediaId);
      success(res, null, 'Media deleted');
    } catch (err) { next(err); }
  }
}
