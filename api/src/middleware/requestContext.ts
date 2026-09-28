import type { NextFunction, Request, Response } from 'express';
import { newRequestId } from '../utils/ids';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = (req.header('x-request-id') ?? newRequestId()).trim();
  req.correlationId = (req.header('x-correlation-id') ?? req.requestId).trim();
  req.clientId = req.header('x-client-id') ?? undefined;
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
