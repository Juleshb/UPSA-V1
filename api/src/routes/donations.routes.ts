import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import * as donations from '../services/donations';

const optionalText = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const docs = z.array(z.object({
  documentType: z.string().trim().min(2),
  fileName: z.string().trim().min(1),
  notes: optionalText,
})).optional();

const donorBody = z.object({
  donorType: z.enum(['INDIVIDUAL', 'COMPANY', 'ORGANIZATION', 'FOUNDATION', 'INSTITUTION', 'PARTNER', 'ANONYMOUS']),
  name: optionalText,
  organizationName: optionalText,
  registrationNumber: optionalText,
  taxId: optionalText,
  country: optionalText,
  district: optionalText,
  address: optionalText,
  telephone: optionalText,
  email: optionalText,
  website: optionalText,
  contactName: optionalText,
  contactPosition: optionalText,
  contactTelephone: optionalText,
  contactEmail: optionalText,
  contactIdentification: optionalText,
  authorizationLetter: optionalText,
  documents: docs,
  mode: z.enum(['draft', 'register']).default('register'),
});

const checks = {
  identityVerified: z.boolean(),
  organizationVerified: z.boolean(),
  registrationVerified: z.boolean(),
  contactVerified: z.boolean(),
  documentsVerified: z.boolean(),
  complianceVerified: z.boolean(),
  comments: optionalText,
};

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return {
    actorId: req.actor?.id,
    actorPublicId: req.actor?.publicId,
    requestId: req.requestId,
    ip: req.ip,
  };
}

export const donationsRouter = Router();
donationsRouter.use(authenticate);

donationsRouter.get('/summary', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json(await donations.dashboard());
}));

donationsRouter.get('/statement', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({
    donorId: optionalText,
    campaignId: optionalText,
    from: optionalText,
    to: optionalText,
    donationType: optionalText,
    status: optionalText,
    currency: optionalText,
  }).parse(req.query);
  res.json(await donations.statement(query));
}));

donationsRouter.get('/reports/:type', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  res.json({ items: await donations.report(req.params.type) });
}));

donationsRouter.get('/audit', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ donationId: optionalText }).parse(req.query);
  res.json({ items: await donations.listAudits(query.donationId) });
}));

donationsRouter.get('/payments', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optionalText }).parse(req.query);
  res.json({ items: await donations.listPayments(query) });
}));

donationsRouter.get('/receipts', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await donations.listReceipts() });
}));

donationsRouter.get('/messages', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await donations.listMessages() });
}));

donationsRouter.post('/messages', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donorId: z.string().min(2),
    donationId: optionalText,
    campaignId: optionalText,
    communicationType: z.enum(['THANK_YOU', 'DONATION_CONFIRMATION', 'RECEIPT', 'CAMPAIGN_UPDATE', 'IMPACT_REPORT', 'PAYMENT_REMINDER', 'OTHER']),
    channel: z.enum(['SMS', 'EMAIL', 'IN_APP', 'PUSH']),
    subject: z.string().trim().min(2),
    message: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await donations.sendMessage(body, trace(req)));
}));

donationsRouter.get('/agreements', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await donations.listAgreements() });
}));

donationsRouter.post('/agreements', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donorId: z.string().min(2),
    campaignId: optionalText,
    amount: z.number().positive(),
    currency: optionalText,
    purpose: z.string().trim().min(2),
    conditions: z.string().trim().min(2),
    startDate: day,
    endDate: day,
    reportingRequirements: optionalText,
    documents: docs,
    donorRepresentative: optionalText,
    rupsaRepresentative: optionalText,
    accept: z.boolean().optional(),
  }).parse(req.body);
  res.status(201).json(await donations.saveAgreement(body, trace(req)));
}));

donationsRouter.get('/impacts', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await donations.listImpacts() });
}));

