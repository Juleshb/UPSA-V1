import { errors } from '../../utils/errors';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import { fileClaim } from '../guarantees.service';
import {
  actorLabel,
  assertAmount,
  assertDual,
  clean,
  dateOnly,
  day,
  dayRequired,
  findClaim,
  findSecurityGuarantee,
  freshExternal,
  id,
  notify,
  recordAudit,
  roundMoney,
  type Trace,
} from './shared';
import { exposureOf, guaranteeFile } from './guarantees';

export async function submitClaim(guaranteeId: string, input: {
  loanId?: string;
  borrower: string;
  lender?: string;
  defaultDate?: string;
  outstandingPrincipal?: number;
  outstandingInterest?: number;
  otherAmount?: number;
  amountClaimed: number;
  reason: string;
  recoveryActions?: string;
  claimDate: string;
}, trace: Trace) {
  const guarantee = await findSecurityGuarantee(guaranteeId);
  if (!['ACTIVE', 'ISSUED', 'CLAIMED', 'PARTIALLY_PAID', 'RECOVERY'].includes(guarantee.status)) {
    throw errors.unprocessable('GUARANTEE_NOT_ACTIVE', 'A claim can be filed only against an active guarantee.');
  }
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  if (input.loanId && !loan) throw errors.notFound('LOAN_NOT_FOUND', 'The loan could not be found.');
  const outstanding = loan ? money(loan.principalOutstanding) : null;
  const exposure = exposureOf(guarantee, outstanding);
  const claimed = assertAmount(input.amountClaimed, 'Claim');
  if (claimed > exposure.remaining + 0.001) {
    throw errors.unprocessable('ABOVE_EXPOSURE', 'The claim is above the remaining guarantee exposure.');
  }
  const row = await prisma.securityClaim.create({
    data: {
      publicId: await id('SCL'),
      guaranteeId: guarantee.id,
      certificateNumber: guarantee.certificateNumber,
      loanId: loan?.id,
      borrower: input.borrower.trim(),
      groupId: guarantee.groupId,
      lender: clean(input.lender),
      defaultDate: day(input.defaultDate),
      outstandingPrincipal: decimal(input.outstandingPrincipal ?? outstanding ?? 0),
      outstandingInterest: decimal(input.outstandingInterest ?? (loan ? money(loan.interestOutstanding) : 0)),
      otherAmount: decimal(input.otherAmount ?? 0),
      guaranteedAmount: decimal(exposure.remaining),
      amountClaimed: decimal(claimed),
      reason: input.reason.trim(),
      recoveryActions: clean(input.recoveryActions),
      claimDate: dayRequired(input.claimDate, 'Claim date'),
      status: 'SUBMITTED',
      requestedById: trace.actorId,
    },
  });
  await prisma.securityGuarantee.update({ where: { id: guarantee.id }, data: { loanPublicId: loan?.publicId ?? guarantee.loanPublicId, status: 'CLAIMED' } });
  await recordAudit({ trace, entityType: 'SecurityClaim', entityId: row.publicId, action: 'claim.submit', amount: claimed, newStatus: 'SUBMITTED' });
  await notify('Claim submitted', `Claim ${row.publicId}`, `${claimed} was claimed on guarantee ${guarantee.publicId}.`, trace.actorId);
  return claimFile(row.publicId);
}

