import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import {
  decideMembershipApplication,
  listMembershipApplications,
  publicMembershipStatus,
  submitMembershipApplication,
  verifyMembershipCertificate,
} from '../services/membership.service';
import { asyncHandler } from '../utils/async';

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalText = z.preprocess(blank, z.string().trim().min(1).optional());

const applySchema = z.object({
  schoolName: z.string().trim().min(2),
  registrationNumber: optionalText,
  contactName: z.string().trim().min(2),
  title: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.string().trim().email(),
  address: z.object({
    province: z.string().trim().min(1),
    district: z.string().trim().min(1),
    sector: optionalText,
  }),
  message: optionalText,
});

const decisionSchema = z.object({
  decision: z.enum(['CONFIRMED', 'REJECTED']),
  note: optionalText,
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

export const membershipRouter = Router();

membershipRouter.post(
  '/',
  applyLimit,
  asyncHandler(async (req, res) => {
    const body = applySchema.parse(req.body);
    const created = await submitMembershipApplication(body);
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
