import type { Prisma } from '@prisma/client';
import { money, prisma, readDocs, dateOnly } from './shared';

const RECEIVED = ['RECEIVED', 'APPROVED', 'ALLOCATED', 'DISTRIBUTED', 'COMPLETED', 'UNDER_REVIEW'] as const;

export async function dashboard() {
  const [donors, campaigns, donations, pledges, refunds, allocations, distributions] = await Promise.all([
    prisma.donor.findMany(),
    prisma.campaign.findMany(),
    prisma.donation.findMany({ include: { allocations: true, refunds: true } }),
    prisma.pledge.count({ where: { status: { in: ['PLEDGED', 'PARTIALLY_FULFILLED'] } } }),
    prisma.donationRefund.findMany({ where: { status: 'COMPLETED' } }),
    prisma.allocation.findMany({ where: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'] } } }),
    prisma.distribution.findMany({ where: { status: 'CONFIRMED' } }),
  ]);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const receivedRows = donations.filter((row) => RECEIVED.includes(row.status as (typeof RECEIVED)[number]));
  const sum = (rows: { amount: Prisma.Decimal; approvedAmount: Prisma.Decimal | null }[]) =>
    rows.reduce((total, row) => total + money(row.approvedAmount ?? row.amount), 0);
  const inMonth = receivedRows.filter((row) => {
    const date = row.donationDate ?? row.createdAt;
    return date.getMonth() === month && date.getFullYear() === year;
  });
  const inYear = receivedRows.filter((row) => (row.donationDate ?? row.createdAt).getFullYear() === year);
  const allocated = allocations.reduce((total, row) => total + money(row.amount), 0);
  const distributed = distributions.reduce((total, row) => total + money(row.amount ?? 0), 0);
  const received = sum(receivedRows);
  const unallocated = receivedRows.reduce((total, row) => {
    const base = money(row.approvedAmount ?? row.amount);
    const reserved = row.allocations
      .filter((item) => ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'].includes(item.status))
      .reduce((inner, item) => inner + money(item.amount), 0);
    const refunded = row.refunds
      .filter((item) => item.status === 'COMPLETED')
      .reduce((inner, item) => inner + money(item.amount), 0);
    return total + Math.max(0, base - reserved - refunded);
  }, 0);
  return {
    totalDonations: received,
    donationsThisMonth: sum(inMonth),
    donationsThisYear: sum(inYear),
    totalDonors: donors.filter((row) => row.status !== 'DRAFT').length,
    activeCampaigns: campaigns.filter((row) => ['PUBLISHED', 'ACTIVE', 'TARGET_REACHED'].includes(row.status)).length,
    pendingPledges: pledges,
    donationsReceived: receivedRows.length,
    donationsPending: donations.filter((row) => ['SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'PAYMENT_PENDING', 'UNDER_REVIEW'].includes(row.status)).length,
    donationsAllocated: allocations.filter((row) => row.status === 'APPROVED' || row.status === 'ALLOCATED').length,
    donationsDistributed: distributions.length,
    allocatedAmount: allocated,
    distributedAmount: distributed,
    unallocatedDonations: unallocated,
    refunds: refunds.reduce((total, row) => total + money(row.amount), 0),
    currency: 'RWF',
  };
}

export async function statement(query: {
  donorId?: string;
  campaignId?: string;
  from?: string;
  to?: string;
  donationType?: string;
  status?: string;
  currency?: string;
}) {
  const donations = await prisma.donation.findMany({
    where: {
      ...(query.donorId ? { donor: { publicId: query.donorId } } : {}),
      ...(query.campaignId ? { campaign: { publicId: query.campaignId } } : {}),
      ...(query.donationType ? { donationType: query.donationType as 'CASH' } : {}),
      ...(query.status ? { status: query.status as 'RECEIVED' } : {}),
      ...(query.currency ? { currency: query.currency.toUpperCase() } : {}),
    },
    include: { ledger: { orderBy: { createdAt: 'asc' } } },
  });
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
  const entries = donations.flatMap((donation) => donation.ledger.map((entry) => ({ donation, entry })));
  const inRange = (date: Date) => (!from || date >= from) && (!to || date <= to);
  const before = entries.filter((row) => from && row.entry.createdAt < from);
  const selected = entries.filter((row) => inRange(row.entry.createdAt));
  const total = (rows: typeof selected, type?: string) => rows
    .filter((row) => !type || row.entry.entryType === type)
    .reduce((sum, row) => sum + money(row.entry.amount), 0);
  const opening = total(before);
  const received = total(selected, 'RECEIVED');
  const adjustments = total(selected, 'ADJUSTMENT');
  const refunds = Math.abs(total(selected, 'REFUND'));
  return {
    openingBalance: opening,
    donationsReceived: received,
    adjustments,
    refunds,
    netDonations: Math.round((opening + received + adjustments - refunds) * 100) / 100,
    lines: selected.map((row) => ({
      date: row.entry.createdAt.toISOString(),
      donationId: row.donation.publicId,
      description: row.entry.description,
      amount: money(row.entry.amount),
      currency: row.entry.currency,
      paymentReference: row.entry.reference,
      status: row.donation.status,
    })),
  };
}

export async function report(type: string) {
  switch (type) {
    case 'donor-register': {
      const rows = await prisma.donor.findMany({ orderBy: { name: 'asc' } });
      return rows.map((row) => ({ id: row.publicId, name: row.name, type: row.donorType, status: row.status, country: row.country, telephone: row.telephone }));
    }
    case 'donations-by-donor':
    case 'donor-history': {
      const rows = await prisma.donation.findMany({ include: { donor: true, campaign: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({ donor: row.donor.name, donorId: row.donor.publicId, donationId: row.publicId, campaign: row.campaign?.name, amount: money(row.amount), currency: row.currency, status: row.status, date: dateOnly(row.donationDate) }));
    }
    case 'anonymous': {
      const rows = await prisma.donation.findMany({ where: { donor: { donorType: 'ANONYMOUS' } }, include: { campaign: true } });
      return rows.map((row) => ({ donationId: row.publicId, campaign: row.campaign?.name, amount: money(row.amount), currency: row.currency, status: row.status }));
    }
    case 'campaign-performance':
    case 'campaign-target':
    case 'campaign-balance':
    case 'donations-by-campaign': {
      const campaigns = await prisma.campaign.findMany({ include: { donations: true } });
      return campaigns.map((campaign) => {
        const received = campaign.donations.filter((row) => RECEIVED.includes(row.status as (typeof RECEIVED)[number]));
        const raised = received.reduce((sum, row) => sum + money(row.approvedAmount ?? row.amount), 0);
        return {
          id: campaign.publicId,
          name: campaign.name,
          status: campaign.status,
          target: money(campaign.targetAmount),
          raised,
          remaining: Math.max(0, money(campaign.targetAmount) - raised),
          donations: campaign.donations.length,
          currency: campaign.currency,
        };
      });
    }
    case 'received': {
      const rows = await prisma.donation.findMany({ where: { status: { in: [...RECEIVED] } }, include: { donor: true } });
      return rows.map((row) => ({ id: row.publicId, donor: row.donor.name, amount: money(row.approvedAmount ?? row.amount), currency: row.currency, status: row.status }));
    }
    case 'allocated': {
      const rows = await prisma.allocation.findMany({ where: { status: { in: ['APPROVED', 'ALLOCATED'] } }, include: { beneficiary: true, donation: true } });
      return rows.map((row) => ({ id: row.publicId, donationId: row.donation.publicId, beneficiary: row.beneficiary.name, amount: money(row.amount), purpose: row.purpose, status: row.status }));
    }
    case 'distributed':
    case 'distribution-history': {
      const rows = await prisma.distribution.findMany({ include: { allocation: { include: { beneficiary: true, donation: true } } } });
      return rows.map((row) => ({ id: row.publicId, donationId: row.allocation.donation.publicId, beneficiary: row.allocation.beneficiary.name, amount: money(row.amount ?? 0), method: row.method, date: dateOnly(row.distributionDate), status: row.status }));
    }
    case 'unallocated': {
      const rows = await prisma.donation.findMany({
        where: { status: { in: ['APPROVED', 'ALLOCATED', 'RECEIVED'] } },
        include: { donor: true, allocations: true, refunds: true },
      });
      return rows.map((row) => {
        const base = money(row.approvedAmount ?? row.amount);
        const reserved = row.allocations.filter((item) => ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'].includes(item.status)).reduce((sum, item) => sum + money(item.amount), 0);
        const refunded = row.refunds.filter((item) => item.status === 'COMPLETED').reduce((sum, item) => sum + money(item.amount), 0);
        return { id: row.publicId, donor: row.donor.name, balance: Math.max(0, base - reserved - refunded), currency: row.currency, status: row.status };
      }).filter((row) => row.balance > 0);
    }
    case 'refunds': {
      const rows = await prisma.donationRefund.findMany({ include: { donation: { include: { donor: true } } }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({ id: row.publicId, donationId: row.donation.publicId, donor: row.donation.donor.name, amount: money(row.amount), status: row.status, reason: row.reason }));
    }
    case 'reconciliation': {
      const rows = await prisma.donationReconciliation.findMany({ include: { donation: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({ id: row.publicId, donationId: row.donation.publicId, expected: money(row.expectedAmount), received: money(row.receivedAmount), difference: money(row.difference), status: row.status, externalTransactionId: row.externalTransactionId }));
    }
    case 'ledger': {
      const rows = await prisma.donationLedgerEntry.findMany({ include: { donation: true }, orderBy: { createdAt: 'desc' }, take: 400 });
      return rows.map((row) => ({ date: row.createdAt.toISOString(), donationId: row.donation.publicId, description: row.description, amount: money(row.amount), currency: row.currency, reference: row.reference }));
    }
    case 'beneficiaries':
    case 'amount-per-beneficiary': {
      const rows = await prisma.beneficiary.findMany({ include: { allocations: true }, orderBy: { name: 'asc' } });
      return rows.map((row) => ({
        id: row.publicId,
        name: row.name,
        type: row.beneficiaryType,
        status: row.status,
        amount: row.allocations.filter((item) => item.status !== 'CANCELLED' && item.status !== 'DRAFT').reduce((sum, item) => sum + money(item.amount), 0),
      }));
    }
    case 'impact': {
      const rows = await prisma.impactReport.findMany({ include: { campaign: true, beneficiary: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({ id: row.publicId, campaign: row.campaign?.name, beneficiary: row.beneficiary?.name, period: row.reportingPeriod, beneficiaries: row.beneficiaryCount, outputs: row.outputs, outcomes: row.outcomes }));
    }
    case 'verification': {
      const rows = await prisma.donation.findMany({ include: { donor: true }, orderBy: { updatedAt: 'desc' } });
      return rows.map((row) => ({ id: row.publicId, donor: row.donor.name, result: row.verificationResult, status: row.status, verifiedBy: row.verifiedBy, documents: readDocs(row.documents).length }));
    }
    case 'pending-compliance': {
      const rows = await prisma.donationCompliance.findMany({ where: { result: { in: ['PENDING_REVIEW', 'NON_COMPLIANT', 'ESCALATED'] } }, include: { donation: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({ id: row.publicId, donationId: row.donation?.publicId, result: row.result, officer: row.officerName, comments: row.comments }));
    }
    case 'exceptions': {
      const rows = await prisma.donation.findMany({ where: { status: { in: ['REJECTED', 'CANCELLED', 'FAILED', 'REFUNDED', 'UNDER_REVIEW'] } }, include: { donor: true } });
      return rows.map((row) => ({ id: row.publicId, donor: row.donor.name, status: row.status, amount: money(row.amount), currency: row.currency }));
    }
    case 'audit':
      return listAudits();
    default:
      return [];
  }
}

export async function listAudits(donationId?: string) {
  const rows = await prisma.donationAudit.findMany({
    where: donationId ? { donation: { publicId: donationId } } : {},
    include: { donation: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map((row) => ({
    id: row.publicId,
    donationId: row.donation?.publicId ?? null,
    userId: row.userId,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    amount: row.amount == null ? null : money(row.amount),
    createdAt: row.createdAt.toISOString(),
    reason: row.reason,
    reference: row.reference,
    ip: row.ip,
    sessionId: row.sessionId,
  }));
}

export async function listPayments(query: { status?: string }) {
  const rows = await prisma.donationPayment.findMany({
    where: query.status ? { status: query.status as 'SUCCESS' } : {},
    include: { donation: { include: { donor: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.publicId,
    donationId: row.donation.publicId,
    donor: row.donation.donor.name,
    amount: money(row.amount),
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    status: row.status,
    reconciliationStatus: row.reconciliationStatus,
    transactionReference: row.transactionReference,
    externalTransactionId: row.externalTransactionId,
    railName: row.railName,
  }));
}
