import fs from 'fs/promises';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import {
  applicationDocumentFile,
  decideMembershipApplication,
  listMembershipApplications,
  publicMembershipCategories,
  publicMembershipStatus,
  submitMembershipApplication,
  verifyMembershipCertificate,
} from '../services/membership.service';
import { acceptUpload, savePendingUpload, schoolUploadPath, uploadContentType } from '../services/uploads';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalText = z.preprocess(blank, z.string().trim().min(1).optional());

const applySchema = z.object({
  schoolName: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(2),
  categoryCode: z.string().trim().min(2),
  institutionType: z.string().trim().min(2),
  dateEstablished: optionalText,
  studentCount: z.number().int().nonnegative().optional(),
  staffCount: z.number().int().nonnegative().optional(),
  contactName: z.string().trim().min(2),
  title: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.string().trim().email(),
  website: optionalText,
  postalAddress: optionalText,
  alternativePhone: optionalText,
  registrationCertificateNumber: z.string().trim().min(2),
  registrationDate: optionalText,
  taxIdentificationNumber: optionalText,
  issuingAuthority: optionalText,
  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNumber: optionalText,
  bankBranch: optionalText,
  currency: optionalText,
  representativeNationalId: optionalText,
  representativePhone: z.string().trim().min(8),
  representativeEmail: z.string().trim().email(),
  address: z.object({
    province: z.string().trim().min(1),
    district: z.string().trim().min(1),
    sector: z.string().trim().min(1),
    cell: z.string().trim().min(1),
    village: optionalText,
    physicalAddress: z.string().trim().min(2),
  }),
  documents: z.array(z.object({
    documentType: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    uploadId: z.string().trim().min(1),
  })).min(1),
  message: optionalText,
  payment: z.object({
    paymentMethod: z.string().trim().min(1),
    payerName: z.string().trim().min(2),
    payerPhone: optionalText,
    paymentReference: optionalText,
    externalTransactionId: optionalText,
  }).optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['CONFIRMED', 'REJECTED']),
  note: optionalText,
});

const uploadLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many files from this network. Try again shortly.',
        requestId: req.requestId,
      },
    });
  },
});

const applyLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many membership requests from this network. Try again shortly.',
        requestId: req.requestId,
      },
    });
  },
});

async function sendStored(res: import('express').Response, storedName: string, fileName: string) {
  const filePath = schoolUploadPath(storedName);
  if (!filePath) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  await fs.access(filePath);
  res.setHeader('Content-Type', uploadContentType(storedName));
  res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
  res.sendFile(filePath);
}

export const membershipRouter = Router();

membershipRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(await publicMembershipCategories());
  }),
);

membershipRouter.post(
  '/uploads',
  uploadLimit,
  acceptUpload,
  asyncHandler(async (req, res) => {
    res.status(201).json(await savePendingUpload(req.file));
  }),
);

membershipRouter.post(
  '/',
  applyLimit,
  asyncHandler(async (req, res) => {
    const body = applySchema.parse(req.body);
    const created = await submitMembershipApplication(body, { requestId: req.requestId, ip: req.ip });
    res.status(201).json(created);
  }),
);

membershipRouter.get(
  '/',
  authenticate,
  requirePermission('school.read'),
  asyncHandler(async (_req, res) => {
    res.json(await listMembershipApplications());
  }),
);

membershipRouter.get(
  '/verify/:code',
  asyncHandler(async (req, res) => {
    res.json(await verifyMembershipCertificate(req.params.code));
  }),
);

membershipRouter.get(
  '/:applicationId/documents/:documentId/file',
  authenticate,
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    const file = await applicationDocumentFile(req.params.applicationId, req.params.documentId);
    await sendStored(res, file.storedName, file.fileName);
  }),
);

membershipRouter.get(
  '/:applicationId/status',
  asyncHandler(async (req, res) => {
    const email = z.string().trim().email().parse(req.query.email);
    res.json(await publicMembershipStatus(req.params.applicationId, email));
  }),
);

membershipRouter.post(
  '/:applicationId/decision',
  authenticate,
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = decisionSchema.parse(req.body);
    res.json(await decideMembershipApplication(req.params.applicationId, body, req.actor?.id));
  }),
);
