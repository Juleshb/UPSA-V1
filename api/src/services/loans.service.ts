import {
  AssessmentStatus,
  CreditDecision,
  LoanApplicationStatus,
  LoanStatus,
  Prisma,
} from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { decimal, money, sub } from '../utils/money';
import { prisma } from '../utils/prisma';
import { findSchool } from './schools.service';

export async function createApplication(input: {
  schoolId: string;
  financialInstitutionId: string;
  productCode: string;
  requestedAmount: number;
  currency?: string;
  tenorMonths: number;
  purpose: string;
  guaranteeRequested?: boolean;
  guaranteeAmountRequested?: number;
}, actorId?: string) {
  const school = await findSchool(input.schoolId);
  const institution = await prisma.financialInstitution.findUnique({
    where: { publicId: input.financialInstitutionId },
  });
  if (!institution) {
    throw errors.notFound('INSTITUTION_NOT_FOUND', 'The requested financial institution could not be found.');
  }

  const application = await prisma.loanApplication.create({
    data: {
      publicId: await nextPublicId('LA'),
      schoolId: school.id,
      financialInstitutionId: institution.id,
      productCode: input.productCode,
      requestedAmount: decimal(input.requestedAmount),
      currency: input.currency ?? 'RWF',
      tenorMonths: input.tenorMonths,
      purpose: input.purpose,
      guaranteeRequested: input.guaranteeRequested ?? false,
      guaranteeAmountRequested: input.guaranteeAmountRequested != null
        ? decimal(input.guaranteeAmountRequested)
        : undefined,
      status: LoanApplicationStatus.SUBMITTED,
    },
  });

  await publishEvent(EventTypes.loanApplicationCreated, application.publicId, {
    applicationId: application.publicId,
  });
  await writeAudit({
    actorId,
    action: 'loan.application.create',
    entityType: 'LoanApplication',
    entityId: application.publicId,
  });

  return {
    applicationId: application.publicId,
    status: application.status,
    createdAt: application.createdAt.toISOString(),
  };
}

export async function assessApplication(applicationId: string) {
  const application = await findApplication(applicationId);
  const assessment = await prisma.creditAssessment.create({
    data: {
      publicId: await nextPublicId('ASSESS'),
      applicationId: application.id,
      assessmentStatus: AssessmentStatus.COMPLETED,
      assessmentReference: await nextPublicId('ASSESS'),
      financialInstitutionDecisionRequired: true,
      summary: {
        note: 'RUPSA NEXT analytical assessment only. Final credit decision remains with the licensed institution.',
      },
    },
  });

  await prisma.loanApplication.update({
    where: { id: application.id },
    data: { status: LoanApplicationStatus.FI_REVIEW },
  });

  return {
    applicationId: application.publicId,
    assessmentStatus: assessment.assessmentStatus,
    assessmentReference: assessment.assessmentReference,
    financialInstitutionDecisionRequired: assessment.financialInstitutionDecisionRequired,
  };
}

export async function decideApplication(applicationId: string, input: {
  decision: CreditDecision;
  approvedAmount?: number;
  currency?: string;
  tenorMonths?: number;
  interestRate?: number;
  decisionReference?: string;
}, actorId?: string) {
  const application = await findApplication(applicationId);
  const approved = input.decision === CreditDecision.APPROVED || input.decision === CreditDecision.CONDITIONAL_APPROVAL;

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.loanApplication.update({
      where: { id: application.id },
      data: {
        decision: input.decision,
        approvedAmount: input.approvedAmount != null ? decimal(input.approvedAmount) : undefined,
        interestRate: input.interestRate != null ? decimal(input.interestRate) : undefined,
        tenorMonths: input.tenorMonths ?? application.tenorMonths,
        decisionReference: input.decisionReference,
        status: approved
          ? LoanApplicationStatus.OFFER
          : input.decision === CreditDecision.CANCELLED
            ? LoanApplicationStatus.CANCELLED
            : input.decision === CreditDecision.MORE_INFORMATION_REQUIRED
              ? LoanApplicationStatus.DOCUMENT_CHECK
              : LoanApplicationStatus.DECLINED,
      },
    });

    if (approved && input.approvedAmount != null && input.interestRate != null) {
      const existing = await tx.loan.findUnique({ where: { applicationId: application.id } });
      if (!existing) {
        await tx.loan.create({
          data: {
            publicId: await nextPublicId('LOAN'),
            applicationId: application.id,
            principal: decimal(input.approvedAmount),
            currency: input.currency ?? application.currency,
            tenorMonths: input.tenorMonths ?? application.tenorMonths,
            interestRate: decimal(input.interestRate),
            principalOutstanding: decimal(input.approvedAmount),
            status: LoanStatus.OFFERED,
          },
        });
      }
    }

    return app;
  });

  if (approved) {
    await publishEvent(EventTypes.loanApproved, updated.publicId, {
      applicationId: updated.publicId,
      approvedAmount: input.approvedAmount,
    });
  }

  await writeAudit({
    actorId,
    action: 'loan.decision',
    entityType: 'LoanApplication',
    entityId: updated.publicId,
    metadata: { decision: input.decision },
  });

  return {
    applicationId: updated.publicId,
    status: updated.status,
    decision: updated.decision,
    approvedAmount: updated.approvedAmount != null ? money(updated.approvedAmount) : null,
  };
}

export async function getLoan(loanId: string) {
  const loan = await findLoan(loanId);
  return serializeLoan(loan);
}

