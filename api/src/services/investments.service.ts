import { Prisma } from '@prisma/client';
import { routeInstruction } from './payment-flow';
import { writeAudit } from '../utils/events';
import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { decimal, money } from '../utils/money';
import { prisma } from '../utils/prisma';
import {
  actorLabel,
  assertAmount,
  assertCurrency,
  dateOnly,
  day,
  jsonDocs,
  notFuture,
  queueNotice,
  readDocs,
  roundMoney,
  todayIso,
  type Doc,
  type Trace,
} from './donations/shared';

const OPEN_OPPORTUNITY = ['PUBLISHED', 'OPEN_FOR_INVESTMENT'];
const FUNDABLE = ['AGREEMENT_SIGNED', 'FUNDING', 'ACTIVE'];
const TYPES = ['EQUITY', 'DEBT', 'PROJECT', 'MONEY_MARKET', 'REAL_ESTATE', 'OTHER'];
const SECTORS = ['EDUCATION', 'AGRICULTURE', 'ENERGY', 'HEALTH', 'TECHNOLOGY', 'INFRASTRUCTURE', 'OTHER'];
const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'AT_MATURITY'];
const SOURCES = ['MEMBER_CONTRIBUTION', 'RETAINED_EARNINGS', 'LOAN_FINANCING', 'OTHER'];
const RATINGS = ['LOW', 'MEDIUM', 'HIGH'];
const RISKS = ['market', 'credit', 'liquidity', 'operational', 'legal', 'concentration', 'project'] as const;

function clean(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

async function audit(input: {
  trace: Trace;
  entityType: string;
  entityId: string;
  positionId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  amount?: number | null;
  reason?: string | null;
  reference?: string | null;
}) {
  await prisma.investmentAudit.create({
    data: {
      publicId: await nextPublicId('IAU'),
      positionId: input.positionId ?? null,
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
      positionId: input.positionId ?? null,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      ip: input.trace.ip ?? null,
    },
  });
}

async function postLedger(positionId: string, entryType: string, amount: number, currency: string, description: string, reference?: string | null) {
  await prisma.investmentLedgerEntry.create({
    data: { positionId, entryType, amount: decimal(roundMoney(amount)), currency, description, reference: reference ?? null },
  });
}

function ledgerBalance(rows: { amount: Prisma.Decimal }[]) {
  return roundMoney(rows.reduce((sum, row) => sum + money(row.amount), 0));
}

const positionInclude = {
  opportunity: true,
  school: true,
  registration: true,
  contributions: true,
  payouts: true,
  exits: true,
  ledger: true,
  application: true,
} satisfies Prisma.InvestmentPositionInclude;

type PositionGraph = Prisma.InvestmentPositionGetPayload<{ include: typeof positionInclude }>;

function memberName(row: { school?: { schoolName: string; rupsaMemberId: string | null; publicId: string } | null; registration?: { displayName: string; publicId: string } | null }) {
  if (row.school) return { name: row.school.schoolName, number: row.school.rupsaMemberId ?? row.school.publicId, id: row.school.publicId, source: 'SCHOOL' as const };
  if (row.registration) return { name: row.registration.displayName, number: row.registration.publicId, id: row.registration.publicId, source: 'INVESTOR' as const };
  return { name: 'Member', number: '—', id: '', source: 'SCHOOL' as const };
}

function opportunityView(row: {
  publicId: string; code: string; name: string; investmentType: string; sector: string; location: string; status: string;
  targetAmount: Prisma.Decimal; minimumAmount: Prisma.Decimal; maximumAmount: Prisma.Decimal | null; currency: string;
  expectedReturnRate: Prisma.Decimal; returnFrequency: string; amountRaised: Prisma.Decimal; startDate: Date; endDate: Date;
}) {
  const target = money(row.targetAmount);
  const raised = money(row.amountRaised);
  return {
    id: row.publicId,
    code: row.code,
    name: row.name,
    investmentType: row.investmentType,
    sector: row.sector,
    location: row.location,
    status: row.status,
    targetAmount: target,
    minimumAmount: money(row.minimumAmount),
    maximumAmount: row.maximumAmount == null ? null : money(row.maximumAmount),
    currency: row.currency,
    expectedReturnRate: money(row.expectedReturnRate),
    returnFrequency: row.returnFrequency,
    amountRaised: raised,
    amountRemaining: roundMoney(Math.max(0, target - raised)),
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
  };
}

async function findOpportunity(id: string) {
  const row = await prisma.investmentOpportunity.findUnique({ where: { publicId: id }, include: { positions: { include: { ledger: true } }, applications: true } });
  if (!row) throw errors.notFound('OPPORTUNITY_NOT_FOUND', 'Investment opportunity was not found.');
  return row;
}

async function findApplication(id: string) {
  const row = await prisma.investmentApplication.findUnique({
    where: { publicId: id },
    include: { opportunity: true, school: true, registration: true, position: true },
  });
  if (!row) throw errors.notFound('APPLICATION_NOT_FOUND', 'Investment application was not found.');
  return row;
}

async function findPosition(id: string) {
  const row = await prisma.investmentPosition.findUnique({ where: { publicId: id }, include: positionInclude });
  if (!row) throw errors.notFound('INVESTMENT_NOT_FOUND', 'Investment was not found.');
  return row;
}

async function resolveMember(input: { memberId?: string; memberSource?: string }) {
  if (input.memberSource === 'INVESTOR' && input.memberId) {
    const registration = await prisma.registration.findUnique({ where: { publicId: input.memberId } });
    if (!registration || registration.kind !== 'INVESTOR') throw errors.notFound('MEMBER_NOT_FOUND', 'Registered investor was not found.');
    const active = ['APPROVED', 'ACTIVE'].includes(registration.status) && registration.consentCaptured;
    return { schoolId: null as string | null, registrationId: registration.id, name: registration.displayName, number: registration.publicId, phone: registration.phone ?? '', email: registration.email, active, schoolInternal: null as string | null, overdue: false };
  }
  if (!input.memberId) throw errors.unprocessable('MEMBER_REQUIRED', 'Choose a member.');
  const school = await prisma.school.findUnique({ where: { publicId: input.memberId } });
  if (!school) throw errors.notFound('MEMBER_NOT_FOUND', 'Member school was not found.');
  const overdue = await prisma.invoice.count({ where: { schoolId: school.id, status: 'OVERDUE' } });
  const active = school.status === 'ACTIVE' && school.membershipStatus === 'VERIFIED';
  return { schoolId: school.id, registrationId: null, name: school.schoolName, number: school.rupsaMemberId ?? school.publicId, phone: school.phone, email: school.email, active, schoolInternal: school.id, overdue: overdue > 0 };
}

export async function listMembers() {
  const schools = await prisma.school.findMany({ where: { status: 'ACTIVE', membershipStatus: 'VERIFIED' }, orderBy: { schoolName: 'asc' }, take: 200 });
  const investors = await prisma.registration.findMany({ where: { kind: 'INVESTOR', status: { in: ['APPROVED', 'ACTIVE'] }, consentCaptured: true }, orderBy: { displayName: 'asc' }, take: 200 });
  return [
    ...schools.map((row) => ({ id: row.publicId, source: 'SCHOOL', name: row.schoolName, number: row.rupsaMemberId ?? row.publicId, telephone: row.phone, email: row.email })),
    ...investors.map((row) => ({ id: row.publicId, source: 'INVESTOR', name: row.displayName, number: row.publicId, telephone: row.phone ?? '', email: row.email })),
  ];
}

export async function summary() {
  const [opportunities, positions, applications, payouts, exits] = await Promise.all([
    prisma.investmentOpportunity.findMany(),
    prisma.investmentPosition.findMany({ include: { ledger: true } }),
    prisma.investmentApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.investmentPayout.findMany(),
    prisma.investmentExit.findMany({ where: { status: 'COMPLETED' } }),
  ]);
  const invested = positions.reduce((sum, row) => sum + ledgerBalance(row.ledger.filter((entry) => entry.entryType === 'CONTRIBUTION')), 0);
  const expected = positions.filter((row) => row.status === 'ACTIVE').reduce((sum, row) => sum + roundMoney(money(row.amount) * money(row.returnRate) / 100), 0);
  const realized = payouts.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + money(row.netReturn), 0);
  const pendingReturns = payouts.filter((row) => row.status !== 'PAID' && row.status !== 'FAILED').reduce((sum, row) => sum + money(row.netReturn), 0);
  return {
    totalPortfolio: roundMoney(positions.reduce((sum, row) => sum + ledgerBalance(row.ledger), 0)),
    totalInvested: roundMoney(invested),
    activeInvestments: positions.filter((row) => row.status === 'ACTIVE').length,
    maturedInvestments: positions.filter((row) => row.status === 'MATURED').length,
    pendingApplications: applications,
    approvedInvestments: positions.filter((row) => ['APPROVED', 'AGREEMENT_SIGNED', 'FUNDING', 'ACTIVE'].includes(row.status)).length,
    expectedReturns: expected,
    realizedReturns: roundMoney(realized),
    pendingReturns: roundMoney(pendingReturns),
    withdrawals: roundMoney(exits.reduce((sum, row) => sum + money(row.netAmount), 0)),
    openOpportunities: opportunities.filter((row) => OPEN_OPPORTUNITY.includes(row.status)).length,
  };
}

