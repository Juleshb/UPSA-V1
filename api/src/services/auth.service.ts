import {
  hashPassword,
  hashToken,
  refreshExpiry,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../utils/auth';
import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { rolePermissions } from '../utils/permissions';
import { prisma } from '../utils/prisma';
import { openParentAccount } from './parent.service';

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  nationalId?: string;
  parentalConsent: boolean;
  requestId?: string;
}) {
  if (!input.parentalConsent) {
    throw errors.unprocessable(
      'CONSENT_REQUIRED',
      'Parental-responsibility consent is required before a parent account can be opened.',
    );
  }
  if (input.nationalId && !/^\d{16}$/.test(input.nationalId)) {
    throw errors.unprocessable('IDENTITY_INVALID', 'Enter the 16-digit national ID number.');
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const user = await prisma.user.create({
    data: {
      publicId: await nextPublicId('USR'),
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      phone: input.phone,
      role: 'PARENT',
    },
  });

  try {
    await openParentAccount(user, {
      phone: input.phone,
      nationalId: input.nationalId,
      requestId: input.requestId,
    });
  } catch (error) {
    const guardian = await prisma.guardian.findUnique({ where: { userId: user.id } });
    if (guardian) {
      await prisma.consent.deleteMany({ where: { subjectId: guardian.publicId } });
      await prisma.kycRecord.deleteMany({ where: { subjectId: guardian.publicId } });
      await prisma.guardian.delete({ where: { id: guardian.id } });
    }
    await prisma.user.delete({ where: { id: user.id } });
    throw error;
  }

  return issueSession(user.id);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw errors.unauthorized('Invalid email or password.');
  }
  if (user.status !== 'ACTIVE') {
    throw errors.forbidden('This account is not active.');
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return issueSession(user.id);
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw errors.unauthorized('Invalid refresh token.');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw errors.unauthorized('Refresh token is expired or revoked.');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueSession(payload.sub);
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('USER_NOT_FOUND', 'The requested user could not be found.');
  return {
    userId: user.publicId,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    permissions: rolePermissions(user.role),
  };
}

async function issueSession(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    publicId: user.publicId,
  });
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiry(),
    },
  });
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    user: {
      userId: user.publicId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: rolePermissions(user.role),
    },
  };
}
