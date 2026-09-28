import { randomBytes } from 'crypto';
import { MembershipStatus, type MembershipApplication } from '@prisma/client';
import { errors } from '../utils/errors';
import { writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';
import {
  deliverEmail,
  deskAddress,
  membershipDecisionEmail,
  membershipSubmittedDeskEmail,
  membershipSubmittedEmail,
  membershipVerifyLink,
} from './mailer';

const DECISIONS = ['CONFIRMED', 'REJECTED'] as const;
type Decision = (typeof DECISIONS)[number];

function serialize(application: {
  publicId: string
  schoolName: string
  registrationNumber: string | null
  contactName: string
  title: string
  phone: string
  email: string
  province: string
  district: string
  sector: string | null
  message: string | null
  status: string
  reviewNote: string | null
  reviewedAt: Date | null
  reviewerName: string | null
  reviewerTitle: string | null
  verificationCode: string | null
  createdAt: Date
}) {
  return {
    applicationId: application.publicId,
    schoolName: application.schoolName,
    registrationNumber: application.registrationNumber,
    contactName: application.contactName,
    title: application.title,
    phone: application.phone,
    email: application.email,
    address: {
      province: application.province,
      district: application.district,
      sector: application.sector,
    },
    message: application.message,
    status: application.status,
    reviewNote: application.reviewNote,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    reviewerName: application.reviewerName,
    reviewerTitle: application.reviewerTitle,
    verifyUrl: application.verificationCode ? membershipVerifyLink(application.verificationCode) : null,
    createdAt: application.createdAt.toISOString(),
  };
}

function newVerificationCode() {
  return randomBytes(12).toString('base64url');
}

async function sealCertificate(application: MembershipApplication): Promise<MembershipApplication> {
  if (application.status !== 'CONFIRMED') return application;
  const data: { verificationCode?: string; reviewerName?: string; reviewerTitle?: string } = {};
  if (!application.verificationCode) data.verificationCode = newVerificationCode();
  if (!application.reviewerName) {
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'MembershipApplication', entityId: application.publicId, action: 'membership.decide' },
      orderBy: { createdAt: 'desc' },
      include: { actor: true },
    });
    data.reviewerName = audit?.actor?.fullName ?? 'UPSA reader';
    data.reviewerTitle = 'UPSA reader';
  }
  if (Object.keys(data).length === 0) return application;
  return prisma.membershipApplication.update({ where: { id: application.id }, data });
}

export async function submitMembershipApplication(input: {
  schoolName: string
  registrationNumber?: string
  contactName: string
  title: string
  phone: string
  email: string
  address: { province: string; district: string; sector?: string }
  message?: string
}) {
  const email = input.email.trim();
  const application = await prisma.membershipApplication.create({
    data: {
      publicId: await nextPublicId('MBA'),
      schoolName: input.schoolName.trim(),
      registrationNumber: input.registrationNumber?.trim() || null,
      contactName: input.contactName.trim(),
      title: input.title.trim(),
      phone: input.phone.trim(),
      email,
      province: input.address.province,
      district: input.address.district,
      sector: input.address.sector,
      message: input.message?.trim() || null,
      status: 'SUBMITTED',
    },
  });

  const location = [application.sector, application.district, application.province].filter(Boolean).join(', ');
  const emailSent = await deliverEmail({
    to: application.email,
    ...membershipSubmittedEmail({
      contactName: application.contactName,
      schoolName: application.schoolName,
      applicationId: application.publicId,
      email: application.email,
    }),
  });
  const desk = deskAddress();
  if (desk && desk.toLowerCase() !== application.email.toLowerCase()) {
    await deliverEmail({
      to: desk,
      ...membershipSubmittedDeskEmail({
        contactName: application.contactName,
        title: application.title,
        schoolName: application.schoolName,
        applicationId: application.publicId,
        email: application.email,
        phone: application.phone,
        location,
        registrationNumber: application.registrationNumber ?? undefined,
        message: application.message ?? undefined,
      }),
    });
  }

  return {
    applicationId: application.publicId,
    schoolName: application.schoolName,
    email: application.email,
    status: application.status,
    emailSent,
  };
}

