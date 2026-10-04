import { PaymentChannel, Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { writeAudit } from '../../utils/events';
import { nextPublicId, type IdKind } from '../../utils/ids';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import { routeInstruction } from '../payment-flow';
import { findApplication } from '../loans.service';
import { findSchool } from '../schools.service';

export type Trace = {
  actorId?: string;
  actorPublicId?: string;
  requestId?: string;
  ip?: string;
};

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

export function assertAmount(value: number, label = 'Amount') {
  if (!Number.isFinite(value) || value <= 0) {
    throw errors.unprocessable('AMOUNT_INVALID', `${label} must be greater than zero.`);
  }
  return roundMoney(value);
}

export function assertSplit(memberPercent: number, financePercent: number) {
  if (!Number.isFinite(memberPercent) || !Number.isFinite(financePercent) || memberPercent < 0 || financePercent < 0) {
    throw errors.unprocessable('SPLIT_INVALID', 'Enter the member percentage and the financing percentage.');
  }
  if (roundMoney(memberPercent + financePercent) !== 100) {
    throw errors.unprocessable('SPLIT_INVALID', 'The member percentage and the financing percentage must add up to 100.');
  }
  return { memberPercent: roundMoney(memberPercent), financePercent: roundMoney(financePercent) };
}

export function splitAmount(total: number, memberPercent: number) {
  const member = roundMoney(total * memberPercent / 100);
  const finance = roundMoney(total - member);
  return { member, finance };
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

export function assertDual(required: boolean, requesterId?: string | null, actorId?: string) {
  if (required && requesterId && actorId && requesterId === actorId) {
    throw errors.unprocessable('DUAL_AUTHORIZATION', 'A different officer must approve this action. Dual authorization is switched on.');
  }
}

export type Buckets = {
  openingBalance: Prisma.Decimal;
  contributions: Prisma.Decimal;
  transfersIn: Prisma.Decimal;
  transfersOut: Prisma.Decimal;
  releases: Prisma.Decimal;
  refunds: Prisma.Decimal;
  adjustments: Prisma.Decimal;
  interest: Prisma.Decimal;
  fees: Prisma.Decimal;
  frozenAmount: Prisma.Decimal;
  restrictedAmount: Prisma.Decimal;
  memberComponent: Prisma.Decimal;
  financeComponent: Prisma.Decimal;
};

export function figures(row: Buckets) {
  const closing = roundMoney(
    money(row.openingBalance)
    + money(row.contributions)
    + money(row.transfersIn)
    - money(row.transfersOut)
    - money(row.releases)
    + money(row.refunds)
    + money(row.adjustments)
    + money(row.interest)
    - money(row.fees),
  );
  const frozen = money(row.frozenAmount);
  const restricted = money(row.restrictedAmount);
  const available = roundMoney(closing - frozen - restricted);
  const unallocated = roundMoney(money(row.openingBalance) + money(row.contributions) - money(row.memberComponent) - money(row.financeComponent));
  return {
    closing,
    available,
    frozen,
    restricted,
    member: money(row.memberComponent),
    finance: money(row.financeComponent),
    unallocated,
  };
}

export function eligibleValue(market: number, haircutPercent: number, encumbrance: number, counts: boolean) {
  if (!counts) return 0;
  return Math.max(0, roundMoney(market * haircutPercent / 100 - encumbrance));
}

export function coverageOf(input: { exposure: number; escrowAvailable: number; eligibleCollateral: number; guaranteeCoverage: number; requiredRatio?: number }) {
  const escrowCoverage = roundMoney(Math.max(0, input.escrowAvailable));
  const collateralCoverage = roundMoney(Math.max(0, input.eligibleCollateral));
  const guaranteeCoverage = roundMoney(Math.max(0, input.guaranteeCoverage));
  const totalSecurity = roundMoney(escrowCoverage + collateralCoverage + guaranteeCoverage);
  const exposure = roundMoney(Math.max(0, input.exposure));
  const ratio = input.requiredRatio ?? 100;
  const requiredCoverage = roundMoney(exposure * ratio / 100);
  const coverageRatio = exposure > 0 ? roundMoney(totalSecurity / exposure * 100) : 0;
  return {
    exposure,
    escrowCoverage,
    collateralCoverage,
    guaranteeCoverage,
    totalSecurity,
    requiredCoverage,
    coverageGap: roundMoney(requiredCoverage - totalSecurity),
    coverageRatio,
  };
}

export async function freshExternal(external?: string | null, method?: string) {
  const channel = method ? RAILS[method] : undefined;
  const value = clean(external);
  if (channel && !value) {
    throw errors.unprocessable('EXTERNAL_TRANSACTION_REQUIRED', 'An external transaction ID is required when money moves on a payment rail.');
  }
  if (!value) return { value: null as string | null, railCode: null as string | null };
  const [contribution, release, withdrawal, refund, payment, recovery, setOff, membershipFee] = await Promise.all([
    prisma.escrowContribution.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.escrowRelease.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.escrowWithdrawal.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.escrowRefund.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.securityClaimPayment.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.securityRecovery.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.escrowSetOff.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
    prisma.membershipFeePayment.findUnique({ where: { externalTransactionId: value }, select: { id: true } }),
  ]);
  if (contribution || release || withdrawal || refund || payment || recovery || setOff || membershipFee) {
    throw errors.conflict('DUPLICATE_TRANSACTION', 'That external transaction is already recorded.');
  }
  let railCode: string | null = null;
  if (channel) {
    const route = await routeInstruction({ channel, originCountry: 'RW', destinationCountry: 'RW' });
    railCode = route.rail.code;
  }
  return { value, railCode };
}

export async function actorLabel(actorId?: string) {
  if (!actorId) return 'System';
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
  return user?.fullName ?? 'Officer';
}

export async function recordAudit(input: {
  trace: Trace;
  entityType: string;
  entityId: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  amount?: number | null;
  reason?: string | null;
  approvalReference?: string | null;
}) {
  await prisma.securityAudit.create({
    data: {
      publicId: await nextPublicId('SAU'),
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.trace.actorPublicId ?? input.trace.actorId ?? null,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      amount: input.amount == null ? null : decimal(input.amount),
      reason: input.reason ?? null,
      approvalReference: input.approvalReference ?? null,
      requestId: input.trace.requestId ?? null,
      correlationId: input.trace.requestId ?? null,
      ip: input.trace.ip ?? null,
    },
  });
  await writeAudit({
    actorId: input.trace.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.trace.requestId,
    metadata: {
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
    },
  });
}

export async function notify(event: string, subject: string, body: string, userId?: string) {
  await prisma.securityNotice.create({
    data: {
      publicId: await nextPublicId('SNT'),
      event,
      channel: 'IN_APP',
      subject,
      body,
      status: 'QUEUED',
    },
  });
  await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      userId,
      channel: 'IN_APP',
      subject,
      body,
      status: 'QUEUED',
    },
  });
}

