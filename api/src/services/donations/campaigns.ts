import { errors } from '../../utils/errors';
import { nextPublicId } from '../../utils/ids';
import {
  OPEN_CAMPAIGN,
  RECEIVED_STATUSES,
  actorLabel,
  assertAmount,
  assertCurrency,
  conflict,
  dateOnly,
  day,
  findCampaign,
  iso,
  jsonDocs,
  money,
  notFuture,
  prisma,
  readDocs,
  recordAudit,
  type Doc,
  type Trace,
} from './shared';

const REQUIRED_DOCS = ['PROPOSAL', 'BUDGET', 'APPROVAL'];

export type CampaignInput = {
  code?: string;
  name?: string;
  description?: string;
  campaignType?: string;
  purpose?: string;
  targetBeneficiary?: string;
  manager?: string;
  startDate?: string;
  endDate?: string;
  targetAmount?: number;
  currency?: string;
  minimumDonation?: number;
  maximumDonation?: number;
  targetDonors?: number;
  documents?: Doc[];
};

function clean(value?: string) {
  const text = value?.trim() ?? '';
  return text || null;
}

function campaignData(input: CampaignInput, mode: 'draft' | 'save') {
  const name = clean(input.name);
  if (!name) throw errors.unprocessable('NAME_REQUIRED', 'Enter the campaign name.');
  const currency = assertCurrency(input.currency || 'RWF');
  const rawTarget = input.targetAmount ?? 0;
  const target = rawTarget > 0 ? assertAmount(rawTarget, 'Target amount') : 0;
  if (mode === 'save' && target <= 0) {
    throw errors.unprocessable('TARGET_REQUIRED', 'Enter a target amount greater than zero.');
  }
  const minimum = input.minimumDonation == null || input.minimumDonation === 0 ? null : assertAmount(input.minimumDonation, 'Minimum donation');
  const maximum = input.maximumDonation == null || input.maximumDonation === 0 ? null : assertAmount(input.maximumDonation, 'Maximum donation');
  if (minimum && maximum && minimum > maximum) {
    throw errors.unprocessable('RANGE_INVALID', 'The minimum donation cannot exceed the maximum donation.');
  }
  const start = day(input.startDate);
  const end = day(input.endDate);
  if (start && end && end < start) {
    throw errors.unprocessable('DATE_RANGE_INVALID', 'The campaign end date cannot be before the start date.');
  }
  if (mode === 'save') {
    if (!clean(input.campaignType) || !clean(input.purpose) || !clean(input.manager)) {
      throw errors.unprocessable('CAMPAIGN_INCOMPLETE', 'Enter the campaign type, purpose, and manager.');
    }
    if (!start || !end) throw errors.unprocessable('DATES_REQUIRED', 'Enter the campaign start and end dates.');
    if (input.targetDonors != null && (!Number.isInteger(input.targetDonors) || input.targetDonors < 1)) {
      throw errors.unprocessable('DONOR_TARGET_INVALID', 'The target number of donors must be at least 1.');
    }
  }
  return {
    name,
    description: clean(input.description),
    campaignType: clean(input.campaignType) ?? 'General',
    purpose: clean(input.purpose) ?? '',
    targetBeneficiary: clean(input.targetBeneficiary),
    manager: clean(input.manager),
    startDate: start,
    endDate: end,
    targetAmount: target,
    currency,
    minimumDonation: minimum,
    maximumDonation: maximum,
    targetDonors: input.targetDonors ?? null,
    documents: jsonDocs(readDocs(input.documents)),
    code: (clean(input.code) ?? '').toUpperCase(),
  };
}

