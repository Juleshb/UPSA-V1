import type { Guardian, PaymentChannel, User } from '@prisma/client';
import { errors } from '../utils/errors';
import { writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { money } from '../utils/money';
import { publishNotice, type ParentNotice } from '../utils/notices';
import { prisma } from '../utils/prisma';
import { deliverEmail, noticeEmail } from './mailer';

export const PARENTAL_PURPOSE = 'PARENTAL_RESPONSIBILITY';

export const PARENTAL_SCOPE = [
  'student.identity',
  'school.enrolment',
  'fees.outstanding',
  'payment.history',
  'digital.receipts',
  'notifications',
] as const;

const RELATIONSHIPS = ['MOTHER', 'FATHER', 'GUARDIAN'] as const;
const ORIGINS = ['RW', 'TZ', 'UG', 'KE', 'BI', 'SS', 'CD'] as const;
const CHANNELS = ['BANK', 'PSP', 'MOBILE_PAYMENT', 'CARD'] as const;
const NOTIFY = ['IN_APP', 'EMAIL', 'SMS'] as const;

const CONSENT_YEARS = 2;

export async function openParentAccount(
  user: User,
  input: { phone?: string; nationalId?: string; requestId?: string },
) {
  if (input.nationalId && !/^\d{16}$/.test(input.nationalId)) {
    throw errors.unprocessable('IDENTITY_INVALID', 'Enter the 16-digit national ID number.');
  }
  const guardian = await prisma.guardian.create({
    data: {
      publicId: await nextPublicId('GRD'),
      userId: user.id,
      fullName: user.fullName,
      phone: input.phone ?? user.phone,
      email: user.email,
      notifyChannel: 'IN_APP',
      nationalId: input.nationalId,
    },
  });

  await grantAuthorization(guardian, user.id, input.requestId);
  if (input.nationalId) await recordIdentity(guardian, input.nationalId);
  await recordNotice(
    user.id,
    guardian.notifyChannel,
    'Parent account opened',
    'Your account is open. Link a student after you confirm parental responsibility, and school and fee records will appear here.',
  );
  return guardian;
}

export async function parentContext(userId: string) {
  const guardian = await prisma.guardian.findUnique({ where: { userId } });
  if (!guardian) return null;
  const [authorization, identity, notifications] = await Promise.all([
    activeAuthorization(guardian.publicId),
    identityStatus(guardian),
    listNotices(userId),
  ]);
  return {
    guardian: {
      guardianId: guardian.publicId,
      fullName: guardian.fullName,
      phone: guardian.phone,
      email: guardian.email,
    },
    identity,
    authorization,
    preferences: {
      paymentChannel: guardian.preferredChannel,
      originCountry: guardian.preferredCountry,
      notifyChannel: guardian.notifyChannel,
    },
    notifications,
  };
}

export async function updateContact(
  userId: string,
  input: { phone?: string; email?: string },
) {
  const guardian = await requireGuardian(userId);
  if (input.email) {
    const taken = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), NOT: { id: userId } },
    });
    if (taken) throw errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    }),
    prisma.guardian.update({
      where: { id: guardian.id },
      data: {
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    }),
  ]);
  await writeAudit({ actorId: userId, action: 'parent.contact', entityType: 'Guardian', entityId: guardian.publicId });
  return parentContext(userId);
}

export async function submitIdentity(userId: string, nationalId: string) {
  const guardian = await requireGuardian(userId);
  if (!/^\d{16}$/.test(nationalId)) {
    throw errors.unprocessable('IDENTITY_INVALID', 'Enter the 16-digit national ID number.');
  }
  const current = await prisma.kycRecord.findFirst({
    where: { subjectId: guardian.publicId, kind: 'KYC' },
    orderBy: { createdAt: 'desc' },
  });
  if (current?.status === 'VERIFIED' && guardian.nationalId === nationalId) {
    return parentContext(userId);
  }
  await prisma.guardian.update({ where: { id: guardian.id }, data: { nationalId } });
  await recordIdentity(guardian, nationalId);
  await writeAudit({ actorId: userId, action: 'parent.identity', entityType: 'Guardian', entityId: guardian.publicId });
  return parentContext(userId);
}

export async function listLinkableSchools() {
  const schools = await prisma.school.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { schoolName: 'asc' },
    select: { publicId: true, schoolName: true, district: true, registrationNumber: true },
  });
  return schools.map((school) => ({
    schoolId: school.publicId,
    schoolName: school.schoolName,
    schoolCode: school.registrationNumber,
    district: school.district,
  }));
}

