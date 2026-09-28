import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';
import { deliverEmail, noticeEmail } from '../services/mailer';

const createSchema = z.object({
  userId: z.string().optional(),
  email: z.string().trim().email().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'IN_APP']).default('EMAIL'),
  subject: z.string().min(2),
  body: z.string().min(2),
});

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.post(
  '/',
  requirePermission('admin.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const user = body.userId
      ? await prisma.user.findUnique({ where: { publicId: body.userId } })
      : null;
    if (body.userId && !user) {
      throw errors.notFound('USER_NOT_FOUND', 'No user matches that identifier.');
    }
    const recipient = body.email ?? user?.email;
    let status = 'QUEUED';
    let sentAt: Date | null = null;
    if (body.channel === 'EMAIL') {
      if (!recipient) {
        throw errors.unprocessable('EMAIL_REQUIRED', 'An email address is required to send this notice.');
      }
      const sent = await deliverEmail({ to: recipient, ...noticeEmail({ subject: body.subject, body: body.body }) });
      status = sent ? 'SENT' : 'FAILED';
      sentAt = sent ? new Date() : null;
    }
    const notification = await prisma.notification.create({
      data: {
        publicId: await nextPublicId('NTF'),
        userId: user?.id,
        channel: body.channel,
        subject: body.subject,
        body: body.body,
        status,
        sentAt,
      },
    });
    res.status(202).json({
      notificationId: notification.publicId,
      status: notification.status,
      channel: notification.channel,
    });
  }),
);

notificationsRouter.get(
  '/',
  requirePermission('report.read'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.notification.findMany({
      where: req.actor ? { OR: [{ userId: req.actor.id }, { userId: null }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({
      items: rows.map((row) => ({
        notificationId: row.publicId,
        channel: row.channel,
        subject: row.subject,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }),
);
