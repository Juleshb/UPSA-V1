import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/errors';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource could not be found.',
      requestId: _req.requestId,
    },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'The request failed validation.',
        requestId: req.requestId,
        details: err.issues,
      },
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: req.requestId,
    },
  });
}

export function accessLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    void import('../utils/prisma').then(({ prisma }) =>
      prisma.accessLog.create({
        data: {
          userId: req.actor?.id,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          requestId: req.requestId,
          ip: req.ip,
        },
      }).catch(() => undefined),
    );
    if (process.env.NODE_ENV !== 'test') {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms ${req.requestId}`);
    }
  });
  next();
}