donationsRouter.post('/impacts', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donationId: optionalText,
    campaignId: optionalText,
    beneficiaryId: optionalText,
    reportingPeriod: z.string().trim().min(2),
    amountUsed: z.number().min(0),
    currency: optionalText,
    beneficiaryCount: z.number().int().min(0),
    activities: z.string().trim().min(2),
    outputs: z.string().trim().min(2),
    outcomes: z.string().trim().min(2),
    challenges: optionalText,
    evidence: docs,
  }).parse(req.body);
  res.status(201).json(await donations.saveImpact(body, trace(req)));
}));

donationsRouter.get('/donors', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ q: optionalText, status: optionalText, donorType: optionalText }).parse(req.query);
  res.json({ items: await donations.listDonors(query) });
}));

donationsRouter.post('/donors', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = donorBody.parse(req.body);
  res.status(201).json(await donations.saveDonor(body, body.mode, trace(req)));
}));

donationsRouter.get('/donors/:donorId', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  res.json(await donations.getDonor(req.params.donorId));
}));

donationsRouter.patch('/donors/:donorId', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = donorBody.parse(req.body);
  res.json(await donations.updateDonor(req.params.donorId, body, body.mode, trace(req)));
}));

donationsRouter.post('/donors/:donorId/verification', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    result: z.enum(['PENDING', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED']),
    ...checks,
  }).parse(req.body);
  res.json(await donations.verifyDonor(req.params.donorId, body, trace(req)));
}));

donationsRouter.get('/campaigns', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ q: optionalText, status: optionalText }).parse(req.query);
  res.json({ items: await donations.listCampaigns(query) });
}));

donationsRouter.post('/campaigns', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: optionalText,
    name: optionalText,
    description: optionalText,
    campaignType: optionalText,
    purpose: optionalText,
    targetBeneficiary: optionalText,
    manager: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    targetAmount: z.number().optional(),
    currency: optionalText,
    minimumDonation: z.number().optional(),
    maximumDonation: z.number().optional(),
    targetDonors: z.number().int().optional(),
    documents: docs,
    mode: z.enum(['draft', 'save']).default('save'),
  }).parse(req.body);
  res.status(201).json(await donations.saveCampaign(body, body.mode, trace(req)));
}));

donationsRouter.get('/campaigns/:campaignId', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  res.json(await donations.getCampaign(req.params.campaignId));
}));

donationsRouter.patch('/campaigns/:campaignId', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: optionalText,
    name: optionalText,
    description: optionalText,
    campaignType: optionalText,
    purpose: optionalText,
    targetBeneficiary: optionalText,
    manager: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    targetAmount: z.number().optional(),
    currency: optionalText,
    minimumDonation: z.number().optional(),
    maximumDonation: z.number().optional(),
    targetDonors: z.number().int().optional(),
    documents: docs,
    mode: z.enum(['draft', 'save']).default('save'),
  }).parse(req.body);
  res.json(await donations.saveCampaign(body, body.mode, trace(req), req.params.campaignId));
}));

donationsRouter.post('/campaigns/:campaignId/approval', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['APPROVE', 'REJECT']), comments: optionalText }).parse(req.body);
  res.json(await donations.decideCampaign(req.params.campaignId, body, trace(req)));
}));

donationsRouter.post('/campaigns/:campaignId/status', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['PUBLISHED', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'CANCELLED']) }).parse(req.body);
  res.json(await donations.setCampaignStatus(req.params.campaignId, body.status, trace(req)));
}));

donationsRouter.post('/campaigns/:campaignId/budget', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    category: z.enum(['PROGRAM_ACTIVITIES', 'SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'LOGISTICS', 'ADMINISTRATION', 'COMMUNICATION', 'OTHER']),
    approvedBudget: z.number().positive(),
    currency: optionalText,
    amountUsed: z.number().min(0).optional(),
    department: optionalText,
    approvalDate: optionalText,
  }).parse(req.body);
  res.status(201).json(await donations.saveBudget(req.params.campaignId, body, trace(req)));
}));

