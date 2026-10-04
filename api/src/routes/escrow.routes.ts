import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import * as escrow from '../services/escrow';

const text = z.string().trim().min(1);
const optional = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().positive();
const flag = z.boolean().optional();

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

export const escrowRouter = Router();
escrowRouter.use(authenticate);

escrowRouter.get('/summary', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json(await escrow.dashboard())));
escrowRouter.get('/groups', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listGroups() })));
escrowRouter.get('/groups/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.groupFile(req.params.id))));
escrowRouter.get('/groups/:id/exposure', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.groupExposure(req.params.id))));
escrowRouter.post('/groups', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: text, groupType: text, registrationNumber: optional, formationDate: day.optional(), purpose: text,
    address: optional, district: optional, sector: optional, contact: optional, chairperson: optional, secretary: optional,
    treasurer: optional, representatives: optional, membershipStatus: optional, schoolId: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.createGroup(body, trace(req)));
}));
escrowRouter.post('/groups/:id/members', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    memberType: text, name: text, schoolId: optional, schoolName: optional, membershipNumber: optional,
    contributionPercent: z.number().optional(), contributionAmount: z.number().optional(),
    votingRights: flag, guaranteeParticipation: flag, collateralParticipation: flag, status: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.addMember(req.params.id, body, trace(req)));
}));
escrowRouter.post('/groups/:id/contributions', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    accountId: optional, requiredContribution: money, period: text, paymentReference: optional,
    reconciliationStatus: optional, approval: optional, remarks: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.addGroupContribution(req.params.id, body, trace(req)));
}));

