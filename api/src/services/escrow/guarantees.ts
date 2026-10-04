import { errors } from '../../utils/errors';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import { decideGuarantee, requestGuarantee } from '../guarantees.service';
import {
  actorLabel,
  assertAmount,
  assertDual,
  clean,
  coverageOf,
  dateOnly,
  day,
  dayRequired,
  figures,
  findAccount,
  findAsset,
  findFacility,
  findGroup,
  findSecurityApplication,
  findSecurityGuarantee,
  id,
  notify,
  optionalInstitution,
  optionalLoanApplication,
  optionalSchool,
  recordAudit,
  roundMoney,
  type Trace,
} from './shared';

export function exposureOf(row: { maximumLiability: { toString(): string }; guaranteePercent: { toString(): string }; claimsPaid: { toString(): string }; recoveries: { toString(): string } }, loanOutstanding: number | null) {
  const cap = money(row.maximumLiability as never);
  const percent = Number(row.guaranteePercent);
  const base = loanOutstanding == null ? cap : Math.min(cap, roundMoney(loanOutstanding * percent / 100));
  const remaining = Math.max(0, Math.min(base, roundMoney(base - money(row.claimsPaid as never) + money(row.recoveries as never))));
  return { original: cap, current: base, remaining, claimsPaid: money(row.claimsPaid as never), recoveries: money(row.recoveries as never) };
}

async function loanOutstanding(publicId?: string | null) {
  if (!publicId) return null;
  const loan = await prisma.loan.findUnique({ where: { publicId } });
  return loan ? money(loan.principalOutstanding) : null;
}

async function facilityRoom(facilityId: string, exceptGuaranteeId?: string) {
  const facility = await prisma.securityFacility.findUniqueOrThrow({ where: { id: facilityId }, include: { guarantees: true } });
  let used = 0;
  for (const guarantee of facility.guarantees) {
    if (exceptGuaranteeId && guarantee.id === exceptGuaranteeId) continue;
    if (['CLOSED', 'CANCELLED'].includes(guarantee.status)) continue;
    used += exposureOf(guarantee, await loanOutstanding(guarantee.loanPublicId)).remaining;
  }
  return { facility, used: roundMoney(used), available: roundMoney(money(facility.approvedLimit) - used) };
}

export async function listFacilities() {
  const rows = await prisma.securityFacility.findMany({ include: { group: true, institution: true, guarantees: true }, orderBy: { createdAt: 'desc' } });
  const items = [];
  for (const row of rows) {
    const room = await facilityRoom(row.id);
    items.push({
      facilityId: row.publicId,
      facilityNumber: row.facilityNumber,
      name: row.name,
      institutionName: row.institution?.name ?? null,
      groupId: row.group?.publicId ?? null,
      groupName: row.group?.name ?? null,
      facilityType: row.facilityType,
      approvedLimit: money(row.approvedLimit),
      currency: row.currency,
      guaranteePercent: Number(row.guaranteePercent),
      maximumAmount: money(row.maximumAmount),
      utilized: room.used,
      available: room.available,
      feeRate: Number(row.feeRate),
      effectiveDate: dateOnly(row.effectiveDate),
      expiryDate: dateOnly(row.expiryDate),
      status: row.status,
      dualAuthorization: row.dualAuthorization,
    });
  }
  return items;
}

export async function createFacility(input: {
  name: string;
  facilityType: string;
  institutionId?: string;
  groupId?: string;
  approvedLimit: number;
  currency?: string;
  guaranteePercent: number;
  maximumAmount: number;
  feeRate?: number;
  effectiveDate: string;
  expiryDate?: string;
  terms?: string;
  dualAuthorization?: boolean;
  mode?: 'draft' | 'active';
}, trace: Trace) {
  const institution = await optionalInstitution(input.institutionId);
  const group = input.groupId ? await findGroup(input.groupId) : null;
  const limit = assertAmount(input.approvedLimit, 'Approved limit');
  const maximum = assertAmount(input.maximumAmount, 'Maximum guarantee');
  if (maximum > limit) throw errors.unprocessable('LIMIT_EXCEEDED', 'The maximum guarantee cannot exceed the facility limit.');
  const publicId = await id('SFC');
  const row = await prisma.securityFacility.create({
    data: {
      publicId,
      facilityNumber: publicId,
      name: input.name.trim(),
      institutionId: institution?.id,
      groupId: group?.id,
      facilityType: input.facilityType,
      approvedLimit: decimal(limit),
      currency: (input.currency ?? 'RWF').toUpperCase(),
      guaranteePercent: decimal(input.guaranteePercent),
      maximumAmount: decimal(maximum),
      feeRate: decimal(input.feeRate ?? 0),
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      expiryDate: day(input.expiryDate),
      terms: clean(input.terms),
      dualAuthorization: input.dualAuthorization ?? false,
      status: input.mode === 'active' ? 'ACTIVE' : 'DRAFT',
    },
  });
  await recordAudit({ trace, entityType: 'SecurityFacility', entityId: row.publicId, action: 'facility.create', newStatus: row.status, amount: limit });
  return listFacilities();
}

