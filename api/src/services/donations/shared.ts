import { Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { writeAudit } from '../../utils/events';
import { nextPublicId } from '../../utils/ids';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';

export type Trace = {
  actorId?: string;
  actorPublicId?: string;
  requestId?: string;
  ip?: string;
};

export type Doc = { documentType: string; fileName: string; notes?: string };

export const ORG_DONOR_TYPES = ['COMPANY', 'ORGANIZATION', 'FOUNDATION', 'INSTITUTION', 'PARTNER'] as const;
export const OPEN_CAMPAIGN = ['PUBLISHED', 'ACTIVE', 'TARGET_REACHED'] as const;
export const RESERVED_ALLOCATION = ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'] as const;
export const RECEIVED_STATUSES = ['RECEIVED', 'APPROVED', 'ALLOCATED', 'DISTRIBUTED', 'COMPLETED', 'UNDER_REVIEW'] as const;

export function isMonetary(type: string) {
  return type !== 'IN_KIND';
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function assertAmount(value: number, label = 'Amount') {
  if (!Number.isFinite(value) || value <= 0) {
    throw errors.unprocessable('AMOUNT_INVALID', `${label} must be greater than zero.`);
  }
  return roundMoney(value);
}

export function assertCurrency(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw errors.unprocessable('CURRENCY_INVALID', 'Use a three-letter currency code.');
  }
  return code;
}

export function readDocs(value: unknown): Doc[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const documentType = String(row.documentType ?? '').trim();
    const fileName = String(row.fileName ?? '').trim();
    if (documentType.length < 2 || !fileName) return [];
    const notes = String(row.notes ?? '').trim();
    return [{ documentType, fileName, notes: notes || undefined }];
  });
}

export function jsonDocs(value: Doc[]): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export function day(value?: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw errors.badRequest('Enter a valid date.');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function iso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

export function dateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function notFuture(value: string) {
  if (value > todayIso()) {
    throw errors.unprocessable('DATE_IN_FUTURE', 'The date cannot be in the future.');
  }
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
  donationId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  amount?: number | null;
  reason?: string | null;
  reference?: string | null;
}) {
  await prisma.donationAudit.create({
    data: {
      publicId: await nextPublicId('DAU'),
      donationId: input.donationId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.trace.actorPublicId ?? input.trace.actorId ?? null,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amount: input.amount == null ? null : decimal(input.amount),
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      ip: input.trace.ip ?? null,
      sessionId: input.trace.requestId ?? null,
    },
  });
  await writeAudit({
    actorId: input.trace.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.trace.requestId,
    metadata: {
      donationId: input.donationId ?? null,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      ip: input.trace.ip ?? null,
    },
  });
}

export async function queueNotice(input: { channel: string; subject: string; body: string; userId?: string }) {
  await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      userId: input.userId,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      status: 'QUEUED',
    },
  });
}

export function availableBalance(donation: {
  amount: Prisma.Decimal;
  approvedAmount: Prisma.Decimal | null;
  allocations: { amount: Prisma.Decimal; status: string }[];
  refunds: { amount: Prisma.Decimal; status: string }[];
}) {
  const base = money(donation.approvedAmount ?? donation.amount);
  const reserved = donation.allocations
    .filter((row) => RESERVED_ALLOCATION.includes(row.status as (typeof RESERVED_ALLOCATION)[number]))
    .reduce((sum, row) => sum + money(row.amount), 0);
  const refunded = donation.refunds
    .filter((row) => row.status === 'APPROVED' || row.status === 'PROCESSING' || row.status === 'COMPLETED')
    .reduce((sum, row) => sum + money(row.amount), 0);
  return roundMoney(base - reserved - refunded);
}

export function assertCampaignAccepts(
  campaign: { status: string; currency: string; minimumDonation: Prisma.Decimal | null; maximumDonation: Prisma.Decimal | null; name: string },
  amount: number,
  currency: string,
) {
  if (!OPEN_CAMPAIGN.includes(campaign.status as (typeof OPEN_CAMPAIGN)[number])) {
    throw errors.unprocessable(
      'CAMPAIGN_NOT_OPEN',
      `${campaign.name} is ${campaign.status.replaceAll('_', ' ').toLowerCase()}. Publish and open the campaign before accepting a pledge or donation.`,
    );
  }
  if (campaign.currency !== currency) {
    throw errors.unprocessable('CURRENCY_MISMATCH', `This campaign accepts ${campaign.currency}.`);
  }
  if (campaign.minimumDonation && amount < money(campaign.minimumDonation)) {
    throw errors.unprocessable(
      'BELOW_MINIMUM',
      `The minimum donation for this campaign is ${money(campaign.minimumDonation)} ${campaign.currency}.`,
    );
  }
  if (campaign.maximumDonation && amount > money(campaign.maximumDonation)) {
    throw errors.unprocessable(
      'ABOVE_MAXIMUM',
      `The maximum donation for this campaign is ${money(campaign.maximumDonation)} ${campaign.currency}.`,
    );
  }
}

