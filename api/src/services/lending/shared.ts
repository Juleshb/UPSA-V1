import { PaymentChannel } from '@prisma/client';
import { errors } from '../../utils/errors';
import { writeAudit } from '../../utils/events';
import { nextPublicId, type IdKind } from '../../utils/ids';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import { freshExternal } from '../escrow/shared';

export type Trace = { actorId?: string; actorPublicId?: string; requestId?: string; ip?: string };

const RAILS: Record<string, PaymentChannel | null> = {
  BANK: 'BANK',
  BANK_TRANSFER: 'BANK',
  PSP: 'PSP',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  CARD: 'CARD',
  CASH: null,
  OTHER: null,
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function day(value?: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw errors.badRequest('Enter a valid date.');
  return new Date(`${value}T00:00:00.000Z`);
}

export function dayRequired(value: string | undefined, label: string) {
  const parsed = day(value);
  if (!parsed) throw errors.badRequest(`${label} is required.`);
  return parsed;
}

export function dateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function clean(value?: string | null) {
  const text = value?.trim() ?? '';
  return text.length ? text : null;
}

export async function id(kind: IdKind) {
  return nextPublicId(kind);
}

export async function actorLabel(actorId?: string) {
  if (!actorId) return 'System';
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
  return user?.fullName ?? 'Officer';
}

export async function recordAudit(input: {
  trace: Trace
  reference?: string | null
  entityType: string
  entityId: string
  action: string
  previousStatus?: string | null
  newStatus?: string | null
  amount?: number | null
  reason?: string | null
  institution?: string | null
}) {
  await prisma.lendingAudit.create({
    data: {
      publicId: await id('LNA'),
      reference: input.reference ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amount: input.amount == null ? null : decimal(input.amount),
      userId: input.trace.actorPublicId ?? input.trace.actorId ?? null,
      reason: input.reason ?? null,
      institution: input.institution ?? null,
      requestId: input.trace.requestId ?? null,
    },
  });
  await writeAudit({
    actorId: input.trace.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.trace.requestId,
    metadata: { previousStatus: input.previousStatus ?? null, newStatus: input.newStatus ?? null, reason: input.reason ?? null },
  });
}

export async function notify(event: string, subject: string, body: string, reference?: string) {
  await prisma.lendingNotice.create({
    data: { publicId: await id('LNT'), reference: reference ?? null, event, channel: 'IN_APP', subject, body, status: 'QUEUED' },
  });
  await prisma.notification.create({
    data: { publicId: await id('NTF'), channel: 'IN_APP', subject, body, status: 'QUEUED' },
  });
}

export async function routeMoney(method: string, external?: string | null) {
  const channel = RAILS[method];
  if (channel === undefined) throw errors.unprocessable('METHOD_INVALID', 'Choose a payment method the payment service accepts.');
  const routed = await freshExternal(external, method);
  if (routed.value) {
    const [disbursement, repayment, refund] = await Promise.all([
      prisma.loanDisbursement.findUnique({ where: { transactionReference: routed.value }, select: { id: true } }),
      prisma.loanRepayment.findFirst({ where: { paymentReference: routed.value }, select: { id: true } }),
      prisma.lendingRefund.findUnique({ where: { externalTransactionId: routed.value }, select: { id: true } }),
    ]);
    if (disbursement || repayment || refund) throw errors.conflict('DUPLICATE_TRANSACTION', 'That external transaction is already recorded.');
  }
  return { ...routed, status: 'SUCCESS' as const, reconciliationStatus: channel ? 'MATCHED' : 'PENDING' };
}

export function buildSchedule(input: {
  principal: number
  annualRate: number
  months: number
  graceMonths: number
  method: string
  fee: number
  start: Date
}) {
  const monthly = input.annualRate / 100 / 12;
  const grace = Math.max(0, Math.min(input.graceMonths, input.months - 1));
  const paying = Math.max(1, input.months - grace);
  const flatInterest = roundMoney(input.principal * monthly);
  const level = monthly === 0 ? input.principal / paying : (input.principal * monthly) / (1 - (1 + monthly) ** -paying);
  let balance = input.principal;
  const rows = [];
  for (let number = 1; number <= input.months; number += 1) {
    const interestDue = input.method === 'FLAT' ? flatInterest : roundMoney(balance * monthly);
    let principalDue = 0;
    if (number > grace) {
      if (number === input.months) principalDue = balance;
      else if (input.method === 'FLAT') principalDue = roundMoney(input.principal / paying);
      else principalDue = roundMoney(Math.max(0, Math.min(balance, level - interestDue)));
    }
    if (principalDue > balance) principalDue = balance;
    balance = roundMoney(balance - principalDue);
    const feesDue = number === 1 ? roundMoney(input.fee) : 0;
    const dueDate = new Date(input.start);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + number);
    rows.push({
      number,
      dueDate,
      principalDue,
      interestDue,
      feesDue,
      totalDue: roundMoney(principalDue + interestDue + feesDue),
    });
  }
  return rows;
}

const FLOW = ['APPLICATION', 'SUBMITTED', 'DOCUMENT_CHECK', 'KYC_KYB', 'ASSESSMENT', 'FI_REVIEW', 'CREDIT_DECISION', 'OFFER', 'ACCEPTANCE', 'CONTRACT', 'DISBURSEMENT', 'ACTIVE', 'REPAYMENT', 'SETTLED'];

export function advance(current: string, next: string) {
  const from = FLOW.indexOf(current);
  const to = FLOW.indexOf(next);
  if (from === -1 || to === -1) return next;
  return to > from ? next : current;
}

export { decimal, money };