async function performance(campaignId: string) {
  const [donations, allocations, distributions, donors] = await Promise.all([
    prisma.donation.findMany({ where: { campaignId } }),
    prisma.allocation.findMany({ where: { donation: { campaignId }, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'] } } }),
    prisma.distribution.findMany({
      where: { status: 'CONFIRMED', allocation: { donation: { campaignId }, status: { in: ['APPROVED', 'ALLOCATED'] } } },
    }),
    prisma.donation.findMany({
      where: { campaignId, status: { in: [...RECEIVED_STATUSES] } },
      select: { donorId: true, amount: true, approvedAmount: true },
    }),
  ]);
  const received = donors.reduce((sum, row) => sum + money(row.approvedAmount ?? row.amount), 0);
  const allocated = allocations.reduce((sum, row) => sum + money(row.amount), 0);
  const distributed = distributions.reduce((sum, row) => sum + money(row.amount ?? 0), 0);
  return {
    donationCount: donations.length,
    receivedCount: donors.length,
    donorCount: new Set(donors.map((row) => row.donorId)).size,
    amountRaised: received,
    amountAllocated: allocated,
    amountDistributed: distributed,
  };
}

export async function serializeCampaign(campaign: Awaited<ReturnType<typeof findCampaign>>) {
  const figures = await performance(campaign.id);
  const target = money(campaign.targetAmount);
  return {
    id: campaign.publicId,
    code: campaign.code,
    name: campaign.name,
    description: campaign.description,
    campaignType: campaign.campaignType,
    purpose: campaign.purpose,
    targetBeneficiary: campaign.targetBeneficiary,
    manager: campaign.manager,
    startDate: dateOnly(campaign.startDate),
    endDate: dateOnly(campaign.endDate),
    status: campaign.status,
    approvalStatus: campaign.approvalStatus,
    approvedBy: campaign.approvedBy,
    approvalDate: iso(campaign.approvalDate),
    approvalComments: campaign.approvalComments,
    targetAmount: target,
    currency: campaign.currency,
    minimumDonation: campaign.minimumDonation == null ? null : money(campaign.minimumDonation),
    maximumDonation: campaign.maximumDonation == null ? null : money(campaign.maximumDonation),
    targetDonors: campaign.targetDonors,
    amountRaised: figures.amountRaised,
    amountRemaining: Math.max(0, Math.round((target - figures.amountRaised) * 100) / 100),
    amountAllocated: figures.amountAllocated,
    amountDistributed: figures.amountDistributed,
    donorCount: figures.donorCount,
    donationCount: figures.donationCount,
    completionPercent: target > 0 ? Math.min(100, Math.round((figures.amountRaised / target) * 1000) / 10) : 0,
    documents: readDocs(campaign.documents),
    createdAt: campaign.createdAt.toISOString(),
  };
}

export async function listCampaigns(query: { q?: string; status?: string }) {
  const rows = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const needle = query.q?.trim().toLowerCase() ?? '';
  const filtered = [];
  for (const row of rows) {
    if (query.status === 'ACTIVE' && !OPEN_CAMPAIGN.includes(row.status as (typeof OPEN_CAMPAIGN)[number])) continue;
    if (query.status && query.status !== 'ACTIVE' && row.status !== query.status) continue;
    if (needle && ![row.publicId, row.code, row.name, row.manager].some((part) => String(part ?? '').toLowerCase().includes(needle))) continue;
    filtered.push(await serializeCampaign(row));
  }
  return filtered;
}

export async function getCampaign(id: string) {
  const campaign = await findCampaign(id);
  const [budgets, monitors, pledges, donations] = await Promise.all([
    prisma.campaignBudget.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: 'asc' } }),
    prisma.campaignMonitor.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: 'desc' } }),
    prisma.pledge.findMany({ where: { campaignId: campaign.id }, include: { donor: true }, orderBy: { createdAt: 'desc' } }),
    prisma.donation.findMany({ where: { campaignId: campaign.id }, include: { donor: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    ...(await serializeCampaign(campaign)),
    budgets: budgets.map((row) => ({
      id: row.id,
      category: row.category,
      approvedBudget: money(row.approvedBudget),
      currency: row.currency,
      amountUsed: money(row.amountUsed),
      amountRemaining: Math.max(0, Math.round((money(row.approvedBudget) - money(row.amountUsed)) * 100) / 100),
      department: row.department,
      approvalDate: dateOnly(row.approvalDate),
    })),
    monitoring: monitors.map((row) => ({
      id: row.id,
      reportingPeriod: row.reportingPeriod,
      activitiesCompleted: row.activitiesCompleted,
      beneficiariesReached: row.beneficiariesReached,
      issues: row.issues,
      correctiveActions: row.correctiveActions,
      officer: row.officer,
      createdAt: row.createdAt.toISOString(),
    })),
    pledges: pledges.map((row) => ({
      id: row.publicId,
      donor: row.donor.name,
      amount: money(row.amount),
      fulfilled: money(row.fulfilledAmount),
      currency: row.currency,
      frequency: row.frequency,
      status: row.status,
    })),
    donations: donations.map((row) => ({
      id: row.publicId,
      donor: row.donor.name,
      amount: money(row.amount),
      currency: row.currency,
      type: row.donationType,
      status: row.status,
    })),
  };
}

export async function saveCampaign(input: CampaignInput, mode: 'draft' | 'save', trace: Trace, id?: string) {
  const data = campaignData(input, mode);
  const existing = id ? await findCampaign(id) : null;
  if (existing && existing.status !== 'DRAFT' && existing.approvalStatus !== 'REJECTED') {
    throw errors.unprocessable('CAMPAIGN_LOCKED', 'Edit the campaign only while it is still a draft.');
  }
  const code = data.code || existing?.code || (await nextPublicId('CMP'));
  try {
    const saved = existing
      ? await prisma.campaign.update({
        where: { id: existing.id },
        data: { ...data, code, approvalStatus: 'PENDING', approvedBy: null, approvalDate: null },
      })
      : await prisma.campaign.create({
        data: { ...data, code, publicId: await nextPublicId('CMP'), status: 'DRAFT' },
      });
    await recordAudit({
      trace,
      entityType: 'Campaign',
      entityId: saved.publicId,
      action: existing ? 'Campaign updated' : 'Campaign created',
      newStatus: saved.status,
      amount: money(saved.targetAmount),
    });
    return getCampaign(saved.publicId);
  } catch (error) {
    conflict(error, 'That campaign code is already in use.');
  }
}

function assertApprovalPack(documents: Doc[]) {
  const types = new Set(documents.map((doc) => doc.documentType.toUpperCase()));
  const missing = REQUIRED_DOCS.filter((type) => !types.has(type));
  if (missing.length) {
    throw errors.unprocessable('CAMPAIGN_DOCUMENTS_REQUIRED', `Attach these documents before approval: ${missing.join(', ').toLowerCase()}.`);
  }
}

export async function decideCampaign(id: string, input: { decision: 'APPROVE' | 'REJECT'; comments?: string }, trace: Trace) {
  const campaign = await findCampaign(id);
  if (campaign.status !== 'DRAFT') {
    throw errors.unprocessable('CAMPAIGN_NOT_DRAFT', 'Only a draft campaign can be approved or rejected.');
  }
  if (!campaign.purpose || !campaign.manager || !campaign.startDate || !campaign.endDate || money(campaign.targetAmount) <= 0) {
    throw errors.unprocessable('CAMPAIGN_INCOMPLETE', 'Complete the campaign purpose, manager, dates, and target before approval.');
  }
  if (input.decision === 'APPROVE') assertApprovalPack(readDocs(campaign.documents));
  const officer = await actorLabel(trace.actorId);
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      approvalStatus: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approvedBy: officer,
      approvalDate: new Date(),
      approvalComments: clean(input.comments),
      status: input.decision === 'REJECT' ? 'CANCELLED' : 'DRAFT',
    },
  });
  await recordAudit({
    trace,
    entityType: 'Campaign',
    entityId: campaign.publicId,
    action: input.decision === 'APPROVE' ? 'Campaign approved' : 'Campaign rejected',
    previousStatus: campaign.status,
    newStatus: input.decision === 'REJECT' ? 'CANCELLED' : 'DRAFT',
    reason: input.comments,
  });
  return getCampaign(campaign.publicId);
}