export async function setFacilityStatus(facilityId: string, status: string, trace: Trace) {
  const facility = await findFacility(facilityId);
  const allowed = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED'];
  if (!allowed.includes(status)) throw errors.badRequest('Choose a facility status from the register.');
  await prisma.securityFacility.update({ where: { id: facility.id }, data: { status } });
  await recordAudit({ trace, entityType: 'SecurityFacility', entityId: facility.publicId, action: 'facility.status', previousStatus: facility.status, newStatus: status });
  return listFacilities();
}

export async function listApplications() {
  const rows = await prisma.securityApplication.findMany({ include: { group: true, facility: true, decision: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    applicationId: row.publicId,
    applicant: row.applicant,
    groupId: row.group?.publicId ?? null,
    groupName: row.group?.name ?? null,
    facilityId: row.facility?.publicId ?? null,
    requestedLoan: money(row.requestedLoan),
    requestedGuarantee: money(row.requestedGuarantee),
    guaranteePercent: Number(row.guaranteePercent),
    purpose: row.purpose,
    status: row.status,
    decision: row.decision?.decision ?? null,
    requestedDate: dateOnly(row.requestedDate),
  }));
}

export async function createApplication(input: {
  applicant: string;
  groupId?: string;
  schoolId?: string;
  loanApplicationId?: string;
  product?: string;
  requestedLoan: number;
  requestedGuarantee: number;
  guaranteePercent: number;
  purpose: string;
  facilityId?: string;
  assetId?: string;
  accountId?: string;
  contribution?: number;
  riskInformation?: string;
  requestedDate: string;
}, trace: Trace) {
  const group = input.groupId ? await findGroup(input.groupId) : null;
  const school = await optionalSchool(input.schoolId);
  const loanApplication = await optionalLoanApplication(input.loanApplicationId);
  const facility = input.facilityId ? await findFacility(input.facilityId) : null;
  const asset = input.assetId ? await findAsset(input.assetId) : null;
  const account = input.accountId ? await findAccount(input.accountId) : null;
  const requestedLoan = assertAmount(input.requestedLoan, 'Requested loan');
  const requestedGuarantee = assertAmount(input.requestedGuarantee, 'Requested guarantee');
  if (facility && facility.status !== 'ACTIVE') throw errors.unprocessable('FACILITY_INACTIVE', 'The guarantee facility must be active.');
  if (facility && requestedGuarantee > money(facility.maximumAmount)) {
    throw errors.unprocessable('FACILITY_CAP', 'The requested guarantee is above the facility maximum.');
  }
  const row = await prisma.securityApplication.create({
    data: {
      publicId: await id('SGA'),
      applicant: input.applicant.trim(),
      groupId: group?.id,
      schoolId: school?.id ?? group?.schoolId ?? loanApplication?.schoolId ?? null,
      loanApplicationId: loanApplication?.id,
      product: clean(input.product) ?? loanApplication?.productCode ?? null,
      requestedLoan: decimal(requestedLoan),
      requestedGuarantee: decimal(requestedGuarantee),
      guaranteePercent: decimal(input.guaranteePercent),
      purpose: input.purpose.trim(),
      facilityId: facility?.id,
      assetId: asset?.id,
      accountId: account?.id,
      contribution: decimal(input.contribution ?? 0),
      riskInformation: clean(input.riskInformation),
      requestedDate: dayRequired(input.requestedDate, 'Requested date'),
      status: 'SUBMITTED',
      requestedById: trace.actorId,
    },
  });
  await recordAudit({ trace, entityType: 'SecurityApplication', entityId: row.publicId, action: 'guarantee.apply', newStatus: 'SUBMITTED', amount: requestedGuarantee });
  return applicationFile(row.publicId);
}

