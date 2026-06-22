import { Response } from 'express';

export function success(res: Response, data: unknown, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function error(res: Response, message: string, statusCode = 400, errors?: unknown) {
  return res.status(statusCode).json({ success: false, message, errors });
}

export function paginate<T>(res: Response, data: T[], total: number, page: number, limit: number) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