export async function previewStudent(userId: string, schoolId: string, studentReference: string) {
  const guardian = await requireGuardian(userId);
  const authorization = await activeAuthorization(guardian.publicId);
  if (!authorization) {
    throw errors.unprocessable(
      'CONSENT_REQUIRED',
      'Parental-responsibility consent is required before a student record can be shown.',
    );
  }

  const school = await prisma.school.findFirst({
    where: { publicId: schoolId, status: 'ACTIVE' },
  });
  const reference = studentReference.trim();
  const student = school
    ? await prisma.student.findFirst({
        where: {
          schoolId: school.id,
          OR: [{ studentExternalId: reference }, { publicId: reference }],
        },
        include: { invoices: { orderBy: { dueDate: 'asc' } } },
      })
    : null;
  if (!school || !student) {
    throw errors.notFound('STUDENT_NOT_MATCHED', 'No student matched that number at this school.');
  }

  const openInvoices = student.invoices.filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'WRITTEN_OFF');
  const totalBilled = openInvoices.reduce((sum, invoice) => sum + money(invoice.amount), 0);
  const totalPaid = openInvoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0);
  return {
    studentId: student.publicId,
    studentReference: student.studentExternalId,
    studentName: student.studentName,
    classLevel: student.classLevel,
    academicYear: student.academicYear,
    feeCategory: student.feeCategory,
    status: student.status,
    schoolId: school.publicId,
    schoolName: school.schoolName,
    schoolCode: school.registrationNumber,
    district: school.district,
    currency: 'RWF',
    totalBilled,
    totalPaid,
    outstanding: totalBilled - totalPaid,
    invoices: student.invoices.map((invoice) => ({
      invoiceId: invoice.publicId,
      description: invoice.description,
      amount: money(invoice.amount),
      amountPaid: money(invoice.amountPaid),
      balance: money(invoice.balance),
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
    })),
  };
}

export async function linkStudent(
  userId: string,
  input: { schoolId: string; studentReference: string; studentName: string; relationship: string },
) {
  const guardian = await requireGuardian(userId);
  const authorization = await activeAuthorization(guardian.publicId);
  if (!authorization) {
    throw errors.unprocessable(
      'CONSENT_REQUIRED',
      'Parental-responsibility consent is required before a student can be linked.',
    );
  }
  if (!RELATIONSHIPS.includes(input.relationship as (typeof RELATIONSHIPS)[number])) {
    throw errors.unprocessable('RELATIONSHIP_INVALID', 'Choose mother, father, or guardian.');
  }

  const school = await prisma.school.findFirst({
    where: { publicId: input.schoolId, status: 'ACTIVE' },
  });
  const reference = input.studentReference.trim();
  const matches = school
    ? await prisma.student.findMany({
        where: {
          schoolId: school.id,
          OR: [{ studentExternalId: reference }, { publicId: reference }],
        },
      })
    : [];
  const student = matches.find((row) => sameName(row.studentName, input.studentName));
  if (!school || !student) {
    throw errors.notFound(
      'STUDENT_NOT_MATCHED',
      'No student matched that school, reference, and name.',
    );
  }

  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
    update: { relationship: input.relationship },
    create: {
      studentId: student.id,
      guardianId: guardian.id,
      relationship: input.relationship,
      isPrimary: false,
    },
  });
  await writeAudit({
    actorId: userId,
    action: 'parent.link_student',
    entityType: 'Student',
    entityId: student.publicId,
    metadata: { schoolId: school.publicId, relationship: input.relationship },
  });
  await recordNotice(
    userId,
    guardian.notifyChannel,
    'Link completed',
    `${student.studentName} at ${school.schoolName} is now on your account.`,
  );
  return { studentId: student.publicId, studentName: student.studentName, schoolName: school.schoolName };
}

export async function updatePreferences(
  userId: string,
  input: { paymentChannel?: string; originCountry?: string; notifyChannel?: string },
) {
  const guardian = await requireGuardian(userId);
  if (input.paymentChannel && !CHANNELS.includes(input.paymentChannel as (typeof CHANNELS)[number])) {
    throw errors.unprocessable('CHANNEL_NOT_APPROVED', 'Choose an approved rail: bank, PSP, mobile money, or card.');
  }
  if (input.originCountry && !ORIGINS.includes(input.originCountry as (typeof ORIGINS)[number])) {
    throw errors.unprocessable('COUNTRY_UNSUPPORTED', 'Choose a country in the EAC payment list.');
  }
  if (input.notifyChannel && !NOTIFY.includes(input.notifyChannel as (typeof NOTIFY)[number])) {
    throw errors.unprocessable('CHANNEL_UNSUPPORTED', 'Choose in-app, email, or SMS notices.');
  }
  await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      ...(input.paymentChannel ? { preferredChannel: input.paymentChannel as PaymentChannel } : {}),
      ...(input.originCountry ? { preferredCountry: input.originCountry } : {}),
      ...(input.notifyChannel ? { notifyChannel: input.notifyChannel } : {}),
    },
  });
  return parentContext(userId);
}

export async function grantParentAuthorization(userId: string, requestId?: string) {
  const guardian = await requireGuardian(userId);
  const current = await activeAuthorization(guardian.publicId);
  if (!current) await grantAuthorization(guardian, userId, requestId);
  return parentContext(userId);
}

