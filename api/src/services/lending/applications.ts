import { CreditDecision, LoanApplicationStatus, LoanStatus, Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { prisma } from '../../utils/prisma';
import { decideApplication, createApplication, findApplication } from '../loans.service';
import { findSchool } from '../schools.service';
import { findProduct } from './products';
import {
  actorLabel, advance, buildSchedule, clean, dateOnly, day, dayRequired, decimal, id, money, notify, recordAudit, roundMoney, type Trace,
} from './shared';

const fileInclude = {
  school: true,
  institution: true,
  loan: true,
  lendingCase: true,
  lendingDocuments: { orderBy: { createdAt: 'desc' as const } },
  lendingKyc: { orderBy: { reviewedAt: 'desc' as const } },
  lendingConsents: { orderBy: { createdAt: 'desc' as const } },
  lendingAssessments: { orderBy: { createdAt: 'desc' as const } },
  offers: { orderBy: { createdAt: 'desc' as const } },
  contracts: { orderBy: { createdAt: 'desc' as const } },
  lendingCollateral: true,
  lendingGuarantees: true,
  assessments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.LoanApplicationInclude;

async function load(applicationId: string) {
  const row = await prisma.loanApplication.findUnique({ where: { publicId: applicationId }, include: fileInclude });
  if (!row) throw errors.notFound('LOAN_APPLICATION_NOT_FOUND', 'The requested loan application could not be found.');
  return row;
}

function present(row: Awaited<ReturnType<typeof load>>) {
  const details = (row.lendingCase?.details ?? {}) as Record<string, unknown>;
  return {
    applicationId: row.publicId,
    schoolId: row.school.publicId,
    schoolName: row.school.schoolName,
    financialInstitutionId: row.institution.publicId,
    institutionName: row.institution.name,
    productCode: row.productCode,
    requestedAmount: money(row.requestedAmount),
    approvedAmount: row.approvedAmount == null ? null : money(row.approvedAmount),
    currency: row.currency,
    tenorMonths: row.tenorMonths,
    purpose: row.purpose,
    interestRate: row.interestRate == null ? null : money(row.interestRate),
    guaranteeRequested: row.guaranteeRequested,
    guaranteeAmountRequested: row.guaranteeAmountRequested == null ? null : money(row.guaranteeAmountRequested),
    status: row.status,
    decision: row.decision,
    decisionReference: row.decisionReference,
    loanId: row.loan?.publicId ?? null,
    loanStatus: row.loan?.status ?? null,
    customerType: row.lendingCase?.customerType ?? 'SCHOOL',
    applicantName: row.lendingCase?.applicantName ?? row.school.schoolName,
    representative: row.lendingCase?.representative ?? null,
    memberPublicId: row.lendingCase?.memberPublicId ?? null,
    monthlyRevenue: money(row.lendingCase?.monthlyRevenue ?? 0),
    monthlyExpenses: money(row.lendingCase?.monthlyExpenses ?? 0),
    existingDebt: money(row.lendingCase?.existingDebt ?? 0),
    existingRepayments: money(row.lendingCase?.existingRepayments ?? 0),
    applicantContribution: money(row.lendingCase?.applicantContribution ?? 0),
    expectedCashFlow: row.lendingCase?.expectedCashFlow ?? null,
    graceMonths: row.lendingCase?.graceMonths ?? 0,
    repaymentFrequency: row.lendingCase?.repaymentFrequency ?? 'MONTHLY',
    collateralAvailable: row.lendingCase?.collateralAvailable ?? false,
    collateralType: row.lendingCase?.collateralType ?? null,
    collateralValue: row.lendingCase?.collateralValue == null ? null : money(row.lendingCase.collateralValue),
    collateralOwner: row.lendingCase?.collateralOwner ?? null,
    details,
    district: row.school.district,
    documents: row.lendingDocuments.map((item) => ({
      documentId: item.publicId,
      documentType: item.documentType,
      documentNumber: item.documentNumber,
      issueDate: dateOnly(item.issueDate),
      expiryDate: dateOnly(item.expiryDate),
      fileName: item.fileName,
      status: item.status,
      comment: item.comment,
      verifiedBy: item.verifiedBy,
      verifiedAt: dateOnly(item.verifiedAt),
    })),
    kyc: row.lendingKyc[0] ? {
      kycId: row.lendingKyc[0].publicId,
      kind: row.lendingKyc[0].kind,
      result: row.lendingKyc[0].result,
      officerName: row.lendingKyc[0].officerName,
      fullName: row.lendingKyc[0].fullName,
      organizationName: row.lendingKyc[0].organizationName,
    } : null,
    consent: row.lendingConsents[0] ? {
      consentId: row.lendingConsents[0].publicId,
      purpose: row.lendingConsents[0].purpose,
      scope: row.lendingConsents[0].scope,
      institution: row.lendingConsents[0].institution,
      status: row.lendingConsents[0].status,
      version: row.lendingConsents[0].version,
      effectiveDate: dateOnly(row.lendingConsents[0].effectiveDate),
      expiryDate: dateOnly(row.lendingConsents[0].expiryDate),
    } : null,
    assessment: row.lendingAssessments[0] ? {
      assessmentId: row.lendingAssessments[0].publicId,
      result: row.lendingAssessments[0].result,
      freeCashFlow: money(row.lendingAssessments[0].freeCashFlow),
      repaymentCapacity: row.lendingAssessments[0].repaymentCapacity,
      officerName: row.lendingAssessments[0].officerName,
      note: 'This is a UPSA Next recommendation. The financial institution makes the credit decision.',
    } : null,
    offer: row.offers[0] ? {
      offerId: row.offers[0].publicId,
      amount: money(row.offers[0].amount),
      interestRate: money(row.offers[0].interestRate),
      tenorMonths: row.offers[0].tenorMonths,
      graceMonths: row.offers[0].graceMonths,
      frequency: row.offers[0].frequency,
      fees: money(row.offers[0].fees),
      conditions: row.offers[0].conditions,
      expiresOn: dateOnly(row.offers[0].expiresOn),
      response: row.offers[0].response,
      acceptedBy: row.offers[0].acceptedBy,
    } : null,
    contract: row.contracts[0] ? {
      contractId: row.contracts[0].publicId,
      contractNumber: row.contracts[0].contractNumber,
      principal: money(row.contracts[0].principal),
      interest: money(row.contracts[0].interest),
      fees: money(row.contracts[0].fees),
      borrowerSigned: row.contracts[0].borrowerSigned,
      institutionSigned: row.contracts[0].institutionSigned,
      signedAt: dateOnly(row.contracts[0].signedAt),
    } : null,
    collateral: row.lendingCollateral.map((item) => ({
      collateralId: item.publicId,
      collateralType: item.collateralType,
      description: item.description,
      owner: item.owner,
      estimatedValue: money(item.estimatedValue),
      status: item.status,
    })),
    guarantee: row.lendingGuarantees[0] ? {
      requestId: row.lendingGuarantees[0].publicId,
      requestedGuarantee: money(row.lendingGuarantees[0].requestedGuarantee),
      percentage: money(row.lendingGuarantees[0].percentage),
      decision: row.lendingGuarantees[0].decision,
    } : null,
  };
}

export async function listApplications(query: { status?: string; q?: string }) {
  const rows = await prisma.loanApplication.findMany({
    where: query.status ? { status: query.status as LoanApplicationStatus } : undefined,
    include: { school: true, institution: true, loan: true, lendingCase: true },
    orderBy: { createdAt: 'desc' },
  });
  const needle = query.q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (!needle) return true;
    return [row.publicId, row.productCode, row.purpose, row.school.schoolName, row.school.district, row.lendingCase?.applicantName, row.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }).map((row) => ({
    applicationId: row.publicId,
    applicant: row.lendingCase?.applicantName ?? row.school.schoolName,
    schoolId: row.school.publicId,
    productCode: row.productCode,
    district: row.school.district,
    institution: row.institution.name,
    requestedAmount: money(row.requestedAmount),
    currency: row.currency,
    status: row.status,
    decision: row.decision,
    loanId: row.loan?.publicId ?? null,
  }));
}

export async function applicationFile(applicationId: string) {
  return present(await load(applicationId));
}

export async function registerApplication(input: {
  schoolId: string
  financialInstitutionId: string
  productCode: string
  requestedAmount: number
  currency?: string
  tenorMonths: number
  purpose: string
  guaranteeRequested?: boolean
  guaranteeAmountRequested?: number
  customerType: string
  applicantName: string
  representative?: string
  memberPublicId?: string
  monthlyRevenue?: number
  monthlyExpenses?: number
  existingDebt?: number
  existingRepayments?: number
  applicantContribution?: number
  expectedCashFlow?: string
  graceMonths?: number
  repaymentFrequency?: string
  collateralAvailable?: boolean
  collateralType?: string
  collateralValue?: number
  collateralOwner?: string
  details?: Record<string, string>
}, trace: Trace) {
  const product = await findProduct(input.productCode);
  if (input.requestedAmount < money(product.minimumAmount) || input.requestedAmount > money(product.maximumAmount)) {
    throw errors.unprocessable('AMOUNT_INVALID', 'The requested amount is outside the product limits.');
  }
  if (input.tenorMonths < product.minimumTenor || input.tenorMonths > product.maximumTenor) {
    throw errors.unprocessable('TENOR_INVALID', 'The requested tenor is outside the product limits.');
  }
  if (product.guaranteeRequired && !input.guaranteeRequested) {
    throw errors.unprocessable('GUARANTEE_REQUIRED', 'This product requires a guarantee request.');
  }
  if (product.collateralRequired && !input.collateralAvailable) {
    throw errors.unprocessable('COLLATERAL_REQUIRED', 'This product requires collateral.');
  }
  if (input.memberPublicId) {
    const member = await prisma.member.findUnique({ where: { publicId: input.memberPublicId } });
    if (!member) throw errors.notFound('MEMBER_NOT_FOUND', 'That membership file could not be found.');
  }
  const invoiceId = input.details?.invoiceId;
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { publicId: invoiceId } });
    if (!invoice) throw errors.notFound('INVOICE_NOT_FOUND', 'That school invoice could not be found.');
  }
  const created = await createApplication({
    schoolId: input.schoolId,
    financialInstitutionId: input.financialInstitutionId,
    productCode: product.code,
    requestedAmount: input.requestedAmount,
    currency: input.currency,
    tenorMonths: input.tenorMonths,
    purpose: input.purpose,
    guaranteeRequested: input.guaranteeRequested,
    guaranteeAmountRequested: input.guaranteeAmountRequested,
  }, trace.actorId);
  const application = await findApplication(created.applicationId);
  await prisma.lendingCase.create({
    data: {
      publicId: await id('LCS'),
      applicationId: application.id,
      customerType: input.customerType,
      applicantName: input.applicantName.trim(),
      representative: clean(input.representative),
      memberPublicId: clean(input.memberPublicId),
      monthlyRevenue: decimal(input.monthlyRevenue ?? 0),
      monthlyExpenses: decimal(input.monthlyExpenses ?? 0),
      existingDebt: decimal(input.existingDebt ?? 0),
      existingRepayments: decimal(input.existingRepayments ?? 0),
      applicantContribution: decimal(input.applicantContribution ?? 0),
      expectedCashFlow: clean(input.expectedCashFlow),
      graceMonths: input.graceMonths ?? product.graceMonths,
      repaymentFrequency: input.repaymentFrequency ?? product.repaymentFrequency,
      collateralAvailable: input.collateralAvailable ?? false,
      collateralType: clean(input.collateralType),
      collateralValue: input.collateralValue == null ? null : decimal(input.collateralValue),
      collateralOwner: clean(input.collateralOwner),
      details: input.details ?? undefined,
    },
  });
  await notify('APPLICATION_RECEIVED', 'Loan application received', `${input.applicantName} requested ${product.name}.`, created.applicationId);
  await recordAudit({ trace, reference: created.applicationId, entityType: 'LoanApplication', entityId: created.applicationId, action: 'lending.apply', newStatus: 'SUBMITTED', amount: input.requestedAmount, institution: input.financialInstitutionId });
  return applicationFile(created.applicationId);
}