export async function runEligibility(applicationId: string, trace: Trace) {
  const application = await findSecurityApplication(applicationId);
  const group = application.groupId ? await prisma.escrowGroup.findUnique({ where: { id: application.groupId }, include: { members: true } }) : null;
  const account = application.account;
  const position = account ? figures(account) : null;
  const guarantees = application.groupId
    ? await prisma.securityGuarantee.findMany({ where: { groupId: application.groupId, status: { notIn: ['CLOSED', 'CANCELLED'] } } })
    : [];
  const existingGuarantee = roundMoney(guarantees.reduce((sum, row) => sum + exposureOf(row, null).remaining, 0));
  const loans = application.schoolId
    ? await prisma.loan.findMany({ where: { application: { schoolId: application.schoolId }, status: { in: ['ACTIVE', 'IN_ARREARS', 'RECOVERY', 'CONTRACTED'] } } })
    : [];
  const existingLoan = roundMoney(loans.reduce((sum, row) => sum + money(row.principalOutstanding), 0));
  const facility = application.facility;
  const room = facility ? await facilityRoom(facility.id) : null;
  const membershipOk = !group || group.membershipStatus === 'ACTIVE';
  const contributionOk = !account || money(account.contributions) > 0 || money(account.requiredContribution) === 0;
  const escrowOk = !account || (position != null && position.closing + 0.001 >= money(account.requiredContribution));
  const collateralOk = !application.asset || !['PROPOSED'].includes(application.asset.status) || application.asset.countsAsCollateral;
  const withinLimit = !room || money(application.requestedGuarantee) <= room.available + 0.001;
  const result = membershipOk && contributionOk && escrowOk && withinLimit ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
  const officer = await actorLabel(trace.actorId);
  await prisma.securityEligibility.upsert({
    where: { applicationId: application.id },
    create: {
      publicId: await id('SEL'),
      applicationId: application.id,
      applicantEligibility: membershipOk,
      membershipStatus: group?.membershipStatus ?? 'UNLINKED',
      contributionStatus: contributionOk ? 'MET' : 'SHORT',
      escrowRequirementMet: escrowOk,
      loanEligibility: Boolean(application.loanApplicationId) || loans.length >= 0,
      collateralRequirement: collateralOk,
      financialCriteria: escrowOk,
      existingGuarantee: decimal(existingGuarantee),
      existingLoan: decimal(existingLoan),
      groupExposure: decimal(existingGuarantee),
      concentrationLimit: decimal(room?.facility ? money(room.facility.approvedLimit) : 0),
      result,
      reviewer: officer,
      reviewedAt: new Date(),
      notes: withinLimit ? null : 'The request is above the facility capacity.',
    },
    update: {
      applicantEligibility: membershipOk,
      membershipStatus: group?.membershipStatus ?? 'UNLINKED',
      contributionStatus: contributionOk ? 'MET' : 'SHORT',
      escrowRequirementMet: escrowOk,
      collateralRequirement: collateralOk,
      financialCriteria: escrowOk,
      existingGuarantee: decimal(existingGuarantee),
      existingLoan: decimal(existingLoan),
      groupExposure: decimal(existingGuarantee),
      concentrationLimit: decimal(room?.facility ? money(room.facility.approvedLimit) : 0),
      result,
      reviewer: officer,
      reviewedAt: new Date(),
    },
  });
  await prisma.securityApplication.update({ where: { id: application.id }, data: { status: 'UNDER_REVIEW' } });
  await recordAudit({ trace, entityType: 'SecurityApplication', entityId: application.publicId, action: 'guarantee.eligibility', previousStatus: application.status, newStatus: result });
  return applicationFile(application.publicId);
}

export async function assessApplication(applicationId: string, input: {
  repaymentCapacity?: string;
  riskFactors?: string;
  mitigation?: string;
  recommended: number;
  conditions?: string;
  result: string;
}, trace: Trace) {
  const application = await findSecurityApplication(applicationId);
  const recommended = assertAmount(input.recommended, 'Recommended guarantee');
  if (recommended > money(application.requestedGuarantee)) {
    throw errors.unprocessable('ABOVE_REQUEST', 'The recommended guarantee cannot exceed the amount requested.');
  }
  const account = application.account ? figures(application.account) : null;
  const collateral = application.asset && application.asset.countsAsCollateral
    ? Math.max(0, money(application.asset.marketValue) * Number(application.asset.haircutPercent) / 100 - money(application.asset.encumbrance))
    : 0;
  const officer = await actorLabel(trace.actorId);
  await prisma.securityAssessment.upsert({
    where: { applicationId: application.id },
    create: {
      publicId: await id('SAS'),
      applicationId: application.id,
      loanAmount: application.requestedLoan,
      requestedGuarantee: application.requestedGuarantee,
      existingExposure: decimal(0),
      escrowBalance: decimal(account?.closing ?? 0),
      collateralValue: decimal(collateral),
      repaymentCapacity: clean(input.repaymentCapacity),
      riskFactors: clean(input.riskFactors),
      mitigation: clean(input.mitigation),
      recommended: decimal(recommended),
      conditions: clean(input.conditions),
      result: input.result,
      assessor: officer,
      assessedAt: new Date(),
    },
    update: {
      escrowBalance: decimal(account?.closing ?? 0),
      collateralValue: decimal(collateral),
      repaymentCapacity: clean(input.repaymentCapacity),
      riskFactors: clean(input.riskFactors),
      mitigation: clean(input.mitigation),
      recommended: decimal(recommended),
      conditions: clean(input.conditions),
      result: input.result,
      assessor: officer,
      assessedAt: new Date(),
    },
  });
  await recordAudit({ trace, entityType: 'SecurityApplication', entityId: application.publicId, action: 'guarantee.assess', amount: recommended, newStatus: input.result });
  return applicationFile(application.publicId);
}

