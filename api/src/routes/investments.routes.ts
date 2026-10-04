import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import * as investments from '../services/investments.service';
import { asyncHandler } from '../utils/async';

const optionalText = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const docs = z.array(z.object({ documentType: z.string().trim().min(2), fileName: z.string().trim().min(1), notes: optionalText })).optional();

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

export const investmentsRouter = Router();
investmentsRouter.use(authenticate);

investmentsRouter.get('/summary', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json(await investments.summary());
}));
investmentsRouter.get('/members', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listMembers() });
}));
investmentsRouter.get('/statement', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  const query = z.object({ memberId: optionalText, positionId: optionalText, from: optionalText, to: optionalText, entryType: optionalText }).parse(req.query);
  res.json(await investments.statement(query));
}));
investmentsRouter.get('/reports/:type', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  res.json({ items: await investments.report(req.params.type) });
}));
investmentsRouter.get('/audit', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listAudits() });
}));
investmentsRouter.get('/messages', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listMessages() });
}));
investmentsRouter.post('/messages', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ positionId: optionalText, kind: z.string().trim().min(2), channel: z.string(), subject: z.string().trim().min(2), message: z.string().trim().min(2) }).parse(req.body);
  res.status(201).json(await investments.sendMessage(body, trace(req)));
}));
investmentsRouter.get('/payouts', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listPayouts() });
}));
investmentsRouter.get('/exits', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listExits() });
}));
investmentsRouter.get('/transfers', requirePermission('investment.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await investments.listTransfers() });
}));
investmentsRouter.post('/transfers/:transferId/decision', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['APPROVE', 'REJECT']), reviewedBy: z.string().trim().min(2) }).parse(req.body);
  res.json(await investments.decideTransfer(req.params.transferId, body, trace(req)));
}));

investmentsRouter.get('/opportunities', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optionalText, q: optionalText }).parse(req.query);
  res.json({ items: await investments.listOpportunities(query) });
}));
investmentsRouter.post('/opportunities', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: z.string().trim().min(2),
    name: z.string().trim().min(2),
    investmentType: z.string(),
    description: z.string().trim().min(2),
    projectName: z.string().trim().min(2),
    sector: z.string(),
    location: z.string().trim().min(2),
    managerName: z.string().trim().min(2),
    startDate: day,
    endDate: day,
    targetAmount: z.number().positive(),
    minimumAmount: z.number().positive(),
    maximumAmount: z.number().positive().optional(),
    currency: optionalText,
    expectedReturnRate: z.number().min(0),
    returnFrequency: z.string(),
    investmentPeriod: z.string().trim().min(1),
    expectedProfit: z.number().min(0).optional(),
    riskDisclosure: z.string().trim().min(2),
    managementFeeRate: z.number().min(0).optional(),
    otherCharges: z.number().min(0).optional(),
    earlyRedemptionRate: z.number().min(0).optional(),
    documents: docs,
    mode: optionalText,
  }).parse(req.body);
  res.status(201).json(await investments.saveOpportunity(body, trace(req)));
}));
investmentsRouter.get('/opportunities/:id', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  res.json(await investments.getOpportunity(req.params.id));
}));
investmentsRouter.post('/opportunities/:id/status', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.string() }).parse(req.body);
  res.json(await investments.setOpportunityStatus(req.params.id, body.status, trace(req)));
}));
investmentsRouter.post('/opportunities/:id/fees', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string(), name: z.string(), feeType: z.string(), basis: z.string(), rate: z.number().min(0), effectiveDate: day }).parse(req.body);
  res.status(201).json(await investments.saveFeeLine(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/opportunities/:id/dividends', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ period: z.string().trim().min(2), totalDividend: z.number().positive(), distributionDate: day }).parse(req.body);
  res.status(201).json(await investments.distributeDividend(req.params.id, body, trace(req)));
}));

