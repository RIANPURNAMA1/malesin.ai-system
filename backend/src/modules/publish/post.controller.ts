import { Response, NextFunction } from 'express';
import { PostService } from './post.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

const postService = new PostService();

export class PostController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await postService.findAll(req.user!.companyId, {
        platform: req.query.platform as string,
        status: req.query.status as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      success(res, data);
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await postService.findById(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await postService.create(req.user!.companyId, req.body);
      success(res, data, 'Post created', 201);
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await postService.update(req.user!.companyId, req.params.id, req.body);
      success(res, data, 'Post updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await postService.delete(req.user!.companyId, req.params.id);
      success(res, null, 'Post deleted');
    } catch (err) { next(err); }
  }

  async publishNow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await postService.publishNow(req.user!.companyId, req.params.id);
      success(res, result, 'Post published');
    } catch (err) { next(err); }
  }
}