export async function refreshCampaign(campaignId?: string | null) {
  if (!campaignId) return;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !OPEN_CAMPAIGN.includes(campaign.status as (typeof OPEN_CAMPAIGN)[number])) return;
  const rows = await prisma.donation.findMany({
    where: { campaignId, status: { in: [...RECEIVED_STATUSES] } },
    select: { amount: true, approvedAmount: true },
  });
  const raised = rows.reduce((sum, row) => sum + money(row.approvedAmount ?? row.amount), 0);
  const reached = raised >= money(campaign.targetAmount);
  const next = reached ? 'TARGET_REACHED' : campaign.status === 'TARGET_REACHED' ? 'ACTIVE' : campaign.status;
  if (next !== campaign.status) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: next } });
  }
}

export async function findDonor(id: string) {
  const donor = await prisma.donor.findFirst({ where: { OR: [{ publicId: id }, { id }] } });
  if (!donor) throw errors.notFound('DONOR_NOT_FOUND', 'The requested donor could not be found.');
  return donor;
}

export async function findCampaign(id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { OR: [{ publicId: id }, { code: id }, { id }] } });
  if (!campaign) throw errors.notFound('CAMPAIGN_NOT_FOUND', 'The requested campaign could not be found.');
  return campaign;
}

export const donationGraph = {
  donor: true,
  campaign: true,
  pledge: true,
  beneficiary: true,
  inKind: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  allocations: {
    include: { beneficiary: true, distributions: true, disbursements: true },
    orderBy: { createdAt: 'desc' as const },
  },
  refunds: { orderBy: { createdAt: 'desc' as const } },
  adjustments: { orderBy: { appliedAt: 'desc' as const } },
  receipt: true,
  reconciliations: { orderBy: { createdAt: 'desc' as const } },
  ledger: { orderBy: { createdAt: 'desc' as const } },
  impacts: { orderBy: { createdAt: 'desc' as const } },
  messages: { orderBy: { sentAt: 'desc' as const } },
  compliance: { orderBy: { createdAt: 'desc' as const } },
  audits: { orderBy: { createdAt: 'desc' as const }, take: 80 },
} satisfies Prisma.DonationInclude;

export async function findDonation(id: string) {
  const donation = await prisma.donation.findFirst({
    where: { OR: [{ publicId: id }, { reference: id }, { id }] },
    include: donationGraph,
  });
  if (!donation) throw errors.notFound('DONATION_NOT_FOUND', 'The requested donation could not be found.');
  return donation;
}

export async function findBeneficiary(id: string) {
  const beneficiary = await prisma.beneficiary.findFirst({ where: { OR: [{ publicId: id }, { id }] } });
  if (!beneficiary) throw errors.notFound('BENEFICIARY_NOT_FOUND', 'The requested beneficiary could not be found.');
  return beneficiary;
}

export async function findPledge(id: string) {
  const pledge = await prisma.pledge.findFirst({
    where: { OR: [{ publicId: id }, { id }] },
    include: { donor: true, campaign: true },
  });
  if (!pledge) throw errors.notFound('PLEDGE_NOT_FOUND', 'The requested pledge could not be found.');
  return pledge;
}

export async function findAllocation(id: string) {
  const allocation = await prisma.allocation.findFirst({
    where: { OR: [{ publicId: id }, { id }] },
    include: {
      donation: { include: { donor: true, allocations: true, refunds: true } },
      beneficiary: true,
      distributions: true,
      disbursements: true,
    },
  });
  if (!allocation) throw errors.notFound('ALLOCATION_NOT_FOUND', 'The requested allocation could not be found.');
  return allocation;
}

export function conflict(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw errors.conflict('ALREADY_EXISTS', message);
  }
  throw error;
}

export { decimal, money, prisma, nextPublicId };
