import { PaymentStatus, Prisma, ReconciliationStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { add, decimal, money, sub } from '../utils/money';
import { prisma } from '../utils/prisma';
import { assertParentOwnsStudent, parentStudentScope, type AccessActor } from './family.service';
import { findInvoice, invoiceStatusFor } from './invoices.service';
import { refreshStudentAccount } from './students.service';
import { notifyFeeReceipt } from './parent.service';
import {
  BUS_EVENTS,
  FLOW,
  MAX_PAYMENT_RETRIES,
  paymentGraph,
  recordFlow,
  routeInstruction,
  serializeCorridor,
  serializeRail,
} from './payment-flow';

const countryCode = (value: string | undefined, fallback: string) =>
  (value ?? fallback).trim().toUpperCase();

export async function initiatePayment(input: {
  invoiceId: string;
  amount: number;
  currency?: string;
  paymentChannel: Parameters<typeof routeInstruction>[0]['channel'];
  payerReference?: string;
  originCountry?: string;
  destinationCountry?: string;
  idempotencyKey?: string;
}, actorId?: string) {
  const invoice = await findInvoice(input.invoiceId);
  if (invoice.status === 'CANCELLED' || invoice.status === 'WRITTEN_OFF') {
    throw errors.unprocessable('INVOICE_NOT_PAYABLE', 'This invoice cannot accept payments.');
  }
  if (input.amount > money(invoice.balance)) {
    throw errors.unprocessable('AMOUNT_EXCEEDS_BALANCE', 'Payment amount exceeds the invoice balance.');
  }

  if (input.idempotencyKey) {
    const replay = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: paymentGraph,
    });
    if (replay) return serialize(replay);
  }

  const originCountry = countryCode(input.originCountry, 'RW');
  const destinationCountry = countryCode(input.destinationCountry, 'RW');
  const route = await routeInstruction({
    channel: input.paymentChannel,
    originCountry,
    destinationCountry,
  });

  const publicId = await nextPublicId('PAY');
  const instructionRef = `INS-${publicId}`;
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        publicId,
        invoiceId: invoice.id,
        amount: decimal(input.amount),
        currency: input.currency ?? invoice.currency,
        paymentChannel: input.paymentChannel,
        payerReference: input.payerReference,
        status: PaymentStatus.INITIATED,
        idempotencyKey: input.idempotencyKey,
        railId: route.rail.id,
        corridorId: route.corridor?.id,
        originCountry,
        destinationCountry,
        flowCode: FLOW.PAY_01.code,
        instructionRef,
      },
    });

    await recordFlow(tx, created.id, FLOW.PAY_01, `Request for invoice ${invoice.publicId}`);
    await recordFlow(
      tx,
      created.id,
      FLOW.PAY_02,
      `Instruction ${instructionRef} routed to ${route.rail.name} (${route.rail.infrastructure})`,
    );
    if (route.corridor) {
      await recordFlow(
        tx,
        created.id,
        FLOW.PAY_16,
        `${route.corridor.originLabel} ↔ ${route.corridor.destinationLabel}`,
      );
    }

    return tx.payment.findUniqueOrThrow({ where: { id: created.id }, include: paymentGraph });
  });

  await publishEvent(EventTypes.paymentInitiated, payment.publicId, {
    paymentId: payment.publicId,
    invoiceId: invoice.publicId,
    amount: input.amount,
    flowCode: payment.flowCode,
    rail: route.rail.code,
    corridor: route.corridor?.code ?? null,
  });
  await writeAudit({
    actorId,
    action: 'payment.initiate',
    entityType: 'Payment',
    entityId: payment.publicId,
    metadata: { rail: route.rail.code, flowCode: payment.flowCode },
  });

  return serialize(payment);
}

