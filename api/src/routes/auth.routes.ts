import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate } from '../middleware/auth';
import * as auth from '../services/auth.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().min(8).optional(),
  nationalId: z.string().optional(),
  parentalConsent: z.boolean(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const session = await auth.register({ ...body, requestId: req.requestId });
    res.status(201).json(session);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    res.json(await auth.login(body.email, body.password));
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    res.json(await auth.refresh(body.refreshToken));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await auth.me(req.actor!.id));
  }),
);
