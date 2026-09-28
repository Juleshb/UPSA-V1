import { Router } from 'express';
import { ReconciliationStatus } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';
import { flagReconciliation } from '../services/settlements.service';

const exceptionSchema = z.object({
  status: z.enum(['UNMATCHED', 'PARTIALLY_MATCHED', 'DUPLICATE', 'FAILED', 'UNDER_REVIEW']),
  notes: z.string().min(3).optional(),
});

export const reconciliationRouter = Router();
reconciliationRouter.use(authenticate);

reconciliationRouter.get(
  '/',
  requirePermission('payment.read'),
  asyncHandler(async (req, res) => {
    const status = req.query.status
      ? z.nativeEnum(ReconciliationStatus).parse(req.query.status)
      : undefined;
    const rows = await prisma.reconciliation.findMany({
      where: status ? { status } : undefined,
      include: { invoice: true, payment: true, settlement: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: rows.map((row) => ({
        reconciliationId: row.publicId,
        status: row.status,
        invoiceId: row.invoice?.publicId ?? null,
        paymentId: row.payment?.publicId ?? null,
        settlementId: row.settlement?.publicId ?? null,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }),
);

reconciliationRouter.post(
  '/:reconciliationId/exception',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    const body = exceptionSchema.parse(req.body);
    res.json(await flagReconciliation(req.params.reconciliationId, {
      status: body.status as ReconciliationStatus,
      notes: body.notes,
    }, req.actor?.id));
  }),
);