export async function assessClaim(claimId: string, input: {
  guaranteeValid: boolean;
  certificateValid: boolean;
  loanValid: boolean;
  defaultVerified: boolean;
  result: string;
}, trace: Trace) {
  const claim = await findClaim(claimId);
  const exposure = exposureOf(claim.guarantee, claim.loan ? money(claim.loan.principalOutstanding) : null);
  const eligible = input.guaranteeValid && input.certificateValid && input.defaultVerified
    ? Math.min(money(claim.amountClaimed), exposure.remaining)
    : 0;
  const officer = await actorLabel(trace.actorId);
  await prisma.securityClaim.update({
    where: { id: claim.id },
    data: {
      guaranteeValid: input.guaranteeValid,
      certificateValid: input.certificateValid,
      loanValid: input.loanValid,
      defaultVerified: input.defaultVerified,
      eligibleAmount: decimal(roundMoney(eligible)),
      assessmentResult: input.result,
      assessor: officer,
      assessedAt: new Date(),
      status: 'UNDER_REVIEW',
    },
  });
  await recordAudit({ trace, entityType: 'SecurityClaim', entityId: claim.publicId, action: 'claim.assess', previousStatus: claim.status, newStatus: 'UNDER_REVIEW', amount: eligible });
  return claimFile(claim.publicId);
}

export async function approveClaim(claimId: string, input: { approvedAmount: number; reason?: string; conditions?: string }, trace: Trace) {
  const claim = await findClaim(claimId);
  if (!['UNDER_REVIEW', 'SUBMITTED'].includes(claim.status)) throw errors.unprocessable('CLAIM_STATUS', 'This claim is not waiting for approval.');
  if (claim.guarantee.facility) assertDual(claim.guarantee.facility.dualAuthorization, claim.requestedById, trace.actorId);
  const approved = roundMoney(input.approvedAmount);
  if (approved < 0) throw errors.unprocessable('AMOUNT_INVALID', 'The approved claim cannot be negative.');
  const eligible = money(claim.eligibleAmount) || money(claim.amountClaimed);
  if (approved > eligible + 0.001) throw errors.unprocessable('ABOVE_ELIGIBLE', 'The approved claim cannot exceed the eligible amount.');
  const rejected = roundMoney(money(claim.amountClaimed) - approved);
  const status = approved <= 0 ? 'REJECTED' : rejected > 0 ? 'PARTIALLY_APPROVED' : 'APPROVED';
  const officer = await actorLabel(trace.actorId);
  await prisma.securityClaim.update({
    where: { id: claim.id },
    data: {
      approvedAmount: decimal(approved),
      rejectedAmount: decimal(Math.max(0, rejected)),
      approver: officer,
      approverId: trace.actorId,
      approvalDate: new Date(),
      approvalReason: clean(input.reason),
      conditions: clean(input.conditions),
      status,
    },
  });
  await recordAudit({ trace, entityType: 'SecurityClaim', entityId: claim.publicId, action: 'claim.approve', previousStatus: claim.status, newStatus: status, amount: approved, reason: input.reason });
  await notify(status === 'REJECTED' ? 'Claim rejected' : 'Claim approved', `Claim ${claim.publicId}`, `Approved amount ${approved}.`, trace.actorId);
  return claimFile(claim.publicId);
}

