import type { NextFunction, Request, Response } from 'express';
import { errors } from '../utils/errors';
import { verifyAccessToken } from '../utils/auth';
import { hasPermission, type Permission } from '../utils/permissions';
import { prisma } from '../utils/prisma';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw errors.unauthorized();
    }
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw errors.unauthorized('The access token is no longer valid.');
    }
    req.actor = {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (error) {
    next(error instanceof Error && 'status' in error ? error : errors.unauthorized());
  }
}

export function requirePermission(...needed: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.actor) {
      next(errors.unauthorized());
      return;
    }
    const allowed = needed.every((permission) => hasPermission(req.actor!.role, permission));
    if (!allowed) {
      next(errors.forbidden());
      return;
    }
    next();
  };
}
