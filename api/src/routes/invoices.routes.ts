import { Router } from 'express';
import { InvoiceStatus } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as invoices from '../services/invoices.service';

const createSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
  currency: z.string().default('RWF'),
  amount: z.number().positive(),
  description: z.string().min(2),
  dueDate: z.string(),
});

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);

invoicesRouter.post(
  '/',
  requirePermission('invoice.write'),
  asyncHandler(async (req, res) => {
    const created = await invoices.createInvoice(createSchema.parse(req.body), req.actor?.id);
    res.status(201).json(created);
  }),
);

invoicesRouter.get(
  '/',
  requirePermission('invoice.read'),
  asyncHandler(async (req, res) => {
    const status = req.query.status
      ? z.nativeEnum(InvoiceStatus).parse(req.query.status)
      : undefined;
    res.json({
      items: await invoices.listInvoices({
        schoolId: typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined,
        studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
        status,
      }, req.actor),
    });
  }),
);

invoicesRouter.get(
  '/:invoiceId',
  requirePermission('invoice.read'),
  asyncHandler(async (req, res) => {
    res.json(await invoices.getInvoice(req.params.invoiceId, req.actor));
  }),
);

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(2).optional(),
  dueDate: z.string().optional(),
});

invoicesRouter.patch(
  '/:invoiceId',
  requirePermission('invoice.write'),
  asyncHandler(async (req, res) => {
    res.json(await invoices.updateInvoice(req.params.invoiceId, updateSchema.parse(req.body), req.actor?.id));
  }),
);

invoicesRouter.delete(
  '/:invoiceId',
  requirePermission('invoice.write'),
  asyncHandler(async (req, res) => {
    res.json(await invoices.cancelInvoice(req.params.invoiceId, req.actor?.id));
  }),
);
