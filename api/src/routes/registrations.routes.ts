import fs from 'fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { authenticate, requirePermission } from '../middleware/auth';
import * as registrations from '../services/registrations.service';
import { acceptUpload, savePendingUpload, schoolUploadPath, uploadContentType } from '../services/uploads';

const optionalText = z.string().trim().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const documentSchema = z.object({
  documentType: z.string().trim().min(2),
  documentNumber: optionalText,
  issueDate: day.optional(),
  expiryDate: day.optional(),
  issuingAuthority: optionalText,
  fileName: z.string().trim().min(1),
  uploadId: optionalText,
  comments: optionalText,
});

const createSchema = z.object({
  kind: z.enum(['PARENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR']),
  profile: z.record(z.union([z.string(), z.boolean(), z.number()])),
  documents: z.array(documentSchema).optional(),
});

const verifySchema = z.object({
  result: z.enum(['VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED', 'ESCALATED']),
  identityVerified: z.boolean(),
  documentsVerified: z.boolean(),
  contactVerified: z.boolean(),
  addressVerified: z.boolean(),
  financialVerified: z.boolean(),
  consentCaptured: z.boolean(),
  duplicateChecked: z.boolean(),
  comments: optionalText,
});

const approvalSchema = z.object({
  decision: z.enum(['APPROVE', 'CONDITIONAL', 'MORE_INFORMATION', 'REJECT']),
  conditions: optionalText,
  comments: optionalText,
});

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return {
    actorId: req.actor?.id,
    actorPublicId: req.actor?.publicId,
    requestId: req.requestId,
    ip: req.ip,
  };
}

export const registrationsRouter = Router();
registrationsRouter.use(authenticate);

registrationsRouter.get(
  '/summary',
  requirePermission('school.read'),
  asyncHandler(async (_req, res) => {
    res.json(await registrations.registrationSummary());
  }),
);

registrationsRouter.get(
  '/',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    const query = z.object({
      q: z.string().optional(),
      kind: z.string().optional(),
      status: z.string().optional(),
    }).parse(req.query);
    res.json({ items: await registrations.searchRegistry(query) });
  }),
);

registrationsRouter.post(
  '/uploads',
  requirePermission('school.write'),
  acceptUpload,
  asyncHandler(async (req, res) => {
    res.status(201).json(await savePendingUpload(req.file));
  }),
);

registrationsRouter.post(
  '/',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const created = await registrations.createRegistration(body, trace(req));
    res.status(201).json(created);
  }),
);

registrationsRouter.get(
  '/:registrationId',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    res.json(await registrations.getRegistration(req.params.registrationId));
  }),
);

registrationsRouter.post(
  '/:registrationId/verification',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = verifySchema.parse(req.body);
    res.json(await registrations.verifyRegistration(req.params.registrationId, body, trace(req)));
  }),
);

registrationsRouter.post(
  '/:registrationId/approval',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = approvalSchema.parse(req.body);
    res.json(await registrations.approveRegistration(req.params.registrationId, body, trace(req)));
  }),
);

registrationsRouter.post(
  '/:registrationId/documents',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = documentSchema.parse(req.body);
    res.status(201).json(await registrations.addRegistrationDocument(req.params.registrationId, body, trace(req)));
  }),
);

registrationsRouter.post(
  '/:registrationId/documents/:documentId/review',
  requirePermission('school.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({
      verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
    }).parse(req.body);
    res.json(await registrations.reviewRegistrationDocument(
      req.params.registrationId,
      req.params.documentId,
      body.verificationStatus,
      trace(req),
    ));
  }),
);

registrationsRouter.get(
  '/:registrationId/documents/:documentId/file',
  requirePermission('school.read'),
  asyncHandler(async (req, res) => {
    const file = await registrations.registrationDocumentFile(req.params.registrationId, req.params.documentId);
    const filePath = schoolUploadPath(file.storedName);
    if (!filePath) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
    await fs.access(filePath);
    res.setHeader('Content-Type', uploadContentType(file.storedName));
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
    res.sendFile(filePath);
  }),
);
