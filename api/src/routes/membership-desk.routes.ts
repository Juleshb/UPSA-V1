import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import { authenticate, requirePermission } from '../middleware/auth';
import { acceptUpload, savePendingUpload, schoolUploadPath, uploadContentType } from '../services/uploads';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import * as membership from '../services/membership';

const text = z.string().trim().min(1);
const optional = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const flag = z.boolean();

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

export const membershipDeskRouter = Router();
membershipDeskRouter.use(authenticate);

membershipDeskRouter.get('/summary', requirePermission('school.read'), asyncHandler(async (_req, res) => res.json(await membership.dashboard())));
membershipDeskRouter.get('/categories', requirePermission('school.read'), asyncHandler(async (_req, res) => res.json({ items: await membership.listCategories() })));
membershipDeskRouter.post('/categories', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: text, name: text, description: optional, eligibility: optional, membershipFee: z.number().nonnegative(),
    renewalFee: z.number().nonnegative(), periodMonths: z.number().int().positive(), effectiveDate: day, approvalRequired: flag.optional(),
  }).parse(req.body);
  res.status(201).json(await membership.saveCategory(body, trace(req)));
}));
membershipDeskRouter.post('/categories/:id/requirements', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ documentType: text, mandatory: flag, verificationRequired: flag }).parse(req.body);
  res.status(201).json(await membership.saveRequirement(req.params.id, body, trace(req)));
}));
membershipDeskRouter.get('/members', requirePermission('school.read'), asyncHandler(async (req, res) => {
  const query = z.object({ status: optional, q: optional }).parse(req.query);
  res.json({ items: await membership.listMembers(query) });
}));
membershipDeskRouter.get('/members/:id', requirePermission('school.read'), asyncHandler(async (req, res) => res.json(await membership.memberFile(req.params.id))));
membershipDeskRouter.post('/members', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    mode: optional, schoolId: optional, categoryCode: text, institutionName: text, registrationNumber: text, institutionType: text,
    dateEstablished: day.optional(), studentCount: z.number().int().nonnegative().optional(), staffCount: z.number().int().nonnegative().optional(),
    province: text, district: text, sector: text, cell: text, village: optional, physicalAddress: text,
    phone: text, email: z.string().email(), website: optional, postalAddress: optional, alternativePhone: optional,
    registrationCertificateNumber: text, registrationDate: day.optional(), taxIdentificationNumber: optional, issuingAuthority: optional,
    bankName: optional, bankAccountName: optional, bankAccountNumber: optional, bankBranch: optional, currency: optional,
    representativeName: text, representativePosition: text, representativeNationalId: optional, representativePhone: text, representativeEmail: z.string().email(),
  }).parse(req.body);
  res.status(201).json(await membership.registerMember(body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/application', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    reason: text, referredBy: optional, accurate: flag, termsAccepted: flag, verifyAuthorized: flag, applicationDate: day.optional(),
  }).parse(req.body);
  res.status(201).json(await membership.submitApplication(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/uploads', requirePermission('school.write'), acceptUpload, asyncHandler(async (req, res) => {
  res.status(201).json(await savePendingUpload(req.file));
}));
membershipDeskRouter.post('/members/:id/documents', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    documentType: text, documentNumber: optional, issueDate: day.optional(), expiryDate: day.optional(), issuingAuthority: optional, fileName: text, uploadId: optional,
  }).parse(req.body);
  res.status(201).json(await membership.addDocument(req.params.id, body, trace(req)));
}));
membershipDeskRouter.get('/members/:id/documents/:documentId/file', requirePermission('school.read'), asyncHandler(async (req, res) => {
  const file = await membership.memberDocumentFile(req.params.id, req.params.documentId);
  const filePath = schoolUploadPath(file.storedName);
  if (!filePath) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  await fs.access(filePath);
  res.setHeader('Content-Type', uploadContentType(file.storedName));
  res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
  res.sendFile(filePath);
}));
membershipDeskRouter.post('/members/:id/documents/:documentId', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: text, comment: optional }).parse(req.body);
  res.json(await membership.reviewDocument(req.params.id, req.params.documentId, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/verification', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    registrationVerified: flag, nameVerified: flag, numberVerified: flag, addressVerified: flag, legalVerified: flag,
    identityVerified: flag, authorityVerified: flag, contactVerified: flag, bankVerified: flag, bankBelongsToInstitution: flag,
    result: z.enum(['PENDING', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED']), comments: optional,
  }).parse(req.body);
  res.json(await membership.verifyMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/decision', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ decision: z.enum(['APPROVE', 'CONDITIONAL', 'MORE_INFORMATION', 'REJECT']), comment: optional, conditions: optional }).parse(req.body);
  res.json(await membership.decideMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/fees', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    feeType: text, financialYear: text, amount: z.number().nonnegative(), discount: z.number().nonnegative().optional(),
    penalty: z.number().nonnegative().optional(), dueDate: day.optional(),
  }).parse(req.body);
  res.status(201).json(await membership.createFee(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/payments', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    feeId: text, amount: z.number().positive(), paymentMethod: text, payerName: text, payerPhone: optional,
    paymentReference: optional, externalTransactionId: optional, paymentDate: day.optional(),
  }).parse(req.body);
  res.status(201).json(await membership.payFee(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/renewals', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    discount: z.number().nonnegative().optional(), penalty: z.number().nonnegative().optional(),
    informationConfirmed: flag, documentsValid: flag, requirementsMet: flag, feePaid: flag,
  }).parse(req.body);
  res.status(201).json(await membership.renewMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/changes', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    institutionName: optional, physicalAddress: optional, phone: optional, email: optional, representativeName: optional,
    bankName: optional, bankAccountName: optional, bankAccountNumber: optional, studentCount: z.number().int().nonnegative().optional(),
    staffCount: z.number().int().nonnegative().optional(), taxIdentificationNumber: optional, reason: text,
  }).parse(req.body);
  res.status(201).json(await membership.updateProfile(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/suspension', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    decision: z.enum(['SUSPEND', 'CANCEL', 'KEEP_ACTIVE']), reason: text, effectiveDate: day, reviewDate: day.optional(), evidence: optional, comments: optional,
  }).parse(req.body);
  res.status(201).json(await membership.suspendMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/reactivation', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, requirements: optional, documentsVerified: flag, reactivationDate: day }).parse(req.body);
  res.status(201).json(await membership.reactivateMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.post('/members/:id/termination', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: text, effectiveDate: day, refundDue: z.number().nonnegative().optional(), evidence: optional, confirmed: flag }).parse(req.body);
  res.status(201).json(await membership.terminateMember(req.params.id, body, trace(req)));
}));
membershipDeskRouter.get('/reports/:type', requirePermission('school.read'), asyncHandler(async (req, res) => res.json({ items: await membership.report(req.params.type) })));
membershipDeskRouter.get('/notices', requirePermission('school.read'), asyncHandler(async (_req, res) => res.json({ items: await membership.listNotices() })));
membershipDeskRouter.post('/notices', requirePermission('school.write'), asyncHandler(async (req, res) => {
  const body = z.object({ memberId: optional, event: text, channel: text, subject: text, body: text }).parse(req.body);
  res.status(201).json(await membership.sendNotice(body, trace(req)));
}));
membershipDeskRouter.get('/audit', requirePermission('school.read'), asyncHandler(async (_req, res) => res.json({ items: await membership.listAudit() })));
