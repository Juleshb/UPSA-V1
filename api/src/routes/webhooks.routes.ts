import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { applyPaymentResult } from '../services/payments.service';

const webhookSchema = z.object({
  event: z.enum([
    'PAYMENT.INITIATED',
    'PAYMENT.SUCCESS',
    'PAYMENT.FAILED',
    'PAYMENT.REVERSED',
    'PAYMENT.REFUNDED',
    'SETTLEMENT.COMPLETED',
  ]),
  eventId: z.string().min(3),
  paymentId: z.string(),
  invoiceId: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  transactionReference: z.string().optional(),
  timestamp: z.string(),
});

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', env.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const webhooksRouter = Router();

webhooksRouter.post(
  '/payment',
  asyncHandler(async (req, res) => {
    const signature = req.header('x-webhook-signature');
    const raw = JSON.stringify(req.body ?? {});
    if (env.nodeEnv === 'production' && !verifySignature(raw, signature)) {
      throw errors.unauthorized('Webhook signature verification failed.');
    }

    const body = webhookSchema.parse(req.body);
    const eventTime = Date.parse(body.timestamp);
    if (Number.isNaN(eventTime) || Math.abs(Date.now() - eventTime) > 15 * 60 * 1000) {
      throw errors.badRequest('Webhook timestamp is missing or outside the replay window.');
    }

    const result = await applyPaymentResult(body);
    res.status(202).json(result);
  }),
);