async function move(applicationId: string, next: LoanApplicationStatus) {
  const application = await findApplication(applicationId);
  const status = advance(application.status, next) as LoanApplicationStatus;
  if (status !== application.status) {
    await prisma.loanApplication.update({ where: { id: application.id }, data: { status } });
  }
  return application;
}

export async function addDocument(applicationId: string, input: {
  documentType: string
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  fileName: string
}, trace: Trace) {
  const application = await move(applicationId, LoanApplicationStatus.DOCUMENT_CHECK);
  const row = await prisma.lendingDocument.create({
    data: {
      publicId: await id('LDC'),
      applicationId: application.id,
      documentType: input.documentType,
      documentNumber: clean(input.documentNumber),
      issueDate: day(input.issueDate),
      expiryDate: day(input.expiryDate),
      fileName: input.fileName.trim(),
    },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingDocument', entityId: row.publicId, action: 'lending.document', newStatus: 'PENDING' });
  return applicationFile(application.publicId);
}

export async function reviewDocument(applicationId: string, documentId: string, input: { status: string; comment?: string }, trace: Trace) {
  const application = await findApplication(applicationId);
  const document = await prisma.lendingDocument.findFirst({ where: { publicId: documentId, applicationId: application.id } });
  if (!document) throw errors.notFound('DOCUMENT_NOT_FOUND', 'That document is not on this application.');
  await prisma.lendingDocument.update({
    where: { id: document.id },
    data: { status: input.status, comment: clean(input.comment), verifiedBy: await actorLabel(trace.actorId), verifiedAt: new Date() },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingDocument', entityId: document.publicId, action: 'lending.document.review', previousStatus: document.status, newStatus: input.status, reason: input.comment });
  return applicationFile(application.publicId);
}

export async function saveKyc(applicationId: string, input: {
  kind: string
  fullName?: string
  idType?: string
  idNumber?: string
  dateOfBirth?: string
  address?: string
  phone?: string
  email?: string
  organizationName?: string
  registrationNumber?: string
  taxId?: string
  directors?: string
  owners?: string
  representative?: string
  beneficialOwners?: string
  result: string
}, trace: Trace) {
  const application = await move(applicationId, input.result === 'VERIFIED' ? LoanApplicationStatus.KYC_KYB : LoanApplicationStatus.DOCUMENT_CHECK);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.lendingKyc.create({
    data: {
      publicId: await id('LKY'),
      applicationId: application.id,
      kind: input.kind,
      fullName: clean(input.fullName),
      idType: clean(input.idType),
      idNumber: clean(input.idNumber),
      dateOfBirth: day(input.dateOfBirth),
      address: clean(input.address),
      phone: clean(input.phone),
      email: clean(input.email),
      organizationName: clean(input.organizationName),
      registrationNumber: clean(input.registrationNumber),
      taxId: clean(input.taxId),
      directors: clean(input.directors),
      owners: clean(input.owners),
      representative: clean(input.representative),
      beneficialOwners: clean(input.beneficialOwners),
      result: input.result,
      officerName: officer,
    },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingKyc', entityId: row.publicId, action: 'lending.kyc', newStatus: input.result });
  return applicationFile(application.publicId);
}

export async function saveConsent(applicationId: string, input: {
  purpose: string
  scope: string
  institution: string
  effectiveDate: string
  expiryDate: string
  version: string
  withdraw?: boolean
}, trace: Trace) {
  const application = await findApplication(applicationId);
  if (input.withdraw) {
    await prisma.lendingConsent.updateMany({ where: { applicationId: application.id, status: 'ACTIVE' }, data: { status: 'WITHDRAWN' } });
    await recordAudit({ trace, reference: application.publicId, entityType: 'LendingConsent', entityId: application.publicId, action: 'lending.consent.withdraw', newStatus: 'WITHDRAWN' });
    return applicationFile(application.publicId);
  }
  const row = await prisma.lendingConsent.create({
    data: {
      publicId: await id('LCN'),
      applicationId: application.id,
      purpose: input.purpose.trim(),
      scope: input.scope.trim(),
      institution: input.institution.trim(),
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      expiryDate: dayRequired(input.expiryDate, 'Expiry date'),
      version: input.version.trim(),
      status: 'ACTIVE',
    },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingConsent', entityId: row.publicId, action: 'lending.consent', newStatus: 'ACTIVE' });
  return applicationFile(application.publicId);
}

export async function saveAssessment(applicationId: string, input: {
  revenue: number
  collections: number
  collectionRate: number
  expenses: number
  exposure: number
  debtService: number
  repaymentCapacity: string
  cashFlowStability: string
  paymentHistory: string
  trend: string
  risks?: string
  mitigation?: string
  result: string
}, trace: Trace) {
  const application = await move(applicationId, LoanApplicationStatus.ASSESSMENT);
  const freeCashFlow = roundMoney(input.collections - input.expenses - input.debtService);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.lendingAssessment.create({
    data: {
      publicId: await id('LCA'),
      applicationId: application.id,
      revenue: decimal(input.revenue),
      collections: decimal(input.collections),
      collectionRate: decimal(input.collectionRate),
      expenses: decimal(input.expenses),
      exposure: decimal(input.exposure),
      debtService: decimal(input.debtService),
      freeCashFlow: decimal(freeCashFlow),
      repaymentCapacity: input.repaymentCapacity,
      cashFlowStability: input.cashFlowStability,
      paymentHistory: input.paymentHistory,
      trend: input.trend,
      risks: clean(input.risks),
      mitigation: clean(input.mitigation),
      result: input.result,
      officerName: officer,
    },
  });
  if (input.result === 'RECOMMEND' || input.result === 'RECOMMEND_WITH_CONDITIONS') {
    await prisma.loanApplication.update({ where: { id: application.id }, data: { status: LoanApplicationStatus.FI_REVIEW } });
  }
  await prisma.creditAssessment.create({
    data: {
      publicId: await id('ASSESS'),
      applicationId: application.id,
      assessmentReference: row.publicId,
      financialInstitutionDecisionRequired: true,
      summary: { result: input.result, freeCashFlow, note: 'UPSA Next recommendation. The financial institution makes the credit decision.' },
    },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingAssessment', entityId: row.publicId, action: 'lending.assess', newStatus: input.result });
  return applicationFile(application.publicId);
}

export async function recordDecision(applicationId: string, input: {
  decision: 'APPROVED' | 'DECLINED' | 'CONDITIONAL_APPROVAL' | 'MORE_INFORMATION_REQUIRED' | 'CANCELLED'
  approvedAmount?: number
  tenorMonths?: number
  interestRate?: number
  graceMonths?: number
  fees?: number
  conditions?: string
  decisionReference?: string
  comments?: string
}, trace: Trace) {
  const application = await load(applicationId);
  const product = await prisma.loanProduct.findUnique({ where: { code: application.productCode } });
  const rate = input.interestRate ?? (product ? money(product.interestRate) : undefined);
  const decided = await decideApplication(application.publicId, {
    decision: input.decision as CreditDecision,
    approvedAmount: input.approvedAmount,
    tenorMonths: input.tenorMonths,
    interestRate: rate,
    decisionReference: input.decisionReference,
  }, trace.actorId);
  if ((input.decision === 'APPROVED' || input.decision === 'CONDITIONAL_APPROVAL') && input.approvedAmount != null && rate != null) {
    const grace = input.graceMonths ?? application.lendingCase?.graceMonths ?? product?.graceMonths ?? 0;
    const feeRate = product ? money(product.processingFeeRate) + money(product.insuranceFeeRate) + money(product.guaranteeFeeRate) : 0;
    const fees = input.fees ?? roundMoney(input.approvedAmount * feeRate / 100 + (product ? money(product.otherCharges) : 0));
    const expiry = new Date();
    expiry.setUTCDate(expiry.getUTCDate() + 14);
    await prisma.loanOffer.create({
      data: {
        publicId: await id('LOF'),
        applicationId: application.id,
        amount: decimal(input.approvedAmount),
        interestRate: decimal(rate),
        tenorMonths: input.tenorMonths ?? application.tenorMonths,
        graceMonths: grace,
        frequency: application.lendingCase?.repaymentFrequency ?? product?.repaymentFrequency ?? 'MONTHLY',
        fees: decimal(fees),
        conditions: clean(input.conditions),
        expiresOn: expiry,
      },
    });
    await notify('LOAN_OFFER_AVAILABLE', 'A loan offer is ready', `${application.lendingCase?.applicantName ?? application.school.schoolName} can accept the offer.`, application.publicId);
  }
  await recordAudit({
    trace,
    reference: application.publicId,
    entityType: 'LoanApplication',
    entityId: application.publicId,
    action: 'lending.decide',
    previousStatus: application.status,
    newStatus: decided.status,
    amount: input.approvedAmount,
    reason: input.comments,
    institution: application.institution.publicId,
  });
  return applicationFile(application.publicId);
}

export async function respondOffer(applicationId: string, input: { response: 'ACCEPTED' | 'REJECTED' | 'CHANGES'; acceptedBy?: string }, trace: Trace) {
  const application = await load(applicationId);
  const offer = application.offers[0];
  if (!offer || offer.response === 'ACCEPTED') throw errors.conflict('OFFER_CLOSED', 'There is no open offer on this application.');
  await prisma.loanOffer.update({
    where: { id: offer.id },
    data: { response: input.response, acceptedBy: clean(input.acceptedBy), acceptedAt: input.response === 'ACCEPTED' ? new Date() : null },
  });
  if (input.response === 'ACCEPTED') {
    await prisma.loanApplication.update({ where: { id: application.id }, data: { status: LoanApplicationStatus.ACCEPTANCE } });
  }
  if (input.response === 'REJECTED') {
    await prisma.loanApplication.update({ where: { id: application.id }, data: { status: LoanApplicationStatus.CANCELLED } });
    if (application.loan) await prisma.loan.update({ where: { id: application.loan.id }, data: { status: LoanStatus.CANCELLED } });
  }
  await recordAudit({ trace, reference: application.publicId, entityType: 'LoanOffer', entityId: offer.publicId, action: 'lending.offer', newStatus: input.response });
  return applicationFile(application.publicId);
}

export async function createContract(applicationId: string, input: {
  security?: string
  guarantee?: string
  defaultTerms?: string
  otherTerms?: string
  borrowerSigned: boolean
  institutionSigned: boolean
  representative?: string
}, trace: Trace) {
  const application = await load(applicationId);
  const offer = application.offers.find((item) => item.response === 'ACCEPTED');
  if (!offer || !application.loan) throw errors.conflict('OFFER_REQUIRED', 'The customer accepts the offer before the contract.');
  if (!input.borrowerSigned || !input.institutionSigned) {
    throw errors.unprocessable('SIGNATURE_REQUIRED', 'The borrower and the financial institution both sign the contract.');
  }
  const product = await prisma.loanProduct.findUnique({ where: { code: application.productCode } });
  const schedule = buildSchedule({
    principal: money(offer.amount),
    annualRate: money(offer.interestRate),
    months: offer.tenorMonths,
    graceMonths: offer.graceMonths,
    method: product?.interestMethod ?? 'DECLINING',
    fee: money(offer.fees),
    start: new Date(),
  });
  const interest = roundMoney(schedule.reduce((sum, row) => sum + row.interestDue, 0));
  const contract = await prisma.loanContract.create({
    data: {
      publicId: await id('LCT'),
      contractNumber: await id('LCT'),
      applicationId: application.id,
      loanId: application.loan.id,
      principal: offer.amount,
      interest: decimal(interest),
      fees: offer.fees,
      tenorMonths: offer.tenorMonths,
      security: clean(input.security),
      guarantee: clean(input.guarantee),
      defaultTerms: clean(input.defaultTerms) ?? 'A missed installment follows the product late-fee rule and may move the loan into collection.',
      otherTerms: clean(input.otherTerms),
      borrowerSigned: true,
      institutionSigned: true,
      representative: clean(input.representative),
      signedAt: new Date(),
    },
  });
  await prisma.lendingInstallment.deleteMany({ where: { loanId: application.loan.id } });
  for (const row of schedule) {
    await prisma.lendingInstallment.create({
      data: {
        publicId: await id('LIN'),
        loanId: application.loan.id,
        number: row.number,
        dueDate: row.dueDate,
        principalDue: decimal(row.principalDue),
        interestDue: decimal(row.interestDue),
        feesDue: decimal(row.feesDue),
        totalDue: decimal(row.totalDue),
      },
    });
  }
  await prisma.lendingPosition.upsert({
    where: { loanId: application.loan.id },
    create: { loanId: application.loan.id, nextDueDate: schedule[0]?.dueDate ?? null },
    update: { nextDueDate: schedule[0]?.dueDate ?? null },
  });
  await prisma.loanApplication.update({ where: { id: application.id }, data: { status: LoanApplicationStatus.CONTRACT } });
  await prisma.loan.update({ where: { id: application.loan.id }, data: { status: LoanStatus.CONTRACTED } });
  await notify('CONTRACT_READY', 'Loan contract is signed', contract.contractNumber, application.publicId);
  await recordAudit({ trace, reference: application.publicId, entityType: 'LoanContract', entityId: contract.publicId, action: 'lending.contract', newStatus: 'CONTRACT' });
  return applicationFile(application.publicId);
}

export async function addCollateral(applicationId: string, input: {
  collateralType: string
  description: string
  owner: string
  documentName?: string
  estimatedValue: number
  valuationDate?: string
  valuer?: string
  location?: string
  registrationNumber?: string
}, trace: Trace) {
  const application = await findApplication(applicationId);
  const row = await prisma.lendingCollateral.create({
    data: {
      publicId: await id('LCL'),
      applicationId: application.id,
      collateralType: input.collateralType,
      description: input.description.trim(),
      owner: input.owner.trim(),
      documentName: clean(input.documentName),
      estimatedValue: decimal(input.estimatedValue),
      valuationDate: day(input.valuationDate),
      valuer: clean(input.valuer),
      location: clean(input.location),
      registrationNumber: clean(input.registrationNumber),
      status: 'PROPOSED',
    },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingCollateral', entityId: row.publicId, action: 'lending.collateral', newStatus: 'PROPOSED', amount: input.estimatedValue });
  return applicationFile(application.publicId);
}

export async function markCollateral(applicationId: string, collateralId: string, status: string, trace: Trace) {
  const application = await findApplication(applicationId);
  const row = await prisma.lendingCollateral.findFirst({ where: { publicId: collateralId, applicationId: application.id } });
  if (!row) throw errors.notFound('COLLATERAL_NOT_FOUND', 'That collateral is not on this application.');
  await prisma.lendingCollateral.update({ where: { id: row.id }, data: { status } });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingCollateral', entityId: row.publicId, action: 'lending.collateral.status', previousStatus: row.status, newStatus: status });
  return applicationFile(application.publicId);
}

export async function requestGuarantee(applicationId: string, input: {
  requestedLoan: number
  requestedGuarantee: number
  facility?: string
  purpose: string
  fee?: number
}, trace: Trace) {
  const application = await findApplication(applicationId);
  if (input.requestedGuarantee > input.requestedLoan) {
    throw errors.unprocessable('GUARANTEE_INVALID', 'The guarantee cannot exceed the requested loan.');
  }
  const percentage = roundMoney((input.requestedGuarantee / input.requestedLoan) * 100);
  const row = await prisma.lendingGuaranteeRequest.create({
    data: {
      publicId: await id('LGQ'),
      applicationId: application.id,
      requestedLoan: decimal(input.requestedLoan),
      requestedGuarantee: decimal(input.requestedGuarantee),
      percentage: decimal(percentage),
      facility: clean(input.facility),
      purpose: input.purpose.trim(),
      fee: decimal(input.fee ?? 0),
    },
  });
  await prisma.loanApplication.update({
    where: { id: application.id },
    data: { guaranteeRequested: true, guaranteeAmountRequested: decimal(input.requestedGuarantee) },
  });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingGuaranteeRequest', entityId: row.publicId, action: 'lending.guarantee.request', newStatus: 'PENDING', amount: input.requestedGuarantee });
  return applicationFile(application.publicId);
}

export async function decideGuarantee(applicationId: string, requestId: string, decision: string, trace: Trace) {
  const application = await findApplication(applicationId);
  const row = await prisma.lendingGuaranteeRequest.findFirst({ where: { publicId: requestId, applicationId: application.id } });
  if (!row) throw errors.notFound('GUARANTEE_REQUEST_NOT_FOUND', 'That guarantee request is not on this application.');
  await prisma.lendingGuaranteeRequest.update({ where: { id: row.id }, data: { decision } });
  await recordAudit({ trace, reference: application.publicId, entityType: 'LendingGuaranteeRequest', entityId: row.publicId, action: 'lending.guarantee.decide', previousStatus: row.decision, newStatus: decision });
  return applicationFile(application.publicId);
}