export async function getLoanBalance(loanId: string) {
  const loan = await findLoan(loanId);
  return {
    loanId: loan.publicId,
    principalOutstanding: money(loan.principalOutstanding),
    interestOutstanding: money(loan.interestOutstanding),
    feesOutstanding: money(loan.feesOutstanding),
    totalOutstanding: money(loan.principalOutstanding) + money(loan.interestOutstanding) + money(loan.feesOutstanding),
    currency: loan.currency,
  };
}

export async function disburse(loanId: string, input: {
  amount: number;
  currency?: string;
  disbursementAccount: string;
  transactionReference: string;
  idempotencyKey?: string;
}, actorId?: string) {
  const loan = await findLoan(loanId);
  if (input.idempotencyKey) {
    const replay = await prisma.loanDisbursement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      return { disbursementId: replay.publicId, status: 'POSTED', loanId: loan.publicId, amount: money(replay.amount) };
    }
  }

  const disbursement = await prisma.$transaction(async (tx) => {
    const row = await tx.loanDisbursement.create({
      data: {
        publicId: await nextPublicId('DISB'),
        loanId: loan.id,
        amount: decimal(input.amount),
        currency: input.currency ?? loan.currency,
        disbursementAccount: input.disbursementAccount,
        transactionReference: input.transactionReference,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.loan.update({
      where: { id: loan.id },
      data: { status: LoanStatus.ACTIVE },
    });
    await tx.loanApplication.update({
      where: { id: loan.applicationId },
      data: { status: LoanApplicationStatus.ACTIVE },
    });
    return row;
  });

  await publishEvent(EventTypes.loanDisbursed, loan.publicId, {
    loanId: loan.publicId,
    amount: input.amount,
  });
  await writeAudit({
    actorId,
    action: 'loan.disburse',
    entityType: 'Loan',
    entityId: loan.publicId,
  });

  return {
    disbursementId: disbursement.publicId,
    status: 'POSTED',
    loanId: loan.publicId,
    amount: money(disbursement.amount),
  };
}

export async function repay(loanId: string, input: {
  amount: number;
  currency?: string;
  paymentReference: string;
  paymentDate: string;
  idempotencyKey?: string;
}, actorId?: string) {
  const loan = await findLoan(loanId);
  if (input.idempotencyKey) {
    const replay = await prisma.loanRepayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      return { repaymentId: replay.publicId, status: replay.status, loanId: loan.publicId, amount: money(replay.amount) };
    }
  }

  const repayment = await prisma.$transaction(async (tx) => {
    const row = await tx.loanRepayment.create({
      data: {
        publicId: await nextPublicId('REP'),
        loanId: loan.id,
        amount: decimal(input.amount),
        currency: input.currency ?? loan.currency,
        paymentReference: input.paymentReference,
        paymentDate: new Date(input.paymentDate),
        status: 'POSTED',
        idempotencyKey: input.idempotencyKey,
      },
    });

    const nextPrincipal = sub(loan.principalOutstanding, input.amount);
    const settled = Number(nextPrincipal) <= 0;
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        principalOutstanding: settled ? new Prisma.Decimal(0) : nextPrincipal,
        status: settled ? LoanStatus.SETTLED : LoanStatus.ACTIVE,
      },
    });
    if (settled) {
      await tx.loanApplication.update({
        where: { id: loan.applicationId },
        data: { status: LoanApplicationStatus.SETTLED },
      });
    }
    return row;
  });

  await publishEvent(EventTypes.loanRepaymentPosted, loan.publicId, {
    loanId: loan.publicId,
    repaymentId: repayment.publicId,
    amount: input.amount,
  });
  await writeAudit({
    actorId,
    action: 'loan.repay',
    entityType: 'Loan',
    entityId: loan.publicId,
  });

  return {
    repaymentId: repayment.publicId,
    status: repayment.status,
    loanId: loan.publicId,
    amount: money(repayment.amount),
  };
}

export async function listApplications(schoolId?: string) {
  const school = schoolId ? await findSchool(schoolId) : null;
  const rows = await prisma.loanApplication.findMany({
    where: school ? { schoolId: school.id } : undefined,
    include: { institution: true, school: true, loan: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    applicationId: row.publicId,
    schoolId: row.school.publicId,
    financialInstitutionId: row.institution.publicId,
    productCode: row.productCode,
    requestedAmount: money(row.requestedAmount),
    currency: row.currency,
    tenorMonths: row.tenorMonths,
    status: row.status,
    decision: row.decision,
    loanId: row.loan?.publicId ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function findApplication(applicationId: string) {
  const application = await prisma.loanApplication.findUnique({ where: { publicId: applicationId } });
  if (!application) {
    throw errors.notFound('LOAN_APPLICATION_NOT_FOUND', 'The requested loan application could not be found.');
  }
  return application;
}

export async function findLoan(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { publicId: loanId } });
  if (!loan) throw errors.notFound('LOAN_NOT_FOUND', 'The requested loan could not be found.');
  return loan;
}

function serializeLoan(loan: Awaited<ReturnType<typeof findLoan>>) {
  return {
    loanId: loan.publicId,
    status: loan.status,
    principal: money(loan.principal),
    principalOutstanding: money(loan.principalOutstanding),
    interestOutstanding: money(loan.interestOutstanding),
    feesOutstanding: money(loan.feesOutstanding),
    currency: loan.currency,
    tenorMonths: loan.tenorMonths,
    interestRate: money(loan.interestRate),
  };
}
