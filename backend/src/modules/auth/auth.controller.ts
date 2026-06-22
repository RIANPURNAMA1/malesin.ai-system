import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.register(req.body);
      success(res, data, 'Registration successful', 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.login(req.body, req.headers['x-company-slug'] as string);
      success(res, data, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.refresh(req.body.refreshToken);
      success(res, data, 'Token refreshed');
    } catch (err) {
      next(err);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.user!.userId);
      success(res, null, 'Logged out');
    } catch (err) {
      next(err);
    }
  }

  async profile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.user!.userId);
      success(res, user);
    } catch (err) {
      next(err);
    }
  }
}
