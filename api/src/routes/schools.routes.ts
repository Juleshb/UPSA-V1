import fs from 'fs/promises';
import { Router } from 'express';
import { RegistrationReviewStatus, SchoolStatus } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { authenticate, requirePermission } from '../middleware/auth';
import { hasPermission } from '../utils/permissions';
import * as schools from '../services/schools.service';
import { acceptUpload, saveSchoolUpload } from '../services/uploads';

const addressSchema = z.object({
  province: z.string().min(1),
  district: z.string().min(1),
  sector: z.string().optional(),
});

const createSchema = z.object({
  rupsaMemberId: z.string().optional(),
  schoolName: z.string().min(2),
  registrationNumber: z.string().min(2),
  taxIdentificationNumber: z.string().optional(),
  phone: z.string().min(8),
  email: z.string().email(),
  address: addressSchema,
});

const updateSchema = z.object({
  schoolName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  rupsaMemberId: z.string().optional(),
  taxIdentificationNumber: z.string().optional(),
});

const personSchema = z.object({
  fullName: z.string().min(2),
  title: z.string().min(2),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  role: z.enum(['MANAGEMENT', 'SIGNATORY']),
});

const ownershipSchema = z.object({
  ownerName: z.string().min(2),
  ownershipPct: z.number().positive().max(100),
  nationalId: z.string().optional(),
});

const bankSchema = z.object({
  bankName: z.string().min(2),
  branch: z.string().min(2).optional(),
  accountName: z.string().min(2),
  accountNumber: z.string().min(4),
  currency: z.string().default('RWF'),
  swiftCode: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const documentSchema = z.object({
  documentType: z.enum([
    'LICENSE',
    'REGISTRATION_CERTIFICATE',
    'TIN_CERTIFICATE',
    'OWNERSHIP_DOCUMENTS',
    'RUPSA_MEMBERSHIP',
    'OWNER_IDENTITY',
    'AUTHORIZATION_LETTER',
    'ID_DOCUMENT',
    'BANK_LETTER',
    'OTHER',
  ]),
  fileName: z.string().min(1),
});

export const schoolsRouter = Router();

schoolsRouter.use(authenticate);

schoolsRouter.post(
  '/',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const created = await schools.createSchool(body, req.actor?.id);
    res.status(201).json(created);
  }),
);

schoolsRouter.get(
  '/',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    const status = req.query.status
      ? z.nativeEnum(SchoolStatus).parse(req.query.status)
      : undefined;
    res.json({ items: await schools.listSchools(status) });
  }),
);

schoolsRouter.get(
  '/uploads',
  requirePermission('admin.write'),
  asyncHandler(async (_req, res) => {
    res.json(await schools.listUploadedDocuments());
  }),
);

schoolsRouter.get(
  '/:schoolId',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    res.json(await schools.getSchool(req.params.schoolId));
  }),
);

schoolsRouter.patch(
  '/:schoolId',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    res.json(await schools.updateSchool(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.get(
  '/:schoolId/financial-profile',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    res.json(await schools.getFinancialProfile(req.params.schoolId));
  }),
);

schoolsRouter.get(
  '/:schoolId/registration',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    res.json(await schools.getRegistration(req.params.schoolId));
  }),
);

schoolsRouter.post(
  '/:schoolId/transition',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.nativeEnum(SchoolStatus) }).parse(req.body);
    const reviewerStep = body.status !== SchoolStatus.SUBMITTED;
    if (reviewerStep && !hasPermission(req.actor!.role, 'admin.write')) {
      throw errors.forbidden('Only a RUPSA reviewer can move this application forward.');
    }
    res.json(await schools.transitionSchool(req.params.schoolId, body.status, req.actor?.id));
  }),
);

schoolsRouter.post(
  '/:schoolId/membership',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({
      decision: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
      rupsaMemberId: z.string().min(3).optional(),
    }).parse(req.body);
    res.json(await schools.decideMembership(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.post(
  '/:schoolId/verification',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({
      status: z.nativeEnum(RegistrationReviewStatus),
      registrationVerified: z.boolean(),
      legalDocumentsVerified: z.boolean(),
      representativeVerified: z.boolean(),
      addressVerified: z.boolean(),
      bankAccountVerified: z.boolean(),
      documentsComplete: z.boolean(),
    }).parse(req.body);
    res.json(await schools.recordRegistrationReview(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.post(
  '/:schoolId/kyc',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({
      kind: z.enum(['KYC', 'KYB']),
      status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
      notes: z.string().optional(),
    }).parse(req.body);
    res.status(201).json(await schools.recordKyc(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.post(
  '/:schoolId/ownership',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = ownershipSchema.parse(req.body);
    res.status(201).json(await schools.addOwnership(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.delete(
  '/:schoolId/ownership/:ownershipId',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    await schools.removeOwnership(req.params.schoolId, req.params.ownershipId, req.actor?.id);
    res.status(204).end();
  }),
);

schoolsRouter.post(
  '/:schoolId/people',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = personSchema.parse(req.body);
    res.status(201).json(await schools.addPerson(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.delete(
  '/:schoolId/people/:personId',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    await schools.removePerson(req.params.schoolId, req.params.personId, req.actor?.id);
    res.status(204).end();
  }),
);

schoolsRouter.post(
  '/:schoolId/bank-accounts',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = bankSchema.parse(req.body);
    res.status(201).json(await schools.addBankAccount(req.params.schoolId, body, req.actor?.id));
  }),
);

schoolsRouter.delete(
  '/:schoolId/bank-accounts/:accountId',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    await schools.removeBankAccount(req.params.schoolId, req.params.accountId, req.actor?.id);
    res.status(204).end();
  }),
);

schoolsRouter.post(
  '/:schoolId/documents',
  requirePermission('school.write'),
  acceptUpload,
  asyncHandler(async (req, res) => {
    const uploaded = req.file ? await saveSchoolUpload(req.file) : null;
    const body = documentSchema.parse({
      documentType: req.body?.documentType,
      fileName: uploaded?.fileName ?? req.body?.fileName,
    });
    res.status(201).json(await schools.addDocument(req.params.schoolId, {
      ...body,
      storedName: uploaded?.storedName,
    }, req.actor?.id));
  }),
);

schoolsRouter.get(
  '/:schoolId/documents/:documentId/file',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const file = await schools.openSchoolDocument(req.params.schoolId, req.params.documentId);
    await fs.access(file.filePath);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
    res.sendFile(file.filePath);
  }),
);

schoolsRouter.post(
  '/:schoolId/documents/:documentId/review',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']) }).parse(req.body);
    res.json(await schools.reviewDocument(req.params.schoolId, req.params.documentId, body.status, req.actor?.id));
  }),
);