export async function setCampaignStatus(id: string, status: 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'SUSPENDED' | 'CANCELLED', trace: Trace) {
  const campaign = await findCampaign(id);
  const from = campaign.status;
  const allowed: Record<string, string[]> = {
    PUBLISHED: ['DRAFT'],
    ACTIVE: ['PUBLISHED', 'SUSPENDED', 'TARGET_REACHED'],
    CLOSED: ['PUBLISHED', 'ACTIVE', 'TARGET_REACHED', 'SUSPENDED'],
    SUSPENDED: ['PUBLISHED', 'ACTIVE', 'TARGET_REACHED'],
    CANCELLED: ['DRAFT', 'PUBLISHED'],
  };
  if (!allowed[status].includes(from)) {
    throw errors.unprocessable('STATUS_NOT_ALLOWED', `A ${from.toLowerCase().replaceAll('_', ' ')} campaign cannot move to ${status.toLowerCase().replaceAll('_', ' ')}.`);
  }
  if (status === 'PUBLISHED' && campaign.approvalStatus !== 'APPROVED') {
    throw errors.unprocessable('CAMPAIGN_NOT_APPROVED', 'Approve the campaign before it is published.');
  }
  if (status === 'CANCELLED') {
    const received = await prisma.donation.count({ where: { campaignId: campaign.id, status: { in: [...RECEIVED_STATUSES, 'PAYMENT_PENDING'] } } });
    if (received) throw errors.unprocessable('CAMPAIGN_HAS_GIFTS', 'Cancel is not available after donations have been received. Close the campaign instead.');
  }
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status } });
  await recordAudit({
    trace,
    entityType: 'Campaign',
    entityId: campaign.publicId,
    action: 'Campaign status',
    previousStatus: from,
    newStatus: status,
  });
  return getCampaign(campaign.publicId);
}

