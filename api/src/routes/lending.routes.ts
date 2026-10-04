import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import * as lending from '../services/lending';

const text = z.string().trim().min(1);
const optional = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const flag = z.boolean();

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

export const lendingRouter = Router();
lendingRouter.use(authenticate);

lendingRouter.get('/summary', requirePermission('loan.read'), asyncHandler(async (_req, res) => res.json(await lending.dashboard())));
lendingRouter.get('/products', requirePermission('loan.read'), asyncHandler(async (_req, res) => res.json({ items: await lending.listProducts() })));
lendingRouter.post('/products', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: text, name: text, description: optional, customerType: text, purpose: text, interestRate: z.number().nonnegative(),
    interestMethod: optional, processingFeeRate: z.number().nonnegative().optional(), insuranceFeeRate: z.number().nonnegative().optional(),
    guaranteeFeeRate: z.number().nonnegative().optional(), lateFeeRate: z.number().nonnegative().optional(), otherCharges: z.number().nonnegative().optional(),
    minimumAmount: z.number().nonnegative(), maximumAmount: z.number().positive(), minimumTenor: z.number().int().positive(), maximumTenor: z.number().int().positive(),
    graceMonths: z.number().int().nonnegative().optional(), repaymentFrequency: optional, eligibility: optional, maximumExposure: z.number().nonnegative().optional(),
    debtServiceRule: optional, guaranteeRequired: flag.optional(), collateralRequired: flag.optional(), allocationOrder: optional, status: optional,
  }).parse(req.body);
  res.status(201).json(await lending.saveProduct(body, trace(req)));
}));
lendingRouter.get('/applications', requirePermission('loan.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optional, q: optional }).parse(req.query);
  res.json({ items: await lending.listApplications(query) });
}));
lendingRouter.get('/applications/:id', requirePermission('loan.read'), asyncHandler(async (req, res) => res.json(await lending.applicationFile(req.params.id))));
lendingRouter.post('/applications', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    schoolId: text, financialInstitutionId: text, productCode: text, requestedAmount: z.number().positive(), currency: optional,
    tenorMonths: z.number().int().positive(), purpose: text, guaranteeRequested: flag.optional(), guaranteeAmountRequested: z.number().nonnegative().optional(),
    customerType: text, applicantName: text, representative: optional, memberPublicId: optional,
    monthlyRevenue: z.number().nonnegative().optional(), monthlyExpenses: z.number().nonnegative().optional(),
    existingDebt: z.number().nonnegative().optional(), existingRepayments: z.number().nonnegative().optional(),
    applicantContribution: z.number().nonnegative().optional(), expectedCashFlow: optional, graceMonths: z.number().int().nonnegative().optional(),
    repaymentFrequency: optional, collateralAvailable: flag.optional(), collateralType: optional, collateralValue: z.number().nonnegative().optional(),
    collateralOwner: optional, details: z.record(z.string()).optional(),
  }).parse(req.body);
  res.status(201).json(await lending.registerApplication(body, trace(req)));
}));
lendingRouter.post('/applications/:id/documents', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ documentType: text, documentNumber: optional, issueDate: day.optional(), expiryDate: day.optional(), fileName: text }).parse(req.body);
  res.status(201).json(await lending.addDocument(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/documents/:documentId', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: text, comment: optional }).parse(req.body);
  res.json(await lending.reviewDocument(req.params.id, req.params.documentId, body, trace(req)));
}));
lendingRouter.post('/applications/:id/kyc', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    kind: text, fullName: optional, idType: optional, idNumber: optional, dateOfBirth: day.optional(), address: optional, phone: optional, email: optional,
    organizationName: optional, registrationNumber: optional, taxId: optional, directors: optional, owners: optional, representative: optional, beneficialOwners: optional,
    result: z.enum(['VERIFIED', 'PENDING', 'FAILED', 'MORE_INFORMATION_REQUIRED']),
  }).parse(req.body);
  res.json(await lending.saveKyc(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/consent', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ purpose: text, scope: text, institution: text, effectiveDate: day, expiryDate: day, version: text, withdraw: flag.optional() }).parse(req.body);
  res.json(await lending.saveConsent(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/assessment', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    revenue: z.number().nonnegative(), collections: z.number().nonnegative(), collectionRate: z.number().nonnegative(), expenses: z.number().nonnegative(),
    exposure: z.number().nonnegative(), debtService: z.number().nonnegative(), repaymentCapacity: text, cashFlowStability: text, paymentHistory: text, trend: text,
    risks: optional, mitigation: optional, result: z.enum(['RECOMMEND', 'RECOMMEND_WITH_CONDITIONS', 'MORE_INFORMATION_REQUIRED', 'NOT_RECOMMENDED']),
  }).parse(req.body);
  res.json(await lending.saveAssessment(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/decision', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['APPROVED', 'DECLINED', 'CONDITIONAL_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'CANCELLED']),
    approvedAmount: z.number().positive().optional(), tenorMonths: z.number().int().positive().optional(), interestRate: z.number().nonnegative().optional(),
    graceMonths: z.number().int().nonnegative().optional(), fees: z.number().nonnegative().optional(), conditions: optional, decisionReference: optional, comments: optional,
  }).parse(req.body);
  res.json(await lending.recordDecision(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/offer', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ response: z.enum(['ACCEPTED', 'REJECTED', 'CHANGES']), acceptedBy: optional }).parse(req.body);
  res.json(await lending.respondOffer(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/contract', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ security: optional, guarantee: optional, defaultTerms: optional, otherTerms: optional, borrowerSigned: flag, institutionSigned: flag, representative: optional }).parse(req.body);
  res.json(await lending.createContract(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/collateral', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    collateralType: text, description: text, owner: text, documentName: optional, estimatedValue: z.number().nonnegative(),
    valuationDate: day.optional(), valuer: optional, location: optional, registrationNumber: optional,
  }).parse(req.body);
  res.status(201).json(await lending.addCollateral(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/collateral/:collateralId', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: text }).parse(req.body);
  res.json(await lending.markCollateral(req.params.id, req.params.collateralId, body.status, trace(req)));
}));
lendingRouter.post('/applications/:id/guarantee', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ requestedLoan: z.number().positive(), requestedGuarantee: z.number().nonnegative(), facility: optional, purpose: text, fee: z.number().nonnegative().optional() }).parse(req.body);
  res.status(201).json(await lending.requestGuarantee(req.params.id, body, trace(req)));
}));
lendingRouter.post('/applications/:id/guarantee/:requestId', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: text }).parse(req.body);
  res.json(await lending.decideGuarantee(req.params.id, req.params.requestId, body.decision, trace(req)));
}));
lendingRouter.get('/loans', requirePermission('loan.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optional, q: optional }).parse(req.query);
  res.json({ items: await lending.listLoans(query) });
}));
lendingRouter.get('/loans/:id', requirePermission('loan.read'), asyncHandler(async (req, res) => res.json(await lending.loanFile(req.params.id))));
lendingRouter.get('/loans/:id/statement', requirePermission('loan.read'), asyncHandler(async (req, res) => res.json(await lending.statement(req.params.id))));
lendingRouter.get('/loans/:id/settlement-quote', requirePermission('loan.read'), asyncHandler(async (req, res) => res.json(await lending.settlementQuote(req.params.id, Number(req.query.charge ?? 0)))));
lendingRouter.post('/loans/:id/disbursements', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.number().positive(), disbursementAccount: text, paymentMethod: text, externalTransactionId: optional, disbursementDate: day.optional() }).parse(req.body);
  res.status(201).json(await lending.disburseLoan(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/repayments', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.number().positive(), paymentMethod: text, externalTransactionId: optional, paymentDate: day.optional(), reference: optional }).parse(req.body);
  res.status(201).json(await lending.postRepayment(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/restructure', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ newTenor: z.number().int().positive(), frequency: text, graceMonths: z.number().int().nonnegative().optional(), interestTerms: optional, fees: z.number().nonnegative().optional(), reason: text, decision: z.enum(['APPROVE', 'REJECT']) }).parse(req.body);
  res.json(await lending.restructureLoan(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/holiday', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ months: z.number().int().positive(), reason: text, decision: z.enum(['APPROVE', 'REJECT', 'MODIFY']), startDate: day }).parse(req.body);
  res.json(await lending.grantHoliday(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/top-up', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ requested: z.number().positive(), purpose: text, tenorMonths: z.number().int().positive(), eligibility: text, capacity: text, decision: text }).parse(req.body);
  res.json(await lending.topUp(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/refinance', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ lender: text, currentRate: z.number().nonnegative(), remainingTenor: z.number().int().nonnegative(), newAmount: z.number().positive(), newRate: z.number().nonnegative(), newTenor: z.number().int().positive(), settlement: z.number().nonnegative(), additional: z.number().nonnegative() }).parse(req.body);
  res.json(await lending.refinance(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/transfer', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ toInstitution: text, transferDate: day, reason: text, approved: flag }).parse(req.body);
  res.json(await lending.transferLoan(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/adjustments', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ kind: z.enum(['PRINCIPAL', 'INTEREST', 'FEES', 'PENALTY']), amount: z.number(), reason: text }).parse(req.body);
  res.json(await lending.adjustLoan(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/refunds', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ originalTransaction: text, amount: z.number().positive(), reason: text, destination: text, paymentMethod: text, externalTransactionId: optional }).parse(req.body);
  res.json(await lending.refundRepayment(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/collections', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ contactDate: day, method: text, person: text, promiseAmount: z.number().nonnegative().optional(), promiseDate: day.optional(), followUpDate: day.optional(), notes: optional, status: text }).parse(req.body);
  res.status(201).json(await lending.collect(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/promises', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ promised: z.number().positive(), promiseDate: day, notes: optional, status: optional }).parse(req.body);
  res.status(201).json(await lending.promiseToPay(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/recovery', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ stage: text, strategy: text, nextAction: text, nextActionDate: day.optional() }).parse(req.body);
  res.status(201).json(await lending.startRecovery(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/write-off', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, evidence: optional, decision: z.enum(['APPROVE', 'REJECT']) }).parse(req.body);
  res.json(await lending.writeOff(req.params.id, body, trace(req)));
}));
lendingRouter.post('/loans/:id/settlement', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ principalSettled: flag, interestSettled: flag, feesSettled: flag, clear: flag, finalPayment: z.number().nonnegative().optional() }).parse(req.body);
  res.json(await lending.settleLoan(req.params.id, body, trace(req)));
}));
lendingRouter.get('/reports/:type', requirePermission('loan.read'), asyncHandler(async (req, res) => res.json({ items: await lending.report(req.params.type) })));
lendingRouter.get('/notices', requirePermission('loan.read'), asyncHandler(async (_req, res) => res.json({ items: await lending.listNotices() })));
lendingRouter.post('/notices', requirePermission('loan.write'), asyncHandler(async (req, res) => {
  const body = z.object({ event: text, channel: text, subject: text, body: text, reference: optional }).parse(req.body);
  res.status(201).json(await lending.sendNotice(body, trace(req)));
}));
lendingRouter.get('/audit', requirePermission('loan.read'), asyncHandler(async (_req, res) => res.json({ items: await lending.listAudit() })));
