import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import * as schools from '../services/schools.service';
import { acceptUpload, savePendingUpload } from '../services/uploads';

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalText = z.preprocess(blank, z.string().trim().min(1).optional());
const optionalEmail = z.preprocess(blank, z.string().trim().email().optional());

const personSchema = z.object({
  fullName: z.string().trim().min(2),
  title: z.string().trim().min(2),
  phone: optionalText,
  email: optionalEmail,
});

const applySchema = z.object({
  rupsaMemberId: optionalText,
  schoolName: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(2),
  taxIdentificationNumber: optionalText,
  phone: z.string().trim().min(8),
  email: z.string().trim().email(),
  address: z.object({
    province: z.string().trim().min(1),
    district: z.string().trim().min(1),
    sector: optionalText,
  }),
  owners: z.array(z.object({
    ownerName: z.string().trim().min(2),
    ownershipPct: z.number().positive().max(100),
    nationalId: optionalText,
  })).min(1),
  management: z.array(personSchema).min(1),
  signatories: z.array(personSchema).min(1),
  bankAccount: z.object({
    bankName: z.string().trim().min(2),
    accountName: z.string().trim().min(2),
    accountNumber: z.string().trim().min(4),
    currency: z.string().trim().min(3).default('RWF'),
  }),
  documents: z.array(z.object({
    documentType: z.enum([
      'LICENSE',
      'REGISTRATION_CERTIFICATE',
      'TIN_CERTIFICATE',
      'RUPSA_MEMBERSHIP',
      'OWNER_IDENTITY',
      'BANK_LETTER',
      'OTHER',
    ]),
    fileName: z.string().trim().min(1),
    uploadId: optionalText,
  })).min(1),
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
        message: 'Too many applications from this network. Try again shortly.',
        requestId: req.requestId,
      },
    });
  },
});

export const schoolApplicationsRouter = Router();

schoolApplicationsRouter.post(
  '/uploads',
  applyLimit,
  acceptUpload,
  asyncHandler(async (req, res) => {
    res.status(201).json(await savePendingUpload(req.file));
  }),
);

schoolApplicationsRouter.post(
  '/',
  applyLimit,
  asyncHandler(async (req, res) => {
    const body = applySchema.parse(req.body);
    const created = await schools.submitPublicApplication(body);
    res.status(201).json(created);
  }),
);

schoolApplicationsRouter.get(
  '/:schoolId/status',
  asyncHandler(async (req, res) => {
    const email = z.string().trim().email().parse(req.query.email);
    res.json(await schools.publicApplicationStatus(req.params.schoolId, email));
  }),
);

schoolApplicationsRouter.post(
  '/:schoolId/membership',
  applyLimit,
  asyncHandler(async (req, res) => {
    const body = z.object({
      email: z.string().trim().email(),
      membershipReference: z.string().trim().min(3),
    }).parse(req.body);
    res.json(await schools.linkPublicMembership(req.params.schoolId, body.email, body.membershipReference));
  }),
);