export async function payClaim(claimId: string, input: {
  amount: number;
  payee: string;
  bankAccount: string;
  paymentMethod: string;
  paymentReference?: string;
  externalTransactionId?: string;
  paymentDate: string;
}, trace: Trace) {
  const claim = await findClaim(claimId);
  if (!['APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_PAID'].includes(claim.status)) {
    throw errors.unprocessable('CLAIM_NOT_APPROVED', 'Pay a claim only after it is approved.');
  }
  if (claim.guarantee.facility) assertDual(claim.guarantee.facility.dualAuthorization, claim.approverId, trace.actorId);
  const already = claim.payments.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + money(row.amount), 0);
  const amount = assertAmount(input.amount, 'Claim payment');
  if (roundMoney(already + amount) > money(claim.approvedAmount) + 0.001) {
    throw errors.unprocessable('ABOVE_APPROVED', 'The payment is above the approved claim.');
  }
  const external = await freshExternal(input.externalTransactionId, input.paymentMethod);
  const row = await prisma.$transaction(async (tx) => {
    const payment = await tx.securityClaimPayment.create({
      data: {
        publicId: await id('SCP'),
        claimId: claim.id,
        payee: input.payee.trim(),
        amount: decimal(amount),
        currency: 'RWF',
        bankAccount: input.bankAccount.trim(),
        paymentMethod: input.paymentMethod,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        paymentDate: dayRequired(input.paymentDate, 'Payment date'),
        status: 'PAID',
        railCode: external.railCode,
        requestedById: trace.actorId,
      },
    });
    const paid = roundMoney(already + amount);
    const fully = paid + 0.001 >= money(claim.approvedAmount);
    await tx.securityClaim.update({ where: { id: claim.id }, data: { status: fully ? 'PAID' : 'PARTIALLY_PAID', paymentReference: clean(input.paymentReference) } });
    await tx.securityGuarantee.update({
      where: { id: claim.guaranteeId },
      data: { claimsPaid: { increment: decimal(amount) }, status: fully ? 'PAID' : 'PARTIALLY_PAID' },
    });
    return payment;
  });
  if (claim.guarantee.legacyGuaranteeId && claim.loan) {
    try {
      await fileClaim(claim.guarantee.legacyGuaranteeId, {
        loanId: claim.loan.publicId,
        claimAmount: amount,
        reason: claim.reason,
        supportingReference: row.publicId,
      }, trace.actorId);
    } catch {
      // The security ledger is the record. The older lending register is updated when it can accept the claim.
    }
  }
  await recordAudit({ trace, entityType: 'SecurityClaimPayment', entityId: row.publicId, action: 'claim.pay', amount, newStatus: 'PAID', approvalReference: external.value });
  await notify('Claim paid', `Payment ${row.publicId}`, `${amount} was paid through the payment service.`, trace.actorId);
  return claimFile(claim.publicId);
}

export async function recover(claimId: string, input: {
  amount: number;
  source: string;
  borrower?: string;
  recoveryDate: string;
  action?: string;
  externalTransactionId?: string;
  paymentMethod?: string;
}, trace: Trace) {
  const claim = await findClaim(claimId);
  const paid = money(claim.guarantee.claimsPaid);
  const already = claim.recoveries.reduce((sum, row) => sum + money(row.amount), 0);
  const amount = assertAmount(input.amount, 'Recovery');
  if (roundMoney(already + amount) > paid + 0.001) {
    throw errors.unprocessable('ABOVE_CLAIM_PAID', 'The recovery cannot exceed the claim that was paid.');
  }
  const external = input.paymentMethod ? await freshExternal(input.externalTransactionId, input.paymentMethod) : { value: clean(input.externalTransactionId), railCode: null };
  const officer = await actorLabel(trace.actorId);
  const outstanding = roundMoney(paid - already - amount);
  const row = await prisma.$transaction(async (tx) => {
    const recovery = await tx.securityRecovery.create({
      data: {
        publicId: await id('SRC'),
        claimId: claim.id,
        loanId: claim.loanId,
        groupId: claim.groupId,
        borrower: input.borrower?.trim() || claim.borrower,
        claimPaid: decimal(paid),
        amount: decimal(amount),
        source: input.source.trim(),
        recoveryDate: dayRequired(input.recoveryDate, 'Recovery date'),
        outstanding: decimal(Math.max(0, outstanding)),
        officer,
        action: clean(input.action),
        status: outstanding <= 0 ? 'COMPLETED' : 'RECEIVED',
        externalTransactionId: external.value,
        railCode: external.railCode,
      },
    });
    await tx.securityClaim.update({ where: { id: claim.id }, data: { status: 'RECOVERY' } });
    await tx.securityGuarantee.update({ where: { id: claim.guaranteeId }, data: { recoveries: { increment: decimal(amount) }, status: 'RECOVERY' } });
    return recovery;
  });
  await recordAudit({ trace, entityType: 'SecurityRecovery', entityId: row.publicId, action: 'claim.recover', amount, newStatus: row.status });
  await notify('Recovery recorded', `Recovery ${row.publicId}`, `${amount} was recovered against claim ${claim.publicId}.`, trace.actorId);
  return claimFile(claim.publicId);
}

