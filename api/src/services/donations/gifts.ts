import type { Donation, Prisma } from '@prisma/client';
import { deliverEmail } from '../mailer';
import { routeInstruction } from '../payment-flow';
import { EventTypes, publishEvent } from '../../utils/events';
import { errors } from '../../utils/errors';
import {
  actorLabel,
  assertAmount,
  assertCampaignAccepts,
  assertCurrency,
  availableBalance,
  dateOnly,
  day,
  decimal,
  donationGraph,
  findBeneficiary,
  findCampaign,
  findDonation,
  findDonor,
  findPledge,
  iso,
  isMonetary,
  jsonDocs,
  money,
  nextPublicId,
  notFuture,
  prisma,
  readDocs,
  recordAudit,
  refreshCampaign,
  roundMoney,
  type Doc,
  type Trace,
} from './shared';

type DonationRow = Prisma.DonationGetPayload<{ include: typeof donationGraph }>;

function clean(value?: string | null) {
  const text = value?.trim() ?? '';
  return text || null;
}

const METHOD_FOR_TYPE: Record<string, string[]> = {
  CASH: ['CASH'],
  BANK_TRANSFER: ['BANK_TRANSFER'],
  MOBILE_PAYMENT: ['MOBILE_PAYMENT'],
  CARD: ['CARD'],
  OTHER: ['OTHER', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'CASH'],
};

function serializePayment(row: DonationRow['payments'][number]) {
  return {
    id: row.publicId,
    amount: money(row.amount),
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    payerName: row.payerName,
    payerPhone: row.payerPhone,
    transactionReference: row.transactionReference,
    externalTransactionId: row.externalTransactionId,
    paymentDate: iso(row.paymentDate),
    status: row.status,
    reconciliationStatus: row.reconciliationStatus,
    railCode: row.railCode,
    railName: row.railName,
  };
}

function serializeInKind(row: NonNullable<DonationRow['inKind']>) {
  return {
    id: row.publicId,
    category: row.category,
    description: row.description,
    quantity: money(row.quantity),
    unit: row.unit,
    estimatedValue: money(row.estimatedValue),
    currency: row.currency,
    condition: row.condition,
    dateReceived: dateOnly(row.dateReceived),
    storageLocation: row.storageLocation,
    intendedBeneficiary: row.intendedBeneficiary,
    documents: readDocs(row.documents),
    valuationMethod: row.valuationMethod,
    valuer: row.valuer,
    valuationDate: dateOnly(row.valuationDate),
    unitValue: row.unitValue == null ? null : money(row.unitValue),
    totalValue: row.totalValue == null ? null : money(row.totalValue),
    evidence: row.evidence,
    valuedBy: row.valuedBy,
    reviewedBy: row.reviewedBy,
    approvedBy: row.approvedBy,
  };
}

