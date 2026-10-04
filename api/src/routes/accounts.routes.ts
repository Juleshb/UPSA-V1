import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import * as accounts from '../services/accounts.service';
import { asyncHandler } from '../utils/async';

const optionalText = z.string().trim().optional();
const docs = z.array(z.object({ documentType: z.string().trim().min(2), fileName: z.string().trim().min(1), notes: optionalText })).optional();
const accountType = z.enum(['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER']);

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

const applicationBody = z.object({
  mode: z.enum(['draft', 'submit']),
  accountType,
  channel: z.string().trim().min(2),
  referral: optionalText,
  purpose: optionalText,
  language: optionalText,
  communicationPreference: optionalText,
  digitalAccess: z.boolean().optional(),
  mobileAccess: z.boolean().optional(),
  webAccess: z.boolean().optional(),
  applicantName: z.string().trim().min(2),
  identityNumber: optionalText,
  phone: z.string().trim().min(6),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  country: optionalText,
  province: optionalText,
  district: optionalText,
  sector: optionalText,
  cell: optionalText,
  village: optionalText,
  address: optionalText,
  partyId: optionalText,
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  dataConsent: z.boolean().optional(),
  consentVersion: optionalText,
  documents: docs,
  profile: z.record(z.string(), z.string()).optional(),
});

export const accountsRouter = Router();
accountsRouter.use(authenticate);

accountsRouter.get('/summary', requirePermission('account.read'), asyncHandler(async (req, res) => {
  res.json(await accounts.summary(trace(req)));
}));
accountsRouter.get('/parties', requirePermission('account.read'), asyncHandler(async (req, res) => {
  const query = z.object({ type: accountType }).parse(req.query);
  res.json(await accounts.listParties(query.type));
}));
accountsRouter.get('/reports/:type', requirePermission('account.read'), asyncHandler(async (req, res) => {
  res.json({ items: await accounts.report(req.params.type) });
}));
accountsRouter.get('/audit', requirePermission('account.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await accounts.listAudits() });
}));
accountsRouter.get('/messages', requirePermission('account.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await accounts.listMessages() });
}));
accountsRouter.post('/messages', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    accountId: optionalText,
    kind: z.string().trim().min(2),
    channel: z.string().trim().min(2),
    subject: z.string().trim().min(2),
    message: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await accounts.sendMessage(body, trace(req)));
}));
accountsRouter.get('/', requirePermission('account.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optionalText, accountType: optionalText, q: optionalText, queue: optionalText }).parse(req.query);
  res.json({ items: await accounts.list(query) });
}));
accountsRouter.post('/', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = applicationBody.parse(req.body);
  res.status(201).json(await accounts.save({ ...body, email: body.email || undefined }, trace(req)));
}));

accountsRouter.get('/:accountId/statement', requirePermission('account.read'), asyncHandler(async (req, res) => {
  res.json(await accounts.statement(req.params.accountId));
}));
accountsRouter.get('/:accountId', requirePermission('account.read'), asyncHandler(async (req, res) => {
  res.json(await accounts.get(req.params.accountId));
}));
accountsRouter.post('/:accountId', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = applicationBody.parse(req.body);
  res.json(await accounts.save({ ...body, email: body.email || undefined }, trace(req), req.params.accountId));
}));
accountsRouter.post('/:accountId/documents', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ verified: z.boolean(), comments: optionalText, documents: docs }).parse(req.body);
  res.json(await accounts.reviewDocuments(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/kyc', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    result: z.enum(['VERIFIED', 'REJECTED']),
    notes: optionalText,
    checks: z.record(z.string(), z.boolean()),
  }).parse(req.body);
  res.json(await accounts.saveKyc(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/contacts', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    phoneStatus: z.string(),
    emailStatus: z.string(),
    addressStatus: z.string(),
    reference: z.string().trim().min(3),
  }).parse(req.body);
  res.json(await accounts.verifyContacts(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/duplicates', requirePermission('account.write'), asyncHandler(async (req, res) => {
  res.json(await accounts.checkDuplicates(req.params.accountId, trace(req)));
}));
accountsRouter.post('/:accountId/duplicates/clear', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ note: z.string().trim().min(5) }).parse(req.body);
  res.json(await accounts.clearDuplicate(req.params.accountId, body.note, trace(req)));
}));
accountsRouter.post('/:accountId/party', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ partyId: z.string().trim().min(3) }).parse(req.body);
  res.json(await accounts.linkParty(req.params.accountId, body.partyId, trace(req)));
}));
accountsRouter.post('/:accountId/risk', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    notes: z.string().trim().min(5),
    complianceResult: z.enum(['CLEAR', 'REVIEW', 'FAILED']),
  }).parse(req.body);
  res.json(await accounts.saveRisk(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/decision', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['APPROVE', 'CONDITIONAL', 'REJECT', 'MORE_INFORMATION']),
    conditions: optionalText,
    reason: optionalText,
  }).parse(req.body);
  res.json(await accounts.decide(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/activation', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().trim().min(3),
    mfaMethod: z.enum(['APP', 'SMS', 'EMAIL']),
    dailyLimit: z.number().min(0).optional(),
    transactionLimit: z.number().min(0).optional(),
  }).parse(req.body);
  res.json(await accounts.activate(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/suspension', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(5) }).parse(req.body);
  res.json(await accounts.suspend(req.params.accountId, body.reason, trace(req)));
}));
accountsRouter.post('/:accountId/reactivation', requirePermission('account.write'), asyncHandler(async (req, res) => {
  res.json(await accounts.reactivate(req.params.accountId, trace(req)));
}));
accountsRouter.post('/:accountId/dormancy', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: optionalText }).parse(req.body ?? {});
  res.json(await accounts.markDormantAccount(req.params.accountId, body.reason, trace(req)));
}));
accountsRouter.post('/:accountId/hold', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ active: z.boolean(), reason: optionalText }).parse(req.body);
  res.json(await accounts.setHold(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/closure', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(5) }).parse(req.body);
  res.json(await accounts.close(req.params.accountId, body.reason, trace(req)));
}));
accountsRouter.post('/:accountId/changes', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ field: z.string().trim().min(2), value: z.string().trim().min(1), reason: z.string().trim().min(5) }).parse(req.body);
  res.json(await accounts.requestChange(req.params.accountId, body, trace(req)));
}));
accountsRouter.post('/:accountId/devices', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2) }).parse(req.body);
  res.json(await accounts.registerDevice(req.params.accountId, body.name, trace(req)));
}));
accountsRouter.post('/:accountId/students', requirePermission('account.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    studentPublicId: z.string().trim().min(3),
    relationship: z.string().trim().min(2),
    financialResponsibility: z.boolean().optional(),
    paymentAuthorization: z.boolean().optional(),
  }).parse(req.body);
  res.json(await accounts.linkStudent(req.params.accountId, body, trace(req)));
}));
