import { ReconciliationStatus, SettlementStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { decimal, money } from '../utils/money';
import { prisma } from '../utils/prisma';
import { FLOW, recordFlow } from './payment-flow';
import { findSchool } from './schools.service';

export async function createSettlement(input: {
  schoolId: string;
  amount: number;
  currency?: string;
  rail: string;
  reference: string;
  paymentIds?: string[];
}, actorId?: string) {
  const school = await findSchool(input.schoolId);
  const existing = await prisma.settlement.findUnique({ where: { reference: input.reference } });
  if (existing) {
    throw errors.conflict('SETTLEMENT_EXISTS', 'A settlement with this reference already exists.');
  }

  const payments = input.paymentIds?.length
    ? await prisma.payment.findMany({
      where: { publicId: { in: input.paymentIds }, status: 'SUCCESS' },
      include: { invoice: true },
    })
    : [];

  if (input.paymentIds?.length && payments.length !== input.paymentIds.length) {
    throw errors.unprocessable(
      'PAYMENT_NOT_SETTLEABLE',
      'Every payment in a settlement must exist and be confirmed.',
    );
  }
  if (payments.some((payment) => payment.invoice.schoolId !== school.id)) {
    throw errors.unprocessable('SETTLEMENT_SCHOOL_MISMATCH', 'Payments must belong to the school being settled.');
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        publicId: await nextPublicId('SET'),
        schoolId: school.id,
        amount: decimal(input.amount),
        currency: input.currency ?? 'RWF',
        rail: input.rail,
        reference: input.reference,
        status: SettlementStatus.COMPLETED,
        settledAt: new Date(),
      },
    });

    for (const payment of payments) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { settlementReference: input.reference },
      });
      await tx.reconciliation.updateMany({
        where: { paymentId: payment.id },
        data: { settlementId: created.id, status: ReconciliationStatus.MATCHED },
      });
      await recordFlow(tx, payment.id, FLOW.PAY_08, input.reference);
    }

    return created;
  });

  await publishEvent(EventTypes.settlementCompleted, settlement.publicId, {
    settlementId: settlement.publicId,
    schoolId: school.publicId,
    reference: settlement.reference,
    paymentIds: payments.map((payment) => payment.publicId),
  });
  await writeAudit({
    actorId,
    action: 'settlement.complete',
    entityType: 'Settlement',
    entityId: settlement.publicId,
  });

  return {
    settlementId: settlement.publicId,
    schoolId: school.publicId,
    amount: money(settlement.amount),
    currency: settlement.currency,
    rail: settlement.rail,
    reference: settlement.reference,
    status: settlement.status,
    settledAt: settlement.settledAt?.toISOString() ?? null,
    paymentIds: payments.map((payment) => payment.publicId),
  };
}

export async function listSettlements() {
  const rows = await prisma.settlement.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    settlementId: row.publicId,
    amount: money(row.amount),
    currency: row.currency,
    rail: row.rail,
    reference: row.reference,
    status: row.status,
    settledAt: row.settledAt?.toISOString() ?? null,
  }));
}

export async function flagReconciliation(reconciliationId: string, input: {
  status: ReconciliationStatus;
  notes?: string;
}, actorId?: string) {
  const row = await prisma.reconciliation.findUnique({
    where: { publicId: reconciliationId },
    include: { payment: true },
  });
  if (!row) throw errors.notFound('RECONCILIATION_NOT_FOUND', 'The requested reconciliation could not be found.');

  const updated = await prisma.reconciliation.update({
    where: { id: row.id },
    data: { status: input.status, notes: input.notes },
  });
  await writeAudit({
    actorId,
    action: 'reconciliation.exception',
    entityType: 'Reconciliation',
    entityId: updated.publicId,
    metadata: { status: input.status },
  });

  return {
    reconciliationId: updated.publicId,
    status: updated.status,
    notes: updated.notes,
    paymentId: row.payment?.publicId ?? null,
  };
}