escrowRouter.get('/accounts', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listAccounts() })));
escrowRouter.get('/accounts/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.accountFile(req.params.id))));
escrowRouter.get('/accounts/:id/statement', requirePermission('guarantee.read'), asyncHandler(async (req, res) => {
  const query = z.object({ from: optional, to: optional, type: optional, status: optional }).parse(req.query);
  res.json(await escrow.statement(req.params.id, query));
}));
escrowRouter.post('/accounts', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: text, accountType: text, product: text, currency: optional, purpose: text, description: optional,
    openingDate: day, expectedClosingDate: day.optional(), groupId: optional, schoolId: optional, institutionId: optional,
    representative: optional, signatory: optional, contact: optional, bankName: optional, branch: optional,
    bankAccountNumber: optional, bankAccountName: optional, settlementAccount: optional, paymentReference: optional,
    memberPercent: z.number().optional(), financePercent: z.number().optional(),
    requiredContribution: z.number().optional(), requiredFinancing: z.number().optional(),
    minimumBalance: z.number().optional(), maximumBalance: z.number().optional(),
    contributionFrequency: optional, allocationRule: optional, releaseRule: optional,
    withdrawalRestricted: flag, approvalRequired: flag, dualAuthorization: flag, freezeAllowed: flag,
    partialReleaseAllowed: flag, setOffAllowed: flag, mode: z.enum(['draft', 'submit']).optional(),
  }).parse(req.body);
  res.status(201).json(await escrow.openAccount(body, trace(req)));
}));
escrowRouter.post('/accounts/:id/decision', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']) }).parse(req.body);
  res.json(await escrow.decideAccount(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/contributions', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    memberId: optional, memberName: text, contributionType: text, amount: money, currency: optional,
    contributionDate: day, paymentMethod: text, paymentReference: optional, externalTransactionId: optional,
    sourceOfFunds: optional, document: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.contribute(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/allocations', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ totalAmount: money, purpose: optional, destinationAccount: optional, approvalReference: optional }).parse(req.body);
  res.status(201).json(await escrow.allocate(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/movements', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    type: z.enum(['TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'FEE', 'INTEREST', 'REVERSAL', 'OTHER']),
    amount: money, transactionDate: day, debitAccount: optional, creditAccount: optional,
    paymentReference: optional, externalTransactionId: optional, purpose: optional, document: optional, remarks: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.postMovement(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/freezes', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ amount: money, reason: text, authority: optional, document: optional, startDate: day, endDate: day.optional(), legalReference: optional }).parse(req.body);
  res.status(201).json(await escrow.requestFreeze(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/freezes/:freezeId', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['ACTIVE', 'REJECTED', 'RELEASED']) }).parse(req.body);
  res.json(await escrow.decideFreeze(req.params.id, req.params.freezeId, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/releases', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: money, fromRestricted: flag, purpose: text, beneficiary: text, destinationAccount: text,
    paymentReference: optional, externalTransactionId: optional, paymentMethod: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.requestRelease(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/releases/:releaseId', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['RELEASED', 'REJECTED']), paymentMethod: optional, externalTransactionId: optional, paymentReference: optional }).parse(req.body);
  res.json(await escrow.decideRelease(req.params.id, req.params.releaseId, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/withdrawals', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: money, reason: text, beneficiary: text, destinationAccount: text, approval: optional,
    paymentMethod: optional, paymentReference: optional, externalTransactionId: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.withdraw(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/refunds', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: money, reason: text, beneficiary: text, originalTransaction: optional, destinationAccount: optional,
    approval: optional, paymentMethod: optional, paymentReference: optional, externalTransactionId: optional, refundDate: day,
  }).parse(req.body);
  res.status(201).json(await escrow.refund(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/agreements', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    parties: text, agent: optional, institutionName: optional, purpose: text, amount: money, currency: optional, rule: text,
    contributionRequirements: optional, releaseConditions: optional, withdrawalConditions: optional, defaultConditions: optional,
    terminationConditions: optional, disputeResolution: optional, effectiveDate: day, expiryDate: day.optional(),
    signatures: z.array(z.object({ role: text, name: text, signedAt: optional })).optional(),
  }).parse(req.body);
  res.status(201).json(await escrow.saveAgreement(req.params.id, body, trace(req)));
}));
escrowRouter.post('/accounts/:id/close', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, destinationAccount: optional, settlementAmount: z.number().optional() }).parse(req.body);
  res.json(await escrow.closeAccount(req.params.id, body, trace(req)));
}));

escrowRouter.get('/collateral', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listAssets(), pools: await escrow.listPools() })));
escrowRouter.get('/collateral/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.assetFile(req.params.id))));
escrowRouter.post('/pools', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ groupId: text, name: text, purpose: text, haircutPercent: z.number().optional(), encumbrance: z.number().optional(), reviewDate: day.optional() }).parse(req.body);
  res.status(201).json({ items: await escrow.createPool(body, trace(req)) });
}));
escrowRouter.post('/collateral', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    groupId: text, poolId: optional, accountId: optional, schoolId: optional, collateralType: text, description: text, owner: text,
    coOwners: optional, ownershipPercent: z.number().optional(), location: optional, registrationNumber: optional,
    acquisitionDate: day.optional(), acquisitionCost: z.number().optional(), marketValue: z.number(), forcedSaleValue: z.number(),
    valuer: optional, haircutPercent: z.number().optional(), ownershipDocument: optional, insurance: optional,
    insuranceExpiry: day.optional(), encumbrance: z.number().optional(), securityRegistration: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.registerAsset(body, trace(req)));
}));
escrowRouter.post('/collateral/:id/verification', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    ownershipVerified: z.boolean(), registrationVerified: z.boolean(), physicalVerification: z.boolean(), lienCheck: z.boolean(),
    insuranceVerified: z.boolean(), valuationVerified: z.boolean(), legalVerified: z.boolean(),
    result: z.enum(['VERIFIED', 'PARTIALLY_VERIFIED', 'FAILED', 'MORE_INFORMATION_REQUIRED']), comments: optional, verificationDate: day,
  }).parse(req.body);
  res.json(await escrow.verifyAsset(req.params.id, body, trace(req)));
}));
escrowRouter.post('/collateral/:id/valuation', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    marketValue: z.number(), forcedSaleValue: z.number(), replacementValue: z.number().optional(), method: text, valuer: text,
    valuerRegistration: optional, valuationDate: day, report: optional, reviewDate: day.optional(), approvedValue: z.number(), comments: optional,
  }).parse(req.body);
  res.json(await escrow.valueAsset(req.params.id, body, trace(req)));
}));
escrowRouter.post('/collateral/:id/status', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['REGISTERED', 'ACTIVE']) }).parse(req.body);
  res.json(await escrow.markAsset(req.params.id, body.status, trace(req)));
}));
escrowRouter.post('/collateral/:id/liens', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    loanId: optional, guaranteeId: optional, institutionName: optional, securedAmount: money, registrationNumber: optional,
    registrationDate: day.optional(), priority: z.number().int().optional(), expiryDate: day.optional(), releaseConditions: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.addLien(req.params.id, body, trace(req)));
}));
escrowRouter.post('/collateral/:id/release', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, loanId: optional, registryReference: optional }).parse(req.body);
  res.json(await escrow.releaseAsset(req.params.id, body, trace(req)));
}));
escrowRouter.post('/collateral/substitutions', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ existingId: text, replacementId: text, reason: text, loanExposure: z.number().optional() }).parse(req.body);
  res.status(201).json(await escrow.substituteAsset(body, trace(req)));
}));
escrowRouter.post('/collateral/:id/monitoring', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    currentValue: z.number(), insuranceStatus: text, physicalCondition: optional, ownershipStatus: optional,
    encumbrance: z.number().optional(), reviewRequired: flag, nextReviewDate: day.optional(), comments: optional, valuationDate: day,
  }).parse(req.body);
  res.json(await escrow.watchAsset(req.params.id, body, trace(req)));
}));
escrowRouter.post('/collateral/:id/realization', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    loanId: optional, defaultCaseId: optional, approvedValue: z.number(), realizedValue: z.number(), costs: z.number().optional(),
    buyer: optional, saleReference: optional, saleDate: day.optional(), allocation: optional,
  }).parse(req.body);
  res.json(await escrow.realizeAsset(req.params.id, body, trace(req)));
}));
escrowRouter.post('/enforcements', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    poolId: text, loanId: optional, defaultCaseId: optional, reason: text, legalReference: optional, assetName: optional,
    value: z.number().optional(), enforcementDate: day, legalRepresentative: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.enforcePool(body, trace(req)));
}));