export async function decideApplication(applicationId: string, input: {
  decision: 'APPROVED' | 'DECLINED' | 'CONDITIONAL_APPROVAL' | 'MORE_INFORMATION_REQUIRED' | 'CANCELLED';
  approvedAmount?: number;
  guaranteePercent?: number;
  fee?: number;
  effectiveDate?: string;
  expiryDate?: string;
  conditions?: string;
  reference?: string;
}, trace: Trace) {
  const application = await findSecurityApplication(applicationId);
  if (application.facility) assertDual(application.facility.dualAuthorization, application.requestedById, trace.actorId);
  const approved = input.decision === 'APPROVED' || input.decision === 'CONDITIONAL_APPROVAL'
    ? assertAmount(input.approvedAmount ?? money(application.requestedGuarantee), 'Approved guarantee')
    : 0;
  if (application.assessment && approved > money(application.assessment.recommended) + 0.001) {
    throw errors.unprocessable('ABOVE_ASSESSMENT', 'The approved guarantee cannot exceed the assessed recommendation.');
  }
  if (application.facility && approved > 0) {
    const room = await facilityRoom(application.facility.id);
    if (approved > room.available + 0.001) throw errors.unprocessable('FACILITY_CAPACITY', 'The facility does not have enough available capacity.');
    if (approved > money(application.facility.maximumAmount)) throw errors.unprocessable('FACILITY_CAP', 'The approved guarantee is above the facility maximum.');
  }
  const percent = input.guaranteePercent ?? Number(application.guaranteePercent);
  const fee = input.fee ?? (application.facility ? roundMoney(approved * Number(application.facility.feeRate) / 100) : 0);
  const officer = await actorLabel(trace.actorId);
  await prisma.securityDecision.upsert({
    where: { applicationId: application.id },
    create: {
      publicId: await id('SDC'),
      applicationId: application.id,
      facilityId: application.facility?.publicId,
      requestedAmount: application.requestedGuarantee,
      approvedAmount: decimal(approved),
      guaranteePercent: decimal(percent),
      fee: decimal(fee),
      effectiveDate: day(input.effectiveDate),
      expiryDate: day(input.expiryDate),
      conditions: clean(input.conditions),
      decision: input.decision,
      decisionMaker: officer,
      decisionMakerId: trace.actorId,
      institutionName: application.facility?.institutionId ?? null,
      decisionDate: new Date(),
      reference: clean(input.reference),
    },
    update: {
      approvedAmount: decimal(approved),
      guaranteePercent: decimal(percent),
      fee: decimal(fee),
      effectiveDate: day(input.effectiveDate),
      expiryDate: day(input.expiryDate),
      conditions: clean(input.conditions),
      decision: input.decision,
      decisionMaker: officer,
      decisionMakerId: trace.actorId,
      decisionDate: new Date(),
      reference: clean(input.reference),
    },
  });
  const status = input.decision === 'APPROVED' || input.decision === 'CONDITIONAL_APPROVAL' ? 'APPROVED' : input.decision;
  await prisma.securityApplication.update({ where: { id: application.id }, data: { status } });
  await recordAudit({ trace, entityType: 'SecurityApplication', entityId: application.publicId, action: 'guarantee.decide', previousStatus: application.status, newStatus: status, amount: approved });
  if (status === 'APPROVED') await notify('Guarantee approved', `Application ${application.publicId}`, `The guarantee decision is ${input.decision}. The certificate is issued as a separate step.`, trace.actorId);
  return applicationFile(application.publicId);
}

