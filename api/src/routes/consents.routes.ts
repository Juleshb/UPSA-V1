import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';

const createSchema = z.object({
  subjectId: z.string(),
  purpose: z.string().min(2),
  recipient: z.string().min(2),
  scope: z.array(z.string()).min(1),
  expiresAt: z.string(),
});

export const consentsRouter = Router();
consentsRouter.use(authenticate);

consentsRouter.post(
  '/',
  requirePermission('consent.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const institution = await prisma.financialInstitution.findUnique({ where: { publicId: body.recipient } });
    const consent = await prisma.consent.create({
      data: {
        publicId: await nextPublicId('CON'),
        subjectId: body.subjectId,
        purpose: body.purpose,
        recipient: body.recipient,
        recipientId: institution?.id,
        scope: body.scope,
        expiresAt: new Date(body.expiresAt),
        evidenceRef: req.requestId,
      },
    });
    res.status(201).json({
      consentId: consent.publicId,
      subjectId: body.subjectId,
      purpose: consent.purpose,
      recipient: consent.recipient,
      scope: consent.scope,
      status: consent.status,
      expiresAt: consent.expiresAt.toISOString(),
      createdAt: consent.createdAt.toISOString(),
      evidenceRef: consent.evidenceRef,
    });
  }),
);

consentsRouter.get(
  '/',
  requirePermission('consent.read'),
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
    const ownSubject = req.actor?.role === 'PARENT' ? await parentSubjectId(req.actor.id) : undefined;
    if (req.actor?.role === 'PARENT' && !ownSubject) {
      res.json({ items: [] });
      return;
    }
    const subjectId = ownSubject ?? requested;
    const rows = await prisma.consent.findMany({
      where: subjectId ? { subjectId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: rows.map((row) => ({
        consentId: row.publicId,
        purpose: row.purpose,
        recipient: row.recipient,
        scope: row.scope,
        status: row.status,
        expiresAt: row.expiresAt.toISOString(),
        withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
      })),
    });
  }),
);

consentsRouter.post(
  '/:consentId/withdraw',
  requirePermission('consent.write'),
  asyncHandler(async (req, res) => {
    const consent = await prisma.consent.findUnique({ where: { publicId: req.params.consentId } });
    if (!consent) throw errors.notFound('CONSENT_NOT_FOUND', 'The requested consent could not be found.');
    if (req.actor?.role === 'PARENT') {
      const ownSubject = await parentSubjectId(req.actor.id);
      if (!ownSubject || consent.subjectId !== ownSubject) {
        throw errors.notFound('CONSENT_NOT_FOUND', 'The requested consent could not be found.');
      }
    }
    const updated = await prisma.consent.update({
      where: { id: consent.id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    });
    res.json({
      consentId: updated.publicId,
      status: updated.status,
      withdrawnAt: updated.withdrawnAt?.toISOString(),
    });
  }),
);

async function parentSubjectId(userId: string) {
  const guardian = await prisma.guardian.findUnique({ where: { userId }, select: { publicId: true } });
  return guardian?.publicId;
}
