import { GuaranteeDecision, GuaranteeStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { add, decimal, money, sub } from '../utils/money';
import { prisma } from '../utils/prisma';
import { findApplication, findLoan } from './loans.service';
import { findSchool } from './schools.service';

export async function requestGuarantee(input: {
  loanApplicationId: string;
  schoolId: string;
  financialInstitutionId: string;
  loanAmount: number;
  guaranteeAmount: number;
  currency?: string;
}, actorId?: string) {
  const application = await findApplication(input.loanApplicationId);
  const school = await findSchool(input.schoolId);
  const institution = await prisma.financialInstitution.findUnique({
    where: { publicId: input.financialInstitutionId },
  });
  if (!institution) {
    throw errors.notFound('INSTITUTION_NOT_FOUND', 'The requested financial institution could not be found.');
  }

  const facility = await prisma.guaranteeFacility.findFirst();
  const guarantee = await prisma.guarantee.create({
    data: {
      publicId: await nextPublicId('GUA'),
      loanApplicationId: application.id,
      schoolId: school.id,
      financialInstitutionId: institution.id,
      facilityId: facility?.id,
      loanAmount: decimal(input.loanAmount),
      guaranteeAmount: decimal(input.guaranteeAmount),
      currency: input.currency ?? 'RWF',
      status: GuaranteeStatus.REQUESTED,
    },
  });

  await writeAudit({
    actorId,
    action: 'guarantee.request',
    entityType: 'Guarantee',
    entityId: guarantee.publicId,
  });

  return {
    guaranteeId: guarantee.publicId,
    status: guarantee.status,
    guaranteeAmount: money(guarantee.guaranteeAmount),
    currency: guarantee.currency,
  };
}

export async function decideGuarantee(guaranteeId: string, input: {
  decision: GuaranteeDecision;
  guaranteedAmount?: number;
  expiryDate?: string;
}, actorId?: string) {
  const guarantee = await findGuarantee(guaranteeId);
  const approved = input.decision === GuaranteeDecision.APPROVED;
  const amount = decimal(input.guaranteedAmount ?? money(guarantee.guaranteeAmount));

  const updated = await prisma.$transaction(async (tx) => {
    if (approved) {
      const facility = guarantee.facilityId
        ? await tx.guaranteeFacility.findUnique({ where: { id: guarantee.facilityId } })
        : await tx.guaranteeFacility.findFirst();
      if (facility && Number(sub(facility.availableCapacity, amount)) < 0) {
        throw errors.unprocessable('GUARANTEE_CAPACITY_EXCEEDED', 'The guarantee facility has insufficient available capacity.');
      }
      if (facility) {
        await tx.guaranteeFacility.update({
          where: { id: facility.id },
          data: {
            availableCapacity: sub(facility.availableCapacity, amount),
            outstandingGuarantees: add(facility.outstandingGuarantees, amount),
          },
        });
      }
    }

    return tx.guarantee.update({
      where: { id: guarantee.id },
      data: {
        decision: input.decision,
        guaranteedAmount: approved ? amount : undefined,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        status: approved ? GuaranteeStatus.ACTIVE : GuaranteeStatus.DECLINED,
        certificateRef: approved ? `RUPSA-GCT-${guarantee.publicId.slice(-6)}` : undefined,
      },
    });
  });

  if (approved) {
    await publishEvent(EventTypes.guaranteeApproved, updated.publicId, {
      guaranteeId: updated.publicId,
      guaranteedAmount: money(updated.guaranteedAmount),
    });
  }

  await writeAudit({
    actorId,
    action: 'guarantee.decision',
    entityType: 'Guarantee',
    entityId: updated.publicId,
  });

  return {
    guaranteeId: updated.publicId,
    status: updated.status,
    decision: updated.decision,
    guaranteedAmount: updated.guaranteedAmount != null ? money(updated.guaranteedAmount) : null,
    certificateRef: updated.certificateRef,
    expiryDate: updated.expiryDate?.toISOString().slice(0, 10) ?? null,
  };
}

export async function fileClaim(guaranteeId: string, input: {
  loanId: string;
  claimAmount: number;
  reason: string;
  supportingReference?: string;
}, actorId?: string) {
  const guarantee = await findGuarantee(guaranteeId);
  if (guarantee.status !== GuaranteeStatus.ACTIVE && guarantee.status !== GuaranteeStatus.APPROVED) {
    throw errors.unprocessable('GUARANTEE_NOT_ACTIVE', 'A claim can only be filed against an active guarantee.');
  }
  const loan = await findLoan(input.loanId);

  const claim = await prisma.$transaction(async (tx) => {
    const row = await tx.guaranteeClaim.create({
      data: {
        publicId: await nextPublicId('CLM'),
        guaranteeId: guarantee.id,
        loanId: loan.id,
        claimAmount: decimal(input.claimAmount),
        reason: input.reason,
        supportingReference: input.supportingReference,
      },
    });
    await tx.guarantee.update({
      where: { id: guarantee.id },
      data: { status: GuaranteeStatus.CLAIMED },
    });
    if (guarantee.facilityId) {
      const facility = await tx.guaranteeFacility.findUniqueOrThrow({ where: { id: guarantee.facilityId } });
      await tx.guaranteeFacility.update({
        where: { id: facility.id },
        data: { claimsTotal: add(facility.claimsTotal, input.claimAmount) },
      });
    }
    return row;
  });

  await publishEvent(EventTypes.guaranteeClaimed, guarantee.publicId, {
    guaranteeId: guarantee.publicId,
    claimId: claim.publicId,
    claimAmount: input.claimAmount,
  });
  await writeAudit({
    actorId,
    action: 'guarantee.claim',
    entityType: 'Guarantee',
    entityId: guarantee.publicId,
  });

  return {
    claimId: claim.publicId,
    guaranteeId: guarantee.publicId,
    status: claim.status,
    claimAmount: money(claim.claimAmount),
  };
}

export async function listGuarantees() {
  const rows = await prisma.guarantee.findMany({
    include: { school: true, institution: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    guaranteeId: row.publicId,
    schoolId: row.school.publicId,
    financialInstitutionId: row.institution.publicId,
    loanAmount: money(row.loanAmount),
    guaranteeAmount: money(row.guaranteeAmount),
    guaranteedAmount: row.guaranteedAmount != null ? money(row.guaranteedAmount) : null,
    currency: row.currency,
    status: row.status,
    expiryDate: row.expiryDate?.toISOString().slice(0, 10) ?? null,
  }));
}

export async function facilitySnapshot() {
  const facility = await prisma.guaranteeFacility.findFirst();
  if (!facility) {
    return {
      maximumExposure: 0,
      availableCapacity: 0,
      outstandingGuarantees: 0,
      claims: 0,
      currency: 'RWF',
    };
  }
  return {
    facilityName: facility.name,
    maximumExposure: money(facility.maximumExposure),
    availableCapacity: money(facility.availableCapacity),
    outstandingGuarantees: money(facility.outstandingGuarantees),
    claims: money(facility.claimsTotal),
    currency: facility.currency,
  };
}

export async function findGuarantee(guaranteeId: string) {
  const guarantee = await prisma.guarantee.findUnique({ where: { publicId: guaranteeId } });
  if (!guarantee) throw errors.notFound('GUARANTEE_NOT_FOUND', 'The requested guarantee could not be found.');
  return guarantee;
}
