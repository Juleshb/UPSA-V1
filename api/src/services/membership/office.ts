import { errors } from '../../utils/errors';
import { prisma } from '../../utils/prisma';
import { dateOnly, dayRequired, decimal, feePaid, id, money, recordAudit, type Trace } from './shared';
import { ensureCategories } from './members';

export async function listCategories() {
  await ensureCategories();
  const rows = await prisma.membershipCategory.findMany({ include: { requirements: true }, orderBy: { code: 'asc' } });
  return rows.map((row) => ({
    categoryId: row.publicId,
    code: row.code,
    name: row.name,
    description: row.description,
    eligibility: row.eligibility,
    membershipFee: money(row.membershipFee),
    renewalFee: money(row.renewalFee),
    periodMonths: row.periodMonths,
    currency: row.currency,
    status: row.status,
    effectiveDate: dateOnly(row.effectiveDate),
    approvalRequired: row.approvalRequired,
    requirements: row.requirements.map((item) => ({
      requirementId: item.publicId,
      documentType: item.documentType,
      mandatory: item.mandatory,
      verificationRequired: item.verificationRequired,
    })),
  }));
}

export async function saveCategory(input: {
  code: string
  name: string
  description?: string
  eligibility?: string
  membershipFee: number
  renewalFee: number
  periodMonths: number
  effectiveDate: string
  approvalRequired?: boolean
}, trace: Trace) {
  const code = input.code.trim().toUpperCase();
  const existing = await prisma.membershipCategory.findUnique({ where: { code } });
  if (existing) throw errors.conflict('CATEGORY_EXISTS', 'That category code is already in use.');
  const row = await prisma.membershipCategory.create({
    data: {
      publicId: await id('MCA'),
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      eligibility: input.eligibility?.trim() || null,
      membershipFee: decimal(input.membershipFee),
      renewalFee: decimal(input.renewalFee),
      periodMonths: input.periodMonths,
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      approvalRequired: input.approvalRequired !== false,
      status: 'ACTIVE',
    },
  });
  await recordAudit({ trace, entityType: 'MembershipCategory', entityId: row.publicId, action: 'membership.category', newStatus: 'ACTIVE' });
  return { categoryId: row.publicId };
}

export async function saveRequirement(categoryId: string, input: { documentType: string; mandatory: boolean; verificationRequired: boolean }, trace: Trace) {
  const category = await prisma.membershipCategory.findUnique({ where: { publicId: categoryId } });
  if (!category) throw errors.notFound('CATEGORY_NOT_FOUND', 'No membership category matches that reference.');
  const row = await prisma.membershipRequirement.upsert({
    where: { categoryId_documentType: { categoryId: category.id, documentType: input.documentType } },
    create: {
      publicId: await id('MRQ'),
      categoryId: category.id,
      documentType: input.documentType,
      mandatory: input.mandatory,
      verificationRequired: input.verificationRequired,
    },
    update: { mandatory: input.mandatory, verificationRequired: input.verificationRequired },
  });
  await recordAudit({ trace, entityType: 'MembershipRequirement', entityId: row.publicId, action: 'membership.requirement', reference: category.publicId });
  return { requirementId: row.publicId };
}

export async function dashboard() {
  await ensureCategories();
  const [members, fees] = await Promise.all([
    prisma.member.findMany({ select: { status: true, expiryDate: true } }),
    prisma.membershipFee.findMany({ include: { payments: true } }),
  ]);
  const count = (status: string) => members.filter((item) => item.status === status).length;
  const due = fees.reduce((sum, fee) => sum + feePaid(fee).outstanding, 0);
  const collected = fees.reduce((sum, fee) => sum + feePaid(fee).paid, 0);
  return {
    total: members.length,
    active: count('ACTIVE'),
    pending: members.filter((item) => ['SUBMITTED', 'DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL', 'FEE_PAYMENT', 'MORE_INFORMATION_REQUIRED'].includes(item.status)).length,
    verification: count('VERIFICATION') + count('DOCUMENT_REVIEW'),
    suspended: count('SUSPENDED'),
    expired: count('EXPIRED'),
    feesDue: due,
    feesCollected: collected,
  };
}