export function serializeDonation(row: DonationRow) {
  const balance = availableBalance(row);
  return {
    id: row.publicId,
    reference: row.reference,
    donorId: row.donor.publicId,
    donorName: row.donor.name,
    donorStatus: row.donor.status,
    campaignId: row.campaign?.publicId ?? null,
    campaignName: row.campaign?.name ?? null,
    pledgeId: row.pledge?.publicId ?? null,
    beneficiaryId: row.beneficiary?.publicId ?? null,
    beneficiaryName: row.beneficiary?.name ?? null,
    donationType: row.donationType,
    status: row.status,
    heldFromStatus: row.heldFromStatus,
    donationDate: dateOnly(row.donationDate),
    amount: money(row.amount),
    currency: row.currency,
    purpose: row.purpose,
    availableBalance: balance,
    donorVerified: row.donorVerified,
    amountVerified: row.amountVerified,
    paymentVerified: row.paymentVerified,
    campaignVerified: row.campaignVerified,
    purposeVerified: row.purposeVerified,
    documentsVerified: row.documentsVerified,
    beneficiaryVerified: row.beneficiaryVerified,
    verificationResult: row.verificationResult,
    verificationComment: row.verificationComment,
    verifiedBy: row.verifiedBy,
    verificationDate: iso(row.verificationDate),
    approvalDecision: row.approvalDecision,
    approvedAmount: row.approvedAmount == null ? null : money(row.approvedAmount),
    conditions: row.conditions,
    approvedBy: row.approvedBy,
    approvalDate: iso(row.approvalDate),
    approvalComments: row.approvalComments,
    documents: readDocs(row.documents),
    inKind: row.inKind ? serializeInKind(row.inKind) : null,
    payments: row.payments.map(serializePayment),
    allocations: row.allocations.map((allocation) => ({
      id: allocation.publicId,
      beneficiaryId: allocation.beneficiary.publicId,
      beneficiary: allocation.beneficiary.name,
      amount: money(allocation.amount),
      currency: allocation.currency,
      purpose: allocation.purpose,
      category: allocation.category,
      status: allocation.status,
      date: dateOnly(allocation.allocationDate),
    })),
    refunds: row.refunds.map((refund) => ({
      id: refund.publicId,
      amount: money(refund.amount),
      originalAmount: money(refund.originalAmount),
      currency: refund.currency,
      reason: refund.reason,
      destination: refund.destination,
      status: refund.status,
      requestedBy: refund.requestedBy,
      reviewedBy: refund.reviewedBy,
      approvedBy: refund.approvedBy,
      approvalDate: iso(refund.approvalDate),
    })),
    adjustments: row.adjustments.map((adjustment) => ({
      id: adjustment.publicId,
      originalAmount: money(adjustment.originalAmount),
      amount: money(adjustment.amount),
      adjustmentType: adjustment.adjustmentType,
      reason: adjustment.reason,
      requestedBy: adjustment.requestedBy,
      approvedBy: adjustment.approvedBy,
      date: adjustment.appliedAt.toISOString(),
    })),
    receipt: row.receipt ? {
      id: row.receipt.publicId,
      donorName: row.receipt.donorName,
      campaign: row.receipt.campaignName,
      amount: money(row.receipt.amount),
      currency: row.receipt.currency,
      donationDate: dateOnly(row.receipt.donationDate),
      paymentMethod: row.receipt.paymentMethod,
      transactionReference: row.receipt.transactionReference,
      purpose: row.receipt.purpose,
      signatory: row.receipt.signatory,
      issuedAt: row.receipt.issuedAt.toISOString(),
    } : null,
    reconciliations: row.reconciliations.map((item) => ({
      id: item.publicId,
      paymentId: item.paymentId,
      expectedAmount: money(item.expectedAmount),
      receivedAmount: money(item.receivedAmount),
      currency: item.currency,
      externalTransactionId: item.externalTransactionId,
      settlementReference: item.settlementReference,
      settlementDate: dateOnly(item.settlementDate),
      difference: money(item.difference),
      status: item.status,
    })),
    ledger: row.ledger.map((item) => ({
      date: item.createdAt.toISOString(),
      entryType: item.entryType,
      description: item.description,
      amount: money(item.amount),
      currency: item.currency,
      reference: item.reference,
      status: row.status,
    })),
    compliance: row.compliance.map((item) => ({
      id: item.publicId,
      result: item.result,
      officerName: item.officerName,
      reviewedAt: item.reviewedAt.toISOString(),
      comments: item.comments,
      donorIdentified: item.donorIdentified,
      donorVerified: item.donorVerified,
      sourceRecorded: item.sourceRecorded,
      approvalsObtained: item.approvalsObtained,
      documentationComplete: item.documentationComplete,
      beneficiaryVerified: item.beneficiaryVerified,
      restrictionsRecorded: item.restrictionsRecorded,
      reportingCompleted: item.reportingCompleted,
    })),
    messages: row.messages.map((item) => ({
      id: item.publicId,
      type: item.communicationType,
      channel: item.channel,
      subject: item.subject,
      message: item.message,
      sentBy: item.sentBy,
      sentAt: item.sentAt.toISOString(),
      status: item.deliveryStatus,
    })),
    audits: row.audits.map((item) => ({
      id: item.publicId,
      userId: item.userId,
      action: item.action,
      previousStatus: item.previousStatus,
      newStatus: item.newStatus,
      amount: item.amount == null ? null : money(item.amount),
      reason: item.reason,
      reference: item.reference,
      ip: item.ip,
      sessionId: item.sessionId,
      createdAt: item.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDonations(query: { q?: string; status?: string; donationType?: string; queue?: string }) {
  const rows = await prisma.donation.findMany({
    include: { donor: true, campaign: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (query.status && row.status !== query.status) return false;
    if (query.donationType === 'MONETARY' && !isMonetary(row.donationType)) return false;
    if (query.donationType && query.donationType !== 'MONETARY' && row.donationType !== query.donationType) return false;
    if (query.queue === 'verification' && !['SUBMITTED', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(row.status)) return false;
    if (query.queue === 'approval' && row.status !== 'RECEIVED') return false;
    if (!needle) return true;
    return [row.publicId, row.reference, row.donor.name, row.campaign?.name, row.purpose]
      .some((part) => String(part ?? '').toLowerCase().includes(needle));
  }).map((row) => ({
    id: row.publicId,
    reference: row.reference,
    donor: row.donor.name,
    campaign: row.campaign?.name ?? '—',
    donationType: row.donationType,
    amount: money(row.amount),
    currency: row.currency,
    status: row.status,
    date: dateOnly(row.donationDate ?? row.createdAt),
  }));
}

export async function getDonation(id: string) {
  return serializeDonation(await findDonation(id));
}

type GiftInput = {
  donorId: string;
  campaignId?: string;
  pledgeId?: string;
  beneficiaryId?: string;
  donationType: Donation['donationType'];
  donationDate?: string;
  amount?: number;
  currency?: string;
  purpose?: string;
  documents?: Doc[];
  inKind?: {
    category?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    estimatedValue?: number;
    condition?: string;
    dateReceived?: string;
    storageLocation?: string;
    intendedBeneficiary?: string;
    documents?: Doc[];
  };
};

async function prepareGift(input: GiftInput, mode: 'draft' | 'submit') {
  const donor = await findDonor(input.donorId);
  if (mode === 'submit' && donor.status !== 'VERIFIED') {
    throw errors.unprocessable('DONOR_NOT_VERIFIED', 'Verify the donor before submitting a donation or pledge.');
  }
  const campaign = input.campaignId ? await findCampaign(input.campaignId) : null;
  if (mode === 'submit' && !campaign) {
    throw errors.unprocessable('CAMPAIGN_REQUIRED', 'Choose a campaign before submitting the donation.');
  }
  const beneficiary = input.beneficiaryId ? await findBeneficiary(input.beneficiaryId) : null;
  if (beneficiary && mode === 'submit' && beneficiary.status !== 'VERIFIED') {
    throw errors.unprocessable('BENEFICIARY_NOT_VERIFIED', 'The designated beneficiary must be verified.');
  }
  const currency = assertCurrency(input.currency || campaign?.currency || 'RWF');
  const inKind = input.donationType === 'IN_KIND';
  let amount = input.amount ?? 0;
  if (inKind) {
    const item = input.inKind;
    if (mode === 'submit') {
      if (!clean(item?.category) || !clean(item?.description) || !clean(item?.unit) || !clean(item?.condition)) {
        throw errors.unprocessable('IN_KIND_INCOMPLETE', 'Enter the category, description, unit, and condition of the in-kind donation.');
      }
      if (!item?.quantity || item.quantity <= 0) throw errors.unprocessable('QUANTITY_INVALID', 'Quantity must be greater than zero.');
      if (!clean(item.storageLocation) || !item.dateReceived) {
        throw errors.unprocessable('IN_KIND_INCOMPLETE', 'Enter the date received and the storage location.');
      }
      notFuture(item.dateReceived);
    }
    amount = item?.estimatedValue && item.estimatedValue > 0 ? assertAmount(item.estimatedValue, 'Estimated value') : 0;
    if (mode === 'submit' && amount <= 0) throw errors.unprocessable('VALUE_REQUIRED', 'Enter the estimated value of the in-kind donation.');
  } else if (mode === 'submit' || (input.amount != null && input.amount > 0)) {
    amount = input.amount && input.amount > 0 ? assertAmount(input.amount) : 0;
    if (mode === 'submit' && amount <= 0) throw errors.unprocessable('AMOUNT_REQUIRED', 'Enter the donation amount.');
  }
  if (campaign && amount > 0) assertCampaignAccepts(campaign, amount, currency);
  if (input.donationDate) notFuture(input.donationDate);
  const pledge = input.pledgeId ? await findPledge(input.pledgeId) : null;
  if (pledge) {
    if (pledge.donorId !== donor.id) throw errors.unprocessable('PLEDGE_DONOR_MISMATCH', 'The pledge belongs to a different donor.');
    if (campaign && pledge.campaignId !== campaign.id) throw errors.unprocessable('PLEDGE_CAMPAIGN_MISMATCH', 'The pledge belongs to a different campaign.');
    if (!['PLEDGED', 'PARTIALLY_FULFILLED'].includes(pledge.status)) {
      throw errors.unprocessable('PLEDGE_CLOSED', 'This pledge is no longer open for a donation.');
    }
    const remaining = roundMoney(money(pledge.amount) - money(pledge.fulfilledAmount));
    if (amount > remaining) {
      throw errors.unprocessable('PLEDGE_EXCEEDED', `This pledge has ${remaining} ${pledge.currency} still outstanding.`);
    }
  }
  return { donor, campaign, beneficiary, pledge, currency, amount, inKind };
}

export async function saveDonation(input: GiftInput, mode: 'draft' | 'submit', trace: Trace) {
  const prepared = await prepareGift(input, mode);
  const status = mode === 'submit' ? 'SUBMITTED' : 'DRAFT';
  const publicId = await nextPublicId('DON');
  const created = await prisma.donation.create({
    data: {
      publicId,
      reference: `${publicId}-REF`,
      donorId: prepared.donor.id,
      campaignId: prepared.campaign?.id,
      pledgeId: prepared.pledge?.id,
      beneficiaryId: prepared.beneficiary?.id,
      donationType: input.donationType,
      status,
      donationDate: day(input.donationDate) ?? new Date(),
      amount: prepared.amount,
      currency: prepared.currency,
      purpose: clean(input.purpose),
      documents: jsonDocs(readDocs(input.documents)),
      inKind: prepared.inKind && input.inKind ? {
        create: {
          publicId: await nextPublicId('INK'),
          category: clean(input.inKind.category) ?? 'Other',
          description: clean(input.inKind.description) ?? '',
          quantity: input.inKind.quantity ?? 0,
          unit: clean(input.inKind.unit) ?? '',
          estimatedValue: prepared.amount,
          currency: prepared.currency,
          condition: clean(input.inKind.condition),
          dateReceived: day(input.inKind.dateReceived),
          storageLocation: clean(input.inKind.storageLocation),
          intendedBeneficiary: clean(input.inKind.intendedBeneficiary),
          documents: jsonDocs(readDocs(input.inKind.documents)),
        },
      } : undefined,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: created.publicId,
    donationId: created.id,
    action: mode === 'submit' ? 'Submitted' : 'Draft saved',
    newStatus: status,
    amount: prepared.amount,
  });
  return getDonation(created.publicId);
}

export async function listPledges(query: { status?: string; q?: string }) {
  const rows = await prisma.pledge.findMany({ include: { donor: true, campaign: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) => (!query.status || row.status === query.status) && (!needle || [row.publicId, row.donor.name, row.campaign.name].some((part) => part.toLowerCase().includes(needle))))
    .map((row) => ({
      id: row.publicId,
      donorId: row.donor.publicId,
      donor: row.donor.name,
      campaignId: row.campaign.publicId,
      campaign: row.campaign.name,
      amount: money(row.amount),
      fulfilled: money(row.fulfilledAmount),
      currency: row.currency,
      frequency: row.frequency,
      status: row.status,
      pledgeDate: dateOnly(row.pledgeDate),
      expectedPaymentDate: dateOnly(row.expectedPaymentDate),
      purpose: row.purpose,
      notes: row.notes,
    }));
}

export async function savePledge(input: {
  donorId: string;
  campaignId: string;
  amount: number;
  currency?: string;
  pledgeDate: string;
  expectedPaymentDate?: string;
  frequency: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'OTHER';
  purpose?: string;
  notes?: string;
}, trace: Trace) {
  const donor = await findDonor(input.donorId);
  if (donor.status !== 'VERIFIED') throw errors.unprocessable('DONOR_NOT_VERIFIED', 'Verify the donor before recording a pledge.');
  const campaign = await findCampaign(input.campaignId);
  const currency = assertCurrency(input.currency || campaign.currency);
  const amount = assertAmount(input.amount, 'Pledged amount');
  assertCampaignAccepts(campaign, amount, currency);
  notFuture(input.pledgeDate);
  if (input.expectedPaymentDate && input.expectedPaymentDate < input.pledgeDate) {
    throw errors.unprocessable('DATE_RANGE_INVALID', 'The expected payment date cannot be before the pledge date.');
  }
  const created = await prisma.pledge.create({
    data: {
      publicId: await nextPublicId('PLG'),
      donorId: donor.id,
      campaignId: campaign.id,
      amount,
      currency,
      pledgeDate: day(input.pledgeDate)!,
      expectedPaymentDate: day(input.expectedPaymentDate),
      frequency: input.frequency,
      purpose: clean(input.purpose),
      notes: clean(input.notes),
    },
  });
  await recordAudit({
    trace,
    entityType: 'Pledge',
    entityId: created.publicId,
    action: 'Pledge recorded',
    newStatus: 'PLEDGED',
    amount,
    reference: donor.publicId,
  });
  return { id: created.publicId, status: created.status };
}

export async function setPledgeStatus(id: string, status: 'CANCELLED' | 'EXPIRED', trace: Trace) {
  const pledge = await findPledge(id);
  if (!['PLEDGED', 'PARTIALLY_FULFILLED'].includes(pledge.status)) {
    throw errors.unprocessable('PLEDGE_CLOSED', 'This pledge can no longer be changed.');
  }
  if (status === 'EXPIRED') {
    if (!pledge.expectedPaymentDate || pledge.expectedPaymentDate.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10)) {
      throw errors.unprocessable('PLEDGE_NOT_DUE', 'A pledge can expire only after its expected payment date.');
    }
  }
  await prisma.pledge.update({ where: { id: pledge.id }, data: { status } });
  await recordAudit({
    trace,
    entityType: 'Pledge',
    entityId: pledge.publicId,
    action: status === 'CANCELLED' ? 'Pledge cancelled' : 'Pledge expired',
    previousStatus: pledge.status,
    newStatus: status,
    amount: money(pledge.amount),
  });
  return { id: pledge.publicId, status };
}

export async function verifyDonation(id: string, input: {
  result: 'VERIFIED' | 'PENDING' | 'MORE_INFORMATION_REQUIRED' | 'REJECTED';
  donorVerified: boolean;
  amountVerified: boolean;
  paymentVerified: boolean;
  campaignVerified: boolean;
  purposeVerified: boolean;
  documentsVerified: boolean;
  beneficiaryVerified: boolean;
  comments?: string;
}, trace: Trace) {
  const donation = await findDonation(id);
  if (!['SUBMITTED', 'PENDING_VERIFICATION', 'UNDER_REVIEW', 'VERIFIED'].includes(donation.status)) {
    throw errors.unprocessable('VERIFICATION_CLOSED', 'Verification is open after the donation is submitted and before payment is received.');
  }
  if (input.paymentVerified && isMonetary(donation.donationType) && !donation.payments.some((payment) => payment.status === 'SUCCESS')) {
    throw errors.unprocessable('PAYMENT_NOT_CONFIRMED', 'Payment can be marked verified only after the payment service confirms it.');
  }
  if (input.paymentVerified && !isMonetary(donation.donationType) && !valuationReady(donation.inKind)) {
    throw errors.unprocessable('VALUATION_REQUIRED', 'Approve the in-kind valuation before confirming the donated value.');
  }
  if (input.documentsVerified && readDocs(donation.documents).length === 0 && readDocs(donation.inKind?.documents).length === 0) {
    throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Attach supporting documents before confirming them.');
  }
  if (input.beneficiaryVerified && donation.beneficiary && donation.beneficiary.status !== 'VERIFIED') {
    throw errors.unprocessable('BENEFICIARY_NOT_VERIFIED', 'Verify the designated beneficiary first.');
  }
  if (input.result === 'VERIFIED') {
    const checks = [
      input.donorVerified,
      input.amountVerified,
      input.campaignVerified,
      input.purposeVerified,
      input.documentsVerified,
      !donation.beneficiary || input.beneficiaryVerified,
    ];
    if (checks.some((item) => !item)) {
      throw errors.unprocessable('VERIFICATION_INCOMPLETE', 'Complete the donor, amount, campaign, purpose, document, and beneficiary checks before verifying.');
    }
    if (!isMonetary(donation.donationType) && !valuationReady(donation.inKind)) {
      throw errors.unprocessable('VALUATION_REQUIRED', 'Value, review, and approve the in-kind donation before verifying it.');
    }
  }
  const officer = await actorLabel(trace.actorId);
  const next = input.result === 'VERIFIED'
    ? 'VERIFIED'
    : input.result === 'REJECTED'
      ? 'REJECTED'
      : input.result === 'MORE_INFORMATION_REQUIRED'
        ? 'UNDER_REVIEW'
        : 'PENDING_VERIFICATION';
  await prisma.donation.update({
    where: { id: donation.id },
    data: {
      donorVerified: input.donorVerified,
      amountVerified: input.amountVerified,
      paymentVerified: input.paymentVerified || donation.paymentVerified,
      campaignVerified: input.campaignVerified,
      purposeVerified: input.purposeVerified,
      documentsVerified: input.documentsVerified,
      beneficiaryVerified: input.beneficiaryVerified,
      verificationResult: input.result,
      verificationComment: clean(input.comments),
      verifiedBy: officer,
      verificationDate: new Date(),
      heldFromStatus: next === 'UNDER_REVIEW' ? donation.status : null,
      status: next,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Verification',
    previousStatus: donation.status,
    newStatus: next,
    reason: input.comments,
    reference: input.result,
    amount: money(donation.amount),
  });
  return getDonation(donation.publicId);
}

function valuationReady(inKind: DonationRow['inKind']) {
  if (!inKind?.valuedBy || !inKind.reviewedBy || !inKind.approvedBy || !inKind.valuationMethod || inKind.totalValue == null) return false;
  return inKind.approvedBy !== inKind.valuedBy;
}

export async function saveValuation(id: string, input: {
  valuationMethod: string;
  valuer?: string;
  valuationDate: string;
  unitValue: number;
  evidence?: string;
  valuedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
}, trace: Trace) {
  const donation = await findDonation(id);
  if (donation.donationType !== 'IN_KIND' || !donation.inKind) {
    throw errors.unprocessable('NOT_IN_KIND', 'Valuation applies to an in-kind donation.');
  }
  if (['RECEIVED', 'APPROVED', 'ALLOCATED', 'DISTRIBUTED', 'COMPLETED'].includes(donation.status)) {
    throw errors.unprocessable('VALUATION_LOCKED', 'The valuation is locked after the donation is received.');
  }
  notFuture(input.valuationDate);
  const quantity = money(donation.inKind.quantity);
  const unitValue = assertAmount(input.unitValue, 'Estimated unit value');
  const total = roundMoney(quantity * unitValue);
  if (input.approvedBy && input.valuedBy && input.approvedBy.trim() === input.valuedBy.trim()) {
    throw errors.unprocessable('SEGREGATION_REQUIRED', 'The officer who values the gift cannot be the officer who approves the value.');
  }
  await prisma.inKindDonation.update({
    where: { id: donation.inKind.id },
    data: {
      valuationMethod: input.valuationMethod.trim(),
      valuer: clean(input.valuer),
      valuationDate: day(input.valuationDate),
      unitValue,
      totalValue: total,
      evidence: clean(input.evidence),
      valuedBy: clean(input.valuedBy),
      reviewedBy: clean(input.reviewedBy),
      approvedBy: clean(input.approvedBy),
      estimatedValue: total,
    },
  });
  await prisma.donation.update({ where: { id: donation.id }, data: { amount: total } });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'In-kind valuation',
    amount: total,
    reference: input.valuationMethod,
  });
  return getDonation(donation.publicId);
}

export async function receiveInKind(id: string, trace: Trace) {
  const donation = await findDonation(id);
  if (donation.donationType !== 'IN_KIND') throw errors.unprocessable('NOT_IN_KIND', 'Only an in-kind donation is received without the payment service.');
  if (donation.status !== 'VERIFIED') throw errors.unprocessable('NOT_VERIFIED', 'Verify the in-kind donation before receiving it.');
  if (!valuationReady(donation.inKind)) throw errors.unprocessable('VALUATION_REQUIRED', 'Approve the valuation before receiving the goods or services.');
  const officer = await actorLabel(trace.actorId);
  await prisma.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: donation.id },
      data: { status: 'RECEIVED', paymentVerified: true },
    });
    await tx.donationLedgerEntry.create({
      data: {
        donationId: donation.id,
        entryType: 'RECEIVED',
        amount: donation.amount,
        currency: donation.currency,
        description: 'In-kind donation received',
        reference: donation.publicId,
      },
    });
    await issueReceipt(tx, donation, officer, 'IN_KIND', donation.publicId);
    if (donation.pledgeId) await fulfillPledge(tx, donation.pledgeId, money(donation.amount));
  });
  await publishEvent(EventTypes.donationReceived, donation.publicId, { donationId: donation.publicId, kind: 'IN_KIND' });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'In-kind received',
    previousStatus: donation.status,
    newStatus: 'RECEIVED',
    amount: money(donation.amount),
  });
  await refreshCampaign(donation.campaignId);
  return getDonation(donation.publicId);
}