export async function retryPayment(paymentId: string, actorId?: string) {
  const payment = await findPayment(paymentId);
  if (payment.status !== PaymentStatus.FAILED) {
    throw errors.unprocessable('RETRY_NOT_ALLOWED', 'Only a failed payment can be retried.');
  }
  if (payment.retryCount >= MAX_PAYMENT_RETRIES) {
    throw errors.unprocessable('RETRY_EXHAUSTED', 'This payment has used its retry limit.');
  }

  const route = await routeInstruction({
    channel: payment.paymentChannel,
    originCountry: payment.originCountry,
    destinationCountry: payment.destinationCountry,
    excludeRailIds: payment.railId ? [payment.railId] : [],
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.INITIATED,
        railId: route.rail.id,
        retryCount: { increment: 1 },
        lastError: null,
      },
    });
    await recordFlow(
      tx,
      payment.id,
      FLOW.PAY_02,
      route.switched
        ? `Switched to ${route.rail.name} after ${payment.lastError ?? 'a rail error'}`
        : `Retry routed to ${route.rail.name}`,
    );
    return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: paymentGraph });
  });

  await publishEvent(EventTypes.paymentInitiated, updated.publicId, {
    paymentId: updated.publicId,
    flowCode: FLOW.PAY_02.code,
    rail: route.rail.code,
    retryCount: updated.retryCount,
  });
  await writeAudit({
    actorId,
    action: 'payment.retry',
    entityType: 'Payment',
    entityId: updated.publicId,
    metadata: { rail: route.rail.code, retryCount: updated.retryCount },
  });

  return serialize(updated);
}

export async function refundPayment(paymentId: string, actorId?: string) {
  return closePayment(paymentId, 'refund', actorId);
}

export async function reversePayment(paymentId: string, actorId?: string) {
  return closePayment(paymentId, 'reverse', actorId);
}

async function closePayment(paymentId: string, action: 'refund' | 'reverse', actorId?: string) {
  const payment = await findPayment(paymentId);
  if (payment.status !== PaymentStatus.SUCCESS) {
    throw errors.unprocessable(
      'PAYMENT_NOT_SETTLED_TO_LEDGER',
      'Only a confirmed payment can be refunded or reversed.',
    );
  }

  const step = action === 'refund' ? FLOW.PAY_06 : FLOW.PAY_07;
  const nextStatus = action === 'refund' ? PaymentStatus.REFUNDED : PaymentStatus.REVERSED;
  const updated = await prisma.$transaction(async (tx) => {
    await unwindLedger(tx, payment);
    await tx.payment.update({ where: { id: payment.id }, data: { status: nextStatus } });
    await tx.reconciliation.updateMany({
      where: { paymentId: payment.id },
      data: { status: ReconciliationStatus.REFUNDED, notes: step.label },
    });
    await recordFlow(tx, payment.id, step, step.label);
    return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: paymentGraph });
  });

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
  await refreshStudentAccount(invoice.studentId);

  await publishEvent(
    action === 'refund' ? EventTypes.paymentRefunded : EventTypes.paymentReversed,
    updated.publicId,
    { paymentId: updated.publicId, flowCode: step.code },
  );
  await writeAudit({
    actorId,
    action: action === 'refund' ? 'payment.refund' : 'payment.reverse',
    entityType: 'Payment',
    entityId: updated.publicId,
  });

  return serialize(updated);
}

export async function getPayment(paymentId: string, actor?: AccessActor) {
  const payment = await findPayment(paymentId);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
  await assertParentOwnsStudent(actor, invoice.studentId, {
    code: 'PAYMENT_NOT_FOUND',
    message: 'The requested payment could not be found.',
  });
  return serialize(payment);
}

export async function listPayments(invoiceId?: string, actor?: AccessActor) {
  const invoice = invoiceId ? await findInvoice(invoiceId) : null;
  if (invoice) {
    await assertParentOwnsStudent(actor, invoice.studentId, {
      code: 'INVOICE_NOT_FOUND',
      message: 'The requested invoice could not be found.',
    });
  }
  const scope = await parentStudentScope(actor);
  const payments = await prisma.payment.findMany({
    where: {
      ...(invoice ? { invoiceId: invoice.id } : {}),
      ...(scope ? { invoice: { studentId: { in: scope } } } : {}),
    },
    include: paymentGraph,
    orderBy: { createdAt: 'desc' },
  });
  return payments.map(serialize);
}

export async function listRails() {
  const rails = await prisma.paymentRail.findMany({
    orderBy: [{ country: 'asc' }, { priority: 'asc' }, { code: 'asc' }],
  });
  return rails.map((rail) => serializeRail(rail));
}

export async function listCorridors() {
  const corridors = await prisma.eacCorridor.findMany({
    orderBy: [{ status: 'asc' }, { code: 'asc' }],
  });
  return corridors.map((corridor) => serializeCorridor(corridor));
}

