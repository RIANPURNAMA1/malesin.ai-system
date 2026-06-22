import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { error } from '../utils/response';
import { AuthRequest } from '../types/express.d';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return error(res, 'Unauthorized', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return error(res, 'Token invalid or expired', 401);
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, 'Forbidden', 403);
    }
    next();
  };
}
