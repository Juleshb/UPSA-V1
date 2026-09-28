import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as guardians from '../services/guardians.service';

const createSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  nationalId: z.string().optional(),
});

export const guardiansRouter = Router();
guardiansRouter.use(authenticate);

guardiansRouter.post(
  '/',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    const created = await guardians.createGuardian(createSchema.parse(req.body));
    res.status(201).json(created);
  }),
);

guardiansRouter.get(
  '/',
  requirePermission('student.read'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await guardians.listGuardians() });
  }),
);

guardiansRouter.get(
  '/:guardianId',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    res.json(await guardians.getGuardian(req.params.guardianId));
  }),
);