export async function saveBudget(id: string, input: {
  category: 'PROGRAM_ACTIVITIES' | 'SCHOOL_SUPPORT' | 'STUDENT_SUPPORT' | 'LOGISTICS' | 'ADMINISTRATION' | 'COMMUNICATION' | 'OTHER';
  approvedBudget: number;
  currency?: string;
  amountUsed?: number;
  department?: string;
  approvalDate?: string;
}, trace: Trace) {
  const campaign = await findCampaign(id);
  if (campaign.status === 'CANCELLED' || campaign.status === 'CLOSED') {
    throw errors.unprocessable('CAMPAIGN_CLOSED', 'A closed campaign cannot take a new budget line.');
  }
  const approved = assertAmount(input.approvedBudget, 'Approved budget');
  const used = input.amountUsed == null ? 0 : input.amountUsed;
  if (used < 0 || used > approved) {
    throw errors.unprocessable('BUDGET_USED_INVALID', 'Amount used cannot exceed the approved budget.');
  }
  const currency = assertCurrency(input.currency || campaign.currency);
  if (currency !== campaign.currency) {
    throw errors.unprocessable('CURRENCY_MISMATCH', `Budget lines for this campaign use ${campaign.currency}.`);
  }
  if (input.approvalDate) notFuture(input.approvalDate);
  const existing = await prisma.campaignBudget.findFirst({ where: { campaignId: campaign.id, category: input.category } });
  const saved = existing
    ? await prisma.campaignBudget.update({
      where: { id: existing.id },
      data: {
        approvedBudget: approved,
        amountUsed: used,
        currency,
        department: clean(input.department),
        approvalDate: day(input.approvalDate),
      },
    })
    : await prisma.campaignBudget.create({
      data: {
        campaignId: campaign.id,
        category: input.category,
        approvedBudget: approved,
        amountUsed: used,
        currency,
        department: clean(input.department),
        approvalDate: day(input.approvalDate),
      },
    });
  await recordAudit({
    trace,
    entityType: 'Campaign',
    entityId: campaign.publicId,
    action: 'Budget recorded',
    amount: approved,
    reference: saved.category,
  });
  return getCampaign(campaign.publicId);
}

export async function saveMonitoring(id: string, input: {
  reportingPeriod: string;
  activitiesCompleted: string;
  beneficiariesReached: number;
  issues?: string;
  correctiveActions?: string;
}, trace: Trace) {
  const campaign = await findCampaign(id);
  if (!clean(input.reportingPeriod) || !clean(input.activitiesCompleted)) {
    throw errors.unprocessable('MONITORING_INCOMPLETE', 'Enter the reporting period and the activities completed.');
  }
  if (!Number.isInteger(input.beneficiariesReached) || input.beneficiariesReached < 0) {
    throw errors.unprocessable('BENEFICIARY_COUNT_INVALID', 'Beneficiaries reached cannot be negative.');
  }
  const officer = await actorLabel(trace.actorId);
  await prisma.campaignMonitor.create({
    data: {
      campaignId: campaign.id,
      reportingPeriod: input.reportingPeriod.trim(),
      activitiesCompleted: input.activitiesCompleted.trim(),
      beneficiariesReached: input.beneficiariesReached,
      issues: clean(input.issues),
      correctiveActions: clean(input.correctiveActions),
      officer,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Campaign',
    entityId: campaign.publicId,
    action: 'Monitoring recorded',
    reference: input.reportingPeriod.trim(),
  });
  return getCampaign(campaign.publicId);
}