export async function issueGuarantee(applicationId: string, input: { signatory?: string; claimConditions?: string }, trace: Trace) {
  const application = await findSecurityApplication(applicationId);
  if (!application.decision || !['APPROVED', 'CONDITIONAL_APPROVAL'].includes(application.decision.decision)) {
    throw errors.unprocessable('DECISION_REQUIRED', 'Issue a certificate only after an approved decision.');
  }
  if (application.guarantee) throw errors.unprocessable('ALREADY_ISSUED', 'This application already has a guarantee.');
  if (application.facility) assertDual(application.facility.dualAuthorization, application.decision.decisionMakerId, trace.actorId);
  const approved = money(application.decision.approvedAmount);
  const percent = Number(application.decision.guaranteePercent);
  const officer = await actorLabel(trace.actorId);
  const guaranteePublicId = await id('SGT');
  const certificatePublicId = await id('SCT');
  const created = await prisma.$transaction(async (tx) => {
    const guarantee = await tx.securityGuarantee.create({
      data: {
        publicId: guaranteePublicId,
        certificateNumber: certificatePublicId,
        facilityId: application.facilityId,
        applicationId: application.id,
        applicant: application.applicant,
        groupId: application.groupId,
        schoolId: application.schoolId,
        institutionId: application.facility?.institutionId,
        loanApplicationId: application.loanApplicationId,
        guaranteedPrincipal: decimal(approved),
        guaranteePercent: decimal(percent),
        maximumLiability: decimal(approved),
        fee: application.decision?.fee ?? decimal(0),
        effectiveDate: application.decision?.effectiveDate ?? new Date(),
        expiryDate: application.decision?.expiryDate,
        conditions: application.decision?.conditions,
        assetId: application.assetId,
        accountId: application.accountId,
        status: 'ACTIVE',
      },
    });
    await tx.securityCertificate.create({
      data: {
        publicId: certificatePublicId,
        certificateNumber: certificatePublicId,
        guaranteeId: guarantee.id,
        applicant: application.applicant,
        groupName: application.group?.name,
        lender: null,
        guaranteedAmount: decimal(approved),
        guaranteePercent: decimal(percent),
        originalLoanAmount: application.requestedLoan,
        effectiveDate: guarantee.effectiveDate,
        expiryDate: guarantee.expiryDate,
        conditions: guarantee.conditions,
        claimConditions: clean(input.claimConditions) ?? 'A claim requires a verified default and an outstanding amount within the guarantee percentage.',
        signatory: clean(input.signatory) ?? officer,
        signature: `System:${certificatePublicId}`,
      },
    });
    await tx.securityApplication.update({ where: { id: application.id }, data: { status: 'ISSUED' } });
    if (application.assetId) await tx.collateralAsset.update({ where: { id: application.assetId }, data: { status: 'PLEDGED', lienStatus: 'PLEDGED' } });
    return guarantee;
  });
  let legacyGuaranteeId: string | null = null;
  if (application.loanApplicationId && application.facility?.institutionId) {
    const loanApplication = await prisma.loanApplication.findUnique({ where: { id: application.loanApplicationId }, include: { institution: true, school: true } });
    if (loanApplication) {
      try {
        const requested = await requestGuarantee({
          loanApplicationId: loanApplication.publicId,
          schoolId: loanApplication.school.publicId,
          financialInstitutionId: loanApplication.institution.publicId,
          loanAmount: money(application.requestedLoan),
          guaranteeAmount: approved,
          currency: application.facility?.currency ?? 'RWF',
        }, trace.actorId);
        await decideGuarantee(requested.guaranteeId, {
          decision: 'APPROVED',
          guaranteedAmount: approved,
          expiryDate: dateOnly(created.expiryDate) ?? undefined,
        }, trace.actorId);
        legacyGuaranteeId = requested.guaranteeId;
        await prisma.securityGuarantee.update({ where: { id: created.id }, data: { legacyGuaranteeId } });
      } catch {
        legacyGuaranteeId = null;
      }
    }
  }
  await recordAudit({ trace, entityType: 'SecurityGuarantee', entityId: created.publicId, action: 'guarantee.issue', newStatus: 'ACTIVE', amount: approved, approvalReference: certificatePublicId });
  await notify('Guarantee certificate issued', `Certificate ${certificatePublicId}`, `Guarantee ${created.publicId} is active for ${application.applicant}.`, trace.actorId);
  return guaranteeFile(created.publicId);
}

