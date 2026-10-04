import { routeInstruction } from '../payment-flow';
import { errors } from '../../utils/errors';
import {
  actorLabel,
  assertAmount,
  assertCurrency,
  availableBalance,
  dateOnly,
  day,
  findAllocation,
  findBeneficiary,
  findDonation,
  isMonetary,
  jsonDocs,
  money,
  nextPublicId,
  notFuture,
  prisma,
  readDocs,
  recordAudit,
  roundMoney,
  type Doc,
  type Trace,
} from './shared';

const BUDGET_FOR_CATEGORY: Record<string, 'PROGRAM_ACTIVITIES' | 'SCHOOL_SUPPORT' | 'STUDENT_SUPPORT' | 'OTHER'> = {
  SCHOOL_SUPPORT: 'SCHOOL_SUPPORT',
  STUDENT_SUPPORT: 'STUDENT_SUPPORT',
  PROGRAM_SUPPORT: 'PROGRAM_ACTIVITIES',
  COMMUNITY_SUPPORT: 'PROGRAM_ACTIVITIES',
  EMERGENCY_SUPPORT: 'PROGRAM_ACTIVITIES',
  INFRASTRUCTURE: 'PROGRAM_ACTIVITIES',
  EDUCATION_MATERIALS: 'PROGRAM_ACTIVITIES',
  OTHER: 'OTHER',
};

function clean(value?: string) {
  const text = value?.trim() ?? '';
  return text || null;
}