export async function report(type: string) {
  const members = await prisma.member.findMany({ include: { category: true, fees: { include: { payments: true } } }, orderBy: { createdAt: 'desc' } });
  const line = (row: (typeof members)[number]) => ({
    memberId: row.publicId,
    membershipNumber: row.membershipNumber ?? '',
    institution: row.institutionName,
    category: row.category?.name ?? row.membershipType,
    district: row.district,
    status: row.status,
    expiry: dateOnly(row.expiryDate) ?? '',
    registered: dateOnly(row.createdAt) ?? '',
  });
  if (type === 'new') return members.filter((row) => ['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL'].includes(row.status)).map(line);
  if (type === 'active') return members.filter((row) => row.status === 'ACTIVE').map(line);
  if (type === 'pending') return members.filter((row) => !['ACTIVE', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'TERMINATED'].includes(row.status)).map(line);
  if (type === 'rejected') return members.filter((row) => row.status === 'REJECTED').map(line);
  if (type === 'expired') return members.filter((row) => row.status === 'EXPIRED').map(line);
  if (type === 'suspended') return members.filter((row) => row.status === 'SUSPENDED').map(line);
  if (type === 'renewed') {
    const renewals = await prisma.membershipRenewal.findMany({ include: { member: true }, orderBy: { createdAt: 'desc' } });
    return renewals.map((row) => ({ renewalId: row.publicId, member: row.member.institutionName, status: row.status, total: money(row.totalPayable) }));
  }
  if (type === 'fees' || type === 'outstanding') {
    const fees = await prisma.membershipFee.findMany({ include: { member: true, payments: true }, orderBy: { createdAt: 'desc' } });
    return fees.filter((fee) => type === 'fees' || feePaid(fee).outstanding > 0).map((fee) => ({
      feeId: fee.publicId,
      member: fee.member.institutionName,
      type: fee.feeType,
      payable: money(fee.totalPayable),
      outstanding: feePaid(fee).outstanding,
      status: fee.status,
    }));
  }
  if (type === 'payments') {
    const payments = await prisma.membershipFeePayment.findMany({ include: { member: true }, orderBy: { createdAt: 'desc' } });
    return payments.map((row) => ({
      paymentId: row.publicId,
      member: row.member.institutionName,
      amount: money(row.amount),
      method: row.paymentMethod,
      external: row.externalTransactionId ?? '',
      reconciliation: row.reconciliationStatus,
      status: row.status,
    }));
  }
  if (type === 'growth') {
    const buckets = new Map<string, number>();
    for (const row of members) {
      const key = row.createdAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([month, membersInMonth]) => ({ month, members: membersInMonth }));
  }
  return members.map(line);
}

export async function listNotices() {
  const rows = await prisma.membershipNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ noticeId: row.publicId, event: row.event, channel: row.channel, subject: row.subject, body: row.body, status: row.status, createdAt: row.createdAt.toISOString() }));
}

export async function sendNotice(input: { memberId?: string; event: string; channel: string; subject: string; body: string }, trace: Trace) {
  const member = input.memberId ? await prisma.member.findUnique({ where: { publicId: input.memberId } }) : null;
  const row = await prisma.membershipNotice.create({
    data: {
      publicId: await id('MNT'),
      memberId: member?.publicId ?? null,
      event: input.event,
      channel: input.channel,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: 'QUEUED',
    },
  });
  await recordAudit({ trace, memberId: member?.publicId, entityType: 'MembershipNotice', entityId: row.publicId, action: 'membership.notice', newStatus: 'QUEUED' });
  return { noticeId: row.publicId };
}

export async function listAudit() {
  const rows = await prisma.membershipAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({
    auditId: row.publicId,
    memberId: row.memberId,
    action: row.action,
    entity: `${row.entityType} ${row.entityId}`,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    userId: row.userId,
    reason: row.reason,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
  }));
}
