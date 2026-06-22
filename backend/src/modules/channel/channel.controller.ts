import { Response, NextFunction } from 'express';
import { ChannelService } from './channel.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

const channelService = new ChannelService();

export class ChannelController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await channelService.create(req.user!.companyId, req.body);
      success(res, data, 'Channel created', 201);
    } catch (err) { next(err); }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await channelService.findAll(req.user!.companyId);
      success(res, data);
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await channelService.findById(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await channelService.update(req.user!.companyId, req.params.id, req.body);
      success(res, data, 'Channel updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await channelService.delete(req.user!.companyId, req.params.id);
      success(res, null, 'Channel deleted');
    } catch (err) { next(err); }
  }
}
