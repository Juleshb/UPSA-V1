import { LoanApplicationStatus, LoanStatus, Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { prisma } from '../../utils/prisma';
import { disburse, findLoan } from '../loans.service';
import {
  actorLabel, buildSchedule, clean, dateOnly, day, dayRequired, decimal, id, money, notify, recordAudit, roundMoney, routeMoney, type Trace,
} from './shared';

const loanInclude = {
  application: { include: { school: true, institution: true, lendingCase: true, contracts: true } },
  disbursements: { orderBy: { createdAt: 'asc' as const } },
  repayments: { orderBy: { createdAt: 'desc' as const } },
  installments: { orderBy: { number: 'asc' as const } },
  position: true,
  collections: { orderBy: { contactDate: 'desc' as const } },
  promises: { orderBy: { promiseDate: 'desc' as const } },
  recoveries: true,
  writeOffs: true,
  restructures: true,
  holidays: true,
  topUps: true,
  refinances: true,
  transfers: true,
  adjustments: true,
  refunds: true,
  settlement: true,
} satisfies Prisma.LoanInclude;

async function load(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { publicId: loanId }, include: loanInclude });
  if (!loan) throw errors.notFound('LOAN_NOT_FOUND', 'The requested loan could not be found.');
  await markOverdue(loan);
  return prisma.loan.findUniqueOrThrow({ where: { id: loan.id }, include: loanInclude });
}