escrowRouter.get('/facilities', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listFacilities() })));
escrowRouter.post('/facilities', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: text, facilityType: text, institutionId: optional, groupId: optional, approvedLimit: money, currency: optional,
    guaranteePercent: z.number(), maximumAmount: money, feeRate: z.number().optional(), effectiveDate: day, expiryDate: day.optional(),
    terms: optional, dualAuthorization: flag, mode: z.enum(['draft', 'active']).optional(),
  }).parse(req.body);
  res.status(201).json({ items: await escrow.createFacility(body, trace(req)) });
}));
escrowRouter.post('/facilities/:id/status', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: text }).parse(req.body);
  res.json({ items: await escrow.setFacilityStatus(req.params.id, body.status, trace(req)) });
}));
escrowRouter.get('/applications', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listApplications() })));
escrowRouter.get('/applications/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.applicationFile(req.params.id))));
escrowRouter.post('/applications', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    applicant: text, groupId: optional, schoolId: optional, loanApplicationId: optional, product: optional,
    requestedLoan: money, requestedGuarantee: money, guaranteePercent: z.number(), purpose: text, facilityId: optional,
    assetId: optional, accountId: optional, contribution: z.number().optional(), riskInformation: optional, requestedDate: day,
  }).parse(req.body);
  res.status(201).json(await escrow.createApplication(body, trace(req)));
}));
escrowRouter.post('/applications/:id/eligibility', requirePermission('guarantee.write'), asyncHandler(async (req, res) => res.json(await escrow.runEligibility(req.params.id, trace(req)))));
escrowRouter.post('/applications/:id/assessment', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ repaymentCapacity: optional, riskFactors: optional, mitigation: optional, recommended: money, conditions: optional, result: text }).parse(req.body);
  res.json(await escrow.assessApplication(req.params.id, body, trace(req)));
}));
escrowRouter.post('/applications/:id/decision', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['APPROVED', 'DECLINED', 'CONDITIONAL_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'CANCELLED']),
    approvedAmount: z.number().optional(), guaranteePercent: z.number().optional(), fee: z.number().optional(),
    effectiveDate: day.optional(), expiryDate: day.optional(), conditions: optional, reference: optional,
  }).parse(req.body);
  res.json(await escrow.decideApplication(req.params.id, body, trace(req)));
}));
escrowRouter.post('/applications/:id/issue', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ signatory: optional, claimConditions: optional }).parse(req.body);
  res.status(201).json(await escrow.issueGuarantee(req.params.id, body, trace(req)));
}));
escrowRouter.get('/guarantees', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listGuarantees() })));
escrowRouter.get('/guarantees/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.guaranteeFile(req.params.id))));
escrowRouter.post('/guarantees/:id/fees', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ feeType: text, rate: z.number(), baseAmount: money, dueDate: day.optional(), waiver: flag, approval: optional }).parse(req.body);
  res.status(201).json(await escrow.addFee(req.params.id, body, trace(req)));
}));
escrowRouter.post('/guarantees/:id/renewals', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ requestedExpiry: day, renewalFee: z.number().optional(), reason: text, approval: optional }).parse(req.body);
  res.status(201).json(await escrow.renewGuarantee(req.params.id, body, trace(req)));
}));
escrowRouter.post('/guarantees/:id/amendments', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    requestedChange: text, newAmount: z.number().optional(), newExpiry: day.optional(), newPercent: z.number().optional(),
    reason: text, approval: optional, effectiveDate: day,
  }).parse(req.body);
  res.status(201).json(await escrow.amendGuarantee(req.params.id, body, trace(req)));
}));
escrowRouter.post('/guarantees/:id/cancel', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, document: optional }).parse(req.body);
  res.json(await escrow.cancelGuarantee(req.params.id, body, trace(req)));
}));
escrowRouter.post('/guarantees/:id/claims', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    loanId: optional, borrower: text, lender: optional, defaultDate: day.optional(), outstandingPrincipal: z.number().optional(),
    outstandingInterest: z.number().optional(), otherAmount: z.number().optional(), amountClaimed: money, reason: text,
    recoveryActions: optional, claimDate: day,
  }).parse(req.body);
  res.status(201).json(await escrow.submitClaim(req.params.id, body, trace(req)));
}));
escrowRouter.get('/claims/:id', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json(await escrow.claimFile(req.params.id))));
escrowRouter.post('/claims/:id/assessment', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ guaranteeValid: z.boolean(), certificateValid: z.boolean(), loanValid: z.boolean(), defaultVerified: z.boolean(), result: text }).parse(req.body);
  res.json(await escrow.assessClaim(req.params.id, body, trace(req)));
}));
escrowRouter.post('/claims/:id/approval', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ approvedAmount: z.number(), reason: optional, conditions: optional }).parse(req.body);
  res.json(await escrow.approveClaim(req.params.id, body, trace(req)));
}));
escrowRouter.post('/claims/:id/payments', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: money, payee: text, bankAccount: text, paymentMethod: text, paymentReference: optional, externalTransactionId: optional, paymentDate: day,
  }).parse(req.body);
  res.status(201).json(await escrow.payClaim(req.params.id, body, trace(req)));
}));
escrowRouter.post('/claims/:id/recoveries', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: money, source: text, borrower: optional, recoveryDate: day, action: optional, externalTransactionId: optional, paymentMethod: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.recover(req.params.id, body, trace(req)));
}));
escrowRouter.post('/recoveries/:id/allocation', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ principal: z.number(), interest: z.number(), fees: z.number(), costs: z.number() }).parse(req.body);
  res.json(await escrow.splitRecovery(req.params.id, body, trace(req)));
}));

