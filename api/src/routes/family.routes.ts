import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { familyHome } from '../services/family.service';
import {
  grantParentAuthorization,
  linkStudent,
  listLinkableSchools,
  markNoticesRead,
  previewStudent,
  listParentNotices,
  submitIdentity,
  updateContact,
  updatePreferences,
  withdrawParentAuthorization,
} from '../services/parent.service';
import { subscribeNotices } from '../utils/notices';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';

const contactSchema = z.object({
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().optional(),
});

const identitySchema = z.object({
  nationalId: z.string(),
});

const linkSchema = z.object({
  schoolId: z.string().min(3),
  studentReference: z.string().min(3),
  studentName: z.string().min(3),
  relationship: z.string(),
});

const preferenceSchema = z.object({
  paymentChannel: z.string().optional(),
  originCountry: z.string().length(2).optional(),
  notifyChannel: z.string().optional(),
});

const authorizationSchema = z.object({
  accepted: z.literal(true),
});

export const familyRouter = Router();
familyRouter.use(authenticate);

familyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await familyHome(req.actor!.id));
  }),
);

familyRouter.get(
  '/schools',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.json({ items: await listLinkableSchools() });
  }),
);

familyRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.json({ items: await listParentNotices(req.actor!.id) });
  }),
);

familyRouter.get('/notifications/stream', (req, res, next) => {
  void (async () => {
    try {
      assertParent(req.actor!.role);
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      const send = (event: unknown) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };
      send({ type: 'ready' });
      const unsubscribe = subscribeNotices(req.actor!.id, send);
      const heartbeat = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);
      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (error) {
      next(error);
    }
  })();
});

familyRouter.post(
  '/notifications/read',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    const body = z.object({
      notificationIds: z.array(z.string().min(3)).max(50).optional(),
    }).parse(req.body ?? {});
    res.json({ items: await markNoticesRead(req.actor!.id, body.notificationIds) });
  }),
);

familyRouter.patch(
  '/contact',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.json(await updateContact(req.actor!.id, contactSchema.parse(req.body)));
  }),
);

familyRouter.post(
  '/identity',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    const body = identitySchema.parse(req.body);
    res.json(await submitIdentity(req.actor!.id, body.nationalId));
  }),
);

familyRouter.get(
  '/students/lookup',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    const schoolId = z.string().min(3).parse(req.query.schoolId);
    const reference = z.string().min(3).parse(req.query.reference);
    res.json(await previewStudent(req.actor!.id, schoolId, reference));
  }),
);

familyRouter.post(
  '/students',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.status(201).json(await linkStudent(req.actor!.id, linkSchema.parse(req.body)));
  }),
);

familyRouter.patch(
  '/preferences',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.json(await updatePreferences(req.actor!.id, preferenceSchema.parse(req.body)));
  }),
);

familyRouter.post(
  '/authorization',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    authorizationSchema.parse(req.body);
    res.status(201).json(await grantParentAuthorization(req.actor!.id, req.requestId));
  }),
);

familyRouter.post(
  '/authorization/withdraw',
  asyncHandler(async (req, res) => {
    assertParent(req.actor!.role);
    res.json(await withdrawParentAuthorization(req.actor!.id));
  }),
);

function assertParent(role: string) {
  if (role !== 'PARENT') {
    throw errors.forbidden('This action is for parent and guardian accounts.');
  }
}
