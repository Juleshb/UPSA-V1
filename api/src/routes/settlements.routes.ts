import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import { createSettlement, listSettlements } from '../services/settlements.service';

const createSchema = z.object({
  schoolId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('RWF'),
  rail: z.string().min(2),
  reference: z.string().min(2),
  paymentIds: z.array(z.string()).optional(),
});

export const settlementsRouter = Router();
settlementsRouter.use(authenticate);

settlementsRouter.post(
  '/',
  requirePermission('payment.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const settlement = await createSettlement(body, req.actor?.id);
    res.status(201).json(settlement);
  }),
);

settlementsRouter.get(
  '/',
  requirePermission('payment.read'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await listSettlements() });
  }),
);
