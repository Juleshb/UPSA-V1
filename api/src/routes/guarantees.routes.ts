import { Router } from 'express';
import { GuaranteeDecision } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as guarantees from '../services/guarantees.service';

const requestSchema = z.object({
  loanApplicationId: z.string(),
  schoolId: z.string(),
  financialInstitutionId: z.string(),
  loanAmount: z.number().positive(),
  guaranteeAmount: z.number().positive(),
  currency: z.string().default('RWF'),
});

const decisionSchema = z.object({
  decision: z.nativeEnum(GuaranteeDecision),
  guaranteedAmount: z.number().positive().optional(),
  expiryDate: z.string().optional(),
});

const claimSchema = z.object({
  loanId: z.string(),
  claimAmount: z.number().positive(),
  reason: z.string().min(2),
  supportingReference: z.string().optional(),
});

export const guaranteesRouter = Router();
guaranteesRouter.use(authenticate);

guaranteesRouter.post(
  '/',
  requirePermission('guarantee.write'),
  asyncHandler(async (req, res) => {
    const created = await guarantees.requestGuarantee(requestSchema.parse(req.body), req.actor?.id);
    res.status(201).json(created);
  }),
);

guaranteesRouter.get(
  '/',
  requirePermission('guarantee.read'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await guarantees.listGuarantees(), facility: await guarantees.facilitySnapshot() });
  }),
);

guaranteesRouter.post(
  '/:guaranteeId/decision',
  requirePermission('guarantee.write'),
  asyncHandler(async (req, res) => {
    res.json(await guarantees.decideGuarantee(req.params.guaranteeId, decisionSchema.parse(req.body), req.actor?.id));
  }),
);

guaranteesRouter.post(
  '/:guaranteeId/claims',
  requirePermission('guarantee.write'),
  asyncHandler(async (req, res) => {
    const created = await guarantees.fileClaim(req.params.guaranteeId, claimSchema.parse(req.body), req.actor?.id);
    res.status(201).json(created);
  }),
);