export async function listGuarantees() {
  const rows = await prisma.securityGuarantee.findMany({ include: { group: true, facility: true, certificate: true }, orderBy: { createdAt: 'desc' } });
  const items = [];
  for (const row of rows) {
    const exposure = exposureOf(row, await loanOutstanding(row.loanPublicId));
    items.push({
      guaranteeId: row.publicId,
      certificateNumber: row.certificate?.certificateNumber ?? row.certificateNumber,
      applicant: row.applicant,
      groupId: row.group?.publicId ?? null,
      groupName: row.group?.name ?? null,
      facilityId: row.facility?.publicId ?? null,
      guaranteedPrincipal: money(row.guaranteedPrincipal),
      guaranteePercent: Number(row.guaranteePercent),
      maximumLiability: exposure.original,
      currentExposure: exposure.remaining,
      claimsPaid: exposure.claimsPaid,
      recoveries: exposure.recoveries,
      effectiveDate: dateOnly(row.effectiveDate),
      expiryDate: dateOnly(row.expiryDate),
      status: row.status,
      legacyGuaranteeId: row.legacyGuaranteeId,
    });
  }
  return items;
}

export async function addFee(guaranteeId: string, input: { feeType: string; rate: number; baseAmount: number; dueDate?: string; waiver?: boolean; approval?: string }, trace: Trace) {
  const guarantee = await findSecurityGuarantee(guaranteeId);
  const base = assertAmount(input.baseAmount, 'Fee base');
  const calculated = input.waiver ? 0 : roundMoney(base * input.rate / 100);
  const row = await prisma.securityFee.create({
    data: {
      publicId: await id('SFE'),
      guaranteeId: guarantee.id,
      feeType: input.feeType,
      rate: decimal(input.rate),
      baseAmount: decimal(base),
      calculatedFee: decimal(calculated),
      dueDate: day(input.dueDate),
      paymentStatus: input.waiver ? 'WAIVED' : 'DUE',
      waiver: Boolean(input.waiver),
      approval: clean(input.approval),
    },
  });
  await recordAudit({ trace, entityType: 'SecurityFee', entityId: row.publicId, action: 'guarantee.fee', amount: calculated });
  return guaranteeFile(guarantee.publicId);
}

export async function renewGuarantee(guaranteeId: string, input: { requestedExpiry: string; renewalFee?: number; reason: string; approval?: string }, trace: Trace) {
  const guarantee = await findSecurityGuarantee(guaranteeId);
  if (['CLOSED', 'CANCELLED', 'PAID'].includes(guarantee.status)) throw errors.unprocessable('GUARANTEE_CLOSED', 'A closed guarantee cannot be renewed.');
  const expiry = dayRequired(input.requestedExpiry, 'New expiry');
  const exposure = exposureOf(guarantee, await loanOutstanding(guarantee.loanPublicId));
  const account = guarantee.account ? figures(guarantee.account) : null;
  const collateral = guarantee.asset && guarantee.asset.countsAsCollateral ? money(guarantee.asset.marketValue) : 0;
  const row = await prisma.securityRenewal.create({
    data: {
      publicId: await id('SRN'),
      guaranteeId: guarantee.id,
      currentExpiry: guarantee.expiryDate,
      requestedExpiry: expiry,
      currentExposure: decimal(exposure.remaining),
      updatedExposure: decimal(exposure.remaining),
      updatedCollateral: decimal(collateral),
      updatedEscrow: decimal(account?.available ?? 0),
      renewalFee: decimal(input.renewalFee ?? 0),
      reason: input.reason.trim(),
      approval: clean(input.approval),
      requestedById: trace.actorId,
      newCertificate: guarantee.certificateNumber,
    },
  });
  if (clean(input.approval)) {
    await prisma.securityGuarantee.update({ where: { id: guarantee.id }, data: { expiryDate: expiry, status: 'ACTIVE' } });
  }
  await recordAudit({ trace, entityType: 'SecurityRenewal', entityId: row.publicId, action: 'guarantee.renew', amount: exposure.remaining });
  return guaranteeFile(guarantee.publicId);
}