export async function withdrawParentAuthorization(userId: string) {
  const guardian = await requireGuardian(userId);
  await prisma.consent.updateMany({
    where: { subjectId: guardian.publicId, purpose: PARENTAL_PURPOSE, status: 'ACTIVE' },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });
  await writeAudit({
    actorId: userId,
    action: 'parent.withdraw_consent',
    entityType: 'Guardian',
    entityId: guardian.publicId,
  });
  return parentContext(userId);
}

export async function notifyFeeReceipt(studentId: string, amountLabel: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { school: true },
  });
  if (!student) return;
  await notifyGuardians(
    studentId,
    'Payment received',
    `${amountLabel} was applied for ${student.studentName} at ${student.school.schoolName}. A digital receipt is on your statements.`,
  );
}

async function notifyGuardians(studentId: string, subject: string, body: string) {
  const links = await prisma.studentGuardian.findMany({
    where: { studentId },
    include: { guardian: true },
  });
  for (const link of links) {
    if (!link.guardian.userId) continue;
    await recordNotice(link.guardian.userId, link.guardian.notifyChannel, subject, body);
  }
}

async function requireGuardian(userId: string) {
  const guardian = await prisma.guardian.findUnique({ where: { userId } });
  if (!guardian) {
    throw errors.notFound('GUARDIAN_NOT_FOUND', 'This parent account has no guardian record.');
  }
  return guardian;
}

async function activeAuthorization(subjectId: string) {
  const consent = await prisma.consent.findFirst({
    where: {
      subjectId,
      purpose: PARENTAL_PURPOSE,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!consent) return null;
  return {
    consentId: consent.publicId,
    purpose: consent.purpose,
    scope: consent.scope,
    status: consent.status,
    expiresAt: consent.expiresAt.toISOString(),
  };
}

async function identityStatus(guardian: Guardian) {
  const record = await prisma.kycRecord.findFirst({
    where: { subjectId: guardian.publicId, kind: 'KYC' },
    orderBy: { createdAt: 'desc' },
  });
  return {
    status: record?.status ?? 'NOT_SUBMITTED',
    nationalIdMask: maskNationalId(guardian.nationalId),
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

async function listNotices(userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map(serializeNotice);
}

export async function listParentNotices(userId: string) {
  return listNotices(userId);
}

export async function markNoticesRead(userId: string, notificationIds?: string[]) {
  const unread = await prisma.notification.findMany({
    where: {
      userId,
      readAt: null,
      ...(notificationIds?.length ? { publicId: { in: notificationIds } } : {}),
    },
    select: { publicId: true },
  });
  if (unread.length === 0) return listNotices(userId);
  const ids = unread.map((row) => row.publicId);
  await prisma.notification.updateMany({
    where: { userId, publicId: { in: ids } },
    data: { readAt: new Date() },
  });
  publishNotice(userId, { type: 'read', notificationIds: ids });
  return listNotices(userId);
}

function serializeNotice(row: { publicId: string; channel: string; subject: string; body: string; createdAt: Date; readAt: Date | null }): ParentNotice {
  return {
    notificationId: row.publicId,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read: row.readAt != null,
  };
}

async function grantAuthorization(guardian: Guardian, actorId: string, requestId?: string) {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + CONSENT_YEARS);
  const consent = await prisma.consent.create({
    data: {
      publicId: await nextPublicId('CON'),
      subjectId: guardian.publicId,
      purpose: PARENTAL_PURPOSE,
      recipient: 'RUPSA NEXT',
      scope: [...PARENTAL_SCOPE],
      expiresAt,
      evidenceRef: requestId,
    },
  });
  await writeAudit({
    actorId,
    action: 'parent.grant_consent',
    entityType: 'Consent',
    entityId: consent.publicId,
    requestId,
  });
  return consent;
}

async function recordIdentity(guardian: Guardian, nationalId: string) {
  await prisma.kycRecord.create({
    data: {
      publicId: await nextPublicId('KYC'),
      kind: 'KYC',
      subjectId: guardian.publicId,
      status: 'PENDING',
      notes: `National ID ending ${nationalId.slice(-4)} submitted by the parent.`,
    },
  });
}

async function recordNotice(userId: string, channel: string, subject: string, body: string) {
  const channelName = channel || 'IN_APP';
  let status = 'SENT';
  let sentAt: Date | null = new Date();
  if (channelName === 'EMAIL') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const sent = user?.email
      ? await deliverEmail({ to: user.email, ...noticeEmail({ subject, body }) })
      : false;
    status = sent ? 'SENT' : 'FAILED';
    sentAt = sent ? new Date() : null;
  }
  const row = await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      userId,
      channel: channelName,
      subject,
      body,
      status,
      sentAt,
    },
  });
  publishNotice(userId, { type: 'notice', notice: serializeNotice(row) });
}

function maskNationalId(value: string | null) {
  if (!value) return null;
  return `••••••••••••${value.slice(-4)}`;
}

function sameName(left: string, right: string) {
  return left.trim().toLowerCase().replace(/\s+/g, ' ') === right.trim().toLowerCase().replace(/\s+/g, ' ');
}