escrowRouter.get('/links', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listLinks() })));
escrowRouter.post('/links', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ groupId: optional, accountId: optional, poolId: optional, facilityId: optional, loanApplicationId: optional, loanId: optional }).parse(req.body);
  res.status(201).json({ items: await escrow.createLink(body, trace(req)) });
}));
escrowRouter.post('/defaults', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    groupId: optional, loanId: optional, loanIds: optional, borrower: text, defaultDate: day, dpd: z.number().int().optional(),
    principal: z.number().optional(), interest: z.number().optional(), fees: z.number().optional(), strategy: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.createDefault(body, trace(req)));
}));
escrowRouter.post('/set-offs', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    accountId: text, loanId: optional, defaultCaseId: optional, amount: money, reason: text, authority: text,
    paymentReference: optional, externalTransactionId: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.setOff(body, trace(req)));
}));
escrowRouter.get('/reconciliation', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listReconciliations() })));
escrowRouter.post('/reconciliation', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    accountId: optional, transactionDate: day, internalId: optional, externalId: optional, amount: z.number(),
    paymentReference: optional, bankName: optional, expectedAmount: z.number(), actualAmount: z.number(),
    exceptionReason: optional, resolution: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.reconcile(body, trace(req)));
}));
escrowRouter.get('/documents', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listDocuments() })));
escrowRouter.post('/documents', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    entityType: text, entityId: text, documentType: text, documentNumber: optional, issueDate: day.optional(),
    expiryDate: day.optional(), fileName: text, comments: optional,
  }).parse(req.body);
  res.status(201).json({ items: await escrow.addDocument(body, trace(req)) });
}));
escrowRouter.post('/documents/:id/verification', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['VERIFIED', 'REJECTED']), comments: optional }).parse(req.body);
  res.json({ items: await escrow.verifyDocument(req.params.id, body, trace(req)) });
}));
escrowRouter.get('/approvals', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listApprovals() })));
escrowRouter.post('/approvals', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    entityType: text, entityId: text, stage: text, requestedAction: text, level: text, decision: text, comments: optional, signature: optional,
  }).parse(req.body);
  res.status(201).json(await escrow.addApproval(body, trace(req)));
}));
escrowRouter.get('/audit', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listAudit() })));
escrowRouter.get('/notices', requirePermission('guarantee.read'), asyncHandler(async (_req, res) => res.json({ items: await escrow.listNotices() })));
escrowRouter.post('/notices', requirePermission('guarantee.write'), asyncHandler(async (req, res) => {
  const body = z.object({ event: text, subject: text, body: text }).parse(req.body);
  res.status(201).json({ items: await escrow.notifyManual(body, trace(req)) });
}));
escrowRouter.get('/reports/:type', requirePermission('guarantee.read'), asyncHandler(async (req, res) => res.json({ items: await escrow.report(req.params.type) })));
