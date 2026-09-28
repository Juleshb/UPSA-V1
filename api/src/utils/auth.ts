import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  publicId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl,
  } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: 'refresh', jti: randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.jwtRefreshTtl);
  const amount = match ? Number(match[1]) : 7;
  const unit = match?.[2] ?? 'd';
  const ms =
    unit === 's' ? amount * 1000 :
    unit === 'm' ? amount * 60_000 :
    unit === 'h' ? amount * 3_600_000 :
    amount * 86_400_000;
  return new Date(Date.now() + ms);
}