export async function optionalSchool(publicId?: string | null) {
  const id = clean(publicId);
  if (!id) return null;
  return findSchool(id);
}

export async function optionalLoanApplication(publicId?: string | null) {
  const id = clean(publicId);
  if (!id) return null;
  return findApplication(id);
}

export async function optionalInstitution(publicId?: string | null) {
  const id = clean(publicId);
  if (!id) return null;
  const row = await prisma.financialInstitution.findUnique({ where: { publicId: id } });
  if (!row) throw errors.notFound('INSTITUTION_NOT_FOUND', 'The financial institution could not be found.');
  return row;
}

export async function findGroup(publicId: string) {
  const row = await prisma.escrowGroup.findUnique({ where: { publicId } });
  if (!row) throw errors.notFound('GROUP_NOT_FOUND', 'The group could not be found.');
  return row;
}

export async function findAccount(publicId: string) {
  const row = await prisma.escrowAccount.findUnique({ where: { publicId } });
  if (!row) throw errors.notFound('ESCROW_NOT_FOUND', 'The escrow account could not be found.');
  return row;
}

export async function findAsset(publicId: string) {
  const row = await prisma.collateralAsset.findUnique({ where: { publicId } });
  if (!row) throw errors.notFound('COLLATERAL_NOT_FOUND', 'The collateral could not be found.');
  return row;
}

export async function findFacility(publicId: string) {
  const row = await prisma.securityFacility.findUnique({ where: { publicId } });
  if (!row) throw errors.notFound('FACILITY_NOT_FOUND', 'The guarantee facility could not be found.');
  return row;
}

export async function findSecurityApplication(publicId: string) {
  const row = await prisma.securityApplication.findUnique({
    where: { publicId },
    include: { eligibility: true, assessment: true, decision: true, facility: true, account: true, asset: true, group: true, guarantee: true },
  });
  if (!row) throw errors.notFound('APPLICATION_NOT_FOUND', 'The guarantee application could not be found.');
  return row;
}

export async function findSecurityGuarantee(publicId: string) {
  const row = await prisma.securityGuarantee.findUnique({
    where: { publicId },
    include: { facility: true, certificate: true, group: true, account: true, asset: true },
  });
  if (!row) throw errors.notFound('GUARANTEE_NOT_FOUND', 'The guarantee could not be found.');
  return row;
}

export async function findClaim(publicId: string) {
  const row = await prisma.securityClaim.findUnique({ where: { publicId }, include: { guarantee: { include: { facility: true } }, loan: true, payments: true, recoveries: true } });
  if (!row) throw errors.notFound('CLAIM_NOT_FOUND', 'The claim could not be found.');
  return row;
}

export async function id(kind: IdKind) {
  return nextPublicId(kind);
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