export async function amendGuarantee(guaranteeId: string, input: { requestedChange: string; newAmount?: number; newExpiry?: string; newPercent?: number; reason: string; approval?: string; effectiveDate: string }, trace: Trace) {
  const guarantee = await findSecurityGuarantee(guaranteeId);
  const row = await prisma.securityAmendment.create({
    data: {
      publicId: await id('SAM'),
      guaranteeId: guarantee.id,
      originalTerms: `${money(guarantee.maximumLiability)} at ${Number(guarantee.guaranteePercent)}% until ${dateOnly(guarantee.expiryDate) ?? 'open'}`,
      requestedChange: input.requestedChange.trim(),
      newAmount: input.newAmount == null ? null : decimal(input.newAmount),
      newExpiry: day(input.newExpiry),
      newPercent: input.newPercent == null ? null : decimal(input.newPercent),
      reason: input.reason.trim(),
      approval: clean(input.approval),
      requestedById: trace.actorId,
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
    },
  });
  if (clean(input.approval)) {
    if (guarantee.facilityId && input.newAmount != null) {
      const room = await facilityRoom(guarantee.facilityId, guarantee.id);
      if (input.newAmount > room.available + money(guarantee.maximumLiability) + 0.001) {
        throw errors.unprocessable('FACILITY_CAPACITY', 'The amended amount does not fit the facility.');
      }
    }
    await prisma.securityGuarantee.update({
      where: { id: guarantee.id },
      data: {
        maximumLiability: input.newAmount == null ? undefined : decimal(input.newAmount),
        guaranteedPrincipal: input.newAmount == null ? undefined : decimal(input.newAmount),
        guaranteePercent: input.newPercent == null ? undefined : decimal(input.newPercent),
        expiryDate: day(input.newExpiry) ?? undefined,
      },
    });
  }
  await recordAudit({ trace, entityType: 'SecurityAmendment', entityId: row.publicId, action: 'guarantee.amend', amount: input.newAmount ?? null, reason: input.reason });
  return guaranteeFile(guarantee.publicId);
}