async function fulfillPledge(tx: Prisma.TransactionClient, pledgeId: string, amount: number) {
  const pledge = await tx.pledge.findUnique({ where: { id: pledgeId } });
  if (!pledge || pledge.status === 'CANCELLED' || pledge.status === 'EXPIRED') return;
  const fulfilled = roundMoney(money(pledge.fulfilledAmount) + amount);
  await tx.pledge.update({
    where: { id: pledge.id },
    data: {
      fulfilledAmount: Math.max(0, fulfilled),
      status: fulfilled >= money(pledge.amount) ? 'FULFILLED' : fulfilled > 0 ? 'PARTIALLY_FULFILLED' : 'PLEDGED',
    },
  });
}

async function issueReceipt(
  tx: Prisma.TransactionClient,
  donation: { id: string; donorId: string; campaignId: string | null; amount: Prisma.Decimal; currency: string; donationDate: Date | null; purpose: string | null; createdAt: Date },
  signatory: string,
  paymentMethod: string | null,
  transactionReference: string | null,
) {
  const existing = await tx.donationReceipt.findUnique({ where: { donationId: donation.id } });
  if (existing) return existing;
  const donor = await tx.donor.findUniqueOrThrow({ where: { id: donation.donorId } });
  const campaign = donation.campaignId ? await tx.campaign.findUnique({ where: { id: donation.campaignId } }) : null;
  return tx.donationReceipt.create({
    data: {
      publicId: await nextPublicId('DRC'),
      donationId: donation.id,
      donorName: donor.name,
      campaignName: campaign?.name,
      amount: donation.amount,
      currency: donation.currency,
      donationDate: donation.donationDate ?? donation.createdAt,
      paymentMethod,
      transactionReference,
      purpose: donation.purpose,
      signatory,
    },
  });
}

