import { Router } from 'express';
import { asyncHandler } from '../utils/async';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';

export const institutionsRouter = Router();
institutionsRouter.use(authenticate);

institutionsRouter.get(
  '/',
  requirePermission('loan.read'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.financialInstitution.findMany({ orderBy: { name: 'asc' } });
    res.json({
      items: rows.map((row) => ({
        financialInstitutionId: row.publicId,
        name: row.name,
        type: row.type,
        clientId: row.clientId,
        status: row.status,
        webhookUrl: row.webhookUrl,
      })),
    });
  }),
);
