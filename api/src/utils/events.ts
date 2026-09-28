import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const EventTypes = {
  schoolCreated: 'school.created',
  schoolVerified: 'school.verified',
  invoiceCreated: 'invoice.created',
  paymentInitiated: 'PAYMENT.INITIATED',
  paymentCompleted: 'PAYMENT.SUCCESS',
  paymentFailed: 'PAYMENT.FAILED',
  paymentRefunded: 'PAYMENT.REFUNDED',
  paymentReversed: 'PAYMENT.REVERSED',
  settlementCompleted: 'SETTLEMENT.COMPLETED',
  loanApplicationCreated: 'loan.application.created',
  loanApproved: 'loan.approved',
  loanDisbursed: 'loan.disbursed',
  loanRepaymentPosted: 'loan.repayment.posted',
  loanOverdue: 'loan.overdue',
  guaranteeApproved: 'guarantee.approved',
  guaranteeClaimed: 'guarantee.claimed',
} as const;

export async function publishEvent(
  eventType: string,
  aggregateId: string,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.domainEvent.create({
    data: { eventType, aggregateId, payload, processedAt: new Date() },
  });
}

export async function writeAudit(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId,
      metadata: input.metadata,
    },
  });
}