export async function processPayment(id: string, input: {
  paymentMethod: string;
  payerName?: string;
  payerPhone?: string;
  amount?: number;
}, trace: Trace) {
  const donation = await findDonation(id);
  if (!isMonetary(donation.donationType)) {
    throw errors.unprocessable('PAYMENT_NOT_MONETARY', 'In-kind donations are received through valuation, not the payment service.');
  }
  if (!['VERIFIED', 'FAILED'].includes(donation.status)) {
    throw errors.unprocessable('PAYMENT_NOT_READY', 'Verify the donation before sending it to the payment service.');
  }
  const allowed = METHOD_FOR_TYPE[donation.donationType] ?? [];
  if (!allowed.includes(input.paymentMethod)) {
    throw errors.unprocessable('METHOD_NOT_ALLOWED', `A ${donation.donationType.toLowerCase().replaceAll('_', ' ')} donation uses ${allowed.join(', ').toLowerCase().replaceAll('_', ' ')}.`);
  }
  const amount = input.amount == null ? money(donation.amount) : assertAmount(input.amount);
  if (amount !== money(donation.amount)) {
    throw errors.unprocessable('AMOUNT_MISMATCH', 'The payment amount must match the donation amount.');
  }
  let railCode: string | null = null;
  let railName: string | null = null;
  const channel = input.paymentMethod === 'BANK_TRANSFER' ? 'BANK' : input.paymentMethod === 'CARD' ? 'CARD' : input.paymentMethod === 'MOBILE_PAYMENT' ? 'MOBILE_PAYMENT' : null;
  if (channel) {
    const route = await routeInstruction({ channel, originCountry: 'RW', destinationCountry: 'RW' });
    railCode = route.rail.code;
    railName = route.rail.name;
  }
  const payment = await prisma.donationPayment.create({
    data: {
      publicId: await nextPublicId('DPY'),
      donationId: donation.id,
      amount,
      currency: donation.currency,
      paymentMethod: input.paymentMethod,
      payerName: clean(input.payerName) ?? donation.donor.name,
      payerPhone: clean(input.payerPhone) ?? donation.donor.telephone,
      status: 'INITIATED',
      railCode,
      railName,
    },
  });
  await prisma.donation.update({ where: { id: donation.id }, data: { status: 'PAYMENT_PENDING', heldFromStatus: null } });
  await publishEvent(EventTypes.paymentInitiated, payment.publicId, {
    paymentId: payment.publicId,
    donationId: donation.publicId,
    rail: railCode,
    source: 'donation',
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Payment initiated',
    previousStatus: donation.status,
    newStatus: 'PAYMENT_PENDING',
    amount,
    reference: payment.publicId,
  });
  return getDonation(donation.publicId);
}

