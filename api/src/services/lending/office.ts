import { prisma } from '../../utils/prisma';
import { dateOnly, id, money, recordAudit, roundMoney, type Trace } from './shared';
import { ensureProducts } from './products';

export async function dashboard() {
  await ensureProducts();
  const [applications, loans] = await Promise.all([
    prisma.loanApplication.findMany({ include: { loan: { include: { position: true } }, lendingGuarantees: true } }),
    prisma.loan.findMany({ include: { position: true, application: true, disbursements: true } }),
  ]);
  const countStatus = (status: string) => applications.filter((item) => item.status === status).length;
  const outstanding = loans.reduce((sum, loan) => sum + money(loan.principalOutstanding) + money(loan.interestOutstanding) + money(loan.feesOutstanding) + money(loan.position?.penaltyOutstanding ?? 0), 0);
  const disbursed = loans.reduce((sum, loan) => sum + loan.disbursements.reduce((inner, item) => inner + money(item.amount), 0), 0);
  return {
    applications: applications.length,
    pending: applications.filter((item) => ['SUBMITTED', 'DOCUMENT_CHECK', 'KYC_KYB', 'ASSESSMENT', 'FI_REVIEW'].includes(item.status)).length,
    assessment: countStatus('ASSESSMENT') + countStatus('FI_REVIEW'),
    approved: applications.filter((item) => item.decision === 'APPROVED' || item.decision === 'CONDITIONAL_APPROVAL').length,
    declined: countStatus('DECLINED'),
    active: loans.filter((loan) => loan.status === 'ACTIVE' || loan.status === 'IN_ARREARS').length,
    disbursed,
    principal: roundMoney(loans.reduce((sum, loan) => sum + money(loan.principalOutstanding), 0)),
    interest: roundMoney(loans.reduce((sum, loan) => sum + money(loan.interestOutstanding), 0)),
    fees: roundMoney(loans.reduce((sum, loan) => sum + money(loan.feesOutstanding), 0)),
    outstanding: roundMoney(outstanding),
    overdue: loans.filter((loan) => (loan.position?.daysPastDue ?? 0) > 0 || loan.status === 'IN_ARREARS').length,
    recovery: loans.filter((loan) => loan.status === 'RECOVERY' || loan.position?.label === 'RECOVERY').length,
    settled: loans.filter((loan) => loan.status === 'SETTLED').length,
    defaulted: loans.filter((loan) => loan.position?.label === 'DEFAULTED' || loan.position?.label === 'WRITTEN_OFF').length,
    guaranteed: applications.filter((item) => item.guaranteeRequested || item.lendingGuarantees.length > 0).length,
  };
}

export async function report(type: string) {
  const loans = await prisma.loan.findMany({
    include: { application: { include: { school: true, institution: true, lendingCase: true } }, position: true, repayments: true },
    orderBy: { createdAt: 'desc' },
  });
  const line = (row: (typeof loans)[number]) => ({
    loanId: row.publicId,
    borrower: row.application.lendingCase?.applicantName ?? row.application.school.schoolName,
    product: row.application.productCode,
    school: row.application.school.schoolName,
    district: row.application.school.district,
    institution: row.application.institution.name,
    principal: money(row.principalOutstanding),
    outstanding: roundMoney(money(row.principalOutstanding) + money(row.interestOutstanding) + money(row.feesOutstanding)),
    status: row.position?.label ?? row.status,
    daysPastDue: row.position?.daysPastDue ?? 0,
  });
  if (type === 'active') return loans.filter((row) => row.status === 'ACTIVE' || row.status === 'IN_ARREARS').map(line);
  if (type === 'outstanding') return loans.filter((row) => money(row.principalOutstanding) > 0).map(line);
  if (type === 'overdue') return loans.filter((row) => (row.position?.daysPastDue ?? 0) > 0 || row.status === 'IN_ARREARS').map(line);
  if (type === 'settled') return loans.filter((row) => row.status === 'SETTLED').map(line);
  if (type === 'restructured') {
    const rows = await prisma.lendingRestructure.findMany({ include: { loan: true }, orderBy: { id: 'desc' } });
    return rows.map((row) => ({ restructureId: row.publicId, loanId: row.loan.publicId, status: row.status, tenor: row.newTenor }));
  }
  if (type === 'applications' || type === 'approvals' || type === 'declines') {
    const applications = await prisma.loanApplication.findMany({ include: { school: true, lendingAssessments: { take: 1, orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    return applications.filter((row) => {
      if (type === 'approvals') return row.decision === 'APPROVED' || row.decision === 'CONDITIONAL_APPROVAL';
      if (type === 'declines') return row.decision === 'DECLINED';
      return true;
    }).map((row) => ({
      applicationId: row.publicId,
      school: row.school.schoolName,
      product: row.productCode,
      requested: money(row.requestedAmount),
      decision: row.decision ?? '',
      assessment: row.lendingAssessments[0]?.result ?? '',
      status: row.status,
    }));
  }
  if (type === 'repayments') {
    const payments = await prisma.loanRepayment.findMany({ include: { loan: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return payments.map((row) => ({ repaymentId: row.publicId, loanId: row.loan.publicId, amount: money(row.amount), reference: row.paymentReference, date: dateOnly(row.paymentDate), status: row.status }));
  }
  if (type === 'par') {
    const book = loans.filter((row) => row.status === 'ACTIVE' || row.status === 'IN_ARREARS');
    const atRisk = book.filter((row) => (row.position?.daysPastDue ?? 0) > 0);
    const base = book.reduce((sum, row) => sum + money(row.principalOutstanding), 0);
    const risk = atRisk.reduce((sum, row) => sum + money(row.principalOutstanding), 0);
    return [{ loans: book.length, overdue: atRisk.length, outstanding: roundMoney(base), atRisk: roundMoney(risk), ratio: base ? roundMoney((risk / base) * 100) : 0 }];
  }
  if (type === 'concentration') {
    const buckets = new Map<string, number>();
    for (const row of loans) {
      const key = row.application.school.schoolName;
      buckets.set(key, roundMoney((buckets.get(key) ?? 0) + money(row.principalOutstanding)));
    }
    return [...buckets.entries()].map(([school, principal]) => ({ school, principal }));
  }
  return loans.map(line);
}

export async function listNotices() {
  const rows = await prisma.lendingNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ noticeId: row.publicId, event: row.event, subject: row.subject, status: row.status, createdAt: row.createdAt.toISOString() }));
}

export async function sendNotice(input: { event: string; channel: string; subject: string; body: string; reference?: string }, trace: Trace) {
  const row = await prisma.lendingNotice.create({
    data: { publicId: await id('LNT'), reference: input.reference ?? null, event: input.event, channel: input.channel, subject: input.subject.trim(), body: input.body.trim(), status: 'QUEUED' },
  });
  await recordAudit({ trace, reference: input.reference, entityType: 'LendingNotice', entityId: row.publicId, action: 'lending.notice', newStatus: 'QUEUED' });
  return { noticeId: row.publicId };
}

export async function listAudit() {
  const rows = await prisma.lendingAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({
    auditId: row.publicId,
    reference: row.reference,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    amount: row.amount == null ? null : money(row.amount),
    userId: row.userId,
    reason: row.reason,
    institution: row.institution,
    createdAt: row.createdAt.toISOString(),
  }));
}
