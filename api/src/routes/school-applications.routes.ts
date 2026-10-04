import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import * as schools from '../services/schools.service';
import { acceptUpload, savePendingUpload } from '../services/uploads';

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalText = z.preprocess(blank, z.string().trim().min(1).optional());

const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.');
const count = z.number().int().min(0).max(200000);

const applySchema = z.object({
  rupsaMemberId: optionalText,
  schoolName: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(2),
  schoolType: z.enum(['NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER']),
  ownershipType: z.enum(['PRIVATE', 'PUBLIC', 'GOVERNMENT_AIDED', 'FAITH_BASED', 'COMMUNITY', 'OTHER']),
  dateEstablished: day,
  operatingStatus: z.enum(['OPERATING', 'TEMPORARILY_CLOSED', 'CLOSED']),
  studentCount: count,
  teacherCount: count,
  staffCount: count.optional(),
  taxIdentificationNumber: z.string().trim().min(2),
  registrationCertificateNumber: z.string().trim().min(2),
  registrationDate: day,
  registrationAuthority: z.string().trim().min(2),
  licenseNumber: z.string().trim().min(2),
  licenseExpiryDate: day,
  legalStatus: z.enum(['REGISTERED', 'PROVISIONALLY_REGISTERED', 'LICENSED', 'SUSPENDED', 'OTHER']),
  phone: z.string().trim().min(8),
  alternativePhone: optionalText,
  email: z.string().trim().email(),
  website: optionalText,
  emergencyContact: optionalText,
  address: z.object({
    province: z.string().trim().min(1),
    district: z.string().trim().min(1),
    sector: z.string().trim().min(1),
    cell: z.string().trim().min(1),
    village: z.string().trim().min(1),
    physicalAddress: z.string().trim().min(4),
    gpsCoordinates: optionalText,
    postalAddress: optionalText,
  }),
  representative: z.object({
    fullName: z.string().trim().min(2),
    position: z.enum([
      'Owner',
      'Director',
      'Head Teacher',
      'Administrator',
      'Finance Officer',
      'Authorized Representative',
    ]),
    nationalId: z.string().trim().min(4),
    phone: z.string().trim().min(8),
    email: z.string().trim().email(),
    appointmentDate: day,
  }),
  bankAccount: z.object({
    bankName: z.string().trim().min(2),
    branch: z.string().trim().min(2),
    accountName: z.string().trim().min(2),
    accountNumber: z.string().trim().min(4),
    currency: z.enum(['RWF', 'USD', 'EUR']),
    swiftCode: z.preprocess(blank, z.string().trim().regex(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/).optional()),
  }),
  documents: z.array(z.object({
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
    fileName: z.string().trim().min(1),
    uploadId: optionalText,
  })).min(1),
});

function limiter(limit: number, message: string) {
  return rateLimit({
    windowMs: 10 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          requestId: req.requestId,
        },
      });
    },
  });
}

const uploadLimit = limiter(80, 'Too many files from this network. Try again shortly.');
const applyLimit = limiter(20, 'Too many applications from this network. Try again shortly.');

export const schoolApplicationsRouter = Router();

schoolApplicationsRouter.post(
  '/uploads',
  uploadLimit,
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