export async function cancelGuarantee(guaranteeId: string, input: { reason: string; document?: string }, trace: Trace) {
  const guarantee = await findSecurityGuarantee(guaranteeId);
  const openClaims = await prisma.securityClaim.count({ where: { guaranteeId: guarantee.id, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'] } } });
  if (openClaims) throw errors.unprocessable('CLAIM_OPEN', 'Finish the open claims before cancelling the guarantee.');
  const exposure = exposureOf(guarantee, await loanOutstanding(guarantee.loanPublicId));
  const officer = await actorLabel(trace.actorId);
  await prisma.securityCancellation.create({
    data: {
      publicId: await id('SCX'),
      guaranteeId: guarantee.id,
      reason: input.reason.trim(),
      currentExposure: decimal(exposure.remaining),
      unusedGuarantee: decimal(exposure.remaining),
      claims: decimal(exposure.claimsPaid),
      recovery: decimal(exposure.recoveries),
      document: clean(input.document),
      requestedBy: officer,
      requestedById: trace.actorId,
      approvedBy: officer,
      cancellationDate: new Date(),
    },
  });
  await prisma.securityGuarantee.update({ where: { id: guarantee.id }, data: { status: 'CLOSED' } });
  await recordAudit({ trace, entityType: 'SecurityGuarantee', entityId: guarantee.publicId, action: 'guarantee.cancel', previousStatus: guarantee.status, newStatus: 'CLOSED', reason: input.reason, amount: exposure.remaining });
  return guaranteeFile(guarantee.publicId);
}

export async function applicationFile(publicId: string) {
  const row = await findSecurityApplication(publicId);
  return {
    applicationId: row.publicId,
    applicant: row.applicant,
    groupId: row.group?.publicId ?? null,
    groupName: row.group?.name ?? null,
    facilityId: row.facility?.publicId ?? null,
    facilityName: row.facility?.name ?? null,
    accountId: row.account?.publicId ?? null,
    assetId: row.asset?.publicId ?? null,
    product: row.product,
    requestedLoan: money(row.requestedLoan),
    requestedGuarantee: money(row.requestedGuarantee),
    guaranteePercent: Number(row.guaranteePercent),
    purpose: row.purpose,
    contribution: money(row.contribution),
    riskInformation: row.riskInformation,
    requestedDate: dateOnly(row.requestedDate),
    status: row.status,
    eligibility: row.eligibility ? {
      result: row.eligibility.result,
      membershipStatus: row.eligibility.membershipStatus,
      contributionStatus: row.eligibility.contributionStatus,
      escrowRequirementMet: row.eligibility.escrowRequirementMet,
      collateralRequirement: row.eligibility.collateralRequirement,
      existingGuarantee: money(row.eligibility.existingGuarantee),
      existingLoan: money(row.eligibility.existingLoan),
      groupExposure: money(row.eligibility.groupExposure),
      reviewer: row.eligibility.reviewer,
      notes: row.eligibility.notes,
    } : null,
    assessment: row.assessment ? {
      recommended: money(row.assessment.recommended),
      escrowBalance: money(row.assessment.escrowBalance),
      collateralValue: money(row.assessment.collateralValue),
      repaymentCapacity: row.assessment.repaymentCapacity,
      riskFactors: row.assessment.riskFactors,
      mitigation: row.assessment.mitigation,
      conditions: row.assessment.conditions,
      result: row.assessment.result,
      assessor: row.assessment.assessor,
    } : null,
    decision: row.decision ? {
      decision: row.decision.decision,
      approvedAmount: money(row.decision.approvedAmount),
      guaranteePercent: Number(row.decision.guaranteePercent),
      fee: money(row.decision.fee),
      conditions: row.decision.conditions,
      decisionMaker: row.decision.decisionMaker,
      reference: row.decision.reference,
      effectiveDate: dateOnly(row.decision.effectiveDate),
      expiryDate: dateOnly(row.decision.expiryDate),
    } : null,
  };
}

export async function guaranteeFile(publicId: string) {
  const row = await prisma.securityGuarantee.findUnique({
    where: { publicId },
    include: {
      facility: true,
      group: true,
      account: true,
      asset: true,
      certificate: true,
      fees: { orderBy: { createdAt: 'desc' } },
      renewals: { orderBy: { createdAt: 'desc' } },
      amendments: { orderBy: { createdAt: 'desc' } },
      claims: { orderBy: { createdAt: 'desc' } },
      cancellation: true,
    },
  });
  if (!row) throw errors.notFound('GUARANTEE_NOT_FOUND', 'The guarantee could not be found.');
  const outstanding = await loanOutstanding(row.loanPublicId);
  const exposure = exposureOf(row, outstanding);
  const escrow = row.account ? figures(row.account) : null;
  const collateral = row.asset && row.asset.countsAsCollateral
    ? Math.max(0, money(row.asset.marketValue) * Number(row.asset.haircutPercent) / 100 - money(row.asset.encumbrance))
    : 0;
  const room = row.facilityId ? await facilityRoom(row.facilityId) : null;
  return {
    guaranteeId: row.publicId,
    certificateNumber: row.certificate?.certificateNumber ?? null,
    applicant: row.applicant,
    groupId: row.group?.publicId ?? null,
    groupName: row.group?.name ?? null,
    facilityId: row.facility?.publicId ?? null,
    facilityName: row.facility?.name ?? null,
    accountId: row.account?.publicId ?? null,
    assetId: row.asset?.publicId ?? null,
    loanPublicId: row.loanPublicId,
    guaranteedPrincipal: money(row.guaranteedPrincipal),
    guaranteePercent: Number(row.guaranteePercent),
    maximumLiability: exposure.original,
    loanOutstanding: outstanding,
    currentExposure: exposure.remaining,
    claimsPaid: exposure.claimsPaid,
    recoveries: exposure.recoveries,
    fee: money(row.fee),
    effectiveDate: dateOnly(row.effectiveDate),
    expiryDate: dateOnly(row.expiryDate),
    conditions: row.conditions,
    status: row.status,
    legacyGuaranteeId: row.legacyGuaranteeId,
    availableFacility: room?.available ?? null,
    certificate: row.certificate ? {
      certificateId: row.certificate.publicId,
      certificateNumber: row.certificate.certificateNumber,
      guaranteedAmount: money(row.certificate.guaranteedAmount),
      guaranteePercent: Number(row.certificate.guaranteePercent),
      originalLoanAmount: money(row.certificate.originalLoanAmount),
      lender: row.certificate.lender,
      conditions: row.certificate.conditions,
      claimConditions: row.certificate.claimConditions,
      signatory: row.certificate.signatory,
      effectiveDate: dateOnly(row.certificate.effectiveDate),
      expiryDate: dateOnly(row.certificate.expiryDate),
    } : null,
    coverage: coverageOf({
      exposure: outstanding ?? exposure.remaining,
      escrowAvailable: escrow?.available ?? 0,
      eligibleCollateral: collateral,
      guaranteeCoverage: exposure.remaining,
    }),
    fees: row.fees.map((item) => ({ feeId: item.publicId, feeType: item.feeType, rate: Number(item.rate), baseAmount: money(item.baseAmount), calculatedFee: money(item.calculatedFee), paymentStatus: item.paymentStatus, waiver: item.waiver })),
    renewals: row.renewals.map((item) => ({ renewalId: item.publicId, requestedExpiry: dateOnly(item.requestedExpiry), reason: item.reason, approval: item.approval, renewalFee: money(item.renewalFee) })),
    amendments: row.amendments.map((item) => ({ amendmentId: item.publicId, requestedChange: item.requestedChange, newAmount: item.newAmount == null ? null : money(item.newAmount), reason: item.reason, approval: item.approval })),
    claims: row.claims.map((item) => ({ claimId: item.publicId, amountClaimed: money(item.amountClaimed), approvedAmount: money(item.approvedAmount), status: item.status, borrower: item.borrower })),
    cancellation: row.cancellation ? { cancellationId: row.cancellation.publicId, reason: row.cancellation.reason, cancellationDate: dateOnly(row.cancellation.cancellationDate) } : null,
  };
}