export async function listBusEvents() {
  const events = await prisma.domainEvent.findMany({
    where: {
      OR: [
        { eventType: { startsWith: 'PAYMENT.' } },
        { eventType: 'SETTLEMENT.COMPLETED' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  return {
    contract: [...BUS_EVENTS],
    items: events.map((event) => ({
      event: event.eventType,
      aggregateId: event.aggregateId,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function applyPaymentResult(input: {
  paymentId?: string;
  event: string;
  eventId: string;
  invoiceId?: string;
  amount?: number;
  currency?: string;
  transactionReference?: string;
}) {
  const existingEvent = await prisma.webhookEvent.findUnique({ where: { eventId: input.eventId } });
  if (existingEvent) {
    const payment = existingEvent.paymentId
      ? await prisma.payment.findUnique({ where: { id: existingEvent.paymentId }, include: paymentGraph })
      : null;
    return payment ? serialize(payment) : { replayed: true, eventId: input.eventId };
  }

  const payment = input.paymentId ? await findPayment(input.paymentId) : null;
  if (!payment) {
    throw errors.notFound('PAYMENT_NOT_FOUND', 'The requested payment could not be found.');
  }
  if (payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.REVERSED) {
    throw errors.unprocessable('PAYMENT_CLOSED', 'This payment is already refunded or reversed.');
  }

  const nextStatus = statusFromEvent(input.event);
  const alreadyPosted = payment.status === PaymentStatus.SUCCESS;
  if (alreadyPosted && (nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.INITIATED)) {
    throw errors.unprocessable('INVALID_TRANSITION', 'A confirmed payment cannot return to an open state.');
  }

  const { updated, studentId } = await prisma.$transaction(async (tx) => {
    let ledgerStudentId: string | undefined;

    if (nextStatus === PaymentStatus.SUCCESS && !alreadyPosted) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          transactionReference: input.transactionReference,
          lastError: null,
        },
      });
      await recordFlow(tx, payment.id, FLOW.PAY_03, input.transactionReference ?? 'Rail confirmation');
      ledgerStudentId = await postSuccessfulPayment(tx, payment);
      await recordFlow(tx, payment.id, FLOW.PAY_05, 'Matched to the school ledger');
      if (input.event === 'SETTLEMENT.COMPLETED') {
        await markSettled(tx, payment.id, input.transactionReference);
      }
    } else if (input.event === 'SETTLEMENT.COMPLETED' && alreadyPosted) {
      await markSettled(tx, payment.id, input.transactionReference);
    } else if (nextStatus === PaymentStatus.FAILED) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          transactionReference: input.transactionReference,
          lastError: 'The payment rail declined the instruction.',
        },
      });
    } else if (nextStatus === PaymentStatus.REFUNDED || nextStatus === PaymentStatus.REVERSED) {
      if (alreadyPosted) await unwindLedger(tx, payment);
      await tx.payment.update({ where: { id: payment.id }, data: { status: nextStatus } });
      await tx.reconciliation.updateMany({
        where: { paymentId: payment.id },
        data: { status: ReconciliationStatus.REFUNDED },
      });
      await recordFlow(tx, payment.id, nextStatus === PaymentStatus.REFUNDED ? FLOW.PAY_06 : FLOW.PAY_07);
    } else if (!(alreadyPosted && nextStatus === PaymentStatus.SUCCESS)) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          transactionReference: input.transactionReference ?? payment.transactionReference,
        },
      });
    }

    await tx.webhookEvent.create({
      data: {
        eventId: input.eventId,
        event: input.event,
        paymentId: payment.id,
        invoiceId: input.invoiceId,
        amount: input.amount != null ? decimal(input.amount) : payment.amount,
        currency: input.currency ?? payment.currency,
        transactionReference: input.transactionReference,
        payload: input as object,
      },
    });

    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: paymentGraph });
    return { updated: current, studentId: ledgerStudentId };
  });

  if (studentId) await refreshStudentAccount(studentId);
  if (studentId && nextStatus === PaymentStatus.SUCCESS && !alreadyPosted) {
    const amountLabel = `RF ${money(updated.amount).toLocaleString('en-US')}`;
    await notifyFeeReceipt(studentId, amountLabel);
  }

  const eventType =
    nextStatus === PaymentStatus.SUCCESS ? EventTypes.paymentCompleted :
    nextStatus === PaymentStatus.FAILED ? EventTypes.paymentFailed :
    nextStatus === PaymentStatus.REFUNDED ? EventTypes.paymentRefunded :
    nextStatus === PaymentStatus.REVERSED ? EventTypes.paymentReversed :
    input.event === 'SETTLEMENT.COMPLETED' ? EventTypes.settlementCompleted :
    EventTypes.paymentInitiated;

  await publishEvent(eventType, updated.publicId, {
    paymentId: updated.publicId,
    status: updated.status,
    flowCode: updated.flowCode,
  });

  return serialize(updated);
}

