import { Response, NextFunction } from 'express';
import { ConversationService } from './conversation.service';
import { success, paginate } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

const conversationService = new ConversationService();

export class ConversationController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversations, total, page, limit } = await conversationService.findAll(
        req.user!.companyId,
        { ...req.query, page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 20 }
      );
      paginate(res, conversations, total, page, limit);
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await conversationService.findById(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await conversationService.updateStatus(req.user!.companyId, req.params.id, req.body.status);
      success(res, data, 'Status updated');
    } catch (err) { next(err); }
  }

  async assignAgent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await conversationService.assignAgent(req.user!.companyId, req.params.id, req.body.userId);
      success(res, data, 'Agent assigned');
    } catch (err) { next(err); }
  }

  async addLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await conversationService.addLabel(req.params.id, req.body.labelId);
      success(res, data, 'Label added');
    } catch (err) { next(err); }
  }

  async removeLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await conversationService.removeLabel(req.params.id, req.params.labelId);
      success(res, null, 'Label removed');
    } catch (err) { next(err); }
  }

  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await conversationService.markRead(req.user!.companyId, req.params.id);
      success(res, null, 'Marked as read');
    } catch (err) { next(err); }
  }
}
