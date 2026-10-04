import { PaymentChannel, SchoolType } from '@prisma/client';
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

const SCHOOL_TYPES = new Set<string>(Object.values(SchoolType));

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function assertAmount(value: number, label = 'Amount') {
  if (!Number.isFinite(value) || value < 0) throw errors.unprocessable('AMOUNT_INVALID', `${label} cannot be negative.`);
  return roundMoney(value);
}

export function positive(value: number, label = 'Amount') {
  if (!Number.isFinite(value) || value <= 0) throw errors.unprocessable('AMOUNT_INVALID', `${label} must be greater than zero.`);
  return roundMoney(value);
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

export function schoolType(value: string): SchoolType | undefined {
  return SCHOOL_TYPES.has(value) ? (value as SchoolType) : undefined;
}

export function payable(amount: number, discount: number, penalty: number) {
  const total = roundMoney(assertAmount(amount, 'Fee') - assertAmount(discount, 'Discount') + assertAmount(penalty, 'Penalty'));
  if (total < 0) throw errors.unprocessable('AMOUNT_INVALID', 'The discount cannot exceed the fee and the penalty.');
  return total;
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
  memberId?: string | null
  entityType: string
  entityId: string
  action: string
  previousStatus?: string | null
  newStatus?: string | null
  reason?: string | null
  reference?: string | null
}) {
  await prisma.membershipAudit.create({
    data: {
      publicId: await id('MAU'),
      memberId: input.memberId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      userId: input.trace.actorPublicId ?? input.trace.actorId ?? null,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      requestId: input.trace.requestId ?? null,
      ip: input.trace.ip ?? null,
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

export async function notify(event: string, subject: string, body: string, memberId?: string) {
  await prisma.membershipNotice.create({
    data: { publicId: await id('MNT'), memberId: memberId ?? null, event, channel: 'IN_APP', subject, body, status: 'QUEUED' },
  });
  await prisma.notification.create({
    data: { publicId: await id('NTF'), channel: 'IN_APP', subject, body, status: 'QUEUED' },
  });
}

export async function routePayment(method: string, external?: string | null) {
  const channel = RAILS[method];
  if (channel === undefined) throw errors.unprocessable('METHOD_INVALID', 'Choose a payment method the payment service accepts.');
  const routed = await freshExternal(external, method);
  return { ...routed, status: 'SUCCESS' as const, reconciliationStatus: channel ? 'MATCHED' : 'PENDING' };
}

export function feePaid(fee: { totalPayable: { toString(): string }; payments: { amount: { toString(): string }; status: string }[] }) {
  const paid = fee.payments.filter((item) => item.status === 'SUCCESS').reduce((sum, item) => sum + money(item.amount.toString()), 0);
  return { paid: roundMoney(paid), outstanding: roundMoney(Math.max(0, money(fee.totalPayable.toString()) - paid)) };
}

export async function outstandingOf(memberId: string) {
  const fees = await prisma.membershipFee.findMany({ where: { memberId, status: { not: 'WAIVED' } }, include: { payments: true } });
  return roundMoney(fees.reduce((sum, fee) => sum + feePaid(fee).outstanding, 0));
}

export function addMonths(from: Date, months: number) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export { decimal, money };