donationsRouter.post('/campaigns/:campaignId/monitoring', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    reportingPeriod: z.string().trim().min(2),
    activitiesCompleted: z.string().trim().min(2),
    beneficiariesReached: z.number().int().min(0),
    issues: optionalText,
    correctiveActions: optionalText,
  }).parse(req.body);
  res.status(201).json(await donations.saveMonitoring(req.params.campaignId, body, trace(req)));
}));

donationsRouter.get('/pledges', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ q: optionalText, status: optionalText }).parse(req.query);
  res.json({ items: await donations.listPledges(query) });
}));

donationsRouter.post('/pledges', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donorId: z.string().min(2),
    campaignId: z.string().min(2),
    amount: z.number().positive(),
    currency: optionalText,
    pledgeDate: day,
    expectedPaymentDate: optionalText,
    frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'OTHER']),
    purpose: optionalText,
    notes: optionalText,
  }).parse(req.body);
  res.status(201).json(await donations.savePledge(body, trace(req)));
}));

donationsRouter.post('/pledges/:pledgeId/status', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['CANCELLED', 'EXPIRED']) }).parse(req.body);
  res.json(await donations.setPledgeStatus(req.params.pledgeId, body.status, trace(req)));
}));

donationsRouter.get('/beneficiaries', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ q: optionalText, status: optionalText, beneficiaryType: optionalText }).parse(req.query);
  res.json({ items: await donations.listBeneficiaries(query) });
}));

donationsRouter.post('/beneficiaries', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    beneficiaryType: z.enum(['SCHOOL', 'STUDENT', 'FAMILY', 'COMMUNITY', 'INSTITUTION', 'PROJECT', 'PROGRAM', 'OTHER']),
    name: optionalText,
    registrationNumber: optionalText,
    contactPerson: optionalText,
    telephone: optionalText,
    email: optionalText,
    province: optionalText,
    district: optionalText,
    sector: optionalText,
    physicalAddress: optionalText,
    bankName: optionalText,
    bankAccount: optionalText,
    mobileMoneyNumber: optionalText,
    documents: docs,
    mode: z.enum(['draft', 'register']).default('register'),
  }).parse(req.body);
  res.status(201).json(await donations.saveBeneficiary(body, body.mode, trace(req)));
}));

donationsRouter.get('/beneficiaries/:beneficiaryId', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  res.json(await donations.getBeneficiary(req.params.beneficiaryId));
}));

donationsRouter.patch('/beneficiaries/:beneficiaryId', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    beneficiaryType: z.enum(['SCHOOL', 'STUDENT', 'FAMILY', 'COMMUNITY', 'INSTITUTION', 'PROJECT', 'PROGRAM', 'OTHER']),
    name: optionalText,
    registrationNumber: optionalText,
    contactPerson: optionalText,
    telephone: optionalText,
    email: optionalText,
    province: optionalText,
    district: optionalText,
    sector: optionalText,
    physicalAddress: optionalText,
    bankName: optionalText,
    bankAccount: optionalText,
    mobileMoneyNumber: optionalText,
    documents: docs,
    mode: z.enum(['draft', 'register']).default('register'),
  }).parse(req.body);
  res.json(await donations.saveBeneficiary(body, body.mode, trace(req), req.params.beneficiaryId));
}));

donationsRouter.post('/beneficiaries/:beneficiaryId/verification', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['VERIFIED', 'NOT_VERIFIED', 'MORE_INFORMATION_REQUIRED']),
    identityVerified: z.boolean(),
    registrationVerified: z.boolean(),
    locationVerified: z.boolean(),
    eligibilityVerified: z.boolean(),
    documentsVerified: z.boolean(),
    paymentInfoVerified: z.boolean(),
    comments: optionalText,
  }).parse(req.body);
  res.json(await donations.verifyBeneficiary(req.params.beneficiaryId, body, trace(req)));
}));

donationsRouter.get('/allocations', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({ q: optionalText, status: optionalText }).parse(req.query);
  res.json({ items: await donations.listAllocations(query) });
}));

