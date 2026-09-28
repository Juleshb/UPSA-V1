import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { errors } from '../utils/errors';
import { prisma } from '../utils/prisma';

const IDEMPOTENT_PATH = /\/(payments|disbursement|repayments|guarantees|claims|webhooks)\b/;

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    next();
    return;
  }

  const key = req.header('idempotency-key');
  const required = IDEMPOTENT_PATH.test(req.path) || IDEMPOTENT_PATH.test(req.originalUrl);

  if (required && !key) {
    next(errors.badRequest('Idempotency-Key is required for this transaction API.'));
    return;
  }
  if (!key) {
    next();
    return;
  }

  const requestHash = createHash('sha256')
    .update(`${req.method}:${req.path}:${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key_method_path: { key, method: req.method, path: req.path } },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      next(errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was reused with a different payload.'));
      return;
    }
    res.status(existing.responseStatus).json(existing.responseBody);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const status = res.statusCode || 200;
    void prisma.idempotencyRecord.create({
      data: {
        key,
        method: req.method,
        path: req.path,
        requestHash,
        responseStatus: status,
        responseBody: body as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }).catch(() => undefined);
    return originalJson(body);
  }) as typeof res.json;

  next();
}