async function markOverdue(loan: { id: string; status: LoanStatus; installments: { dueDate: Date; status: string }[]; position: { id: string } | null }) {
  if (loan.status === LoanStatus.SETTLED || loan.status === LoanStatus.CANCELLED || loan.status === LoanStatus.RECOVERY) return;
  const now = Date.now();
  const late = loan.installments.filter((item) => item.status !== 'PAID' && item.dueDate.getTime() < now);
  const days = late.length ? Math.max(...late.map((item) => Math.floor((now - item.dueDate.getTime()) / 86_400_000))) : 0;
  if (!days) return;
  await prisma.lendingInstallment.updateMany({
    where: { loanId: loan.id, status: { in: ['DUE', 'PARTIAL'] }, dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  });
  if (loan.position) await prisma.lendingPosition.update({ where: { id: loan.position.id }, data: { daysPastDue: days, label: days >= 90 ? 'DEFAULTED' : 'OVERDUE' } });
  if (loan.status === LoanStatus.ACTIVE) await prisma.loan.update({ where: { id: loan.id }, data: { status: LoanStatus.IN_ARREARS } });
}

function outstandingOf(loan: { principalOutstanding: Prisma.Decimal; interestOutstanding: Prisma.Decimal; feesOutstanding: Prisma.Decimal; position: { penaltyOutstanding: Prisma.Decimal } | null }) {
  const principal = money(loan.principalOutstanding);
  const interest = money(loan.interestOutstanding);
  const fees = money(loan.feesOutstanding);
  const penalty = money(loan.position?.penaltyOutstanding ?? 0);
  return { principal, interest, fees, penalty, total: roundMoney(principal + interest + fees + penalty) };
}

function present(loan: Awaited<ReturnType<typeof load>>) {
  const books = outstandingOf(loan);
  const disbursed = roundMoney(loan.disbursements.reduce((sum, item) => sum + money(item.amount), 0));
  return {
    loanId: loan.publicId,
    applicationId: loan.application.publicId,
    borrower: loan.application.lendingCase?.applicantName ?? loan.application.school.schoolName,
    schoolId: loan.application.school.publicId,
    schoolName: loan.application.school.schoolName,
    institution: loan.application.institution.name,
    productCode: loan.application.productCode,
    currency: loan.currency,
    status: loan.position?.label ?? loan.status,
    bookStatus: loan.status,
    principal: money(loan.principal),
    disbursed,
    principalOutstanding: books.principal,
    interest: books.interest,
    fees: books.fees,
    penalty: books.penalty,
    total: books.total,
    tenorMonths: loan.tenorMonths,
    interestRate: money(loan.interestRate),
    nextPaymentDate: dateOnly(loan.position?.nextDueDate),
    daysPastDue: loan.position?.daysPastDue ?? 0,
    contractNumber: loan.application.contracts[0]?.contractNumber ?? null,
    schedule: loan.installments.map((item) => ({
      number: item.number,
      dueDate: dateOnly(item.dueDate),
      principalDue: money(item.principalDue),
      interestDue: money(item.interestDue),
      feesDue: money(item.feesDue),
      totalDue: money(item.totalDue),
      status: item.status,
    })),
    disbursements: loan.disbursements.map((item) => ({
      disbursementId: item.publicId,
      amount: money(item.amount),
      account: item.disbursementAccount,
      reference: item.transactionReference,
      createdAt: dateOnly(item.createdAt),
    })),
    repayments: loan.repayments.map((item) => ({
      repaymentId: item.publicId,
      amount: money(item.amount),
      reference: item.paymentReference,
      paymentDate: dateOnly(item.paymentDate),
      status: item.status,
    })),
    collections: loan.collections.map((item) => ({ collectionId: item.publicId, status: item.status, person: item.person, outstanding: money(item.outstanding) })),
    promises: loan.promises.map((item) => ({ promiseId: item.publicId, promised: money(item.promised), status: item.status, promiseDate: dateOnly(item.promiseDate) })),
    settlement: loan.settlement ? { settlementId: loan.settlement.publicId, settlementDate: dateOnly(loan.settlement.settlementDate) } : null,
  };
}

export async function listLoans(query: { status?: string; q?: string }) {
  const rows = await prisma.loan.findMany({
    include: { application: { include: { school: true, lendingCase: true } }, position: true },
    orderBy: { createdAt: 'desc' },
  });
  const needle = query.q?.trim().toLowerCase();
  return rows.filter((row) => {
    const label = row.position?.label ?? row.status;
    if (query.status && label !== query.status && row.status !== query.status) return false;
    if (!needle) return true;
    return [row.publicId, row.application.publicId, row.application.productCode, row.application.school.schoolName, row.application.lendingCase?.applicantName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }).map((row) => {
    const books = outstandingOf(row);
    return {
      loanId: row.publicId,
      borrower: row.application.lendingCase?.applicantName ?? row.application.school.schoolName,
      productCode: row.application.productCode,
      district: row.application.school.district,
      principal: money(row.principal),
      outstanding: books.total,
      currency: row.currency,
      status: row.position?.label ?? row.status,
      daysPastDue: row.position?.daysPastDue ?? 0,
    };
  });
}

export async function loanFile(loanId: string) {
  return present(await load(loanId));
}

export async function disburseLoan(loanId: string, input: {
  amount: number
  disbursementAccount: string
  paymentMethod: string
  externalTransactionId?: string
  disbursementDate?: string
}, trace: Trace) {
  const loan = await load(loanId);
  if (!loan.application.contracts.length) throw errors.conflict('CONTRACT_REQUIRED', 'Sign the contract before disbursement.');
  const already = roundMoney(loan.disbursements.reduce((sum, item) => sum + money(item.amount), 0));
  if (roundMoney(already + input.amount) > money(loan.principal) + 0.001) {
    throw errors.unprocessable('ABOVE_APPROVED', 'The disbursement cannot exceed the approved principal.');
  }
  const routed = await routeMoney(input.paymentMethod, input.externalTransactionId);
  const posted = await disburse(loan.publicId, {
    amount: input.amount,
    disbursementAccount: input.disbursementAccount,
    transactionReference: routed.value ?? `CASH-${loan.publicId}-${Date.now()}`,
    idempotencyKey: trace.requestId,
  }, trace.actorId);
  if (already === 0) {
    const interest = roundMoney(loan.installments.reduce((sum, item) => sum + money(item.interestDue), 0));
    const fees = roundMoney(loan.installments.reduce((sum, item) => sum + money(item.feesDue), 0));
    await prisma.loan.update({
      where: { id: loan.id },
      data: { interestOutstanding: decimal(interest), feesOutstanding: decimal(fees) },
    });
  }
  await notify('LOAN_DISBURSED', 'Loan disbursed', `${loan.application.school.schoolName} received ${input.amount} ${loan.currency}.`, loan.publicId);
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LoanDisbursement', entityId: posted.disbursementId, action: 'lending.disburse', newStatus: 'DISBURSED', amount: input.amount, institution: loan.application.institution.publicId });
  return loanFile(loan.publicId);
}

function allocationOrder(loan: { application: { productCode: string } }) {
  return ['FEES', 'PENALTY', 'INTEREST', 'PRINCIPAL'];
}

export async function postRepayment(loanId: string, input: {
  amount: number
  paymentMethod: string
  externalTransactionId?: string
  paymentDate?: string
  reference?: string
}, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  if (input.amount > books.total + 0.001) throw errors.unprocessable('ABOVE_DUE', 'The repayment cannot exceed the amount outstanding.');
  const routed = await routeMoney(input.paymentMethod, input.externalTransactionId);
  const order = allocationOrder(loan);
  const buckets: Record<string, number> = { FEES: books.fees, PENALTY: books.penalty, INTEREST: books.interest, PRINCIPAL: books.principal };
  let left = input.amount;
  const taken: Record<string, number> = {};
  for (const name of order) {
    const pay = roundMoney(Math.min(left, buckets[name] ?? 0));
    taken[name] = pay;
    left = roundMoney(left - pay);
  }
  const repayment = await prisma.loanRepayment.create({
    data: {
      publicId: await id('REP'),
      loanId: loan.id,
      amount: decimal(input.amount),
      currency: loan.currency,
      paymentReference: routed.value ?? input.reference ?? `CASH-${Date.now()}`,
      paymentDate: day(input.paymentDate) ?? new Date(),
      status: 'SUCCESS',
    },
  });
  const nextPrincipal = roundMoney(books.principal - (taken.PRINCIPAL ?? 0));
  const nextInterest = roundMoney(books.interest - (taken.INTEREST ?? 0));
  const nextFees = roundMoney(books.fees - (taken.FEES ?? 0));
  const nextPenalty = roundMoney(books.penalty - (taken.PENALTY ?? 0));
  const settled = roundMoney(nextPrincipal + nextInterest + nextFees + nextPenalty) === 0;
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      principalOutstanding: decimal(nextPrincipal),
      interestOutstanding: decimal(nextInterest),
      feesOutstanding: decimal(nextFees),
      status: settled ? LoanStatus.SETTLED : loan.status === LoanStatus.IN_ARREARS ? LoanStatus.IN_ARREARS : LoanStatus.ACTIVE,
    },
  });
  if (loan.position) {
    await prisma.lendingPosition.update({ where: { loanId: loan.id }, data: { penaltyOutstanding: decimal(nextPenalty), label: settled ? 'SETTLED' : loan.position.label } });
  }
  await applyInstallments(loan.id, taken);
  if (settled) {
    await prisma.loanApplication.update({ where: { id: loan.applicationId }, data: { status: LoanApplicationStatus.SETTLED } });
    await notify('LOAN_SETTLED', 'Loan settled', loan.publicId, loan.publicId);
  } else {
    await notify('PAYMENT_RECEIVED', 'Loan repayment received', `${input.amount} ${loan.currency} on ${loan.publicId}.`, loan.publicId);
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LoanRepayment', entityId: repayment.publicId, action: 'lending.repay', newStatus: repayment.status, amount: input.amount, reason: `Fees ${taken.FEES ?? 0}, interest ${taken.INTEREST ?? 0}, penalty ${taken.PENALTY ?? 0}, principal ${taken.PRINCIPAL ?? 0}` });
  return loanFile(loan.publicId);
}

