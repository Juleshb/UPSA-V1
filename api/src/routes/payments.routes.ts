import { Router } from 'express';
import { PaymentChannel } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as payments from '../services/payments.service';

const createSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('RWF'),
  paymentChannel: z.nativeEnum(PaymentChannel),
  payerReference: z.string().optional(),
  originCountry: z.string().length(2).optional(),
  destinationCountry: z.string().length(2).optional(),
});

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

paymentsRouter.get(
  '/rails',
  requirePermission('payment.read'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await payments.listRails() });
  }),
);

paymentsRouter.get(
  '/corridors',
  requirePermission('payment.read'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await payments.listCorridors() });
  }),
);

paymentsRouter.get(
  '/events',
  requirePermission('payment.read'),
  asyncHandler(async (_req, res) => {
    res.json(await payments.listBusEvents());
  }),
);

paymentsRouter.post(
  '/',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const created = await payments.initiatePayment({
      ...body,
      idempotencyKey: req.header('idempotency-key') ?? undefined,
    }, req.actor?.id);
    res.status(201).json(created);
  }),
);

paymentsRouter.get(
  '/',
  requirePermission('payment.read'),
  asyncHandler(async (req, res) => {
    const invoiceId = typeof req.query.invoiceId === 'string' ? req.query.invoiceId : undefined;
    res.json({ items: await payments.listPayments(invoiceId, req.actor) });
  }),
);

paymentsRouter.post(
  '/:paymentId/retry',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    res.json(await payments.retryPayment(req.params.paymentId, req.actor?.id));
  }),
);

paymentsRouter.post(
  '/:paymentId/refund',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    res.json(await payments.refundPayment(req.params.paymentId, req.actor?.id));
  }),
);

paymentsRouter.post(
  '/:paymentId/reverse',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    res.json(await payments.reversePayment(req.params.paymentId, req.actor?.id));
  }),
);

paymentsRouter.get(
  '/:paymentId',
  requirePermission('payment.read'),
  asyncHandler(async (req, res) => {
    res.json(await payments.getPayment(req.params.paymentId, req.actor));
  }),
);