export async function splitRecovery(recoveryId: string, input: { principal: number; interest: number; fees: number; costs: number }, trace: Trace) {
  const recovery = await prisma.securityRecovery.findUnique({ where: { publicId: recoveryId }, include: { claim: { include: { guarantee: true } } } });
  if (!recovery) throw errors.notFound('RECOVERY_NOT_FOUND', 'The recovery could not be found.');
  const total = roundMoney(input.principal + input.interest + input.fees + input.costs);
  if (Math.abs(total - money(recovery.amount)) > 0.001) {
    throw errors.unprocessable('SPLIT_MISMATCH', 'The principal, interest, fees and costs must add up to the amount recovered.');
  }
  const officer = await actorLabel(trace.actorId);
  const exposure = exposureOf(recovery.claim.guarantee, null);
  await prisma.securityRecoverySplit.upsert({
    where: { recoveryId: recovery.id },
    create: {
      publicId: await id('SRA'),
      recoveryId: recovery.id,
      amountRecovered: recovery.amount,
      principal: decimal(input.principal),
      interest: decimal(input.interest),
      fees: decimal(input.fees),
      costs: decimal(input.costs),
      remainingClaim: decimal(money(recovery.outstanding)),
      remainingExposure: decimal(exposure.remaining),
      approvedBy: officer,
      splitDate: new Date(),
    },
    update: {
      principal: decimal(input.principal),
      interest: decimal(input.interest),
      fees: decimal(input.fees),
      costs: decimal(input.costs),
      approvedBy: officer,
      splitDate: new Date(),
    },
  });
  await recordAudit({ trace, entityType: 'SecurityRecovery', entityId: recovery.publicId, action: 'claim.recover.allocate', amount: total });
  return claimFile(recovery.claim.publicId);
}

export async function claimFile(publicId: string) {
  const claim = await findClaim(publicId);
  const file = await guaranteeFile(claim.guarantee.publicId);
  return {
    claimId: claim.publicId,
    guaranteeId: claim.guarantee.publicId,
    certificateNumber: claim.certificateNumber,
    borrower: claim.borrower,
    lender: claim.lender,
    loanId: claim.loan?.publicId ?? null,
    defaultDate: dateOnly(claim.defaultDate),
    outstandingPrincipal: money(claim.outstandingPrincipal),
    outstandingInterest: money(claim.outstandingInterest),
    otherAmount: money(claim.otherAmount),
    guaranteedAmount: money(claim.guaranteedAmount),
    amountClaimed: money(claim.amountClaimed),
    eligibleAmount: money(claim.eligibleAmount),
    approvedAmount: money(claim.approvedAmount),
    rejectedAmount: money(claim.rejectedAmount),
    reason: claim.reason,
    recoveryActions: claim.recoveryActions,
    claimDate: dateOnly(claim.claimDate),
    guaranteeValid: claim.guaranteeValid,
    certificateValid: claim.certificateValid,
    loanValid: claim.loanValid,
    defaultVerified: claim.defaultVerified,
    assessmentResult: claim.assessmentResult,
    assessor: claim.assessor,
    approver: claim.approver,
    approvalReason: claim.approvalReason,
    conditions: claim.conditions,
    status: claim.status,
    exposure: file.currentExposure,
    payments: claim.payments.map((item) => ({
      paymentId: item.publicId,
      payee: item.payee,
      amount: money(item.amount),
      paymentMethod: item.paymentMethod,
      paymentReference: item.paymentReference,
      externalTransactionId: item.externalTransactionId,
      railCode: item.railCode,
      status: item.status,
      paymentDate: dateOnly(item.paymentDate),
    })),
    recoveries: claim.recoveries.map((item) => ({
      recoveryId: item.publicId,
      amount: money(item.amount),
      source: item.source,
      outstanding: money(item.outstanding),
      status: item.status,
      recoveryDate: dateOnly(item.recoveryDate),
      action: item.action,
    })),
  };
}