async function applyInstallments(loanId: string, taken: Record<string, number>) {
  let principal = taken.PRINCIPAL ?? 0;
  let interest = taken.INTEREST ?? 0;
  let fees = taken.FEES ?? 0;
  const rows = await prisma.lendingInstallment.findMany({ where: { loanId }, orderBy: { number: 'asc' } });
  for (const row of rows) {
    if (row.status === 'PAID') continue;
    const principalPaid = roundMoney(Math.min(principal, money(row.principalDue) - money(row.principalPaid)));
    const interestPaid = roundMoney(Math.min(interest, money(row.interestDue) - money(row.interestPaid)));
    const feesPaid = roundMoney(Math.min(fees, money(row.feesDue) - money(row.feesPaid)));
    if (principalPaid === 0 && interestPaid === 0 && feesPaid === 0) continue;
    principal = roundMoney(principal - principalPaid);
    interest = roundMoney(interest - interestPaid);
    fees = roundMoney(fees - feesPaid);
    const nextPrincipal = roundMoney(money(row.principalPaid) + principalPaid);
    const nextInterest = roundMoney(money(row.interestPaid) + interestPaid);
    const nextFees = roundMoney(money(row.feesPaid) + feesPaid);
    const paid = nextPrincipal >= money(row.principalDue) && nextInterest >= money(row.interestDue) && nextFees >= money(row.feesDue);
    await prisma.lendingInstallment.update({
      where: { id: row.id },
      data: {
        principalPaid: decimal(nextPrincipal),
        interestPaid: decimal(nextInterest),
        feesPaid: decimal(nextFees),
        status: paid ? 'PAID' : 'PARTIAL',
      },
    });
  }
  const next = await prisma.lendingInstallment.findFirst({ where: { loanId, status: { not: 'PAID' } }, orderBy: { number: 'asc' } });
  await prisma.lendingPosition.updateMany({ where: { loanId }, data: { nextDueDate: next?.dueDate ?? null, daysPastDue: next && next.dueDate < new Date() ? Math.floor((Date.now() - next.dueDate.getTime()) / 86_400_000) : 0 } });
}