export async function listOpportunities(query: { status?: string; q?: string }) {
  const rows = await prisma.investmentOpportunity.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (query.status === 'OPEN' && !OPEN_OPPORTUNITY.includes(row.status)) return false;
    if (query.status === 'CLOSED' && !['CLOSED', 'COMPLETED', 'FULLY_SUBSCRIBED'].includes(row.status)) return false;
    if (query.status && !['OPEN', 'CLOSED'].includes(query.status) && row.status !== query.status) return false;
    if (!needle) return true;
    return [row.publicId, row.code, row.name, row.sector, row.location].some((part) => part.toLowerCase().includes(needle));
  }).map(opportunityView);
}

export async function getOpportunity(id: string) {
  const row = await findOpportunity(id);
  return {
    ...opportunityView(row),
    description: row.description,
    projectName: row.projectName,
    managerName: row.managerName,
    investmentPeriod: row.investmentPeriod,
    expectedProfit: row.expectedProfit == null ? null : money(row.expectedProfit),
    riskDisclosure: row.riskDisclosure,
    managementFeeRate: money(row.managementFeeRate),
    otherCharges: money(row.otherCharges),
    earlyRedemptionRate: money(row.earlyRedemptionRate),
    documents: readDocs(row.documents),
    feeLines: Array.isArray(row.feeLines) ? row.feeLines : [],
  };
}

export async function saveOpportunity(input: {
  code: string;
  name: string;
  investmentType: string;
  description: string;
  projectName: string;
  sector: string;
  location: string;
  managerName: string;
  startDate: string;
  endDate: string;
  targetAmount: number;
  minimumAmount: number;
  maximumAmount?: number;
  currency?: string;
  expectedReturnRate: number;
  returnFrequency: string;
  investmentPeriod: string;
  expectedProfit?: number;
  riskDisclosure: string;
  managementFeeRate?: number;
  otherCharges?: number;
  earlyRedemptionRate?: number;
  documents?: Doc[];
  mode?: string;
}, trace: Trace) {
  if (!TYPES.includes(input.investmentType)) throw errors.unprocessable('TYPE_INVALID', 'Choose an investment type.');
  if (!SECTORS.includes(input.sector)) throw errors.unprocessable('SECTOR_INVALID', 'Choose a sector.');
  if (!FREQUENCIES.includes(input.returnFrequency)) throw errors.unprocessable('FREQUENCY_INVALID', 'Choose a return frequency.');
  if (!clean(input.code) || !clean(input.name) || !clean(input.description) || !clean(input.projectName) || !clean(input.location) || !clean(input.managerName) || !clean(input.riskDisclosure)) {
    throw errors.unprocessable('OPPORTUNITY_INCOMPLETE', 'Enter the opportunity name, project, location, manager, description, and risk disclosure.');
  }
  if (input.endDate < input.startDate) throw errors.unprocessable('DATE_RANGE', 'The end date cannot precede the start date.');
  const target = assertAmount(input.targetAmount, 'Target amount');
  const minimum = assertAmount(input.minimumAmount, 'Minimum investment');
  const maximum = input.maximumAmount ? assertAmount(input.maximumAmount, 'Maximum investment') : null;
  if (minimum > target || (maximum != null && (maximum < minimum || maximum > target))) {
    throw errors.unprocessable('AMOUNT_RANGE', 'Minimum and maximum must sit within the target amount.');
  }
  if (input.expectedReturnRate < 0) throw errors.unprocessable('RATE_INVALID', 'The return rate cannot be negative.');
  const data = {
    code: input.code.trim(),
    name: input.name.trim(),
    investmentType: input.investmentType,
    description: input.description.trim(),
    projectName: input.projectName.trim(),
    sector: input.sector,
    location: input.location.trim(),
    managerName: input.managerName.trim(),
    startDate: day(input.startDate)!,
    endDate: day(input.endDate)!,
    targetAmount: decimal(target),
    minimumAmount: decimal(minimum),
    maximumAmount: maximum == null ? null : decimal(maximum),
    currency: assertCurrency(input.currency || 'RWF'),
    expectedReturnRate: decimal(roundMoney(input.expectedReturnRate)),
    returnFrequency: input.returnFrequency,
    investmentPeriod: input.investmentPeriod.trim(),
    expectedProfit: input.expectedProfit == null ? null : decimal(roundMoney(input.expectedProfit)),
    riskDisclosure: input.riskDisclosure.trim(),
    managementFeeRate: decimal(roundMoney(input.managementFeeRate ?? 0)),
    otherCharges: decimal(roundMoney(input.otherCharges ?? 0)),
    earlyRedemptionRate: decimal(roundMoney(input.earlyRedemptionRate ?? 0)),
    documents: jsonDocs(readDocs(input.documents)),
    status: input.mode === 'draft' ? 'DRAFT' : 'DRAFT',
  };
  const created = await prisma.investmentOpportunity.create({ data: { ...data, publicId: await nextPublicId('IOP') } });
  await audit({ trace, entityType: 'Opportunity', entityId: created.publicId, action: 'Opportunity created', newStatus: created.status });
  return getOpportunity(created.publicId);
}

export async function setOpportunityStatus(id: string, status: string, trace: Trace) {
  const row = await findOpportunity(id);
  const allowed = ['DRAFT', 'PUBLISHED', 'OPEN_FOR_INVESTMENT', 'CLOSED', 'SUSPENDED', 'COMPLETED'];
  if (!allowed.includes(status)) throw errors.unprocessable('STATUS_INVALID', 'That opportunity status is not available.');
  if (['PUBLISHED', 'OPEN_FOR_INVESTMENT'].includes(status) && readDocs(row.documents).length === 0) {
    throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Attach the proposal documents before publishing.');
  }
  await prisma.investmentOpportunity.update({ where: { id: row.id }, data: { status } });
  await audit({ trace, entityType: 'Opportunity', entityId: row.publicId, action: 'Opportunity status', previousStatus: row.status, newStatus: status });
  return getOpportunity(id);
}

export async function saveFeeLine(id: string, input: { code: string; name: string; feeType: string; basis: string; rate: number; effectiveDate: string }, trace: Trace) {
  const row = await findOpportunity(id);
  if (!clean(input.code) || !clean(input.name)) throw errors.unprocessable('FEE_INCOMPLETE', 'Enter the fee code and name.');
  if (!['FIXED', 'PERCENT'].includes(input.basis)) throw errors.unprocessable('FEE_BASIS', 'A fee is either a fixed amount or a percentage.');
  const lines = Array.isArray(row.feeLines) ? [...row.feeLines as object[]] : [];
  lines.push({ code: input.code.trim(), name: input.name.trim(), feeType: input.feeType, basis: input.basis, rate: roundMoney(input.rate), currency: row.currency, effectiveDate: input.effectiveDate, status: 'ACTIVE' });
  await prisma.investmentOpportunity.update({ where: { id: row.id }, data: { feeLines: lines as Prisma.InputJsonValue } });
  await audit({ trace, entityType: 'Opportunity', entityId: row.publicId, action: 'Fee saved', reference: input.code });
  return getOpportunity(id);
}

function applicationView(row: Awaited<ReturnType<typeof findApplication>>) {
  const member = memberName(row);
  return {
    id: row.publicId,
    member: member.name,
    memberId: member.id,
    memberSource: member.source,
    memberNumber: member.number,
    representative: row.representative,
    telephone: row.telephone,
    email: row.email,
    opportunityId: row.opportunity.publicId,
    opportunity: row.opportunity.name,
    investmentType: row.opportunity.investmentType,
    requestedAmount: money(row.requestedAmount),
    currency: row.currency,
    investmentPeriod: row.investmentPeriod,
    purpose: row.purpose,
    fundingSource: row.fundingSource,
    status: row.status,
    eligibilityResult: row.eligibilityResult,
    eligibilityDecision: row.eligibilityDecision,
    diligenceResult: row.diligenceResult,
    riskLevel: row.riskLevel,
    decision: row.decision,
    positionId: row.position?.publicId ?? null,
    date: dateOnly(row.createdAt),
  };
}