export async function confirmPayment(id: string, paymentId: string, input: {
  outcome: 'SUCCESS' | 'FAILED';
  transactionReference?: string;
  externalTransactionId?: string;
  receivedAmount?: number;
  settlementReference?: string;
  settlementDate?: string;
}, trace: Trace) {
  const donation = await findDonation(id);
  const payment = donation.payments.find((item) => item.publicId === paymentId);
  if (!payment) throw errors.notFound('PAYMENT_NOT_FOUND', 'The requested donation payment could not be found.');
  if (!['INITIATED', 'PENDING'].includes(payment.status)) {
    throw errors.unprocessable('PAYMENT_CLOSED', 'This payment has already been confirmed, failed, or reversed.');
  }
  if (input.settlementDate) notFuture(input.settlementDate);
  if (input.outcome === 'FAILED') {
    await prisma.donationPayment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    await prisma.donationReconciliation.create({
      data: {
        publicId: await nextPublicId('DRL'),
        donationId: donation.id,
        paymentId: payment.publicId,
        expectedAmount: payment.amount,
        receivedAmount: 0,
        currency: payment.currency,
        difference: decimal(-money(payment.amount)),
        status: 'FAILED',
      },
    });
    await prisma.donation.update({ where: { id: donation.id }, data: { status: 'FAILED' } });
    await publishEvent(EventTypes.paymentFailed, payment.publicId, { paymentId: payment.publicId, donationId: donation.publicId });
    await recordAudit({
      trace,
      entityType: 'Donation',
      entityId: donation.publicId,
      donationId: donation.id,
      action: 'Payment failed',
      previousStatus: donation.status,
      newStatus: 'FAILED',
      amount: money(payment.amount),
      reference: payment.publicId,
    });
    return getDonation(donation.publicId);
  }

  const external = clean(input.externalTransactionId);
  if (!external) throw errors.unprocessable('REFERENCE_REQUIRED', 'Enter the external transaction ID before confirming the payment.');
  const duplicate = await prisma.donationPayment.findFirst({
    where: { externalTransactionId: external, id: { not: payment.id }, status: 'SUCCESS' },
  });
  const expected = money(payment.amount);
  const received = input.receivedAmount == null ? expected : roundMoney(input.receivedAmount);
  const difference = roundMoney(received - expected);
  let reconciliation = 'PENDING';
  if (duplicate) reconciliation = 'DUPLICATE';
  else if (received === expected) reconciliation = 'MATCHED';
  else if (received > 0 && received < expected) reconciliation = 'PARTIALLY_MATCHED';
  else if (received === 0) reconciliation = 'UNMATCHED';
  else reconciliation = 'UNDER_REVIEW';

  const reference = clean(input.transactionReference) ?? payment.publicId;
  await prisma.donationPayment.update({
    where: { id: payment.id },
    data: {
      status: reconciliation === 'MATCHED' ? 'SUCCESS' : 'PENDING',
      transactionReference: reference,
      externalTransactionId: external,
      paymentDate: new Date(),
      reconciliationStatus: reconciliation,
    },
  });
  await prisma.donationReconciliation.create({
    data: {
      publicId: await nextPublicId('DRL'),
      donationId: donation.id,
      paymentId: payment.publicId,
      expectedAmount: expected,
      receivedAmount: received,
      currency: payment.currency,
      externalTransactionId: external,
      settlementReference: clean(input.settlementReference),
      settlementDate: day(input.settlementDate),
      difference,
      status: reconciliation,
    },
  });
  if (reconciliation !== 'MATCHED') {
    await recordAudit({
      trace,
      entityType: 'Donation',
      entityId: donation.publicId,
      donationId: donation.id,
      action: 'Reconciliation',
      previousStatus: donation.status,
      newStatus: donation.status,
      amount: received,
      reference: reconciliation,
      reason: duplicate ? 'External transaction ID is already matched to another payment.' : 'The received amount does not match the donation.',
    });
    return getDonation(donation.publicId);
  }

  const officer = await actorLabel(trace.actorId);
  await prisma.$transaction(async (tx) => {
    await tx.donation.update({ where: { id: donation.id }, data: { status: 'RECEIVED', paymentVerified: true } });
    await tx.donationLedgerEntry.create({
      data: {
        donationId: donation.id,
        entryType: 'RECEIVED',
        amount: payment.amount,
        currency: payment.currency,
        description: 'Donation received',
        reference: payment.publicId,
      },
    });
    await issueReceipt(tx, donation, officer, payment.paymentMethod, reference);
    if (donation.pledgeId) await fulfillPledge(tx, donation.pledgeId, expected);
  });
  await publishEvent(EventTypes.paymentCompleted, payment.publicId, { paymentId: payment.publicId, donationId: donation.publicId, source: 'donation' });
  await publishEvent(EventTypes.donationReceived, donation.publicId, { donationId: donation.publicId });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Payment confirmed',
    previousStatus: 'PAYMENT_PENDING',
    newStatus: 'RECEIVED',
    amount: expected,
    reference: payment.publicId,
  });
  await refreshCampaign(donation.campaignId);
  return getDonation(donation.publicId);
}

export async function decideDonation(id: string, input: {
  decision: 'APPROVE' | 'REJECT' | 'MORE_INFORMATION' | 'HOLD';
  approvedAmount?: number;
  conditions?: string;
  comments?: string;
}, trace: Trace) {
  const donation = await findDonation(id);
  if (donation.status !== 'RECEIVED' && !(donation.status === 'UNDER_REVIEW' && donation.heldFromStatus === 'RECEIVED')) {
    throw errors.unprocessable('APPROVAL_NOT_READY', 'Approve a donation only after it has been received.');
  }
  if (isMonetary(donation.donationType) && !donation.paymentVerified) {
    throw errors.unprocessable('PAYMENT_NOT_VERIFIED', 'Confirm and match the payment before approval.');
  }
  const officer = await actorLabel(trace.actorId);
  if (input.decision === 'APPROVE') {
    const approved = input.approvedAmount == null ? money(donation.amount) : assertAmount(input.approvedAmount, 'Approved amount');
    if (approved > money(donation.amount)) {
      throw errors.unprocessable('AMOUNT_EXCEEDS_DONATION', 'The approved amount cannot exceed the amount received.');
    }
    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        status: 'APPROVED',
        approvalDecision: 'APPROVE',
        approvedAmount: approved,
        conditions: clean(input.conditions),
        approvedBy: officer,
        approvalDate: new Date(),
        approvalComments: clean(input.comments),
        heldFromStatus: null,
      },
    });
  } else if (input.decision === 'REJECT') {
    await prisma.donation.update({
      where: { id: donation.id },
      data: { status: 'REJECTED', approvalDecision: 'REJECT', approvedBy: officer, approvalDate: new Date(), approvalComments: clean(input.comments) },
    });
  } else {
    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        status: 'UNDER_REVIEW',
        heldFromStatus: 'RECEIVED',
        approvalDecision: input.decision,
        approvalComments: clean(input.comments),
        approvedBy: officer,
        approvalDate: new Date(),
      },
    });
  }
  const next = input.decision === 'APPROVE' ? 'APPROVED' : input.decision === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Approval',
    previousStatus: donation.status,
    newStatus: next,
    amount: input.approvedAmount ?? money(donation.amount),
    reason: input.comments,
    reference: input.decision,
  });
  return getDonation(donation.publicId);
}

export async function releaseHold(id: string, trace: Trace) {
  const donation = await findDonation(id);
  if (donation.status !== 'UNDER_REVIEW' || !donation.heldFromStatus) {
    throw errors.unprocessable('NOT_ON_HOLD', 'This donation is not on hold.');
  }
  await prisma.donation.update({
    where: { id: donation.id },
    data: { status: donation.heldFromStatus as Donation['status'], heldFromStatus: null },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Hold released',
    previousStatus: 'UNDER_REVIEW',
    newStatus: donation.heldFromStatus,
  });
  return getDonation(donation.publicId);
}

export async function cancelDonation(id: string, reason: string | undefined, trace: Trace) {
  const donation = await findDonation(id);
  if (!['DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'PAYMENT_PENDING', 'FAILED'].includes(donation.status)) {
    throw errors.unprocessable('CANCEL_NOT_ALLOWED', 'A received donation is closed with a refund, not a cancellation.');
  }
  await prisma.donation.update({ where: { id: donation.id }, data: { status: 'CANCELLED' } });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Cancelled',
    previousStatus: donation.status,
    newStatus: 'CANCELLED',
    reason,
    amount: money(donation.amount),
  });
  return getDonation(donation.publicId);
}

export function receiptPdf(donation: Awaited<ReturnType<typeof getDonation>>) {
  if (!donation.receipt) throw errors.unprocessable('RECEIPT_NOT_ISSUED', 'A receipt is issued after the donation is received.');
  const lines = [
    'RUPSA NEXT PAYMENT',
    'Donation receipt',
    `Receipt: ${donation.receipt.id}`,
    `Donation: ${donation.id}`,
    `Donor: ${donation.receipt.donorName}`,
    `Campaign: ${donation.receipt.campaign ?? '—'}`,
    `Amount: ${donation.receipt.amount} ${donation.receipt.currency}`,
    `Date: ${donation.receipt.donationDate ?? ''}`,
    `Method: ${donation.receipt.paymentMethod ?? '—'}`,
    `Reference: ${donation.receipt.transactionReference ?? '—'}`,
    `Purpose: ${donation.receipt.purpose ?? '—'}`,
    `Signatory: ${donation.receipt.signatory}`,
  ];
  return renderPdf(lines);
}