donationsRouter.post('/allocations', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donationId: z.string().min(2),
    beneficiaryId: z.string().min(2),
    allocationDate: day,
    amount: z.number().positive(),
    currency: optionalText,
    purpose: z.string().trim().min(2),
    category: z.enum(['SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'INFRASTRUCTURE', 'EDUCATION_MATERIALS', 'EMERGENCY_SUPPORT', 'COMMUNITY_SUPPORT', 'PROGRAM_SUPPORT', 'OTHER']),
    submit: z.boolean().optional(),
  }).parse(req.body);
  res.status(201).json(await donations.createAllocation(body, trace(req)));
}));

donationsRouter.post('/allocations/:allocationId/approval', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['APPROVE', 'REJECT', 'MORE_INFORMATION']), comments: optionalText }).parse(req.body);
  res.json(await donations.decideAllocation(req.params.allocationId, body, trace(req)));
}));

donationsRouter.post('/allocations/:allocationId/disbursement', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive().optional(),
    paymentMethod: z.enum(['BANK_TRANSFER', 'MOBILE_PAYMENT', 'OTHER']),
    bankAccount: optionalText,
    mobileMoneyNumber: optionalText,
    paymentReference: optionalText,
    paymentDate: optionalText,
    status: z.enum(['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED']).optional(),
    outcome: z.enum(['SUCCESS', 'FAILED']).optional(),
  }).parse(req.body);
  res.status(201).json(await donations.disburse(req.params.allocationId, body, trace(req)));
}));

donationsRouter.post('/allocations/:allocationId/distribution', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    distributionDate: day,
    method: z.enum(['BANK_TRANSFER', 'MOBILE_PAYMENT', 'DIRECT_DELIVERY', 'IN_KIND_DELIVERY', 'OTHER']),
    location: optionalText,
    itemDescription: optionalText,
    beneficiaryConfirmed: z.boolean(),
    confirmationNote: optionalText,
    documents: docs,
  }).parse(req.body);
  res.status(201).json(await donations.distribute(req.params.allocationId, body, trace(req)));
}));

donationsRouter.get('/distributions', requirePermission('donation.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await donations.listDistributions() });
}));

donationsRouter.get('/', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const query = z.object({
    q: optionalText,
    status: optionalText,
    donationType: optionalText,
    queue: optionalText,
  }).parse(req.query);
  res.json({ items: await donations.listDonations(query) });
}));

donationsRouter.post('/', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donorId: z.string().min(2),
    campaignId: optionalText,
    pledgeId: optionalText,
    beneficiaryId: optionalText,
    donationType: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'IN_KIND', 'OTHER']),
    donationDate: optionalText,
    amount: z.number().optional(),
    currency: optionalText,
    purpose: optionalText,
    documents: docs,
    mode: z.enum(['draft', 'submit']).default('submit'),
    inKind: z.object({
      category: optionalText,
      description: optionalText,
      quantity: z.number().optional(),
      unit: optionalText,
      estimatedValue: z.number().optional(),
      condition: optionalText,
      dateReceived: optionalText,
      storageLocation: optionalText,
      intendedBeneficiary: optionalText,
      documents: docs,
    }).optional(),
  }).parse(req.body);
  res.status(201).json(await donations.saveDonation(body, body.mode, trace(req)));
}));

donationsRouter.get('/:donationId', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  res.json(await donations.getDonation(req.params.donationId));
}));

donationsRouter.post('/:donationId/verification', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    result: z.enum(['VERIFIED', 'PENDING', 'MORE_INFORMATION_REQUIRED', 'REJECTED']),
    donorVerified: z.boolean(),
    amountVerified: z.boolean(),
    paymentVerified: z.boolean(),
    campaignVerified: z.boolean(),
    purposeVerified: z.boolean(),
    documentsVerified: z.boolean(),
    beneficiaryVerified: z.boolean(),
    comments: optionalText,
  }).parse(req.body);
  res.json(await donations.verifyDonation(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/valuation', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    valuationMethod: z.string().trim().min(2),
    valuer: optionalText,
    valuationDate: day,
    unitValue: z.number().positive(),
    evidence: optionalText,
    valuedBy: optionalText,
    reviewedBy: optionalText,
    approvedBy: optionalText,
  }).parse(req.body);
  res.json(await donations.saveValuation(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/receive', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  res.json(await donations.receiveInKind(req.params.donationId, trace(req)));
}));