export async function publicMembershipStatus(applicationId: string, email: string) {
  const found = await prisma.membershipApplication.findUnique({ where: { publicId: applicationId } });
  const matches = found && found.email.trim().toLowerCase() === email.trim().toLowerCase();
  if (!found || !matches) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No membership request matches that reference and email.');
  }
  const application = await sealCertificate(found);
  return {
    applicationId: application.publicId,
    schoolName: application.schoolName,
    email: application.email,
    status: application.status,
    contactName: application.contactName,
    title: application.title,
    location: [application.sector, application.district, application.province].filter(Boolean).join(', '),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    reviewerName: application.reviewerName,
    reviewerTitle: application.reviewerTitle,
    verifyUrl: application.verificationCode ? membershipVerifyLink(application.verificationCode) : null,
  };
}

export async function verifyMembershipCertificate(code: string) {
  const application = await prisma.membershipApplication.findUnique({ where: { verificationCode: code } });
  if (!application || application.status !== 'CONFIRMED') {
    return { verified: false as const };
  }
  return {
    verified: true as const,
    applicationId: application.publicId,
    schoolName: application.schoolName,
    location: [application.sector, application.district, application.province].filter(Boolean).join(', '),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    reviewerName: application.reviewerName ?? 'UPSA reader',
    reviewerTitle: application.reviewerTitle ?? 'UPSA reader',
  };
}

export async function listMembershipApplications() {
  const rows = await prisma.membershipApplication.findMany({ orderBy: { createdAt: 'desc' } });
  const sealed = await Promise.all(rows.map((row) => sealCertificate(row)));
  return { items: sealed.map(serialize) };
}

export async function decideMembershipApplication(
  applicationId: string,
  input: { decision: Decision; note?: string },
  actorId?: string,
) {
  if (!DECISIONS.includes(input.decision)) {
    throw errors.unprocessable('DECISION_INVALID', 'Confirm or reject the membership request.');
  }
  const application = await prisma.membershipApplication.findUnique({ where: { publicId: applicationId } });
  if (!application) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No membership request matches that reference.');
  }
  if (application.status !== 'SUBMITTED') {
    throw errors.conflict('ALREADY_DECIDED', 'This request already has an administrator decision.');
  }
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
  const updated = await prisma.membershipApplication.update({
    where: { id: application.id },
    data: {
      status: input.decision,
      reviewNote: input.note?.trim() || null,
      reviewedAt: new Date(),
      ...(input.decision === 'CONFIRMED'
        ? {
          verificationCode: newVerificationCode(),
          reviewerName: actor?.fullName ?? 'UPSA reader',
          reviewerTitle: 'UPSA reader',
        }
        : {}),
    },
  });
  await writeAudit({
    actorId,
    action: 'membership.decide',
    entityType: 'MembershipApplication',
    entityId: updated.publicId,
    metadata: { decision: input.decision },
  });
  if (input.decision === 'CONFIRMED') {
    await prisma.school.updateMany({
      where: { membershipApplicationId: updated.id },
      data: { membershipStatus: MembershipStatus.VERIFIED, rupsaMemberId: updated.publicId },
    });
  }
  if (input.decision === 'REJECTED') {
    await prisma.school.updateMany({
      where: { membershipApplicationId: updated.id },
      data: { membershipStatus: MembershipStatus.REJECTED },
    });
  }
  await deliverEmail({
    to: updated.email,
    ...membershipDecisionEmail({
      contactName: updated.contactName,
      schoolName: updated.schoolName,
      applicationId: updated.publicId,
      email: updated.email,
      decision: input.decision,
      note: updated.reviewNote ?? undefined,
    }),
  });
  return serialize(updated);
}