function renderPdf(lines: string[]) {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const commands = ['BT', '/F1 12 Tf', '50 780 Td', '16 TL'];
  lines.forEach((line, index) => {
    commands.push(index === 0 ? `(${escape(line)}) Tj` : `T* (${escape(line)}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

export async function sendReceipt(id: string, channel: 'EMAIL' | 'SMS', trace: Trace) {
  const donation = await findDonation(id);
  if (!donation.receipt) throw errors.unprocessable('RECEIPT_NOT_ISSUED', 'Generate the receipt after the donation is received.');
  const officer = await actorLabel(trace.actorId);
  const subject = `Donation receipt ${donation.receipt.publicId}`;
  const body = `${donation.donor.name} — ${money(donation.receipt.amount)} ${donation.receipt.currency} received for ${donation.receipt.campaignName ?? 'RUPSA NEXT'}. Receipt ${donation.receipt.publicId}.`;
  let deliveryStatus = 'QUEUED';
  if (channel === 'EMAIL') {
    if (!donation.donor.email) throw errors.unprocessable('EMAIL_MISSING', 'This donor has no email address.');
    const sent = await deliverEmail({ to: donation.donor.email, subject, text: body, html: `<p>${body}</p>` });
    deliveryStatus = sent ? 'SENT' : 'QUEUED';
  }
  await prisma.donorMessage.create({
    data: {
      publicId: await nextPublicId('MSG'),
      donorId: donation.donorId,
      donationId: donation.id,
      campaignId: donation.campaignId,
      communicationType: 'RECEIPT',
      channel,
      subject,
      message: body,
      sentBy: officer,
      deliveryStatus,
    },
  });
  await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      channel,
      subject,
      body,
      status: deliveryStatus,
      sentAt: deliveryStatus === 'SENT' ? new Date() : null,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: `Receipt ${channel.toLowerCase()}`,
    reference: donation.receipt.publicId,
  });
  return getDonation(donation.publicId);
}

export async function requestRefund(id: string, input: {
  amount: number;
  reason: string;
  destination: string;
  originalTransactionReference?: string;
  documents?: Doc[];
}, trace: Trace) {
  const donation = await findDonation(id);
  if (!['RECEIVED', 'APPROVED', 'ALLOCATED', 'UNDER_REVIEW'].includes(donation.status)) {
    throw errors.unprocessable('REFUND_NOT_ALLOWED', 'Refund an accepted donation that has not yet been fully distributed.');
  }
  const amount = assertAmount(input.amount, 'Refund amount');
  if (amount > availableBalance(donation)) {
    throw errors.unprocessable('REFUND_EXCEEDS_BALANCE', 'The refund cannot exceed the unallocated balance.');
  }
  if (!clean(input.reason) || !clean(input.destination)) {
    throw errors.unprocessable('REFUND_INCOMPLETE', 'Enter the reason and the refund destination.');
  }
  const payment = donation.payments.find((item) => item.status === 'SUCCESS');
  const officer = await actorLabel(trace.actorId);
  const created = await prisma.donationRefund.create({
    data: {
      publicId: await nextPublicId('DRF'),
      donationId: donation.id,
      originalAmount: donation.amount,
      amount,
      currency: donation.currency,
      reason: input.reason.trim(),
      originalTransactionReference: clean(input.originalTransactionReference) ?? payment?.transactionReference,
      destination: input.destination.trim(),
      documents: jsonDocs(readDocs(input.documents)),
      requestedBy: officer,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Refund requested',
    amount,
    reason: input.reason,
    reference: created.publicId,
    newStatus: 'REQUESTED',
  });
  return getDonation(donation.publicId);
}

export async function advanceRefund(id: string, refundId: string, action: 'REVIEW' | 'APPROVE' | 'PROCESS' | 'COMPLETE' | 'REJECT', trace: Trace) {
  const donation = await findDonation(id);
  const refund = donation.refunds.find((item) => item.publicId === refundId);
  if (!refund) throw errors.notFound('REFUND_NOT_FOUND', 'The requested refund could not be found.');
  const officer = await actorLabel(trace.actorId);
  const order = ['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED'] as const;
  if (action === 'REJECT') {
    if (refund.status === 'COMPLETED') throw errors.unprocessable('REFUND_CLOSED', 'A completed refund cannot be rejected.');
    await prisma.donationRefund.update({ where: { id: refund.id }, data: { status: 'REJECTED', reviewedBy: officer } });
  } else if (action === 'REVIEW') {
    if (refund.status !== 'REQUESTED') throw errors.unprocessable('REFUND_STEP', 'Review a refund while it is requested.');
    await prisma.donationRefund.update({ where: { id: refund.id }, data: { reviewedBy: officer } });
  } else if (action === 'APPROVE') {
    if (refund.status !== 'REQUESTED' || !refund.reviewedBy) {
      throw errors.unprocessable('REFUND_STEP', 'Review the refund before approval.');
    }
    if (money(refund.amount) > availableBalance(donation)) {
      throw errors.unprocessable('REFUND_EXCEEDS_BALANCE', 'The unallocated balance no longer covers this refund.');
    }
    await prisma.donationRefund.update({
      where: { id: refund.id },
      data: { status: 'APPROVED', approvedBy: officer, approvalDate: new Date() },
    });
  } else if (action === 'PROCESS') {
    if (refund.status !== 'APPROVED') throw errors.unprocessable('REFUND_STEP', 'Approve the refund before processing it.');
    await prisma.donationRefund.update({ where: { id: refund.id }, data: { status: 'PROCESSING' } });
  } else if (action === 'COMPLETE') {
    if (refund.status !== 'PROCESSING') throw errors.unprocessable('REFUND_STEP', 'Process the refund before completing it.');
    await prisma.$transaction(async (tx) => {
      await tx.donationRefund.update({ where: { id: refund.id }, data: { status: 'COMPLETED' } });
      await tx.donationLedgerEntry.create({
        data: {
          donationId: donation.id,
          entryType: 'REFUND',
          amount: decimal(-money(refund.amount)),
          currency: refund.currency,
          description: 'Donation refund',
          reference: refund.publicId,
        },
      });
      const payment = donation.payments.find((item) => item.status === 'SUCCESS');
      if (payment && money(refund.amount) >= money(donation.amount)) {
        await tx.donationPayment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', reconciliationStatus: 'REFUNDED' } });
      }
      const completed = money(refund.amount);
      const earlier = donation.refunds.filter((item) => item.status === 'COMPLETED').reduce((sum, item) => sum + money(item.amount), 0);
      const fully = roundMoney(earlier + completed) >= money(donation.approvedAmount ?? donation.amount);
      if (fully) await tx.donation.update({ where: { id: donation.id }, data: { status: 'REFUNDED' } });
      if (donation.pledgeId) await fulfillPledge(tx, donation.pledgeId, -completed);
    });
    await publishEvent(EventTypes.donationRefunded, donation.publicId, { donationId: donation.publicId, refundId: refund.publicId });
    await publishEvent(EventTypes.paymentRefunded, refund.publicId, { donationId: donation.publicId, source: 'donation' });
  }
  const next = action === 'REJECT' ? 'REJECTED' : action === 'REVIEW' ? refund.status : action === 'APPROVE' ? 'APPROVED' : action === 'PROCESS' ? 'PROCESSING' : 'COMPLETED';
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Refund',
    previousStatus: refund.status,
    newStatus: next,
    amount: money(refund.amount),
    reference: refund.publicId,
  });
  void order;
  await refreshCampaign(donation.campaignId);
  return getDonation(donation.publicId);
}

export async function applyAdjustment(id: string, input: {
  amount: number;
  adjustmentType: 'AMOUNT_CORRECTION' | 'CLASSIFICATION_CORRECTION' | 'CAMPAIGN_CORRECTION' | 'BENEFICIARY_CORRECTION' | 'OTHER';
  reason: string;
  documentName?: string;
  campaignId?: string;
  beneficiaryId?: string;
  donationType?: Donation['donationType'];
}, trace: Trace) {
  const donation = await findDonation(id);
  if (!['RECEIVED', 'APPROVED', 'ALLOCATED', 'UNDER_REVIEW'].includes(donation.status)) {
    throw errors.unprocessable('ADJUSTMENT_NOT_ALLOWED', 'Adjust a donation after it is received and before it is distributed or closed.');
  }
  if (!clean(input.reason)) throw errors.unprocessable('REASON_REQUIRED', 'Record the reason for the adjustment.');
  const officer = await actorLabel(trace.actorId);
  let delta = 0;
  const data: Prisma.DonationUpdateInput = {};
  if (input.adjustmentType === 'AMOUNT_CORRECTION') {
    const nextAmount = roundMoney(money(donation.amount) + input.amount);
    if (nextAmount <= 0) throw errors.unprocessable('AMOUNT_INVALID', 'The corrected amount must stay above zero.');
    const reserved = donation.allocations
      .filter((row) => ['PENDING_APPROVAL', 'APPROVED', 'ALLOCATED'].includes(row.status))
      .reduce((sum, row) => sum + money(row.amount), 0);
    const refunded = donation.refunds
      .filter((row) => ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(row.status))
      .reduce((sum, row) => sum + money(row.amount), 0);
    if (nextAmount < roundMoney(reserved + refunded)) {
      throw errors.unprocessable('AMOUNT_BELOW_COMMITMENTS', 'The corrected amount cannot fall below allocations and refunds.');
    }
    data.amount = nextAmount;
    if (donation.approvedAmount != null) data.approvedAmount = Math.min(money(donation.approvedAmount) + input.amount, nextAmount);
    delta = input.amount;
  } else if (input.adjustmentType === 'CLASSIFICATION_CORRECTION') {
    if (!input.donationType) throw errors.unprocessable('TYPE_REQUIRED', 'Choose the corrected donation type.');
    if ((input.donationType === 'IN_KIND') !== (donation.donationType === 'IN_KIND') && donation.payments.length) {
      throw errors.unprocessable('TYPE_LOCKED', 'A donation with a payment cannot switch between money and in-kind.');
    }
    data.donationType = input.donationType;
  } else if (input.adjustmentType === 'CAMPAIGN_CORRECTION') {
    if (!input.campaignId) throw errors.unprocessable('CAMPAIGN_REQUIRED', 'Choose the corrected campaign.');
    const campaign = await findCampaign(input.campaignId);
    assertCampaignAccepts(campaign, money(donation.amount), donation.currency);
    data.campaign = { connect: { id: campaign.id } };
  } else if (input.adjustmentType === 'BENEFICIARY_CORRECTION') {
    if (!input.beneficiaryId) throw errors.unprocessable('BENEFICIARY_REQUIRED', 'Choose the corrected beneficiary.');
    const beneficiary = await findBeneficiary(input.beneficiaryId);
    if (beneficiary.status !== 'VERIFIED') throw errors.unprocessable('BENEFICIARY_NOT_VERIFIED', 'The replacement beneficiary must be verified.');
    data.beneficiary = { connect: { id: beneficiary.id } };
  }
  await prisma.donationAdjustment.create({
    data: {
      publicId: await nextPublicId('ADJ'),
      donationId: donation.id,
      originalAmount: donation.amount,
      amount: input.amount,
      adjustmentType: input.adjustmentType,
      reason: input.reason.trim(),
      documentName: clean(input.documentName),
      requestedBy: officer,
      approvedBy: officer,
      campaignId: input.campaignId,
      beneficiaryId: input.beneficiaryId,
      donationType: input.donationType,
    },
  });
  if (Object.keys(data).length) await prisma.donation.update({ where: { id: donation.id }, data });
  if (delta !== 0) {
    await prisma.donationLedgerEntry.create({
      data: {
        donationId: donation.id,
        entryType: 'ADJUSTMENT',
        amount: delta,
        currency: donation.currency,
        description: input.reason.trim(),
        reference: input.adjustmentType,
      },
    });
  }
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Adjustment',
    amount: input.amount,
    reason: input.reason,
    reference: input.adjustmentType,
  });
  await refreshCampaign(donation.campaignId);
  return getDonation(donation.publicId);
}

export async function saveCompliance(id: string, input: {
  donorIdentified: boolean;
  donorVerified: boolean;
  sourceRecorded: boolean;
  approvalsObtained: boolean;
  documentationComplete: boolean;
  beneficiaryVerified: boolean;
  restrictionsRecorded: boolean;
  reportingCompleted: boolean;
  result: 'COMPLIANT' | 'PENDING_REVIEW' | 'NON_COMPLIANT' | 'ESCALATED';
  comments?: string;
}, trace: Trace) {
  const donation = await findDonation(id);
  const flags = [
    input.donorIdentified,
    input.donorVerified,
    input.sourceRecorded,
    input.approvalsObtained,
    input.documentationComplete,
    input.beneficiaryVerified,
    input.restrictionsRecorded,
    input.reportingCompleted,
  ];
  if (input.result === 'COMPLIANT' && flags.some((flag) => !flag)) {
    throw errors.unprocessable('COMPLIANCE_INCOMPLETE', 'Mark the donation compliant only when every compliance check is complete.');
  }
  const officer = await actorLabel(trace.actorId);
  await prisma.donationCompliance.create({
    data: {
      publicId: await nextPublicId('DCM'),
      donationId: donation.id,
      campaignId: donation.campaignId,
      ...input,
      comments: clean(input.comments),
      officerName: officer,
      reviewedAt: new Date(),
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Compliance',
    reference: input.result,
    reason: input.comments,
  });
  return getDonation(donation.publicId);
}

export async function saveAgreement(input: {
  donorId: string;
  campaignId?: string;
  amount: number;
  currency?: string;
  purpose: string;
  conditions: string;
  startDate: string;
  endDate: string;
  reportingRequirements?: string;
  documents?: Doc[];
  donorRepresentative?: string;
  rupsaRepresentative?: string;
  accept?: boolean;
}, trace: Trace) {
  const donor = await findDonor(input.donorId);
  if (donor.status !== 'VERIFIED') throw errors.unprocessable('DONOR_NOT_VERIFIED', 'Verify the donor before accepting an agreement.');
  const campaign = input.campaignId ? await findCampaign(input.campaignId) : null;
  const amount = assertAmount(input.amount, 'Donation amount');
  const currency = assertCurrency(input.currency || campaign?.currency || 'RWF');
  if (campaign) assertCampaignAccepts(campaign, amount, currency);
  if (input.endDate < input.startDate) throw errors.unprocessable('DATE_RANGE_INVALID', 'The agreement end date cannot be before the start date.');
  if (!clean(input.purpose) || !clean(input.conditions)) {
    throw errors.unprocessable('AGREEMENT_INCOMPLETE', 'Enter the purpose and the conditions.');
  }
  const accept = Boolean(input.accept);
  if (accept && (!clean(input.donorRepresentative) || !clean(input.rupsaRepresentative))) {
    throw errors.unprocessable('ACCEPTANCE_REQUIRED', 'Both the donor representative and the UPSA representative must accept the agreement.');
  }
  const created = await prisma.donationAgreement.create({
    data: {
      publicId: await nextPublicId('AGR'),
      donorId: donor.id,
      campaignId: campaign?.id,
      amount,
      currency,
      purpose: input.purpose.trim(),
      conditions: input.conditions.trim(),
      startDate: day(input.startDate)!,
      endDate: day(input.endDate)!,
      reportingRequirements: clean(input.reportingRequirements),
      documents: jsonDocs(readDocs(input.documents)),
      donorRepresentative: clean(input.donorRepresentative),
      rupsaRepresentative: clean(input.rupsaRepresentative),
      acceptedAt: accept ? new Date() : null,
      status: accept ? 'ACCEPTED' : 'DRAFT',
    },
  });
  await recordAudit({
    trace,
    entityType: 'Agreement',
    entityId: created.publicId,
    action: accept ? 'Agreement accepted' : 'Agreement drafted',
    newStatus: created.status,
    amount,
    reference: donor.publicId,
  });
  return { id: created.publicId, status: created.status };
}

export async function listAgreements() {
  const rows = await prisma.donationAgreement.findMany({ include: { donor: true, campaign: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    id: row.publicId,
    donor: row.donor.name,
    campaign: row.campaign?.name ?? '—',
    amount: money(row.amount),
    currency: row.currency,
    purpose: row.purpose,
    status: row.status,
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
  }));
}

export async function sendMessage(input: {
  donorId: string;
  donationId?: string;
  campaignId?: string;
  communicationType: string;
  channel: 'SMS' | 'EMAIL' | 'IN_APP' | 'PUSH';
  subject: string;
  message: string;
}, trace: Trace) {
  const donor = await findDonor(input.donorId);
  const donation = input.donationId ? await findDonation(input.donationId) : null;
  const campaign = input.campaignId ? await findCampaign(input.campaignId) : null;
  if (!clean(input.subject) || !clean(input.message)) throw errors.unprocessable('MESSAGE_INCOMPLETE', 'Enter the subject and the message.');
  if (!['THANK_YOU', 'DONATION_CONFIRMATION', 'RECEIPT', 'CAMPAIGN_UPDATE', 'IMPACT_REPORT', 'PAYMENT_REMINDER', 'OTHER'].includes(input.communicationType)) {
    throw errors.unprocessable('MESSAGE_TYPE_INVALID', 'Choose an approved communication type.');
  }
  const officer = await actorLabel(trace.actorId);
  let deliveryStatus = 'QUEUED';
  if (input.channel === 'EMAIL' && donor.email) {
    const sent = await deliverEmail({ to: donor.email, subject: input.subject.trim(), text: input.message.trim(), html: `<p>${input.message.trim()}</p>` });
    deliveryStatus = sent ? 'SENT' : 'QUEUED';
  }
  if (input.channel === 'IN_APP') deliveryStatus = 'SENT';
  await prisma.donorMessage.create({
    data: {
      publicId: await nextPublicId('MSG'),
      donorId: donor.id,
      donationId: donation?.id,
      campaignId: campaign?.id ?? donation?.campaignId,
      communicationType: input.communicationType,
      channel: input.channel,
      subject: input.subject.trim(),
      message: input.message.trim(),
      sentBy: officer,
      deliveryStatus,
    },
  });
  await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      channel: input.channel,
      subject: input.subject.trim(),
      body: input.message.trim(),
      status: deliveryStatus,
      sentAt: deliveryStatus === 'SENT' ? new Date() : null,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donor',
    entityId: donor.publicId,
    donationId: donation?.id,
    action: 'Communication',
    reference: input.communicationType,
    reason: input.subject,
  });
  return { status: deliveryStatus };
}

export async function listMessages() {
  const rows = await prisma.donorMessage.findMany({ include: { donor: true }, orderBy: { sentAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    id: row.publicId,
    donor: row.donor.name,
    type: row.communicationType,
    channel: row.channel,
    subject: row.subject,
    message: row.message,
    sentBy: row.sentBy,
    sentAt: row.sentAt.toISOString(),
    status: row.deliveryStatus,
  }));
}

export async function saveImpact(input: {
  donationId?: string;
  campaignId?: string;
  beneficiaryId?: string;
  reportingPeriod: string;
  amountUsed: number;
  currency?: string;
  beneficiaryCount: number;
  activities: string;
  outputs: string;
  outcomes: string;
  challenges?: string;
  evidence?: Doc[];
}, trace: Trace) {
  if (!input.donationId && !input.campaignId) {
    throw errors.unprocessable('SUBJECT_REQUIRED', 'Link the impact report to a donation or a campaign.');
  }
  const donation = input.donationId ? await findDonation(input.donationId) : null;
  const campaign = input.campaignId ? await findCampaign(input.campaignId) : donation?.campaign ? await findCampaign(donation.campaign.publicId) : null;
  const beneficiary = input.beneficiaryId ? await findBeneficiary(input.beneficiaryId) : null;
  if (!clean(input.reportingPeriod) || !clean(input.activities) || !clean(input.outputs) || !clean(input.outcomes)) {
    throw errors.unprocessable('IMPACT_INCOMPLETE', 'Enter the period, activities, outputs, and outcomes.');
  }
  if (!Number.isInteger(input.beneficiaryCount) || input.beneficiaryCount < 0) {
    throw errors.unprocessable('BENEFICIARY_COUNT_INVALID', 'The number of beneficiaries cannot be negative.');
  }
  const amount = input.amountUsed < 0 ? (() => { throw errors.unprocessable('AMOUNT_INVALID', 'Amount used cannot be negative.'); })() : roundMoney(input.amountUsed);
  const created = await prisma.impactReport.create({
    data: {
      publicId: await nextPublicId('IMP'),
      donationId: donation?.id,
      campaignId: campaign?.id,
      beneficiaryId: beneficiary?.id,
      reportingPeriod: input.reportingPeriod.trim(),
      amountUsed: amount,
      currency: assertCurrency(input.currency || donation?.currency || campaign?.currency || 'RWF'),
      beneficiaryCount: input.beneficiaryCount,
      activities: input.activities.trim(),
      outputs: input.outputs.trim(),
      outcomes: input.outcomes.trim(),
      challenges: clean(input.challenges),
      evidence: jsonDocs(readDocs(input.evidence)),
    },
  });
  await recordAudit({
    trace,
    entityType: 'Impact',
    entityId: created.publicId,
    donationId: donation?.id,
    action: 'Impact recorded',
    amount,
    reference: input.reportingPeriod,
  });
  return { id: created.publicId };
}

export async function listImpacts() {
  const rows = await prisma.impactReport.findMany({
    include: { donation: true, campaign: true, beneficiary: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.publicId,
    donationId: row.donation?.publicId ?? null,
    campaign: row.campaign?.name ?? '—',
    beneficiary: row.beneficiary?.name ?? '—',
    reportingPeriod: row.reportingPeriod,
    amountUsed: money(row.amountUsed),
    currency: row.currency,
    beneficiaryCount: row.beneficiaryCount,
    activities: row.activities,
    outputs: row.outputs,
    outcomes: row.outcomes,
    challenges: row.challenges,
  }));
}

export async function closeDonation(id: string, trace: Trace) {
  const donation = await findDonation(id);
  if (donation.status !== 'DISTRIBUTED') {
    throw errors.unprocessable('NOT_DISTRIBUTED', 'Close a donation after the approved allocations have been delivered.');
  }
  if (availableBalance(donation) > 0) {
    throw errors.unprocessable('BALANCE_REMAINS', 'Allocate, adjust, or refund the remaining balance before closing the donation.');
  }
  const open = donation.allocations.some((row) => row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL' || row.status === 'APPROVED');
  if (open) throw errors.unprocessable('ALLOCATION_OPEN', 'Every approved allocation must be confirmed as delivered.');
  const impacts = await prisma.impactReport.count({ where: { OR: [{ donationId: donation.id }, { campaignId: donation.campaignId ?? undefined }] } });
  if (!impacts) throw errors.unprocessable('IMPACT_REQUIRED', 'Record an impact report before closing the donation.');
  await prisma.donation.update({ where: { id: donation.id }, data: { status: 'COMPLETED' } });
  await recordAudit({
    trace,
    entityType: 'Donation',
    entityId: donation.publicId,
    donationId: donation.id,
    action: 'Closed',
    previousStatus: donation.status,
    newStatus: 'COMPLETED',
    amount: money(donation.approvedAmount ?? donation.amount),
  });
  return getDonation(donation.publicId);
}

export async function listReceipts() {
  const rows = await prisma.donationReceipt.findMany({ include: { donation: true }, orderBy: { issuedAt: 'desc' }, take: 200 });
  return rows.map((row) => ({
    id: row.publicId,
    donationId: row.donation.publicId,
    donorName: row.donorName,
    campaign: row.campaignName,
    amount: money(row.amount),
    currency: row.currency,
    donationDate: dateOnly(row.donationDate),
    paymentMethod: row.paymentMethod,
    transactionReference: row.transactionReference,
    purpose: row.purpose,
    signatory: row.signatory,
  }));
}