investmentsRouter.get('/applications', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optionalText }).parse(req.query);
  res.json({ items: await investments.listApplications(query) });
}));
investmentsRouter.post('/applications', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    memberId: z.string().trim().min(2),
    memberSource: optionalText,
    opportunityId: z.string().trim().min(2),
    representative: z.string().trim().min(2),
    telephone: z.string().trim().min(3),
    email: optionalText,
    requestedAmount: z.number().positive(),
    currency: optionalText,
    investmentPeriod: z.string().trim().min(1),
    purpose: optionalText,
    fundingSource: z.string(),
    confirmInformation: z.boolean().optional(),
    reviewedTerms: z.boolean().optional(),
    understandRisks: z.boolean().optional(),
    agreeAgreement: z.boolean().optional(),
    documents: docs,
    mode: optionalText,
  }).parse(req.body);
  res.status(201).json(await investments.saveApplication(body, trace(req)));
}));
investmentsRouter.get('/applications/:id', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  res.json(await investments.getApplication(req.params.id));
}));
investmentsRouter.post('/applications/:id/eligibility', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.string(), comments: optionalText }).parse(req.body);
  res.json(await investments.reviewEligibility(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/applications/:id/diligence', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    businessModel: z.boolean(), viability: z.boolean(), performance: z.boolean(), cashFlows: z.boolean(), ownership: z.boolean(), regulatory: z.boolean(), risks: z.boolean(),
    documents: z.array(z.object({ documentType: z.string(), status: z.string(), comment: optionalText })),
    result: z.string(),
  }).parse(req.body);
  res.json(await investments.saveDiligence(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/applications/:id/risk', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    ratings: z.record(z.object({ rating: z.string(), mitigation: optionalText })),
    riskLevel: z.string(),
    riskScore: z.number().optional(),
    mitigationPlan: z.string(),
    assessor: z.string(),
    assessmentDate: day,
    reviewDate: day,
  }).parse(req.body);
  res.json(await investments.saveRisk(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/applications/:id/approval', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.string(),
    approvedAmount: z.number().positive().optional(),
    investmentPeriod: optionalText,
    returnRate: z.number().min(0).optional(),
    returnFrequency: optionalText,
    fees: z.number().min(0).optional(),
    conditions: optionalText,
    startDate: optionalText,
    maturityDate: optionalText,
    comments: optionalText,
  }).parse(req.body);
  res.json(await investments.decideApplication(req.params.id, body, trace(req)));
}));

investmentsRouter.get('/positions', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optionalText, q: optionalText }).parse(req.query);
  res.json({ items: await investments.listPositions(query) });
}));
investmentsRouter.get('/portfolio', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  const query = z.object({ memberId: z.string(), memberSource: optionalText }).parse(req.query);
  res.json(await investments.portfolio(query.memberId, query.memberSource));
}));
investmentsRouter.get('/positions/:id', requirePermission('investment.read'), asyncHandler(async (req, res) => {
  res.json(await investments.getPosition(req.params.id));
}));
investmentsRouter.post('/positions/:id/agreement', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ representative: z.string().trim().min(2), version: optionalText }).parse(req.body);
  res.json(await investments.acceptAgreement(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/payments', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.number().positive(), contributionDate: day, paymentMethod: z.string(), bank: optionalText, accountReference: optionalText }).parse(req.body);
  res.status(201).json(await investments.contribute(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/payments/:paymentId/confirmation', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ outcome: z.enum(['SUCCESS', 'FAILED']), externalTransactionId: optionalText, receivedAmount: z.number().min(0).optional() }).parse(req.body);
  res.json(await investments.confirmContribution(req.params.id, req.params.paymentId, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/returns', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ period: z.string().trim().min(2), tax: z.number().min(0).optional(), paymentDate: optionalText, reviewedBy: z.string().trim().min(2) }).parse(req.body);
  res.status(201).json(await investments.recordReturn(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/returns/:payoutId/approval', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  res.json(await investments.approvePayout(req.params.id, req.params.payoutId, trace(req)));
}));
investmentsRouter.post('/positions/:id/exits', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    kind: z.string(), redemptionType: optionalText, amount: z.number().positive(), reason: z.string().trim().min(2), requestDate: day, bankAccount: optionalText, destination: z.string().trim().min(2), originalReference: optionalText,
  }).parse(req.body);
  res.status(201).json(await investments.requestExit(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/exits/:exitId/decision', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.string(), comments: optionalText }).parse(req.body);
  res.json(await investments.decideExit(req.params.id, req.params.exitId, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/exits/:exitId/payment', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  res.json(await investments.completeExit(req.params.id, req.params.exitId, trace(req)));
}));
investmentsRouter.post('/positions/:id/transfers', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ toPositionId: z.string(), amount: z.number().positive(), fees: z.number().min(0).optional(), reason: z.string().trim().min(2), transferDate: day, documents: docs }).parse(req.body);
  res.status(201).json(await investments.requestTransfer(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/maturity', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ instruction: z.string(), reinvestAmount: z.number().positive().optional(), opportunityId: optionalText }).parse(req.body);
  res.json(await investments.instructMaturity(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/adjustments', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.number(), adjustmentType: z.string(), reason: z.string().trim().min(2), documentName: optionalText }).parse(req.body);
  res.json(await investments.adjust(req.params.id, body, trace(req)));
}));
investmentsRouter.post('/positions/:id/close', requirePermission('investment.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(2), obligationsSettled: z.boolean(), statementGenerated: z.boolean(), noBalance: z.boolean() }).parse(req.body);
  res.json(await investments.closePosition(req.params.id, body, trace(req)));
}));