donationsRouter.post('/:donationId/payments', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    paymentMethod: z.string().trim().min(2),
    payerName: optionalText,
    payerPhone: optionalText,
    amount: z.number().positive().optional(),
  }).parse(req.body);
  res.status(201).json(await donations.processPayment(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/payments/:paymentId/confirmation', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    outcome: z.enum(['SUCCESS', 'FAILED']),
    transactionReference: optionalText,
    externalTransactionId: optionalText,
    receivedAmount: z.number().min(0).optional(),
    settlementReference: optionalText,
    settlementDate: optionalText,
  }).parse(req.body);
  res.json(await donations.confirmPayment(req.params.donationId, req.params.paymentId, body, trace(req)));
}));

donationsRouter.post('/:donationId/approval', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'MORE_INFORMATION', 'HOLD']),
    approvedAmount: z.number().positive().optional(),
    conditions: optionalText,
    comments: optionalText,
  }).parse(req.body);
  res.json(await donations.decideDonation(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/release', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  res.json(await donations.releaseHold(req.params.donationId, trace(req)));
}));

donationsRouter.post('/:donationId/cancel', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: optionalText }).parse(req.body ?? {});
  res.json(await donations.cancelDonation(req.params.donationId, body.reason, trace(req)));
}));

donationsRouter.post('/:donationId/close', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  res.json(await donations.closeDonation(req.params.donationId, trace(req)));
}));

donationsRouter.get('/:donationId/receipt.pdf', requirePermission('donation.read'), asyncHandler(async (req, res) => {
  const file = donations.receiptPdf(await donations.getDonation(req.params.donationId));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.donationId}-receipt.pdf"`);
  res.send(file);
}));

donationsRouter.post('/:donationId/receipt/send', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ channel: z.enum(['EMAIL', 'SMS']) }).parse(req.body);
  res.json(await donations.sendReceipt(req.params.donationId, body.channel, trace(req)));
}));

donationsRouter.post('/:donationId/refunds', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    reason: z.string().trim().min(2),
    destination: z.string().trim().min(2),
    originalTransactionReference: optionalText,
    documents: docs,
  }).parse(req.body);
  res.status(201).json(await donations.requestRefund(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/refunds/:refundId', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({ action: z.enum(['REVIEW', 'APPROVE', 'PROCESS', 'COMPLETE', 'REJECT']) }).parse(req.body);
  res.json(await donations.advanceRefund(req.params.donationId, req.params.refundId, body.action, trace(req)));
}));

donationsRouter.post('/:donationId/adjustments', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number(),
    adjustmentType: z.enum(['AMOUNT_CORRECTION', 'CLASSIFICATION_CORRECTION', 'CAMPAIGN_CORRECTION', 'BENEFICIARY_CORRECTION', 'OTHER']),
    reason: z.string().trim().min(2),
    documentName: optionalText,
    campaignId: optionalText,
    beneficiaryId: optionalText,
    donationType: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'IN_KIND', 'OTHER']).optional(),
  }).parse(req.body);
  res.status(201).json(await donations.applyAdjustment(req.params.donationId, body, trace(req)));
}));

donationsRouter.post('/:donationId/compliance', requirePermission('donation.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    donorIdentified: z.boolean(),
    donorVerified: z.boolean(),
    sourceRecorded: z.boolean(),
    approvalsObtained: z.boolean(),
    documentationComplete: z.boolean(),
    beneficiaryVerified: z.boolean(),
    restrictionsRecorded: z.boolean(),
    reportingCompleted: z.boolean(),
    result: z.enum(['COMPLIANT', 'PENDING_REVIEW', 'NON_COMPLIANT', 'ESCALATED']),
    comments: optionalText,
  }).parse(req.body);
  res.status(201).json(await donations.saveCompliance(req.params.donationId, body, trace(req)));
}));