async function postSuccessfulPayment(
  tx: Prisma.TransactionClient,
  payment: { id: string; invoiceId: string; amount: Prisma.Decimal; currency: string },
): Promise<string> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
  const amountPaid = add(invoice.amountPaid, payment.amount);
  const balance = sub(invoice.amount, amountPaid);
  const status = invoiceStatusFor(money(invoice.amount), money(amountPaid));

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid, balance, status },
  });

  const receiptId = await nextPublicId('RCT');
  await tx.receipt.create({
    data: {
      publicId: receiptId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    },
  });
  await recordFlow(tx, payment.id, FLOW.PAY_04, receiptId);

  await tx.reconciliation.create({
    data: {
      publicId: await nextPublicId('REC'),
      invoiceId: invoice.id,
      paymentId: payment.id,
      status: ReconciliationStatus.MATCHED,
    },
  });

  return invoice.studentId;
}

async function markSettled(tx: Prisma.TransactionClient, paymentId: string, reference?: string) {
  await tx.payment.update({
    where: { id: paymentId },
    data: { settlementReference: reference },
  });
  await recordFlow(tx, paymentId, FLOW.PAY_08, reference ?? 'Settlement completed');
}

async function unwindLedger(
  tx: Prisma.TransactionClient,
  payment: { id: string; invoiceId: string; amount: Prisma.Decimal },
) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
  const rawPaid = sub(invoice.amountPaid, payment.amount);
  const amountPaid = rawPaid.lessThan(0) ? new Prisma.Decimal(0) : rawPaid;
  const balance = sub(invoice.amount, amountPaid);
  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid,
      balance,
      status: invoiceStatusFor(money(invoice.amount), money(amountPaid)),
    },
  });
}

function statusFromEvent(event: string): PaymentStatus {
  switch (event) {
    case 'PAYMENT.SUCCESS':
      return PaymentStatus.SUCCESS;
    case 'PAYMENT.FAILED':
      return PaymentStatus.FAILED;
    case 'PAYMENT.REVERSED':
      return PaymentStatus.REVERSED;
    case 'PAYMENT.REFUNDED':
      return PaymentStatus.REFUNDED;
    case 'SETTLEMENT.COMPLETED':
      return PaymentStatus.SUCCESS;
    case 'PAYMENT.INITIATED':
    default:
      return PaymentStatus.INITIATED;
  }
}

export async function findPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { publicId: paymentId },
    include: paymentGraph,
  });
  if (!payment) throw errors.notFound('PAYMENT_NOT_FOUND', 'The requested payment could not be found.');
  return payment;
}

function serialize(payment: Prisma.PaymentGetPayload<{ include: typeof paymentGraph }>) {
  return {
    paymentId: payment.publicId,
    status: payment.status,
    amount: money(payment.amount),
    currency: payment.currency,
    paymentChannel: payment.paymentChannel,
    settlementReference: payment.settlementReference,
    transactionReference: payment.transactionReference,
    originCountry: payment.originCountry,
    destinationCountry: payment.destinationCountry,
    flowCode: payment.flowCode,
    instructionRef: payment.instructionRef,
    retryCount: payment.retryCount,
    lastError: payment.lastError,
    rail: serializeRail(payment.rail),
    corridor: serializeCorridor(payment.corridor),
    flow: payment.flowSteps.map((step) => ({
      code: step.code,
      label: step.label,
      status: step.status,
      detail: step.detail,
      createdAt: step.createdAt.toISOString(),
    })),
  };
}
