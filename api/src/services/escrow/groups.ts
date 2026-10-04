import { decimal } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import {
  assertAmount,
  clean,
  dateOnly,
  day,
  figures,
  findAccount,
  findGroup,
  id,
  notify,
  optionalSchool,
  recordAudit,
  type Trace,
} from './shared';

export async function listGroups() {
  const rows = await prisma.escrowGroup.findMany({
    include: { school: true, _count: { select: { members: true, accounts: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    groupId: row.publicId,
    name: row.name,
    groupType: row.groupType,
    schoolId: row.school?.publicId ?? null,
    schoolName: row.school?.schoolName ?? null,
    district: row.district,
    members: row._count.members,
    accounts: row._count.accounts,
    membershipStatus: row.membershipStatus,
    status: row.status,
  }));
}

export async function createGroup(input: {
  name: string;
  groupType: string;
  registrationNumber?: string;
  formationDate?: string;
  purpose: string;
  address?: string;
  district?: string;
  sector?: string;
  contact?: string;
  chairperson?: string;
  secretary?: string;
  treasurer?: string;
  representatives?: string;
  membershipStatus?: string;
  schoolId?: string;
  documents?: { documentType: string; fileName: string }[];
}, trace: Trace) {
  const school = await optionalSchool(input.schoolId);
  const row = await prisma.escrowGroup.create({
    data: {
      publicId: await id('EGR'),
      name: input.name.trim(),
      groupType: input.groupType,
      registrationNumber: clean(input.registrationNumber),
      formationDate: day(input.formationDate),
      purpose: input.purpose.trim(),
      address: clean(input.address),
      district: clean(input.district) ?? school?.district ?? null,
      sector: clean(input.sector) ?? school?.sector ?? null,
      contact: clean(input.contact) ?? school?.phone ?? null,
      chairperson: clean(input.chairperson),
      secretary: clean(input.secretary),
      treasurer: clean(input.treasurer),
      representatives: clean(input.representatives),
      membershipStatus: input.membershipStatus ?? 'ACTIVE',
      documents: input.documents?.length ? input.documents : undefined,
      schoolId: school?.id,
      memberCount: 0,
    },
  });
  await recordAudit({ trace, entityType: 'EscrowGroup', entityId: row.publicId, action: 'group.register', newStatus: row.status });
  await notify('Group registered', `Group ${row.publicId} registered`, `${row.name} is on the escrow register.`, trace.actorId);
  return groupFile(row.publicId);
}

export async function addMember(groupId: string, input: {
  memberType: string;
  name: string;
  schoolId?: string;
  schoolName?: string;
  membershipNumber?: string;
  contributionPercent?: number;
  contributionAmount?: number;
  votingRights?: boolean;
  guaranteeParticipation?: boolean;
  collateralParticipation?: boolean;
  status?: string;
}, trace: Trace) {
  const group = await findGroup(groupId);
  const school = await optionalSchool(input.schoolId);
  const member = await prisma.escrowGroupMember.create({
    data: {
      publicId: await id('EGM'),
      groupId: group.id,
      schoolId: school?.id,
      memberType: input.memberType,
      name: input.name.trim(),
      schoolName: clean(input.schoolName) ?? school?.schoolName ?? null,
      membershipNumber: clean(input.membershipNumber) ?? school?.rupsaMemberId ?? null,
      contributionPercent: decimal(input.contributionPercent ?? 0),
      contributionAmount: decimal(input.contributionAmount ?? 0),
      votingRights: input.votingRights ?? true,
      guaranteeParticipation: input.guaranteeParticipation ?? true,
      collateralParticipation: input.collateralParticipation ?? true,
      status: input.status ?? 'ACTIVE',
    },
  });
  await prisma.escrowGroup.update({ where: { id: group.id }, data: { memberCount: { increment: 1 } } });
  await recordAudit({ trace, entityType: 'EscrowGroupMember', entityId: member.publicId, action: 'group.member', newStatus: member.status });
  return groupFile(group.publicId);
}

export async function addGroupContribution(groupId: string, input: {
  accountId?: string;
  requiredContribution: number;
  period: string;
  paymentReference?: string;
  reconciliationStatus?: string;
  approval?: string;
  remarks?: string;
}, trace: Trace) {
  const group = await findGroup(groupId);
  const required = assertAmount(input.requiredContribution, 'Required contribution');
  const account = input.accountId ? await findAccount(input.accountId) : null;
  if (account && account.groupId !== group.id) {
    const { errors } = await import('../../utils/errors');
    throw errors.unprocessable('ACCOUNT_GROUP_MISMATCH', 'That escrow account belongs to another group.');
  }
  const paidRows = account
    ? await prisma.escrowContribution.findMany({ where: { accountId: account.id, status: { in: ['RECEIVED', 'VERIFIED', 'RECONCILED'] } } })
    : [];
  const amountPaid = paidRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const contributors = new Set(paidRows.map((row) => row.memberName)).size;
  const row = await prisma.escrowGroupContribution.create({
    data: {
      publicId: await id('EGC'),
      groupId: group.id,
      accountId: account?.id,
      requiredContribution: decimal(required),
      amountPaid: decimal(amountPaid),
      outstanding: decimal(Math.max(0, Math.round((required - amountPaid) * 100) / 100)),
      contributors,
      period: input.period.trim(),
      paymentReference: clean(input.paymentReference),
      reconciliationStatus: input.reconciliationStatus ?? (amountPaid >= required ? 'MATCHED' : 'PENDING'),
      approval: clean(input.approval),
      remarks: clean(input.remarks),
    },
  });
  await recordAudit({ trace, entityType: 'EscrowGroupContribution', entityId: row.publicId, action: 'group.contribution', amount: required });
  return groupFile(group.publicId);
}

export async function groupFile(publicId: string) {
  const row = await prisma.escrowGroup.findUnique({
    where: { publicId },
    include: {
      school: true,
      members: { include: { school: true }, orderBy: { createdAt: 'desc' } },
      contributions: { orderBy: { createdAt: 'desc' } },
      accounts: true,
    },
  });
  if (!row) {
    const { errors } = await import('../../utils/errors');
    throw errors.notFound('GROUP_NOT_FOUND', 'The group could not be found.');
  }
  return {
    groupId: row.publicId,
    name: row.name,
    groupType: row.groupType,
    registrationNumber: row.registrationNumber,
    formationDate: dateOnly(row.formationDate),
    purpose: row.purpose,
    address: row.address,
    district: row.district,
    sector: row.sector,
    contact: row.contact,
    chairperson: row.chairperson,
    secretary: row.secretary,
    treasurer: row.treasurer,
    representatives: row.representatives,
    memberCount: row.memberCount,
    membershipStatus: row.membershipStatus,
    status: row.status,
    schoolId: row.school?.publicId ?? null,
    schoolName: row.school?.schoolName ?? null,
    members: row.members.map((member) => ({
      memberId: member.publicId,
      memberType: member.memberType,
      name: member.name,
      schoolId: member.school?.publicId ?? null,
      schoolName: member.schoolName,
      membershipNumber: member.membershipNumber,
      contributionPercent: Number(member.contributionPercent),
      contributionAmount: Number(member.contributionAmount),
      votingRights: member.votingRights,
      guaranteeParticipation: member.guaranteeParticipation,
      collateralParticipation: member.collateralParticipation,
      status: member.status,
    })),
    contributions: row.contributions.map((item) => ({
      contributionId: item.publicId,
      requiredContribution: Number(item.requiredContribution),
      amountPaid: Number(item.amountPaid),
      outstanding: Number(item.outstanding),
      contributors: item.contributors,
      period: item.period,
      paymentReference: item.paymentReference,
      reconciliationStatus: item.reconciliationStatus,
      approval: item.approval,
      remarks: item.remarks,
    })),
    accounts: row.accounts.map((account) => ({
      accountId: account.publicId,
      name: account.name,
      status: account.status,
      ...figures(account),
    })),
  };
}

export async function groupExposure(publicId: string) {
  const group = await findGroup(publicId);
  const [accounts, assets, guarantees, loans] = await Promise.all([
    prisma.escrowAccount.findMany({ where: { groupId: group.id } }),
    prisma.collateralAsset.findMany({ where: { groupId: group.id } }),
    prisma.securityGuarantee.findMany({ where: { groupId: group.id } }),
    group.schoolId ? prisma.loan.findMany({ where: { application: { schoolId: group.schoolId }, status: { in: ['ACTIVE', 'IN_ARREARS', 'RECOVERY', 'CONTRACTED', 'DISBURSING'] } } }) : Promise.resolve([]),
  ]);
  const escrow = accounts.filter((row) => row.status !== 'CLOSED').reduce((sum, row) => sum + figures(row).closing, 0);
  const available = accounts.filter((row) => row.status !== 'CLOSED').reduce((sum, row) => sum + figures(row).available, 0);
  const restricted = accounts.filter((row) => row.status !== 'CLOSED').reduce((sum, row) => sum + figures(row).restricted, 0);
  const collateral = assets.filter((row) => row.countsAsCollateral && row.status !== 'RELEASED').reduce((sum, row) => sum + Math.max(0, Number(row.marketValue) * Number(row.haircutPercent) / 100 - Number(row.encumbrance)), 0);
  const guarantee = guarantees.filter((row) => !['CLOSED', 'CANCELLED'].includes(row.status)).reduce((sum, row) => sum + Math.max(0, Number(row.maximumLiability) - Number(row.claimsPaid) + Number(row.recoveries)), 0);
  const loanExposure = loans.reduce((sum, row) => sum + Number(row.principalOutstanding), 0);
  const claims = await prisma.securityClaim.findMany({ where: { guarantee: { groupId: group.id }, status: { not: 'REJECTED' } } });
  const recoveries = await prisma.securityRecovery.findMany({ where: { claim: { guarantee: { groupId: group.id } } } });
  const defaults = await prisma.securityDefault.count({ where: { groupId: group.id, status: 'OPEN' } });
  const limit = guarantees.reduce((max, row) => Math.max(max, Number(row.facilityId ? 0 : 0)), 0);
  const facilityLimit = (await prisma.securityFacility.findMany({ where: { groupId: group.id, status: 'ACTIVE' } })).reduce((sum, row) => sum + Number(row.approvedLimit), 0);
  const coverageRatio = loanExposure > 0 ? Math.round((available + collateral) / loanExposure * 10000) / 100 : 0;
  return {
    groupId: group.publicId,
    loans: loans.length,
    principalOutstanding: Math.round(loanExposure * 100) / 100,
    guarantees: guarantees.length,
    guaranteeExposure: Math.round(guarantee * 100) / 100,
    escrowBalance: Math.round(escrow * 100) / 100,
    restrictedEscrow: Math.round(restricted * 100) / 100,
    availableEscrow: Math.round(available * 100) / 100,
    collateralValue: Math.round(collateral * 100) / 100,
    eligibleCollateral: Math.round(collateral * 100) / 100,
    defaults,
    overdueAmount: loans.filter((row) => row.status === 'IN_ARREARS').reduce((sum, row) => sum + Number(row.principalOutstanding), 0),
    recoveryAmount: Math.round(recoveries.reduce((sum, row) => sum + Number(row.amount), 0) * 100) / 100,
    claims: claims.length,
    groupExposureLimit: facilityLimit || limit,
    availableExposure: Math.round(((facilityLimit || 0) - guarantee) * 100) / 100,
    coverageRatio,
    riskStatus: coverageRatio >= 100 || loanExposure === 0 ? 'WITHIN_LIMIT' : 'COVERAGE_GAP',
  };
}
