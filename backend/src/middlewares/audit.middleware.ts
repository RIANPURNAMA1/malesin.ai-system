import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types/express.d';

export function auditLog(action: string, entity: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      if (res.statusCode < 400 && req.user) {
        try {
          await prisma.auditLog.create({
            data: {
              companyId: req.user.companyId,
              userId: req.user.userId,
              action,
              entity,
              entityId: req.params.id,
              newData: req.body as Record<string, unknown>,
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
            },
          });
        } catch {
          // Non-blocking
        }
      }
    });
    next();
  };
}