export async function listAllocations(query: { status?: string; q?: string }) {
  const rows = await prisma.allocation.findMany({
    include: { donation: { include: { donor: true, campaign: true, allocations: true, refunds: true } }, beneficiary: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (query.status === 'PENDING_APPROVAL' && row.status !== 'PENDING_APPROVAL') return false;
    if (query.status === 'APPROVED' && !['APPROVED', 'ALLOCATED'].includes(row.status)) return false;
    if (query.status && !['PENDING_APPROVAL', 'APPROVED'].includes(query.status) && row.status !== query.status) return false;
    if (!needle) return true;
    return [row.publicId, row.donation.publicId, row.donation.donor.name, row.beneficiary.name, row.purpose]
      .some((part) => part.toLowerCase().includes(needle));
  }).map((row) => ({
    id: row.publicId,
    donationId: row.donation.publicId,
    campaign: row.donation.campaign?.name ?? '—',
    donor: row.donation.donor.name,
    beneficiary: row.beneficiary.name,
    availableBalance: availableBalance(row.donation),
    amount: money(row.amount),
    currency: row.currency,
    purpose: row.purpose,
    category: row.category,
    status: row.status,
    date: dateOnly(row.allocationDate),
    decision: row.decision,
  }));
}

export async function createAllocation(input: {
  donationId: string;
  beneficiaryId: string;
  allocationDate: string;
  amount: number;
  currency?: string;
  purpose: string;
  category: 'SCHOOL_SUPPORT' | 'STUDENT_SUPPORT' | 'INFRASTRUCTURE' | 'EDUCATION_MATERIALS' | 'EMERGENCY_SUPPORT' | 'COMMUNITY_SUPPORT' | 'PROGRAM_SUPPORT' | 'OTHER';
  submit?: boolean;
}, trace: Trace) {
  const donation = await findDonation(input.donationId);
  if (!['APPROVED', 'ALLOCATED'].includes(donation.status)) {
    throw errors.unprocessable('DONATION_NOT_APPROVED', 'Approve the donation before allocating it.');
  }
  const beneficiary = await findBeneficiary(input.beneficiaryId);
  if (beneficiary.status !== 'VERIFIED') {
    throw errors.unprocessable('BENEFICIARY_NOT_VERIFIED', 'Verify the beneficiary before allocating funds or goods.');
  }
  const amount = assertAmount(input.amount);
  const currency = assertCurrency(input.currency || donation.currency);
  if (currency !== donation.currency) throw errors.unprocessable('CURRENCY_MISMATCH', `This donation is held in ${donation.currency}.`);
  if (!clean(input.purpose)) throw errors.unprocessable('PURPOSE_REQUIRED', 'Enter the allocation purpose.');
  notFuture(input.allocationDate);
  if (amount > availableBalance(donation)) {
    throw errors.unprocessable('ALLOCATION_EXCEEDS_BALANCE', `Only ${availableBalance(donation)} ${donation.currency} remains unallocated.`);
  }
  const status = input.submit === false ? 'DRAFT' : 'PENDING_APPROVAL';
  const created = await prisma.allocation.create({
    data: {
      publicId: await nextPublicId('ALC'),
      donationId: donation.id,
      campaignId: donation.campaignId,
      beneficiaryId: beneficiary.id,
      allocationDate: day(input.allocationDate)!,
      amount,
      currency,
      purpose: input.purpose.trim(),
      category: input.category,
      status,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Allocation',
    entityId: created.publicId,
    donationId: donation.id,
    action: 'Allocation created',
    newStatus: status,
    amount,
    reference: donation.publicId,
  });
  return { id: created.publicId, status };
}

export async function decideAllocation(id: string, input: { decision: 'APPROVE' | 'REJECT' | 'MORE_INFORMATION'; comments?: string }, trace: Trace) {
  const allocation = await findAllocation(id);
  if (allocation.status !== 'PENDING_APPROVAL' && allocation.status !== 'DRAFT') {
    throw errors.unprocessable('ALLOCATION_CLOSED', 'This allocation is no longer waiting for a decision.');
  }
  const officer = await actorLabel(trace.actorId);
  if (input.decision === 'APPROVE') {
    if (allocation.beneficiary.status !== 'VERIFIED') {
      throw errors.unprocessable('BENEFICIARY_NOT_VERIFIED', 'Verify the beneficiary before approving the allocation.');
    }
    const balance = availableBalance({
      ...allocation.donation,
      allocations: allocation.donation.allocations.filter((row) => row.id !== allocation.id),
    });
    if (money(allocation.amount) > balance) {
      throw errors.unprocessable('ALLOCATION_EXCEEDS_BALANCE', 'The donation balance no longer covers this allocation.');
    }
    await prisma.allocation.update({
      where: { id: allocation.id },
      data: { status: 'APPROVED', decision: 'APPROVE', approvedBy: officer, approvalDate: new Date(), approvalComments: clean(input.comments) },
    });
    if (allocation.donation.status === 'APPROVED') {
      await prisma.donation.update({ where: { id: allocation.donationId }, data: { status: 'ALLOCATED' } });
    }
  } else if (input.decision === 'REJECT') {
    await prisma.allocation.update({
      where: { id: allocation.id },
      data: { status: 'CANCELLED', decision: 'REJECT', approvedBy: officer, approvalDate: new Date(), approvalComments: clean(input.comments) },
    });
  } else {
    await prisma.allocation.update({
      where: { id: allocation.id },
      data: { status: 'PENDING_APPROVAL', decision: 'MORE_INFORMATION', approvalComments: clean(input.comments) },
    });
  }
  const next = input.decision === 'APPROVE' ? 'APPROVED' : input.decision === 'REJECT' ? 'CANCELLED' : 'PENDING_APPROVAL';
  await recordAudit({
    trace,
    entityType: 'Allocation',
    entityId: allocation.publicId,
    donationId: allocation.donationId,
    action: 'Allocation decision',
    previousStatus: allocation.status,
    newStatus: next,
    amount: money(allocation.amount),
    reason: input.comments,
    reference: input.decision,
  });
  return { id: allocation.publicId, status: next, availableBalance: availableBalance(allocation.donation) };
}

export async function disburse(id: string, input: {
  amount?: number;
  paymentMethod: 'BANK_TRANSFER' | 'MOBILE_PAYMENT' | 'OTHER';
  bankAccount?: string;
  mobileMoneyNumber?: string;
  paymentReference?: string;
  paymentDate?: string;
  status?: 'INITIATED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  outcome?: 'SUCCESS' | 'FAILED';
}, trace: Trace) {
  const allocation = await findAllocation(id);
  if (allocation.status !== 'APPROVED') throw errors.unprocessable('ALLOCATION_NOT_APPROVED', 'Approve the allocation before disbursement.');
  if (!isMonetary(allocation.donation.donationType)) {
    throw errors.unprocessable('NOT_MONETARY', 'In-kind allocations are delivered, not disbursed through a payment rail.');
  }
  const amount = input.amount == null ? money(allocation.amount) : assertAmount(input.amount);
  if (amount !== money(allocation.amount)) throw errors.unprocessable('AMOUNT_MISMATCH', 'Disburse the full approved allocation.');
  const bank = clean(input.bankAccount) ?? allocation.beneficiary.bankAccount;
  const mobile = clean(input.mobileMoneyNumber) ?? allocation.beneficiary.mobileMoneyNumber;
  if (input.paymentMethod === 'BANK_TRANSFER' && !bank) throw errors.unprocessable('ACCOUNT_REQUIRED', 'Enter the beneficiary bank account.');
  if (input.paymentMethod === 'MOBILE_PAYMENT' && !mobile) throw errors.unprocessable('MOBILE_REQUIRED', 'Enter the beneficiary mobile money number.');
  let railCode: string | null = null;
  let railName: string | null = null;
  if (input.paymentMethod !== 'OTHER') {
    const route = await routeInstruction({
      channel: input.paymentMethod === 'BANK_TRANSFER' ? 'BANK' : 'MOBILE_PAYMENT',
      originCountry: 'RW',
      destinationCountry: 'RW',
    });
    railCode = route.rail.code;
    railName = route.rail.name;
  }
  if (input.paymentDate) notFuture(input.paymentDate);
  const outcome = input.status ?? (input.outcome === 'FAILED' ? 'FAILED' : 'SUCCESS');
  const created = await prisma.donationDisbursement.create({
    data: {
      publicId: await nextPublicId('DBS'),
      allocationId: allocation.id,
      beneficiaryId: allocation.beneficiaryId,
      amount,
      currency: allocation.currency,
      bankAccount: bank,
      mobileMoneyNumber: mobile,
      paymentMethod: input.paymentMethod,
      paymentReference: clean(input.paymentReference) ?? await nextPublicId('DPY'),
      paymentDate: day(input.paymentDate) ?? new Date(),
      status: outcome,
      railCode,
      railName,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Disbursement',
    entityId: created.publicId,
    donationId: allocation.donationId,
    action: outcome === 'SUCCESS' ? 'Disbursement succeeded' : `Disbursement ${outcome.toLowerCase()}`,
    newStatus: created.status,
    amount,
    reference: created.paymentReference,
  });
  return { id: created.publicId, status: created.status, reference: created.paymentReference };
}

export async function distribute(id: string, input: {
  distributionDate: string;
  method: 'BANK_TRANSFER' | 'MOBILE_PAYMENT' | 'DIRECT_DELIVERY' | 'IN_KIND_DELIVERY' | 'OTHER';
  location?: string;
  itemDescription?: string;
  beneficiaryConfirmed: boolean;
  confirmationNote?: string;
  documents?: Doc[];
}, trace: Trace) {
  const allocation = await findAllocation(id);
  if (allocation.status !== 'APPROVED') throw errors.unprocessable('ALLOCATION_NOT_APPROVED', 'Approve the allocation before distribution.');
  const monetary = isMonetary(allocation.donation.donationType);
  if (!monetary && !['IN_KIND_DELIVERY', 'DIRECT_DELIVERY'].includes(input.method)) {
    throw errors.unprocessable('METHOD_NOT_ALLOWED', 'In-kind donations are handed over directly or as goods.');
  }
  if (monetary && input.method === 'IN_KIND_DELIVERY') {
    throw errors.unprocessable('METHOD_NOT_ALLOWED', 'A monetary allocation cannot use in-kind delivery.');
  }
  if (!input.beneficiaryConfirmed) {
    throw errors.unprocessable('CONFIRMATION_REQUIRED', 'The beneficiary must confirm that the donation or resources were received.');
  }
  if (readDocs(input.documents).length === 0) {
    throw errors.unprocessable('EVIDENCE_REQUIRED', 'Attach the delivery note, receipt, confirmation, or photograph.');
  }
  notFuture(input.distributionDate);
  if (monetary && ['BANK_TRANSFER', 'MOBILE_PAYMENT'].includes(input.method)) {
    const paid = allocation.disbursements.some((row) => row.status === 'SUCCESS' && money(row.amount) === money(allocation.amount));
    if (!paid) throw errors.unprocessable('DISBURSEMENT_REQUIRED', 'A successful disbursement is required before this distribution can be confirmed.');
  }
  const officer = await actorLabel(trace.actorId);
  const created = await prisma.distribution.create({
    data: {
      publicId: await nextPublicId('DST'),
      allocationId: allocation.id,
      amount: allocation.amount,
      itemDescription: clean(input.itemDescription),
      distributionDate: day(input.distributionDate)!,
      method: input.method,
      location: clean(input.location),
      officer,
      beneficiaryConfirmed: true,
      confirmationNote: clean(input.confirmationNote),
      documents: jsonDocs(readDocs(input.documents)),
      status: 'CONFIRMED',
    },
  });
  await prisma.allocation.update({ where: { id: allocation.id }, data: { status: 'ALLOCATED' } });
  const siblings = await prisma.allocation.findMany({ where: { donationId: allocation.donationId } });
  const stillOpen = siblings.some((row) => row.id !== allocation.id && (row.status === 'APPROVED' || row.status === 'PENDING_APPROVAL' || row.status === 'DRAFT'));
  const fresh = await findDonation(allocation.donation.publicId);
  if (!stillOpen && availableBalance(fresh) === 0) {
    await prisma.donation.update({ where: { id: allocation.donationId }, data: { status: 'DISTRIBUTED' } });
  }
  if (allocation.campaignId) {
    const category = BUDGET_FOR_CATEGORY[allocation.category];
    const line = await prisma.campaignBudget.findFirst({ where: { campaignId: allocation.campaignId, category } });
    if (line) {
      const used = Math.min(money(line.approvedBudget), roundMoney(money(line.amountUsed) + money(allocation.amount)));
      await prisma.campaignBudget.update({ where: { id: line.id }, data: { amountUsed: used } });
    }
  }
  await recordAudit({
    trace,
    entityType: 'Distribution',
    entityId: created.publicId,
    donationId: allocation.donationId,
    action: 'Distribution confirmed',
    previousStatus: 'APPROVED',
    newStatus: 'ALLOCATED',
    amount: money(allocation.amount),
    reference: allocation.publicId,
  });
  return { id: created.publicId, status: 'CONFIRMED' };
}

export async function listDistributions() {
  const rows = await prisma.distribution.findMany({
    include: { allocation: { include: { beneficiary: true, donation: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.publicId,
    allocationId: row.allocation.publicId,
    donationId: row.allocation.donation.publicId,
    beneficiary: row.allocation.beneficiary.name,
    amount: row.amount == null ? null : money(row.amount),
    item: row.itemDescription,
    method: row.method,
    date: dateOnly(row.distributionDate),
    officer: row.officer,
    confirmed: row.beneficiaryConfirmed,
    status: row.status,
  }));
}
