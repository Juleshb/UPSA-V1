import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { errors } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import {
  briefingDeskEmail,
  briefingReceivedEmail,
  deliverEmail,
  deskAddress,
} from '../services/mailer';

const messageSchema = z.object({
  name: z.string().trim().min(2),
  organisation: z.string().trim().min(2),
  role: z.string().trim().min(2),
  interest: z.string().trim().min(2),
  email: z.string().trim().email(),
  message: z.string().trim().min(2),
});

const messageLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many messages from this network. Try again shortly.',
        requestId: req.requestId,
      },
    });
  },
});

export const messagesRouter = Router();

messagesRouter.post(
  '/',
  messageLimit,
  asyncHandler(async (req, res) => {
    const body = messageSchema.parse(req.body);
    const email = body.email.trim();
    const confirmationSent = await deliverEmail({
      to: email,
      ...briefingReceivedEmail({
        name: body.name.trim(),
        organisation: body.organisation.trim(),
        interest: body.interest.trim(),
      }),
    });
    const desk = deskAddress();
    const deskSent = desk
      ? await deliverEmail({
        to: desk,
        ...briefingDeskEmail({
          name: body.name.trim(),
          organisation: body.organisation.trim(),
          role: body.role.trim(),
          interest: body.interest.trim(),
          email,
          message: body.message.trim(),
        }),
      })
      : false;
    if (!confirmationSent && !deskSent) {
      throw errors.emailFailed('The briefing request could not be sent by email. Try again shortly.');
    }
    res.status(202).json({
      status: 'SUBMITTED',
      email,
      emailSent: confirmationSent,
    });
  }),
);
