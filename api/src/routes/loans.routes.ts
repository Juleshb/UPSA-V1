import { Router } from 'express';
import { CreditDecision } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as loans from '../services/loans.service';

const applicationSchema = z.object({
  schoolId: z.string(),
  financialInstitutionId: z.string(),
  productCode: z.string().min(2),
  requestedAmount: z.number().positive(),
  currency: z.string().default('RWF'),
  tenorMonths: z.number().int().positive(),
  purpose: z.string().min(2),
  guaranteeRequested: z.boolean().optional(),
  guaranteeAmountRequested: z.number().positive().optional(),
});

const decisionSchema = z.object({
  decision: z.nativeEnum(CreditDecision),
  approvedAmount: z.number().positive().optional(),
  currency: z.string().optional(),
  tenorMonths: z.number().int().positive().optional(),
  interestRate: z.number().nonnegative().optional(),
  decisionReference: z.string().optional(),
});

const disbursementSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
  disbursementAccount: z.string().min(2),
  transactionReference: z.string().min(2),
});

const repaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
  paymentReference: z.string().min(2),
  paymentDate: z.string(),
});

export const loanApplicationsRouter = Router();
loanApplicationsRouter.use(authenticate);

loanApplicationsRouter.post(
  '/',
  requirePermission('loan.write'),
  asyncHandler(async (req, res) => {
    const created = await loans.createApplication(applicationSchema.parse(req.body), req.actor?.id);
    res.status(201).json(created);
  }),
);

loanApplicationsRouter.get(
  '/',
  requirePermission('loan.read'),
  asyncHandler(async (req, res) => {
    const schoolId = typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined;
    res.json({ items: await loans.listApplications(schoolId) });
  }),
);

loanApplicationsRouter.post(
  '/:applicationId/assessment',
  requirePermission('loan.write'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await loans.assessApplication(req.params.applicationId));
  }),
);

loanApplicationsRouter.post(
  '/:applicationId/decision',
  requirePermission('loan.write'),
  asyncHandler(async (req, res) => {
    res.json(await loans.decideApplication(req.params.applicationId, decisionSchema.parse(req.body), req.actor?.id));
  }),
);

export const loansRouter = Router();
loansRouter.use(authenticate);

loansRouter.get(
  '/:loanId',
  requirePermission('loan.read'),
  asyncHandler(async (req, res) => {
    res.json(await loans.getLoan(req.params.loanId));
  }),
);

loansRouter.get(
  '/:loanId/balance',
  requirePermission('loan.read'),
  asyncHandler(async (req, res) => {
    res.json(await loans.getLoanBalance(req.params.loanId));
  }),
);

loansRouter.post(
  '/:loanId/disbursement',
  requirePermission('loan.write'),
  asyncHandler(async (req, res) => {
    const created = await loans.disburse(req.params.loanId, {
      ...disbursementSchema.parse(req.body),
      idempotencyKey: req.header('idempotency-key') ?? undefined,
    }, req.actor?.id);
    res.status(201).json(created);
  }),
);

loansRouter.post(
  '/:loanId/repayments',
  requirePermission('loan.write'),
  asyncHandler(async (req, res) => {
    const created = await loans.repay(req.params.loanId, {
      ...repaymentSchema.parse(req.body),
      idempotencyKey: req.header('idempotency-key') ?? undefined,
    }, req.actor?.id);
    res.status(201).json(created);
  }),
);