export async function statement(loanId: string) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const disbursed = roundMoney(loan.disbursements.reduce((sum, item) => sum + money(item.amount), 0));
  const principalPaid = roundMoney(money(loan.principal) - books.principal);
  return {
    loanId: loan.publicId,
    openingPrincipal: money(loan.principal),
    disbursements: disbursed,
    principalRepayments: principalPaid,
    closingPrincipal: books.principal,
    interestOutstanding: books.interest,
    feesOutstanding: books.fees,
    penaltyOutstanding: books.penalty,
    totalOutstanding: books.total,
    lines: [
      ...loan.disbursements.map((item) => ({ date: dateOnly(item.createdAt), type: 'DISBURSEMENT', amount: money(item.amount), reference: item.transactionReference })),
      ...loan.repayments.map((item) => ({ date: dateOnly(item.paymentDate), type: 'REPAYMENT', amount: money(item.amount), reference: item.paymentReference })),
    ],
  };
}

export async function settlementQuote(loanId: string, charge = 0) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  return { ...books, earlySettlementCharge: charge, totalSettlement: roundMoney(books.total + charge) };
}

export async function restructureLoan(loanId: string, input: {
  newTenor: number
  frequency: string
  graceMonths?: number
  interestTerms?: string
  fees?: number
  reason: string
  decision: 'APPROVE' | 'REJECT'
}, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const officer = await actorLabel(trace.actorId);
  const product = await prisma.loanProduct.findUnique({ where: { code: loan.application.productCode } });
  const schedule = buildSchedule({
    principal: books.principal,
    annualRate: money(loan.interestRate),
    months: input.newTenor,
    graceMonths: input.graceMonths ?? 0,
    method: product?.interestMethod ?? 'DECLINING',
    fee: input.fees ?? 0,
    start: new Date(),
  });
  const installment = schedule.find((row) => row.principalDue > 0)?.totalDue ?? schedule[0]?.totalDue ?? 0;
  const maturity = schedule.at(-1)?.dueDate ?? null;
  const row = await prisma.lendingRestructure.create({
    data: {
      publicId: await id('LRS'),
      loanId: loan.id,
      principal: decimal(books.principal),
      interest: decimal(books.interest),
      overdue: decimal(books.total),
      currentTenor: loan.tenorMonths,
      newTenor: input.newTenor,
      frequency: input.frequency,
      graceMonths: input.graceMonths ?? 0,
      installment: decimal(installment),
      interestTerms: clean(input.interestTerms),
      fees: decimal(input.fees ?? 0),
      maturity,
      reason: input.reason.trim(),
      requestedBy: officer,
      approvedBy: input.decision === 'APPROVE' ? officer : null,
      status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    },
  });
  if (input.decision === 'APPROVE') {
    await prisma.lendingInstallment.deleteMany({ where: { loanId: loan.id, status: { not: 'PAID' } } });
    for (const item of schedule) {
      await prisma.lendingInstallment.create({
        data: { publicId: await id('LIN'), loanId: loan.id, number: item.number + 1000, dueDate: item.dueDate, principalDue: decimal(item.principalDue), interestDue: decimal(item.interestDue), feesDue: decimal(item.feesDue), totalDue: decimal(item.totalDue) },
      });
    }
    const interest = roundMoney(schedule.reduce((sum, item) => sum + item.interestDue, 0));
    await prisma.loan.update({ where: { id: loan.id }, data: { tenorMonths: input.newTenor, interestOutstanding: decimal(interest), status: LoanStatus.ACTIVE } });
    await prisma.lendingPosition.upsert({
      where: { loanId: loan.id },
      create: { loanId: loan.id, label: 'RESTRUCTURED', nextDueDate: schedule[0]?.dueDate ?? null, daysPastDue: 0 },
      update: { label: 'RESTRUCTURED', nextDueDate: schedule[0]?.dueDate ?? null, daysPastDue: 0 },
    });
    await notify('RESTRUCTURING_APPROVED', 'Loan restructuring approved', loan.publicId, loan.publicId);
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingRestructure', entityId: row.publicId, action: 'lending.restructure', newStatus: row.status, reason: input.reason });
  return loanFile(loan.publicId);
}

export async function grantHoliday(loanId: string, input: { months: number; reason: string; decision: 'APPROVE' | 'REJECT' | 'MODIFY'; startDate: string }, trace: Trace) {
  const loan = await load(loanId);
  const row = await prisma.lendingHoliday.create({
    data: { publicId: await id('LHD'), loanId: loan.id, months: input.months, reason: input.reason.trim(), decision: input.decision, startDate: dayRequired(input.startDate, 'Start date') },
  });
  if (input.decision === 'APPROVE') {
    const rows = await prisma.lendingInstallment.findMany({ where: { loanId: loan.id, status: { not: 'PAID' } } });
    for (const item of rows) {
      const due = new Date(item.dueDate);
      due.setUTCMonth(due.getUTCMonth() + input.months);
      await prisma.lendingInstallment.update({ where: { id: item.id }, data: { dueDate: due, status: item.status === 'OVERDUE' ? 'DUE' : item.status } });
    }
    await prisma.lendingPosition.updateMany({ where: { loanId: loan.id }, data: { label: 'CURRENT', daysPastDue: 0 } });
    await prisma.loan.update({ where: { id: loan.id }, data: { status: LoanStatus.ACTIVE } });
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingHoliday', entityId: row.publicId, action: 'lending.holiday', newStatus: input.decision, reason: input.reason });
  return loanFile(loan.publicId);
}

export async function topUp(loanId: string, input: { requested: number; purpose: string; tenorMonths: number; eligibility: string; capacity: string; decision: string }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const exposure = roundMoney(books.principal + input.requested);
  const row = await prisma.lendingTopUp.create({
    data: {
      publicId: await id('LTP'),
      loanId: loan.id,
      outstanding: decimal(books.total),
      requested: decimal(input.requested),
      exposure: decimal(exposure),
      purpose: input.purpose.trim(),
      tenorMonths: input.tenorMonths,
      eligibility: input.eligibility,
      capacity: input.capacity,
      decision: input.decision,
    },
  });
  if (input.decision === 'APPROVED') {
    await prisma.loan.update({
      where: { id: loan.id },
      data: { principal: decimal(roundMoney(money(loan.principal) + input.requested)), principalOutstanding: decimal(exposure), tenorMonths: input.tenorMonths },
    });
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingTopUp', entityId: row.publicId, action: 'lending.topup', newStatus: input.decision, amount: input.requested });
  return loanFile(loan.publicId);
}

export async function refinance(loanId: string, input: {
  lender: string
  currentRate: number
  remainingTenor: number
  newAmount: number
  newRate: number
  newTenor: number
  settlement: number
  additional: number
}, trace: Trace) {
  const loan = await findLoan(loanId);
  const row = await prisma.lendingRefinance.create({
    data: {
      publicId: await id('LRF'),
      loanId: loan.id,
      lender: input.lender.trim(),
      outstanding: loan.principalOutstanding,
      currentRate: decimal(input.currentRate),
      remainingTenor: input.remainingTenor,
      newAmount: decimal(input.newAmount),
      newRate: decimal(input.newRate),
      newTenor: input.newTenor,
      settlement: decimal(input.settlement),
      additional: decimal(input.additional),
    },
  });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingRefinance', entityId: row.publicId, action: 'lending.refinance', amount: input.newAmount });
  return loanFile(loan.publicId);
}

export async function transferLoan(loanId: string, input: { toInstitution: string; transferDate: string; reason: string; approved: boolean }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const row = await prisma.lendingTransfer.create({
    data: {
      publicId: await id('LXF'),
      loanId: loan.id,
      fromInstitution: loan.application.institution.name,
      toInstitution: input.toInstitution.trim(),
      principal: decimal(books.principal),
      interest: decimal(books.interest),
      transferDate: dayRequired(input.transferDate, 'Transfer date'),
      reason: input.reason.trim(),
      approved: input.approved,
    },
  });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingTransfer', entityId: row.publicId, action: 'lending.transfer', newStatus: input.approved ? 'APPROVED' : 'REQUESTED', reason: input.reason });
  return loanFile(loan.publicId);
}

export async function adjustLoan(loanId: string, input: { kind: 'PRINCIPAL' | 'INTEREST' | 'FEES' | 'PENALTY'; amount: number; reason: string }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const original = input.kind === 'PRINCIPAL' ? books.principal : input.kind === 'INTEREST' ? books.interest : input.kind === 'FEES' ? books.fees : books.penalty;
  const next = roundMoney(original + input.amount);
  if (next < 0) throw errors.unprocessable('AMOUNT_INVALID', 'The adjustment cannot take the balance below zero.');
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.lendingAdjustment.create({
    data: { publicId: await id('LAD'), loanId: loan.id, kind: input.kind, original: decimal(original), amount: decimal(input.amount), reason: input.reason.trim(), requestedBy: officer, approvedBy: officer },
  });
  const data = input.kind === 'PRINCIPAL'
    ? { principalOutstanding: decimal(next) }
    : input.kind === 'INTEREST'
      ? { interestOutstanding: decimal(next) }
      : input.kind === 'FEES'
        ? { feesOutstanding: decimal(next) }
        : null;
  if (data) await prisma.loan.update({ where: { id: loan.id }, data });
  if (input.kind === 'PENALTY') await prisma.lendingPosition.updateMany({ where: { loanId: loan.id }, data: { penaltyOutstanding: decimal(next) } });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingAdjustment', entityId: row.publicId, action: 'lending.adjust', amount: input.amount, reason: input.reason });
  return loanFile(loan.publicId);
}

export async function refundRepayment(loanId: string, input: {
  originalTransaction: string
  amount: number
  reason: string
  destination: string
  paymentMethod: string
  externalTransactionId?: string
}, trace: Trace) {
  const loan = await load(loanId);
  const routed = await routeMoney(input.paymentMethod, input.externalTransactionId);
  const row = await prisma.lendingRefund.create({
    data: {
      publicId: await id('LRD'),
      loanId: loan.id,
      originalTransaction: input.originalTransaction.trim(),
      amount: decimal(input.amount),
      reason: input.reason.trim(),
      destination: input.destination.trim(),
      reference: routed.value,
      externalTransactionId: routed.value,
      railCode: routed.railCode,
      status: 'COMPLETED',
    },
  });
  await prisma.loan.update({
    where: { id: loan.id },
    data: { principalOutstanding: decimal(roundMoney(money(loan.principalOutstanding) + input.amount)), status: LoanStatus.ACTIVE },
  });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingRefund', entityId: row.publicId, action: 'lending.refund', newStatus: 'COMPLETED', amount: input.amount, reason: input.reason });
  return loanFile(loan.publicId);
}

export async function collect(loanId: string, input: {
  contactDate: string
  method: string
  person: string
  promiseAmount?: number
  promiseDate?: string
  followUpDate?: string
  notes?: string
  status: string
}, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const row = await prisma.lendingCollection.create({
    data: {
      publicId: await id('LCO'),
      loanId: loan.id,
      contactDate: dayRequired(input.contactDate, 'Contact date'),
      method: input.method,
      person: input.person.trim(),
      outstanding: decimal(books.total),
      promiseAmount: input.promiseAmount == null ? null : decimal(input.promiseAmount),
      promiseDate: day(input.promiseDate),
      followUpDate: day(input.followUpDate),
      notes: clean(input.notes),
      status: input.status,
    },
  });
  if (input.status === 'ESCALATED') {
    await prisma.loan.update({ where: { id: loan.id }, data: { status: LoanStatus.RECOVERY } });
    await prisma.loanApplication.update({ where: { id: loan.applicationId }, data: { status: LoanApplicationStatus.RECOVERY } });
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingCollection', entityId: row.publicId, action: 'lending.collect', newStatus: input.status });
  return loanFile(loan.publicId);
}

export async function promiseToPay(loanId: string, input: { promised: number; promiseDate: string; notes?: string; status?: string }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const row = await prisma.lendingPromise.create({
    data: {
      publicId: await id('LPM'),
      loanId: loan.id,
      outstanding: decimal(books.total),
      promised: decimal(input.promised),
      promiseDate: dayRequired(input.promiseDate, 'Promise date'),
      officer: await actorLabel(trace.actorId),
      notes: clean(input.notes),
      status: input.status ?? 'PENDING',
    },
  });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingPromise', entityId: row.publicId, action: 'lending.promise', newStatus: row.status, amount: input.promised });
  return loanFile(loan.publicId);
}

export async function startRecovery(loanId: string, input: { stage: string; strategy: string; nextAction: string; nextActionDate?: string }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const row = await prisma.lendingRecovery.create({
    data: {
      publicId: await id('LRV'),
      loanId: loan.id,
      outstanding: decimal(books.total),
      daysPastDue: loan.position?.daysPastDue ?? 0,
      stage: input.stage,
      officer: await actorLabel(trace.actorId),
      strategy: input.strategy.trim(),
      nextAction: input.nextAction.trim(),
      nextActionDate: day(input.nextActionDate),
    },
  });
  await prisma.loan.update({ where: { id: loan.id }, data: { status: LoanStatus.RECOVERY } });
  await prisma.lendingPosition.updateMany({ where: { loanId: loan.id }, data: { label: 'RECOVERY' } });
  await prisma.loanApplication.update({ where: { id: loan.applicationId }, data: { status: LoanApplicationStatus.RECOVERY } });
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingRecovery', entityId: row.publicId, action: 'lending.recovery', newStatus: input.stage });
  return loanFile(loan.publicId);
}

export async function writeOff(loanId: string, input: { reason: string; evidence?: string; decision: 'APPROVE' | 'REJECT' }, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.lendingWriteOff.create({
    data: {
      publicId: await id('LWO'),
      loanId: loan.id,
      principal: decimal(books.principal),
      interest: decimal(books.interest),
      fees: decimal(roundMoney(books.fees + books.penalty)),
      total: decimal(books.total),
      history: `${loan.collections.length} collection records, ${loan.recoveries.length} recovery records`,
      reason: input.reason.trim(),
      evidence: clean(input.evidence),
      requestedBy: officer,
      approvedBy: input.decision === 'APPROVE' ? officer : null,
      status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    },
  });
  if (input.decision === 'APPROVE') {
    await prisma.loan.update({ where: { id: loan.id }, data: { principalOutstanding: decimal(0), interestOutstanding: decimal(0), feesOutstanding: decimal(0), status: LoanStatus.RECOVERY } });
    await prisma.lendingPosition.updateMany({ where: { loanId: loan.id }, data: { penaltyOutstanding: decimal(0), label: 'WRITTEN_OFF' } });
  }
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingWriteOff', entityId: row.publicId, action: 'lending.writeoff', newStatus: row.status, amount: books.total, reason: input.reason });
  return loanFile(loan.publicId);
}

export async function settleLoan(loanId: string, input: {
  principalSettled: boolean
  interestSettled: boolean
  feesSettled: boolean
  clear: boolean
  finalPayment?: number
}, trace: Trace) {
  const loan = await load(loanId);
  const books = outstandingOf(loan);
  if (!input.principalSettled || !input.interestSettled || !input.feesSettled || !input.clear) {
    throw errors.unprocessable('SETTLEMENT_INCOMPLETE', 'Confirm that principal, interest, fees, and the balance are settled.');
  }
  if (books.total > 0.009) throw errors.conflict('BALANCE_REMAINS', 'A balance is still outstanding.');
  const paid = loan.repayments.reduce((sum, item) => sum + money(item.amount), 0);
  const row = await prisma.lendingSettlement.create({
    data: {
      publicId: await id('LST'),
      loanId: loan.id,
      principalPaid: decimal(roundMoney(money(loan.principal) - books.principal)),
      interestPaid: decimal(paid),
      feesPaid: decimal(0),
      penaltiesPaid: decimal(0),
      finalPayment: decimal(input.finalPayment ?? 0),
      principalSettled: true,
      interestSettled: true,
      feesSettled: true,
      clear: true,
      settlementDate: new Date(),
    },
  });
  await prisma.loan.update({ where: { id: loan.id }, data: { status: LoanStatus.SETTLED } });
  await prisma.loanApplication.update({ where: { id: loan.applicationId }, data: { status: LoanApplicationStatus.SETTLED } });
  await prisma.lendingPosition.updateMany({ where: { loanId: loan.id }, data: { label: 'SETTLED' } });
  await notify('LOAN_SETTLED', 'Loan settled', loan.publicId, loan.publicId);
  await recordAudit({ trace, reference: loan.publicId, entityType: 'LendingSettlement', entityId: row.publicId, action: 'lending.settle', newStatus: 'SETTLED' });
  return loanFile(loan.publicId);
}