export async function listApplications(query: { status?: string }) {
  const rows = await prisma.investmentApplication.findMany({
    where: query.status ? { status: query.status } : {},
    include: { opportunity: true, school: true, registration: true, position: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(applicationView);
}

export async function getApplication(id: string) {
  const row = await findApplication(id);
  return {
    ...applicationView(row),
    confirmInformation: row.confirmInformation,
    reviewedTerms: row.reviewedTerms,
    understandRisks: row.understandRisks,
    agreeAgreement: row.agreeAgreement,
    documents: readDocs(row.documents),
    eligibility: row.eligibility,
    eligibilityComments: row.eligibilityComments,
    diligence: row.diligence,
    risk: row.risk,
    riskScore: row.riskScore == null ? null : money(row.riskScore),
    mitigationPlan: row.mitigationPlan,
    assessor: row.assessor,
    assessmentDate: dateOnly(row.assessmentDate),
    reviewDate: dateOnly(row.reviewDate),
    approvedAmount: row.approvedAmount == null ? null : money(row.approvedAmount),
    approvedPeriod: row.approvedPeriod,
    returnRate: row.returnRate == null ? null : money(row.returnRate),
    returnFrequency: row.returnFrequency,
    fees: row.fees == null ? null : money(row.fees),
    conditions: row.conditions,
    startDate: dateOnly(row.startDate),
    maturityDate: dateOnly(row.maturityDate),
    approvedBy: row.approvedBy,
    approvalDate: dateOnly(row.approvalDate),
    approvalComments: row.approvalComments,
  };
}

export async function saveApplication(input: {
  memberId: string;
  memberSource?: string;
  opportunityId: string;
  representative: string;
  telephone: string;
  email?: string;
  requestedAmount: number;
  currency?: string;
  investmentPeriod: string;
  purpose?: string;
  fundingSource: string;
  confirmInformation?: boolean;
  reviewedTerms?: boolean;
  understandRisks?: boolean;
  agreeAgreement?: boolean;
  documents?: Doc[];
  mode?: string;
}, trace: Trace) {
  const member = await resolveMember(input);
  const opportunity = await findOpportunity(input.opportunityId);
  if (!OPEN_OPPORTUNITY.includes(opportunity.status)) throw errors.unprocessable('OPPORTUNITY_CLOSED', 'This opportunity is not open for applications.');
  if (!SOURCES.includes(input.fundingSource)) throw errors.unprocessable('SOURCE_INVALID', 'Choose an approved funding source.');
  if (!clean(input.representative) || !clean(input.telephone) || !clean(input.investmentPeriod)) {
    throw errors.unprocessable('APPLICATION_INCOMPLETE', 'Enter the representative, telephone, and investment period.');
  }
  const amount = assertAmount(input.requestedAmount, 'Requested amount');
  const currency = assertCurrency(input.currency || opportunity.currency);
  if (currency !== opportunity.currency) throw errors.unprocessable('CURRENCY_MISMATCH', 'Use the opportunity currency.');
  if (amount < money(opportunity.minimumAmount) || (opportunity.maximumAmount && amount > money(opportunity.maximumAmount))) {
    throw errors.unprocessable('AMOUNT_RANGE', 'The amount must fall between the minimum and maximum for this opportunity.');
  }
  if (amount > money(opportunity.targetAmount) - money(opportunity.amountRaised)) {
    throw errors.unprocessable('OPPORTUNITY_FULL', 'The opportunity does not have that much capacity left.');
  }
  const submit = input.mode !== 'draft';
  if (submit && !(input.confirmInformation && input.reviewedTerms && input.understandRisks && input.agreeAgreement)) {
    throw errors.unprocessable('DECLARATION_REQUIRED', 'Confirm the information, terms, risks, and agreement before submitting.');
  }
  const created = await prisma.investmentApplication.create({
    data: {
      publicId: await nextPublicId('IAP'),
      schoolId: member.schoolId,
      registrationId: member.registrationId,
      opportunityId: opportunity.id,
      representative: input.representative.trim(),
      telephone: input.telephone.trim(),
      email: clean(input.email),
      requestedAmount: decimal(amount),
      currency,
      investmentPeriod: input.investmentPeriod.trim(),
      purpose: clean(input.purpose),
      fundingSource: input.fundingSource,
      confirmInformation: Boolean(input.confirmInformation),
      reviewedTerms: Boolean(input.reviewedTerms),
      understandRisks: Boolean(input.understandRisks),
      agreeAgreement: Boolean(input.agreeAgreement),
      documents: jsonDocs(readDocs(input.documents)),
      status: submit ? 'SUBMITTED' : 'DRAFT',
    },
  });
  await audit({ trace, entityType: 'Application', entityId: created.publicId, action: submit ? 'Application submitted' : 'Application drafted', newStatus: created.status, amount });
  return getApplication(created.publicId);
}

export async function reviewEligibility(id: string, input: { decision: string; comments?: string }, trace: Trace) {
  const row = await findApplication(id);
  const member = await resolveMember({ memberId: memberName(row).id, memberSource: memberName(row).source });
  const exposure = await prisma.investmentPosition.findMany({
    where: { OR: [{ schoolId: row.schoolId ?? undefined }, { registrationId: row.registrationId ?? undefined }], status: { in: ['ACTIVE', 'FUNDING', 'AGREEMENT_SIGNED'] } },
    include: { ledger: true },
  });
  const checks = {
    activeMembership: member.active,
    feesCurrent: !member.overdue,
    minimumAmount: money(row.requestedAmount) >= money(row.opportunity.minimumAmount),
    documents: readDocs(row.documents).length > 0,
    withinLimit: !row.opportunity.maximumAmount || money(row.requestedAmount) <= money(row.opportunity.maximumAmount),
    exposure: roundMoney(exposure.reduce((sum, item) => sum + ledgerBalance(item.ledger), 0)),
    obligations: !member.overdue,
  };
  const eligible = checks.activeMembership && checks.feesCurrent && checks.minimumAmount && checks.documents && checks.withinLimit && checks.obligations;
  const result = eligible ? 'ELIGIBLE' : input.decision === 'MORE_INFORMATION' ? 'REQUIRES_REVIEW' : 'NOT_ELIGIBLE';
  if (!['APPROVED_FOR_ASSESSMENT', 'MORE_INFORMATION', 'NOT_ELIGIBLE'].includes(input.decision)) {
    throw errors.unprocessable('DECISION_INVALID', 'Choose an eligibility decision.');
  }
  if (input.decision === 'APPROVED_FOR_ASSESSMENT' && !eligible) {
    throw errors.unprocessable('NOT_ELIGIBLE', 'Clear the failed eligibility checks, or request more information.');
  }
  await prisma.investmentApplication.update({
    where: { id: row.id },
    data: {
      eligibility: checks,
      eligibilityResult: result,
      eligibilityDecision: input.decision,
      eligibilityComments: clean(input.comments),
      status: input.decision === 'NOT_ELIGIBLE' ? 'REJECTED' : 'UNDER_REVIEW',
    },
  });
  await audit({ trace, entityType: 'Application', entityId: row.publicId, action: 'Eligibility reviewed', previousStatus: row.status, newStatus: input.decision, reason: input.comments });
  return getApplication(id);
}

export async function saveDiligence(id: string, input: { businessModel: boolean; viability: boolean; performance: boolean; cashFlows: boolean; ownership: boolean; regulatory: boolean; risks: boolean; documents: { documentType: string; status: string; comment?: string }[]; result: string }, trace: Trace) {
  const row = await findApplication(id);
  if (!['PASSED', 'FAILED', 'MORE_INFORMATION_REQUIRED'].includes(input.result)) throw errors.unprocessable('RESULT_INVALID', 'Choose a due diligence result.');
  const flags = [input.businessModel, input.viability, input.performance, input.cashFlows, input.ownership, input.regulatory, input.risks];
  if (input.result === 'PASSED' && flags.some((flag) => !flag)) throw errors.unprocessable('DILIGENCE_INCOMPLETE', 'Pass due diligence only when every review item is confirmed.');
  await prisma.investmentApplication.update({
    where: { id: row.id },
    data: { diligence: { ...input }, diligenceResult: input.result, status: input.result === 'FAILED' ? 'REJECTED' : 'UNDER_REVIEW' },
  });
  await audit({ trace, entityType: 'Application', entityId: row.publicId, action: 'Due diligence', newStatus: input.result });
  return getApplication(id);
}

export async function saveRisk(id: string, input: { ratings: Record<string, { rating: string; mitigation?: string }>; riskLevel: string; riskScore?: number; mitigationPlan: string; assessor: string; assessmentDate: string; reviewDate: string }, trace: Trace) {
  const row = await findApplication(id);
  if (!RATINGS.includes(input.riskLevel)) throw errors.unprocessable('RISK_LEVEL', 'Rate the overall risk as low, medium, or high.');
  for (const key of RISKS) {
    const rating = input.ratings?.[key]?.rating;
    if (!rating || !RATINGS.includes(rating)) throw errors.unprocessable('RISK_INCOMPLETE', 'Rate every risk category.');
  }
  if (!clean(input.mitigationPlan) || !clean(input.assessor)) throw errors.unprocessable('RISK_INCOMPLETE', 'Enter the mitigation plan and the assessor.');
  notFuture(input.assessmentDate);
  await prisma.investmentApplication.update({
    where: { id: row.id },
    data: {
      risk: input.ratings as Prisma.InputJsonValue,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore == null ? null : decimal(input.riskScore),
      mitigationPlan: input.mitigationPlan.trim(),
      assessor: input.assessor.trim(),
      assessmentDate: day(input.assessmentDate),
      reviewDate: day(input.reviewDate),
    },
  });
  await audit({ trace, entityType: 'Application', entityId: row.publicId, action: 'Risk assessed', newStatus: input.riskLevel, reference: input.assessor });
  return getApplication(id);
}

export async function decideApplication(id: string, input: {
  decision: string;
  approvedAmount?: number;
  investmentPeriod?: string;
  returnRate?: number;
  returnFrequency?: string;
  fees?: number;
  conditions?: string;
  startDate?: string;
  maturityDate?: string;
  comments?: string;
}, trace: Trace) {
  const row = await findApplication(id);
  if (!['APPROVE', 'CONDITIONAL', 'MORE_INFORMATION', 'REJECT'].includes(input.decision)) throw errors.unprocessable('DECISION_INVALID', 'Choose an approval decision.');
  if (input.decision === 'REJECT' || input.decision === 'MORE_INFORMATION') {
    await prisma.investmentApplication.update({
      where: { id: row.id },
      data: { decision: input.decision, status: input.decision === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW', approvalComments: clean(input.comments), approvedBy: await actorLabel(trace.actorId), approvalDate: new Date() },
    });
    await audit({ trace, entityType: 'Application', entityId: row.publicId, action: 'Application decision', previousStatus: row.status, newStatus: input.decision, reason: input.comments });
    return getApplication(id);
  }
  if (row.eligibilityResult !== 'ELIGIBLE' || row.diligenceResult !== 'PASSED' || !row.riskLevel) {
    throw errors.unprocessable('REVIEW_INCOMPLETE', 'Complete eligibility, due diligence, and risk assessment before approval.');
  }
  if (!input.startDate || !input.maturityDate || input.maturityDate < input.startDate) throw errors.unprocessable('DATE_RANGE', 'Enter a maturity date on or after the start date.');
  const amount = assertAmount(input.approvedAmount ?? money(row.requestedAmount), 'Approved amount');
  if (amount > money(row.requestedAmount)) throw errors.unprocessable('AMOUNT_RANGE', 'The approved amount cannot exceed the request.');
  const officer = await actorLabel(trace.actorId);
  const position = await prisma.$transaction(async (tx) => {
    await tx.investmentApplication.update({
      where: { id: row.id },
      data: {
        decision: input.decision,
        status: 'APPROVED',
        approvedAmount: decimal(amount),
        approvedPeriod: input.investmentPeriod || row.investmentPeriod,
        returnRate: decimal(input.returnRate ?? money(row.opportunity.expectedReturnRate)),
        returnFrequency: input.returnFrequency || row.opportunity.returnFrequency,
        fees: decimal(roundMoney(input.fees ?? 0)),
        conditions: clean(input.conditions),
        startDate: day(input.startDate),
        maturityDate: day(input.maturityDate),
        approvedBy: officer,
        approvalDate: new Date(),
        approvalComments: clean(input.comments),
      },
    });
    return tx.investmentPosition.create({
      data: {
        publicId: await nextPublicId('IVT'),
        applicationId: row.id,
        schoolId: row.schoolId,
        registrationId: row.registrationId,
        opportunityId: row.opportunityId,
        amount: decimal(amount),
        currency: row.currency,
        period: input.investmentPeriod || row.investmentPeriod,
        returnRate: decimal(input.returnRate ?? money(row.opportunity.expectedReturnRate)),
        returnFrequency: input.returnFrequency || row.opportunity.returnFrequency,
        fees: decimal(roundMoney(input.fees ?? 0)),
        conditions: clean(input.conditions),
        startDate: day(input.startDate)!,
        maturityDate: day(input.maturityDate)!,
        status: 'APPROVED',
      },
    });
  });
  await audit({ trace, entityType: 'Investment', entityId: position.publicId, positionId: position.id, action: 'Investment approved', newStatus: 'APPROVED', amount, reason: input.comments });
  return getApplication(id);
}

function positionView(row: PositionGraph) {
  const member = memberName(row);
  const balance = ledgerBalance(row.ledger);
  const contributed = roundMoney(row.ledger.filter((entry) => entry.entryType === 'CONTRIBUTION').reduce((sum, entry) => sum + money(entry.amount), 0));
  const realized = roundMoney(row.ledger.filter((entry) => entry.entryType === 'RETURN' || entry.entryType === 'DIVIDEND').reduce((sum, entry) => sum + money(entry.amount), 0));
  const withdrawn = roundMoney(row.ledger.filter((entry) => ['WITHDRAWAL', 'REDEMPTION', 'REFUND'].includes(entry.entryType)).reduce((sum, entry) => sum + Math.abs(money(entry.amount)), 0));
  return {
    id: row.publicId,
    member: member.name,
    memberId: member.id,
    memberNumber: member.number,
    opportunityId: row.opportunity.publicId,
    opportunity: row.opportunity.name,
    amount: money(row.amount),
    currency: row.currency,
    returnRate: money(row.returnRate),
    returnFrequency: row.returnFrequency,
    startDate: dateOnly(row.startDate),
    maturityDate: dateOnly(row.maturityDate),
    status: row.status,
    agreementAccepted: row.agreementAccepted,
    currentValue: balance,
    contributed,
    realized,
    withdrawn,
    available: balance,
    expectedReturn: roundMoney(money(row.amount) * money(row.returnRate) / 100),
  };
}

export async function listPositions(query: { status?: string; q?: string }) {
  const rows = await prisma.investmentPosition.findMany({ include: positionInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  const today = todayIso();
  return rows.filter((row) => {
    if (query.status === 'MATURED') return row.status === 'MATURED' || (row.status === 'ACTIVE' && dateOnly(row.maturityDate)! <= today);
    if (query.status === 'UPCOMING') return row.status === 'ACTIVE' && dateOnly(row.maturityDate)! <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    if (query.status && row.status !== query.status) return false;
    if (!query.q) return true;
    const needle = query.q.toLowerCase();
    return [row.publicId, row.opportunity.name, memberName(row).name].some((part) => part.toLowerCase().includes(needle));
  }).map(positionView);
}

export async function getPosition(id: string) {
  const row = await findPosition(id);
  return {
    ...positionView(row),
    period: row.period,
    fees: money(row.fees),
    conditions: row.conditions,
    acceptedBy: row.acceptedBy,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    agreementVersion: row.agreementVersion,
    maturityInstruction: row.maturityInstruction,
    statementGenerated: row.statementGenerated,
    obligationsSettled: row.obligationsSettled,
    closureReason: row.closureReason,
    contributions: row.contributions.map((item) => ({
      id: item.publicId,
      amount: money(item.amount),
      currency: item.currency,
      date: dateOnly(item.contributionDate),
      paymentMethod: item.paymentMethod,
      status: item.status,
      reconciliationStatus: item.reconciliationStatus,
      paymentReference: item.paymentReference,
      externalTransactionId: item.externalTransactionId,
      receivedAmount: item.receivedAmount == null ? null : money(item.receivedAmount),
      allocatedUnits: item.allocatedUnits == null ? null : money(item.allocatedUnits),
      allocationPercent: item.allocationPercent == null ? null : money(item.allocationPercent),
      railName: item.railName,
    })),
    payouts: row.payouts.map((item) => ({ id: item.publicId, kind: item.kind, period: item.period, gross: money(item.grossReturn), net: money(item.netReturn), status: item.status })),
    exits: row.exits.map((item) => ({ id: item.publicId, kind: item.kind, amount: money(item.requestedAmount), net: money(item.netAmount), status: item.status, decision: item.decision })),
    ledger: row.ledger.map((item) => ({ date: item.createdAt.toISOString(), type: item.entryType, description: item.description, amount: money(item.amount), currency: item.currency, reference: item.reference })),
  };
}

export async function acceptAgreement(id: string, input: { representative: string; version?: string }, trace: Trace) {
  const row = await findPosition(id);
  if (row.status !== 'APPROVED') throw errors.unprocessable('AGREEMENT_CLOSED', 'Accept the agreement while the investment is approved.');
  if (!clean(input.representative)) throw errors.unprocessable('REPRESENTATIVE_REQUIRED', 'Enter the member representative who accepts the agreement.');
  const officer = await actorLabel(trace.actorId);
  await prisma.investmentPosition.update({
    where: { id: row.id },
    data: { agreementAccepted: true, acceptedBy: `${input.representative.trim()} · ${officer}`, acceptedAt: new Date(), agreementVersion: clean(input.version) ?? '1', status: 'AGREEMENT_SIGNED' },
  });
  await audit({ trace, entityType: 'Investment', entityId: row.publicId, positionId: row.id, action: 'Agreement accepted', previousStatus: row.status, newStatus: 'AGREEMENT_SIGNED', reference: trace.requestId });
  return getPosition(id);
}

export async function contribute(id: string, input: { amount: number; contributionDate: string; paymentMethod: string; bank?: string; accountReference?: string }, trace: Trace) {
  const row = await findPosition(id);
  if (!FUNDABLE.includes(row.status)) throw errors.unprocessable('NOT_FUNDABLE', 'Accept the agreement before recording a contribution.');
  const amount = assertAmount(input.amount);
  const already = row.contributions.filter((item) => ['INITIATED', 'PENDING', 'SUCCESS'].includes(item.status)).reduce((sum, item) => sum + money(item.amount), 0);
  if (already + amount > money(row.amount)) throw errors.unprocessable('AMOUNT_RANGE', 'Contributions cannot exceed the approved amount.');
  notFuture(input.contributionDate);
  if (!['BANK_TRANSFER', 'MOBILE_PAYMENT', 'CASH', 'OTHER'].includes(input.paymentMethod)) throw errors.unprocessable('METHOD_INVALID', 'Choose a payment method.');
  let railCode: string | null = null;
  let railName: string | null = null;
  if (input.paymentMethod === 'BANK_TRANSFER' || input.paymentMethod === 'MOBILE_PAYMENT') {
    const route = await routeInstruction({ channel: input.paymentMethod === 'BANK_TRANSFER' ? 'BANK' : 'MOBILE_PAYMENT', originCountry: 'RW', destinationCountry: 'RW' });
    railCode = route.rail.code;
    railName = route.rail.name;
  }
  const reference = await nextPublicId('ICT');
  const created = await prisma.investmentContribution.create({
    data: {
      publicId: reference,
      positionId: row.id,
      amount: decimal(amount),
      currency: row.currency,
      contributionDate: day(input.contributionDate)!,
      paymentMethod: input.paymentMethod,
      bank: clean(input.bank),
      accountReference: clean(input.accountReference),
      paymentReference: reference,
      status: input.paymentMethod === 'CASH' || input.paymentMethod === 'OTHER' ? 'PENDING' : 'INITIATED',
      reconciliationStatus: 'PENDING',
      railCode,
      railName,
    },
  });
  if (row.status === 'AGREEMENT_SIGNED') await prisma.investmentPosition.update({ where: { id: row.id }, data: { status: 'FUNDING' } });
  await audit({ trace, entityType: 'Contribution', entityId: created.publicId, positionId: row.id, action: 'Contribution initiated', newStatus: created.status, amount, reference });
  return getPosition(id);
}

export async function confirmContribution(id: string, contributionId: string, input: { outcome: 'SUCCESS' | 'FAILED'; externalTransactionId?: string; receivedAmount?: number }, trace: Trace) {
  const row = await findPosition(id);
  const payment = row.contributions.find((item) => item.publicId === contributionId);
  if (!payment || !['INITIATED', 'PENDING'].includes(payment.status)) throw errors.unprocessable('PAYMENT_CLOSED', 'This contribution is not awaiting confirmation.');
  if (input.outcome === 'FAILED') {
    await prisma.investmentContribution.update({ where: { id: payment.id }, data: { status: 'FAILED', reconciliationStatus: 'FAILED' } });
    await audit({ trace, entityType: 'Contribution', entityId: payment.publicId, positionId: row.id, action: 'Contribution failed', previousStatus: payment.status, newStatus: 'FAILED' });
    return getPosition(id);
  }
  const received = roundMoney(input.receivedAmount ?? money(payment.amount));
  const duplicate = input.externalTransactionId
    ? await prisma.investmentContribution.findFirst({ where: { externalTransactionId: input.externalTransactionId, status: 'SUCCESS', NOT: { id: payment.id } } })
    : null;
  const matched = received === money(payment.amount) && Boolean(clean(input.externalTransactionId)) && !duplicate;
  if (!matched) {
    await prisma.investmentContribution.update({
      where: { id: payment.id },
      data: { status: 'PENDING', reconciliationStatus: duplicate ? 'DUPLICATE' : 'UNMATCHED', receivedAmount: decimal(received), externalTransactionId: clean(input.externalTransactionId) },
    });
    return getPosition(id);
  }
  const percent = roundMoney((received / money(row.opportunity.targetAmount)) * 100);
  await prisma.$transaction(async (tx) => {
    await tx.investmentContribution.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', reconciliationStatus: 'MATCHED', receivedAmount: decimal(received), externalTransactionId: input.externalTransactionId, allocatedUnits: decimal(received), unitPrice: decimal(1), allocationPercent: decimal(percent), allocatedAt: new Date() },
    });
    await tx.investmentLedgerEntry.create({
      data: { positionId: row.id, entryType: 'CONTRIBUTION', amount: decimal(received), currency: row.currency, description: 'Investment contribution', reference: payment.publicId },
    });
    const raised = money(row.opportunity.amountRaised) + received;
    await tx.investmentOpportunity.update({
      where: { id: row.opportunityId },
      data: { amountRaised: decimal(raised), status: raised >= money(row.opportunity.targetAmount) ? 'FULLY_SUBSCRIBED' : row.opportunity.status },
    });
    await tx.investmentPosition.update({ where: { id: row.id }, data: { status: 'ACTIVE' } });
  });
  await audit({ trace, entityType: 'Contribution', entityId: payment.publicId, positionId: row.id, action: 'Contribution allocated', previousStatus: payment.status, newStatus: 'SUCCESS', amount: received, reference: input.externalTransactionId });
  return getPosition(id);
}

export async function recordReturn(id: string, input: { period: string; tax?: number; paymentDate?: string; reviewedBy: string }, trace: Trace) {
  const row = await findPosition(id);
  if (row.status !== 'ACTIVE' && row.status !== 'MATURED') throw errors.unprocessable('NOT_ACTIVE', 'Returns are recorded on an active or matured investment.');
  const principal = ledgerBalance(row.ledger.filter((entry) => entry.entryType === 'CONTRIBUTION'));
  if (principal <= 0) throw errors.unprocessable('NO_PRINCIPAL', 'A matched contribution is required before a return.');
  const gross = roundMoney(principal * money(row.returnRate) / 100);
  const fee = roundMoney(principal * money(row.opportunity.managementFeeRate) / 100);
  const charges = money(row.opportunity.otherCharges);
  const tax = roundMoney(input.tax ?? 0);
  const net = roundMoney(gross - fee - charges - tax);
  if (net < 0) throw errors.unprocessable('NET_NEGATIVE', 'Fees and tax cannot exceed the gross return.');
  const officer = await actorLabel(trace.actorId);
  if (input.reviewedBy.trim().toLowerCase() === officer.toLowerCase()) throw errors.unprocessable('SEGREGATION', 'The reviewer must be a different officer from the calculator.');
  const created = await prisma.investmentPayout.create({
    data: {
      publicId: await nextPublicId('IRT'),
      positionId: row.id,
      opportunityId: row.opportunityId,
      kind: 'RETURN',
      period: input.period.trim(),
      principal: decimal(principal),
      rate: row.returnRate,
      grossReturn: decimal(gross),
      managementFee: decimal(fee),
      otherCharges: decimal(charges),
      tax: decimal(tax),
      netReturn: decimal(net),
      paymentDate: input.paymentDate ? day(input.paymentDate) : null,
      status: 'CALCULATED',
      calculatedBy: officer,
      reviewedBy: input.reviewedBy.trim(),
    },
  });
  await audit({ trace, entityType: 'Return', entityId: created.publicId, positionId: row.id, action: 'Return calculated', newStatus: 'CALCULATED', amount: net });
  return getPosition(id);
}

export async function approvePayout(id: string, payoutId: string, trace: Trace) {
  const row = await findPosition(id);
  const payout = row.payouts.find((item) => item.publicId === payoutId);
  if (!payout || payout.status !== 'CALCULATED') throw errors.unprocessable('PAYOUT_CLOSED', 'This return is not waiting for approval.');
  const officer = await actorLabel(trace.actorId);
  if (officer.toLowerCase() === payout.calculatedBy.toLowerCase()) throw errors.unprocessable('SEGREGATION', 'A different officer approves the return.');
  await prisma.$transaction(async (tx) => {
    await tx.investmentPayout.update({ where: { id: payout.id }, data: { status: 'PAID', approvedBy: officer, approvalDate: new Date() } });
    const credited = roundMoney(money(payout.grossReturn) - money(payout.tax));
    await tx.investmentLedgerEntry.create({ data: { positionId: row.id, entryType: payout.kind, amount: decimal(credited), currency: row.currency, description: `${payout.kind === 'DIVIDEND' ? 'Dividend' : 'Return'} ${payout.period}`, reference: payout.publicId } });
    const charges = roundMoney(money(payout.managementFee) + money(payout.otherCharges));
    if (charges > 0) {
      await tx.investmentLedgerEntry.create({ data: { positionId: row.id, entryType: 'FEE', amount: decimal(-charges), currency: row.currency, description: 'Investment fees', reference: payout.publicId } });
    }
  });
  await audit({ trace, entityType: 'Return', entityId: payout.publicId, positionId: row.id, action: 'Return paid', previousStatus: 'CALCULATED', newStatus: 'PAID', amount: money(payout.netReturn) });
  return getPosition(id);
}

export async function distributeDividend(opportunityId: string, input: { period: string; totalDividend: number; distributionDate: string }, trace: Trace) {
  const opportunity = await prisma.investmentOpportunity.findUnique({ where: { publicId: opportunityId }, include: { positions: { include: { ledger: true, school: true, registration: true } } } });
  if (!opportunity) throw errors.notFound('OPPORTUNITY_NOT_FOUND', 'Investment opportunity was not found.');
  const holders = opportunity.positions.filter((row) => row.status === 'ACTIVE').map((row) => ({ row, principal: ledgerBalance(row.ledger.filter((entry) => entry.entryType === 'CONTRIBUTION')) })).filter((item) => item.principal > 0);
  const base = holders.reduce((sum, item) => sum + item.principal, 0);
  if (base <= 0) throw errors.unprocessable('NO_HOLDERS', 'There is no active holding to receive a dividend.');
  const total = assertAmount(input.totalDividend, 'Total dividend');
  notFuture(input.distributionDate);
  const officer = await actorLabel(trace.actorId);
  for (const holder of holders) {
    const share = holder.principal / base;
    const net = roundMoney(total * share);
    await prisma.investmentPayout.create({
      data: {
        publicId: await nextPublicId('IRT'),
        positionId: holder.row.id,
        opportunityId: opportunity.id,
        kind: 'DIVIDEND',
        period: input.period.trim(),
        principal: decimal(holder.principal),
        rate: decimal(roundMoney(share * 100)),
        grossReturn: decimal(net),
        netReturn: decimal(net),
        paymentDate: day(input.distributionDate),
        status: 'CALCULATED',
        calculatedBy: officer,
        holdingPercent: decimal(roundMoney(share * 100)),
      },
    });
  }
  await audit({ trace, entityType: 'Opportunity', entityId: opportunity.publicId, action: 'Dividend calculated', amount: total, reference: input.period });
  return { holders: holders.length, total };
}

export async function requestExit(id: string, input: { kind: string; redemptionType?: string; amount: number; reason: string; requestDate: string; bankAccount?: string; destination: string; originalReference?: string }, trace: Trace) {
  const row = await findPosition(id);
  if (!['ACTIVE', 'MATURED', 'WITHDRAWAL_REQUESTED'].includes(row.status)) throw errors.unprocessable('NOT_OPEN', 'This investment cannot be withdrawn.');
  if (!['WITHDRAWAL', 'REDEMPTION', 'REFUND'].includes(input.kind)) throw errors.unprocessable('EXIT_INVALID', 'Choose a withdrawal, redemption, or refund.');
  const amount = assertAmount(input.amount);
  const available = ledgerBalance(row.ledger);
  if (amount > available) throw errors.unprocessable('AMOUNT_RANGE', 'The amount exceeds the available balance.');
  const early = input.kind === 'REDEMPTION' && input.redemptionType === 'EARLY' && dateOnly(row.maturityDate)! > todayIso();
  const penalty = early ? roundMoney(amount * money(row.opportunity.earlyRedemptionRate) / 100) : 0;
  const net = roundMoney(amount - penalty);
  if (input.kind === 'REDEMPTION' && !['FULL', 'PARTIAL', 'MATURITY', 'EARLY'].includes(input.redemptionType ?? '')) {
    throw errors.unprocessable('REDEMPTION_TYPE', 'Choose the redemption type.');
  }
  notFuture(input.requestDate);
  const created = await prisma.investmentExit.create({
    data: {
      publicId: await nextPublicId('IXT'),
      positionId: row.id,
      kind: input.kind,
      redemptionType: clean(input.redemptionType),
      requestedAmount: decimal(amount),
      currency: row.currency,
      reason: input.reason.trim(),
      requestDate: day(input.requestDate)!,
      bankAccount: clean(input.bankAccount),
      destination: input.destination.trim(),
      penalty: decimal(penalty),
      netAmount: decimal(net),
      originalReference: clean(input.originalReference),
      status: 'REQUESTED',
    },
  });
  await prisma.investmentPosition.update({ where: { id: row.id }, data: { status: 'WITHDRAWAL_REQUESTED' } });
  await audit({ trace, entityType: 'Exit', entityId: created.publicId, positionId: row.id, action: `${input.kind} requested`, previousStatus: row.status, newStatus: 'REQUESTED', amount });
  return getPosition(id);
}

export async function decideExit(id: string, exitId: string, input: { decision: string; comments?: string }, trace: Trace) {
  const row = await findPosition(id);
  const exit = row.exits.find((item) => item.publicId === exitId);
  if (!exit || exit.status !== 'REQUESTED') throw errors.unprocessable('EXIT_CLOSED', 'This request is not awaiting a decision.');
  if (!['APPROVE', 'REJECT', 'PARTIAL', 'MORE_INFORMATION'].includes(input.decision)) throw errors.unprocessable('DECISION_INVALID', 'Choose a decision.');
  const officer = await actorLabel(trace.actorId);
  const next = input.decision === 'APPROVE' || input.decision === 'PARTIAL' ? 'APPROVED' : input.decision === 'REJECT' ? 'REJECTED' : 'REQUESTED';
  await prisma.investmentExit.update({ where: { id: exit.id }, data: { decision: input.decision, status: next, approvedBy: officer } });
  if (next === 'REJECTED') await prisma.investmentPosition.update({ where: { id: row.id }, data: { status: 'ACTIVE' } });
  await audit({ trace, entityType: 'Exit', entityId: exit.publicId, positionId: row.id, action: 'Exit decision', previousStatus: exit.status, newStatus: next, reason: input.comments });
  return getPosition(id);
}

export async function completeExit(id: string, exitId: string, trace: Trace) {
  const row = await findPosition(id);
  const exit = row.exits.find((item) => item.publicId === exitId);
  if (!exit || exit.status !== 'APPROVED') throw errors.unprocessable('EXIT_NOT_APPROVED', 'Approve the request before paying it.');
  let reference = exit.publicId;
  if (exit.bankAccount) {
    const route = await routeInstruction({ channel: 'BANK', originCountry: 'RW', destinationCountry: 'RW' });
    reference = route.rail.code;
  }
  const type = exit.kind === 'REFUND' ? 'REFUND' : exit.kind === 'REDEMPTION' ? 'REDEMPTION' : 'WITHDRAWAL';
  await prisma.$transaction(async (tx) => {
    await tx.investmentExit.update({ where: { id: exit.id }, data: { status: 'COMPLETED', paymentReference: reference } });
    await tx.investmentLedgerEntry.create({ data: { positionId: row.id, entryType: type, amount: decimal(-money(exit.netAmount)), currency: row.currency, description: type, reference: exit.publicId } });
    if (money(exit.penalty) > 0) {
      await tx.investmentLedgerEntry.create({ data: { positionId: row.id, entryType: 'FEE', amount: decimal(-money(exit.penalty)), currency: row.currency, description: 'Exit penalty', reference: exit.publicId } });
    }
    const remaining = ledgerBalance(row.ledger) - money(exit.netAmount) - money(exit.penalty);
    await tx.investmentPosition.update({ where: { id: row.id }, data: { status: remaining <= 0 ? 'REDEEMED' : 'ACTIVE' } });
  });
  await audit({ trace, entityType: 'Exit', entityId: exit.publicId, positionId: row.id, action: 'Exit paid', previousStatus: 'APPROVED', newStatus: 'COMPLETED', amount: money(exit.netAmount), reference });
  return getPosition(id);
}

export async function requestTransfer(id: string, input: { toPositionId: string; amount: number; fees?: number; reason: string; transferDate: string; documents?: Doc[] }, trace: Trace) {
  const from = await findPosition(id);
  const to = await findPosition(input.toPositionId);
  if (from.opportunityId !== to.opportunityId) throw errors.unprocessable('OPPORTUNITY_MISMATCH', 'Transfer only within the same opportunity.');
  if (from.id === to.id) throw errors.unprocessable('TRANSFER_SELF', 'Choose a different member.');
  const amount = assertAmount(input.amount);
  if (amount > ledgerBalance(from.ledger)) throw errors.unprocessable('AMOUNT_RANGE', 'The transfer exceeds the available balance.');
  notFuture(input.transferDate);
  const officer = await actorLabel(trace.actorId);
  const created = await prisma.investmentTransfer.create({
    data: {
      publicId: await nextPublicId('ITR'),
      fromPositionId: from.id,
      toPositionId: to.id,
      amount: decimal(amount),
      fees: decimal(roundMoney(input.fees ?? 0)),
      reason: input.reason.trim(),
      transferDate: day(input.transferDate)!,
      documents: jsonDocs(readDocs(input.documents)),
      requestedBy: officer,
    },
  });
  await audit({ trace, entityType: 'Transfer', entityId: created.publicId, positionId: from.id, action: 'Transfer requested', amount, reference: to.publicId });
  return { id: created.publicId, status: created.status };
}

export async function decideTransfer(id: string, input: { decision: 'APPROVE' | 'REJECT'; reviewedBy: string }, trace: Trace) {
  const transfer = await prisma.investmentTransfer.findUnique({ where: { publicId: id }, include: { fromPosition: true, toPosition: true } });
  if (!transfer || transfer.status !== 'REQUESTED') throw errors.notFound('TRANSFER_NOT_FOUND', 'Transfer request was not found.');
  const officer = await actorLabel(trace.actorId);
  if (input.decision === 'REJECT') {
    await prisma.investmentTransfer.update({ where: { id: transfer.id }, data: { status: 'REJECTED', reviewedBy: input.reviewedBy, approvedBy: officer } });
    return { id: transfer.publicId, status: 'REJECTED' };
  }
  if (input.reviewedBy.trim().toLowerCase() === officer.toLowerCase()) throw errors.unprocessable('SEGREGATION', 'The reviewer and approver must be different officers.');
  const fees = money(transfer.fees);
  await prisma.$transaction(async (tx) => {
    await tx.investmentTransfer.update({ where: { id: transfer.id }, data: { status: 'APPROVED', reviewedBy: input.reviewedBy.trim(), approvedBy: officer } });
    await tx.investmentLedgerEntry.create({ data: { positionId: transfer.fromPositionId, entryType: 'TRANSFER', amount: decimal(-money(transfer.amount)), currency: transfer.fromPosition.currency, description: `Transfer to ${transfer.toPosition.publicId}`, reference: transfer.publicId } });
    await tx.investmentLedgerEntry.create({ data: { positionId: transfer.toPositionId, entryType: 'TRANSFER', amount: transfer.amount, currency: transfer.toPosition.currency, description: `Transfer from ${transfer.fromPosition.publicId}`, reference: transfer.publicId } });
    if (fees > 0) await tx.investmentLedgerEntry.create({ data: { positionId: transfer.fromPositionId, entryType: 'FEE', amount: decimal(-fees), currency: transfer.fromPosition.currency, description: 'Transfer fee', reference: transfer.publicId } });
  });
  await audit({ trace, entityType: 'Transfer', entityId: transfer.publicId, positionId: transfer.fromPositionId, action: 'Transfer approved', previousStatus: 'REQUESTED', newStatus: 'APPROVED', amount: money(transfer.amount) });
  return { id: transfer.publicId, status: 'APPROVED' };
}

export async function instructMaturity(id: string, input: { instruction: string; reinvestAmount?: number; opportunityId?: string }, trace: Trace) {
  const row = await findPosition(id);
  if (!['REDEEM', 'REINVEST', 'PARTIAL'].includes(input.instruction)) throw errors.unprocessable('INSTRUCTION_INVALID', 'Choose redeem, reinvest, or a partial instruction.');
  if (dateOnly(row.maturityDate)! > todayIso() && row.status === 'ACTIVE') {
    await prisma.investmentPosition.update({ where: { id: row.id }, data: { status: 'MATURED', maturityInstruction: input.instruction } });
  } else {
    await prisma.investmentPosition.update({ where: { id: row.id }, data: { maturityInstruction: input.instruction, status: row.status === 'ACTIVE' ? 'MATURED' : row.status } });
  }
  if (input.instruction === 'REDEEM') {
    await audit({ trace, entityType: 'Investment', entityId: row.publicId, positionId: row.id, action: 'Maturity instruction', newStatus: 'REDEEM' });
    return getPosition(id);
  }
  if (!input.opportunityId) throw errors.unprocessable('OPPORTUNITY_REQUIRED', 'Choose the opportunity that receives the reinvestment.');
  const available = ledgerBalance(row.ledger);
  const amount = input.instruction === 'REINVEST' ? available : assertAmount(input.reinvestAmount ?? 0);
  if (amount <= 0 || amount > available) throw errors.unprocessable('AMOUNT_RANGE', 'The reinvestment must be within the available balance.');
  const target = await findOpportunity(input.opportunityId);
  if (!OPEN_OPPORTUNITY.includes(target.status) && target.publicId !== row.opportunity.publicId) {
    throw errors.unprocessable('OPPORTUNITY_CLOSED', 'The new opportunity is not open.');
  }
  if (target.currency !== row.currency) throw errors.unprocessable('CURRENCY_MISMATCH', 'Reinvest into an opportunity that uses the same currency.');
  const officer = await actorLabel(trace.actorId);
  const member = memberName(row);
  const application = await prisma.investmentApplication.create({
    data: {
      publicId: await nextPublicId('IAP'),
      schoolId: row.schoolId,
      registrationId: row.registrationId,
      opportunityId: target.id,
      representative: officer,
      telephone: row.school?.phone ?? row.registration?.phone ?? '—',
      email: row.school?.email ?? row.registration?.email,
      requestedAmount: decimal(amount),
      currency: row.currency,
      investmentPeriod: target.investmentPeriod,
      fundingSource: 'RETAINED_EARNINGS',
      confirmInformation: true,
      reviewedTerms: true,
      understandRisks: true,
      agreeAgreement: true,
      status: 'APPROVED',
      eligibilityResult: 'ELIGIBLE',
      diligenceResult: 'PASSED',
      riskLevel: 'MEDIUM',
      decision: 'APPROVE',
      approvedAmount: decimal(amount),
      approvedBy: officer,
      approvalDate: new Date(),
      startDate: new Date(),
      maturityDate: target.endDate,
      approvedPeriod: target.investmentPeriod,
      returnRate: target.expectedReturnRate,
      returnFrequency: target.returnFrequency,
    },
  });
  const created = await prisma.investmentPosition.create({
    data: {
      publicId: await nextPublicId('IVT'),
      applicationId: application.id,
      schoolId: row.schoolId,
      registrationId: row.registrationId,
      opportunityId: target.id,
      amount: decimal(amount),
      currency: target.currency,
      period: target.investmentPeriod,
      returnRate: target.expectedReturnRate,
      returnFrequency: target.returnFrequency,
      startDate: new Date(),
      maturityDate: target.endDate,
      status: 'AGREEMENT_SIGNED',
      agreementAccepted: true,
      acceptedBy: officer,
      acceptedAt: new Date(),
    },
  });
  await prisma.$transaction(async (tx) => {
    await tx.investmentLedgerEntry.create({ data: { positionId: row.id, entryType: 'REDEMPTION', amount: decimal(-amount), currency: row.currency, description: `Reinvested to ${created.publicId}`, reference: created.publicId } });
    await tx.investmentLedgerEntry.create({ data: { positionId: created.id, entryType: 'CONTRIBUTION', amount: decimal(amount), currency: target.currency, description: `Reinvestment from ${row.publicId}`, reference: row.publicId } });
    await tx.investmentOpportunity.update({ where: { id: target.id }, data: { amountRaised: decimal(money(target.amountRaised) + amount) } });
    await tx.investmentPosition.update({ where: { id: created.id }, data: { status: 'ACTIVE' } });
    await tx.investmentPosition.update({ where: { id: row.id }, data: { reinvestAmount: decimal(amount), maturityInstruction: input.instruction, status: amount >= available ? 'SETTLED' : 'MATURED' } });
  });
  await audit({ trace, entityType: 'Investment', entityId: created.publicId, positionId: created.id, action: 'Reinvestment', amount, reference: member.number });
  return getPosition(created.publicId);
}

export async function adjust(id: string, input: { amount: number; adjustmentType: string; reason: string; documentName?: string }, trace: Trace) {
  const row = await findPosition(id);
  if (!clean(input.reason)) throw errors.unprocessable('REASON_REQUIRED', 'Enter the reason for the adjustment.');
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount === 0) throw errors.unprocessable('AMOUNT_INVALID', 'Enter a non-zero adjustment.');
  if (ledgerBalance(row.ledger) + amount < 0) throw errors.unprocessable('AMOUNT_RANGE', 'The adjustment cannot take the balance below zero.');
  const officer = await actorLabel(trace.actorId);
  await postLedger(row.id, 'ADJUSTMENT', amount, row.currency, input.reason.trim(), clean(input.documentName));
  await audit({ trace, entityType: 'Investment', entityId: row.publicId, positionId: row.id, action: 'Adjustment', amount, reason: `${input.adjustmentType}: ${input.reason}`, reference: officer });
  return getPosition(id);
}

export async function closePosition(id: string, input: { reason: string; obligationsSettled: boolean; statementGenerated: boolean; noBalance: boolean }, trace: Trace) {
  const row = await findPosition(id);
  if (!input.obligationsSettled || !input.statementGenerated || !input.noBalance) {
    throw errors.unprocessable('CLOSURE_INCOMPLETE', 'Confirm settlement, the final statement, and a zero balance.');
  }
  if (Math.abs(ledgerBalance(row.ledger)) > 0.009) throw errors.unprocessable('BALANCE_OPEN', 'The investment still has a balance.');
  await prisma.investmentPosition.update({
    where: { id: row.id },
    data: { status: 'CLOSED', obligationsSettled: true, statementGenerated: true, closureReason: input.reason.trim(), closedAt: new Date() },
  });
  await audit({ trace, entityType: 'Investment', entityId: row.publicId, positionId: row.id, action: 'Closed', previousStatus: row.status, newStatus: 'CLOSED', reason: input.reason });
  return getPosition(id);
}

export async function portfolio(memberId: string, memberSource?: string) {
  const member = await resolveMember({ memberId, memberSource });
  const rows = await prisma.investmentPosition.findMany({
    where: member.schoolId ? { schoolId: member.schoolId } : { registrationId: member.registrationId ?? undefined },
    include: positionInclude,
  });
  const items = rows.map(positionView);
  return {
    member: member.name,
    memberNumber: member.number,
    portfolioNumber: member.number,
    totalInvested: roundMoney(items.reduce((sum, item) => sum + item.contributed, 0)),
    currentValue: roundMoney(items.reduce((sum, item) => sum + item.currentValue, 0)),
    expectedReturn: roundMoney(items.reduce((sum, item) => sum + item.expectedReturn, 0)),
    realizedReturn: roundMoney(items.reduce((sum, item) => sum + item.realized, 0)),
    withdrawals: roundMoney(items.reduce((sum, item) => sum + item.withdrawn, 0)),
    netInvestment: roundMoney(items.reduce((sum, item) => sum + item.available, 0)),
    items,
  };
}

export async function statement(query: { memberId?: string; positionId?: string; from?: string; to?: string; entryType?: string }) {
  const rows = await prisma.investmentLedgerEntry.findMany({
    where: {
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.positionId || query.memberId ? {
        position: {
          ...(query.positionId ? { publicId: query.positionId } : {}),
          ...(query.memberId ? { OR: [{ school: { publicId: query.memberId } }, { registration: { publicId: query.memberId } }] } : {}),
        },
      } : {}),
    },
    include: { position: { include: { school: true, registration: true, opportunity: true } } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
  const inRange = (date: Date) => (!from || date >= from) && (!to || date <= to);
  const before = rows.filter((row) => from && row.createdAt < from);
  const selected = rows.filter((row) => inRange(row.createdAt));
  const total = (list: typeof rows, type?: string) => list.filter((row) => !type || row.entryType === type).reduce((sum, row) => sum + money(row.amount), 0);
  const opening = total(before);
  const contributions = total(selected, 'CONTRIBUTION');
  const returns = total(selected, 'RETURN') + total(selected, 'DIVIDEND');
  const fees = Math.abs(total(selected, 'FEE'));
  const withdrawals = Math.abs(total(selected, 'WITHDRAWAL') + total(selected, 'REDEMPTION') + total(selected, 'REFUND'));
  const adjustments = total(selected, 'ADJUSTMENT');
  return {
    openingBalance: roundMoney(opening),
    contributions: roundMoney(contributions),
    returns: roundMoney(returns),
    fees: roundMoney(fees),
    withdrawals: roundMoney(withdrawals),
    adjustments: roundMoney(adjustments),
    closingBalance: roundMoney(opening + contributions + returns - fees - withdrawals + adjustments + total(selected, 'TRANSFER')),
    lines: selected.map((row) => ({
      date: row.createdAt.toISOString(),
      investmentId: row.position.publicId,
      member: memberName(row.position).name,
      description: row.description,
      type: row.entryType,
      amount: money(row.amount),
      currency: row.currency,
      reference: row.reference,
    })),
  };
}

export async function report(type: string) {
  if (type === 'by-type' || type === 'by-sector' || type === 'by-location') {
    const rows = await prisma.investmentPosition.findMany({ include: { opportunity: true, ledger: true } });
    const key = type === 'by-type' ? 'investmentType' : type === 'by-sector' ? 'sector' : 'location';
    const groups = new Map<string, number>();
    for (const row of rows) {
      const label = row.opportunity[key];
      groups.set(label, roundMoney((groups.get(label) ?? 0) + ledgerBalance(row.ledger)));
    }
    return [...groups.entries()].map(([name, value]) => ({ name, value }));
  }
  if (type === 'performance') {
    const rows = await prisma.investmentPosition.findMany({ include: { opportunity: true, ledger: true, payouts: true } });
    return rows.map((row) => ({ investment: row.publicId, opportunity: row.opportunity.name, contributed: ledgerBalance(row.ledger.filter((entry) => entry.entryType === 'CONTRIBUTION')), realized: row.payouts.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + money(item.netReturn), 0), status: row.status }));
  }
  const positions = await prisma.investmentPosition.findMany({ include: { opportunity: true, school: true, registration: true, ledger: true } });
  if (type === 'active') return positions.filter((row) => row.status === 'ACTIVE').map((row) => ({ id: row.publicId, member: memberName(row).name, opportunity: row.opportunity.name, value: ledgerBalance(row.ledger), maturity: dateOnly(row.maturityDate) }));
  if (type === 'matured' || type === 'upcoming') {
    const limit = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    return positions.filter((row) => type === 'matured' ? row.status === 'MATURED' : row.status === 'ACTIVE' && dateOnly(row.maturityDate)! <= limit).map((row) => ({ id: row.publicId, member: memberName(row).name, maturity: dateOnly(row.maturityDate), value: ledgerBalance(row.ledger) }));
  }
  return positions.map((row) => ({ id: row.publicId, member: memberName(row).name, opportunity: row.opportunity.name, status: row.status, value: ledgerBalance(row.ledger) }));
}

export async function listPayouts() {
  const rows = await prisma.investmentPayout.findMany({ include: { position: { include: { school: true, registration: true, opportunity: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({ id: row.publicId, investmentId: row.position.publicId, member: memberName(row.position).name, kind: row.kind, period: row.period, net: money(row.netReturn), status: row.status }));
}

export async function listExits() {
  const rows = await prisma.investmentExit.findMany({ include: { position: { include: { school: true, registration: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({ id: row.publicId, investmentId: row.position.publicId, member: memberName(row.position).name, kind: row.kind, amount: money(row.requestedAmount), net: money(row.netAmount), status: row.status }));
}

export async function listTransfers() {
  const rows = await prisma.investmentTransfer.findMany({ include: { fromPosition: true, toPosition: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ id: row.publicId, from: row.fromPosition.publicId, to: row.toPosition.publicId, amount: money(row.amount), status: row.status }));
}

export async function sendMessage(input: { positionId?: string; kind: string; channel: string; subject: string; message: string }, trace: Trace) {
  if (!clean(input.subject) || !clean(input.message)) throw errors.unprocessable('MESSAGE_INCOMPLETE', 'Enter the subject and the message.');
  if (!['SMS', 'EMAIL', 'IN_APP', 'PUSH'].includes(input.channel)) throw errors.unprocessable('CHANNEL_INVALID', 'Choose a notification channel.');
  const position = input.positionId ? await findPosition(input.positionId) : null;
  const member = position ? memberName(position) : { name: 'Members' };
  const officer = await actorLabel(trace.actorId);
  await queueNotice({ channel: input.channel, subject: input.subject.trim(), body: input.message.trim() });
  const created = await prisma.investmentMessage.create({
    data: { publicId: await nextPublicId('IMS'), positionId: position?.id, memberName: member.name, kind: input.kind, channel: input.channel, subject: input.subject.trim(), message: input.message.trim(), sentBy: officer, status: 'QUEUED' },
  });
  await audit({ trace, entityType: 'Message', entityId: created.publicId, positionId: position?.id, action: 'Notification', reference: input.kind });
  return { id: created.publicId, status: created.status };
}

export async function listMessages() {
  const rows = await prisma.investmentMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ id: row.publicId, member: row.memberName, kind: row.kind, channel: row.channel, subject: row.subject, status: row.status, sentAt: row.sentAt.toISOString() }));
}

export async function listAudits() {
  const rows = await prisma.investmentAudit.findMany({ include: { position: true }, orderBy: { createdAt: 'desc' }, take: 300 });
  return rows.map((row) => ({
    id: row.publicId,
    investmentId: row.position?.publicId ?? null,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    amount: row.amount == null ? null : money(row.amount),
    userId: row.userId,
    reason: row.reason,
    reference: row.reference,
    ip: row.ip,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
  }));
}
