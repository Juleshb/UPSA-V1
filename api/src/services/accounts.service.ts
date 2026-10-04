import { OwnershipType, Prisma, SchoolStatus, SchoolType, StudentGender } from '@prisma/client';
import { actorLabel, day, iso, jsonDocs, queueNotice, readDocs, type Doc, type Trace } from './donations/shared';
import { errors } from '../utils/errors';
import { writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { money } from '../utils/money';
import { prisma } from '../utils/prisma';

const TYPES = ['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER'] as const;
type AccountType = (typeof TYPES)[number];
const OPEN_STATUSES = ['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'KYC_KYB', 'VERIFICATION', 'PENDING_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'APPROVED'];
const LIVE_STATUSES = ['ACTIVE', 'SUSPENDED', 'DORMANT', 'INACTIVE'];
const PERSON = new Set(['PARENT', 'STUDENT', 'TEACHER']);
const ORG = new Set(['SCHOOL', 'SUPPLIER']);
const ROLE: Record<AccountType, string> = {
  SCHOOL: 'SCHOOL_USER',
  PARENT: 'PARENT',
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  SUPPLIER: 'SUPPLIER',
};
const LIMITS: Record<AccountType, { daily: number; transaction: number }> = {
  SCHOOL: { daily: 5_000_000, transaction: 1_000_000 },
  PARENT: { daily: 500_000, transaction: 200_000 },
  STUDENT: { daily: 0, transaction: 0 },
  TEACHER: { daily: 200_000, transaction: 100_000 },
  SUPPLIER: { daily: 2_000_000, transaction: 500_000 },
};
const OPENABLE: SchoolStatus[] = ['APPLICATION', 'SUBMITTED', 'DOCUMENT_REVIEW', 'PENDING_VERIFICATION', 'VERIFICATION', 'APPROVED'];
const OPEN_INVOICE = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] as const;
const OPEN_LOAN = ['OFFERED', 'CONTRACTED', 'DISBURSING', 'ACTIVE', 'IN_ARREARS', 'RECOVERY'] as const;
const OPEN_GUARANTEE = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'CLAIMED'] as const;

const include = {
  school: { select: { id: true, publicId: true, schoolName: true, registrationNumber: true, phone: true, email: true, status: true } },
  guardian: { select: { id: true, publicId: true, fullName: true, phone: true, email: true, nationalId: true, userId: true } },
  student: { select: { id: true, publicId: true, studentName: true, schoolId: true, telephone: true, studentExternalId: true } },
  registration: { select: { id: true, publicId: true, displayName: true, email: true, phone: true, kind: true } },
  user: { select: { id: true, publicId: true, email: true, fullName: true } },
} satisfies Prisma.OpenedAccountInclude;

type Loaded = Prisma.OpenedAccountGetPayload<{ include: typeof include }>;

function asType(value: string): AccountType {
  if ((TYPES as readonly string[]).includes(value)) return value as AccountType;
  throw errors.unprocessable('ACCOUNT_TYPE_INVALID', 'Choose a school, parent, student, teacher, or supplier account.');
}

function textOf(value: unknown) {
  return String(value ?? '').trim();
}

function profileOf(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>;
  const profile: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item == null || item === '') continue;
    profile[key] = String(item);
  }
  return profile;
}

function readList<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function enumValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function partyOf(row: Loaded) {
  if (row.accountType === 'SCHOOL' && row.school) return { id: row.school.publicId, name: row.school.schoolName, source: 'School' };
  if (row.accountType === 'PARENT' && row.guardian) return { id: row.guardian.publicId, name: row.guardian.fullName, source: 'Guardian' };
  if (row.accountType === 'STUDENT' && row.student) return { id: row.student.publicId, name: row.student.studentName, source: 'Student' };
  if (row.registration) return { id: row.registration.publicId, name: row.registration.displayName, source: 'Registration' };
  if (row.school) return { id: row.school.publicId, name: row.school.schoolName, source: 'School' };
  return null;
}

function nextStep(row: Loaded) {
  if (row.status === 'DRAFT') return 'Submit the application';
  if (row.status === 'MORE_INFORMATION_REQUIRED') return 'Correct the file and resubmit';
  if (row.status === 'SUBMITTED') return 'Review the documents';
  if (row.status === 'DOCUMENT_REVIEW') return ORG.has(row.accountType) ? 'Complete KYB' : 'Complete KYC';
  if (row.status === 'KYC_KYB') return 'Verify the phone, email, and address';
  if (row.status === 'VERIFICATION' && row.duplicateResult === 'NOT_CHECKED') return 'Run the duplicate check';
  if (row.status === 'VERIFICATION' && row.duplicateResult === 'POSSIBLE_DUPLICATE') return 'Clear the possible duplicate, or reject the application';
  if (row.status === 'VERIFICATION' && row.duplicateResult === 'CONFIRMED_DUPLICATE') return 'Link the existing record, or reject the confirmed duplicate';
  if (row.status === 'PENDING_APPROVAL' && !row.riskLevel) return 'Record the risk assessment';
  if (row.status === 'PENDING_APPROVAL') return 'Approve or reject the application';
  if (row.status === 'APPROVED') return 'Activate the account';
  if (row.status === 'ACTIVE') return 'The account is active';
  if (row.status === 'SUSPENDED') return 'Reactivate the account, or close it';
  if (row.status === 'DORMANT') return 'Reactivate the dormant account, or close it';
  if (row.status === 'REJECTED') return 'The application was rejected';
  if (row.status === 'CLOSED') return 'The account is closed';
  return row.status;
}

function present(row: Loaded) {
  const limits = row.limits && typeof row.limits === 'object' && !Array.isArray(row.limits) ? row.limits as Record<string, unknown> : {};
  return {
    id: row.publicId,
    accountType: row.accountType,
    status: row.status,
    nextStep: nextStep(row),
    channel: row.channel,
    referral: row.referral,
    purpose: row.purpose,
    language: row.language,
    communicationPreference: row.communicationPreference,
    digitalAccess: row.digitalAccess,
    mobileAccess: row.mobileAccess,
    webAccess: row.webAccess,
    applicantName: row.applicantName,
    identityNumber: row.identityNumber,
    phone: row.phone,
    email: row.email,
    country: row.country,
    province: row.province,
    district: row.district,
    sector: row.sector,
    cell: row.cell,
    village: row.village,
    address: row.address,
    termsAccepted: row.termsAccepted,
    privacyAccepted: row.privacyAccepted,
    dataConsent: row.dataConsent,
    consentVersion: row.consentVersion,
    documents: readDocs(row.documents),
    profile: profileOf(row.profile),
    devices: readList<{ name: string; registeredAt: string }>(row.devices),
    limits: {
      daily: Number(limits.daily ?? 0),
      transaction: Number(limits.transaction ?? 0),
      currency: String(limits.currency ?? 'RWF'),
    },
    changes: readList<Record<string, string>>(row.changes),
    party: partyOf(row),
    linkedUser: row.user ? { id: row.user.publicId, name: row.user.fullName, email: row.user.email } : null,
    identityStatus: row.identityStatus,
    phoneStatus: row.phoneStatus,
    emailStatus: row.emailStatus,
    addressStatus: row.addressStatus,
    documentStatus: row.documentStatus,
    kycResult: row.kycResult,
    kycNotes: row.kycNotes,
    duplicateResult: row.duplicateResult,
    duplicateMatches: readList<{ source: string; id: string; name: string; reason: string }>(row.duplicateMatches),
    duplicateNote: row.duplicateNote,
    riskLevel: row.riskLevel,
    riskNotes: row.riskNotes,
    complianceResult: row.complianceResult,
    decision: row.decision,
    conditions: row.conditions,
    approvedBy: row.approvedBy,
    approvalDate: iso(row.approvalDate),
    rejectionReason: row.rejectionReason,
    username: row.username,
    roleName: row.roleName,
    mfaRequired: row.mfaRequired,
    mfaMethod: row.mfaMethod,
    accessIssued: row.accessIssued,
    activatedAt: iso(row.activatedAt),
    activatedBy: row.activatedBy,
    lastActivityAt: iso(row.lastActivityAt),
    suspendedAt: iso(row.suspendedAt),
    suspensionReason: row.suspensionReason,
    legalHold: row.legalHold,
    legalHoldReason: row.legalHoldReason,
    closedAt: iso(row.closedAt),
    closureReason: row.closureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

function rowOf(row: Loaded) {
  const party = partyOf(row);
  return {
    id: row.publicId,
    accountType: row.accountType,
    applicantName: row.applicantName,
    phone: row.phone,
    email: row.email,
    party: party?.name ?? null,
    partyId: party?.id ?? null,
    status: row.status,
    kycResult: row.kycResult,
    duplicateResult: row.duplicateResult,
    createdAt: row.createdAt.toISOString(),
  };
}

async function audit(input: {
  trace: Trace;
  accountId: string;
  entityId: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  reference?: string | null;
}) {
  await prisma.accountAudit.create({
    data: {
      publicId: await nextPublicId('AAU'),
      accountId: input.accountId,
      entityType: 'OpenedAccount',
      entityId: input.entityId,
      userId: input.trace.actorPublicId ?? input.trace.actorId ?? null,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      ip: input.trace.ip ?? null,
    },
  });
  await writeAudit({
    actorId: input.trace.actorId,
    action: input.action,
    entityType: 'OpenedAccount',
    entityId: input.entityId,
    requestId: input.trace.requestId,
    metadata: { status: input.newStatus, reason: input.reason, reference: input.reference },
  });
}

async function load(publicId: string) {
  const row = await prisma.openedAccount.findUnique({ where: { publicId }, include });
  if (!row) throw errors.notFound('ACCOUNT_NOT_FOUND', 'Account application not found.');
  return row;
}

async function reload(id: string) {
  const row = await prisma.openedAccount.findUniqueOrThrow({ where: { id }, include });
  return present(row);
}

function assertStatus(row: Loaded, allowed: string[], message: string) {
  if (!allowed.includes(row.status)) throw errors.unprocessable('STATUS_INVALID', message);
}

function requireFields(type: AccountType, profile: Record<string, string>, identity?: string | null, email?: string | null) {
  const missing: string[] = [];
  const need = (key: string, label: string) => {
    if (!profile[key]?.trim()) missing.push(label);
  };
  if (!email?.includes('@')) missing.push('email');
  if (type === 'SCHOOL') {
    ['schoolName', 'registrationNumber', 'schoolType', 'province', 'district', 'representativeName', 'representativeTitle', 'bankName', 'accountName', 'accountNumber']
      .forEach((key) => need(key, key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()));
  }
  if (type === 'PARENT') need('relationship', 'relationship');
  if (type === 'STUDENT') {
    ['schoolPublicId', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'academicYear', 'classLevel', 'guardianName', 'guardianPhone', 'relationship']
      .forEach((key) => need(key, key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()));
  }
  if (type === 'TEACHER') ['qualification', 'subject', 'employmentType'].forEach((key) => need(key, key));
  if (type === 'SUPPLIER') ['businessName', 'registrationNumber', 'category', 'bankName', 'accountName', 'accountNumber'].forEach((key) => need(key, key));
  if (PERSON.has(type) && !identity?.trim()) missing.push('identity number');
  if (missing.length) throw errors.unprocessable('APPLICATION_INCOMPLETE', `Add ${missing.join(', ')} before submitting.`);
}

async function resolveParty(type: AccountType, partyId?: string | null) {
  if (!partyId) return { schoolId: undefined as string | undefined, guardianId: undefined as string | undefined, studentId: undefined as string | undefined, registrationId: undefined as string | undefined, profile: {} as Record<string, string> };
  if (type === 'SCHOOL') {
    const school = await prisma.school.findUnique({ where: { publicId: partyId } });
    if (!school) throw errors.notFound('PARTY_NOT_FOUND', 'School not found.');
    return {
      schoolId: school.id,
      guardianId: undefined,
      studentId: undefined,
      registrationId: undefined,
      profile: {
        schoolName: school.schoolName,
        registrationNumber: school.registrationNumber,
        schoolType: school.schoolType ?? 'OTHER',
        province: school.province,
        district: school.district,
      },
    };
  }
  if (type === 'PARENT') {
    const guardian = await prisma.guardian.findUnique({ where: { publicId: partyId } });
    if (!guardian) throw errors.notFound('PARTY_NOT_FOUND', 'Parent not found.');
    return { schoolId: undefined, guardianId: guardian.id, studentId: undefined, registrationId: undefined, profile: {} };
  }
  if (type === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { publicId: partyId }, include: { school: { select: { publicId: true } } } });
    if (!student) throw errors.notFound('PARTY_NOT_FOUND', 'Student not found.');
    return {
      schoolId: student.schoolId,
      guardianId: undefined,
      studentId: student.id,
      registrationId: undefined,
      profile: { schoolPublicId: student.school.publicId, firstName: student.studentName, studentNumber: student.studentExternalId },
    };
  }
  const registration = await prisma.registration.findUnique({ where: { publicId: partyId } });
  if (!registration || registration.kind !== type) throw errors.notFound('PARTY_NOT_FOUND', 'Registration not found for this account type.');
  return { schoolId: registration.schoolId ?? undefined, guardianId: undefined, studentId: undefined, registrationId: registration.id, profile: profileOf(registration.profile) };
}

export async function listParties(type: string) {
  const accountType = asType(type);
  const schools = await prisma.school.findMany({
    orderBy: { schoolName: 'asc' },
    take: 200,
    select: { publicId: true, schoolName: true, phone: true, email: true, registrationNumber: true, schoolType: true, province: true, district: true },
  });
  const students = await prisma.student.findMany({
    orderBy: { studentName: 'asc' },
    take: 200,
    select: { publicId: true, studentName: true, telephone: true, studentExternalId: true, school: { select: { schoolName: true } } },
  });
  let parties: { id: string; name: string; phone: string | null; email: string | null; number: string | null; detail: string | null }[] = [];
  if (accountType === 'SCHOOL') {
    parties = schools.map((school) => ({ id: school.publicId, name: school.schoolName, phone: school.phone, email: school.email, number: school.registrationNumber, detail: school.schoolType }));
  } else if (accountType === 'PARENT') {
    const guardians = await prisma.guardian.findMany({ orderBy: { fullName: 'asc' }, take: 200, select: { publicId: true, fullName: true, phone: true, email: true, nationalId: true } });
    parties = guardians.map((guardian) => ({ id: guardian.publicId, name: guardian.fullName, phone: guardian.phone, email: guardian.email, number: guardian.nationalId, detail: null }));
  } else if (accountType === 'STUDENT') {
    parties = students.map((student) => ({ id: student.publicId, name: student.studentName, phone: student.telephone, email: null, number: student.studentExternalId, detail: student.school.schoolName }));
  } else {
    const registrations = await prisma.registration.findMany({
      where: { kind: accountType },
      orderBy: { displayName: 'asc' },
      take: 200,
      select: { publicId: true, displayName: true, phone: true, email: true, referenceCode: true, kind: true },
    });
    parties = registrations.map((registration) => ({ id: registration.publicId, name: registration.displayName, phone: registration.phone, email: registration.email, number: registration.referenceCode, detail: registration.kind }));
  }
  return {
    parties,
    schools: schools.map((school) => ({ id: school.publicId, name: school.schoolName, number: school.registrationNumber })),
    students: students.map((student) => ({ id: student.publicId, name: `${student.studentName} · ${student.school.schoolName}`, number: student.studentExternalId })),
  };
}

type SaveInput = {
  mode: 'draft' | 'submit';
  accountType: string;
  channel: string;
  referral?: string;
  purpose?: string;
  language?: string;
  communicationPreference?: string;
  digitalAccess?: boolean;
  mobileAccess?: boolean;
  webAccess?: boolean;
  applicantName: string;
  identityNumber?: string;
  phone: string;
  email?: string;
  country?: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  address?: string;
  partyId?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  dataConsent?: boolean;
  consentVersion?: string;
  documents?: Doc[];
  profile?: Record<string, string>;
};

export async function save(input: SaveInput, trace: Trace, publicId?: string) {
  const accountType = asType(input.accountType);
  const existing = publicId ? await load(publicId) : null;
  if (existing) assertStatus(existing, ['DRAFT', 'MORE_INFORMATION_REQUIRED'], 'This application can no longer be edited. Use a change request on the open account.');
  const linked = await resolveParty(accountType, input.partyId);
  const profile = { ...linked.profile, ...Object.fromEntries(Object.entries(input.profile ?? {}).filter(([, value]) => value.trim())) };
  if (!profile.province && input.province?.trim()) profile.province = input.province.trim();
  if (!profile.district && input.district?.trim()) profile.district = input.district.trim();
  const documents = (input.documents ?? []).filter((item) => item.fileName.trim());
  const email = input.email?.trim() || null;
  if (input.mode === 'submit') {
    if (!input.purpose?.trim()) throw errors.unprocessable('APPLICATION_INCOMPLETE', 'Add the purpose of the account before submitting.');
    if (!input.termsAccepted || !input.privacyAccepted || !input.dataConsent) {
      throw errors.unprocessable('CONSENT_REQUIRED', 'Terms, privacy, and data consent are required before submission.');
    }
    if (!documents.length) throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Add at least one supporting document before submitting.');
    requireFields(accountType, profile, input.identityNumber, email);
  }
  const data = {
    accountType,
    status: input.mode === 'submit' ? 'SUBMITTED' : existing?.status === 'MORE_INFORMATION_REQUIRED' ? 'MORE_INFORMATION_REQUIRED' : 'DRAFT',
    channel: input.channel,
    referral: input.referral?.trim() || null,
    purpose: input.purpose?.trim() || 'Account opening',
    language: input.language?.trim() || 'English',
    communicationPreference: input.communicationPreference?.trim() || 'IN_APP',
    digitalAccess: Boolean(input.digitalAccess),
    mobileAccess: Boolean(input.mobileAccess),
    webAccess: Boolean(input.webAccess),
    applicantName: input.applicantName.trim(),
    identityNumber: input.identityNumber?.trim() || null,
    phone: input.phone.trim(),
    email,
    country: input.country?.trim() || 'RW',
    province: input.province?.trim() || profile.province || null,
    district: input.district?.trim() || profile.district || null,
    sector: input.sector?.trim() || null,
    cell: input.cell?.trim() || null,
    village: input.village?.trim() || null,
    address: input.address?.trim() || null,
    termsAccepted: Boolean(input.termsAccepted),
    privacyAccepted: Boolean(input.privacyAccepted),
    dataConsent: Boolean(input.dataConsent),
    consentVersion: input.consentVersion?.trim() || 'account-opening-v1',
    consentDate: input.termsAccepted ? new Date() : null,
    documents: documents.length ? jsonDocs(documents) : undefined,
    profile,
    schoolId: linked.schoolId ?? existing?.schoolId ?? null,
    guardianId: linked.guardianId ?? existing?.guardianId ?? null,
    studentId: linked.studentId ?? existing?.studentId ?? null,
    registrationId: linked.registrationId ?? existing?.registrationId ?? null,
    lastActivityAt: new Date(),
  };
  const row = existing
    ? await prisma.openedAccount.update({ where: { id: existing.id }, data, include })
    : await prisma.openedAccount.create({ data: { ...data, publicId: await nextPublicId('ACC'), documents: documents.length ? jsonDocs(documents) : [] }, include });
  await audit({
    trace,
    accountId: row.id,
    entityId: row.publicId,
    action: input.mode === 'submit' ? 'APPLICATION_SUBMITTED' : 'APPLICATION_SAVED',
    previousStatus: existing?.status,
    newStatus: row.status,
  });
  return present(row);
}

export async function list(query: { status?: string; accountType?: string; q?: string; queue?: string }) {
  const where: Prisma.OpenedAccountWhereInput = {};
  if (query.accountType) where.accountType = asType(query.accountType);
  if (query.queue === 'open') where.status = { in: OPEN_STATUSES };
  if (query.queue === 'live') where.status = { in: LIVE_STATUSES };
  if (query.status) where.status = query.status;
  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { publicId: { contains: q, mode: 'insensitive' } },
      { applicantName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
      { identityNumber: { contains: q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.openedAccount.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map(rowOf);
}

export async function get(publicId: string) {
  const row = await load(publicId);
  const audits = await prisma.accountAudit.findMany({ where: { accountId: row.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  return {
    ...present(row),
    closureBlockers: await closureBlockers(row),
    audits: audits.map((item) => ({
      id: item.publicId,
      action: item.action,
      previousStatus: item.previousStatus,
      newStatus: item.newStatus,
      reason: item.reason,
      actor: item.userId,
      at: item.createdAt.toISOString(),
    })),
  };
}

async function markDormant(trace: Trace) {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const stale = await prisma.openedAccount.findMany({
    where: { status: 'ACTIVE', lastActivityAt: { lt: cutoff } },
    select: { id: true, publicId: true },
  });
  for (const row of stale) {
    await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'DORMANT' } });
    await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DORMANCY_MARKED', previousStatus: 'ACTIVE', newStatus: 'DORMANT', reason: 'No activity for 180 days' });
  }
}

export async function summary(trace: Trace) {
  await markDormant(trace);
  const [total, pending, approved, active, suspended, dormant, closed, rejected, school, parent, student, teacher, supplier] = await Promise.all([
    prisma.openedAccount.count(),
    prisma.openedAccount.count({ where: { status: { in: ['SUBMITTED', 'DOCUMENT_REVIEW', 'KYC_KYB', 'VERIFICATION', 'PENDING_APPROVAL', 'MORE_INFORMATION_REQUIRED'] } } }),
    prisma.openedAccount.count({ where: { status: 'APPROVED' } }),
    prisma.openedAccount.count({ where: { status: 'ACTIVE' } }),
    prisma.openedAccount.count({ where: { status: 'SUSPENDED' } }),
    prisma.openedAccount.count({ where: { status: 'DORMANT' } }),
    prisma.openedAccount.count({ where: { status: 'CLOSED' } }),
    prisma.openedAccount.count({ where: { status: 'REJECTED' } }),
    prisma.openedAccount.count({ where: { accountType: 'SCHOOL' } }),
    prisma.openedAccount.count({ where: { accountType: 'PARENT' } }),
    prisma.openedAccount.count({ where: { accountType: 'STUDENT' } }),
    prisma.openedAccount.count({ where: { accountType: 'TEACHER' } }),
    prisma.openedAccount.count({ where: { accountType: 'SUPPLIER' } }),
  ]);
  return { total, pending, approved, active, suspended, dormant, closed, rejected, school, parent, student, teacher, supplier };
}

export async function reviewDocuments(publicId: string, input: { verified: boolean; comments?: string; documents?: Doc[] }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['SUBMITTED', 'DOCUMENT_REVIEW'], 'Review documents after the application is submitted.');
  const documents = input.documents?.filter((item) => item.fileName.trim()) ?? readDocs(row.documents);
  if (input.verified && !documents.length) throw errors.unprocessable('DOCUMENTS_REQUIRED', 'A verified file needs at least one document.');
  const status = input.verified ? 'DOCUMENT_REVIEW' : 'SUBMITTED';
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: { status, documentStatus: input.verified ? 'VERIFIED' : 'REJECTED', documents: jsonDocs(documents), lastActivityAt: new Date() },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: input.verified ? 'DOCUMENTS_VERIFIED' : 'DOCUMENTS_REJECTED', previousStatus: row.status, newStatus: status, reason: input.comments });
  return reload(row.id);
}

const KYC_CHECKS: Record<AccountType, string[]> = {
  SCHOOL: ['registrationCertificate', 'taxCertificate', 'addressProof', 'representativeId'],
  SUPPLIER: ['registrationCertificate', 'taxCertificate', 'addressProof', 'representativeId'],
  PARENT: ['identityDocument', 'photo', 'addressProof'],
  STUDENT: ['identityDocument', 'photo', 'addressProof'],
  TEACHER: ['identityDocument', 'photo', 'addressProof'],
};

export async function saveKyc(publicId: string, input: { result: 'VERIFIED' | 'REJECTED'; notes?: string; checks: Record<string, boolean> }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['DOCUMENT_REVIEW', 'KYC_KYB'], 'Complete document review before KYC or KYB.');
  if (row.documentStatus !== 'VERIFIED') throw errors.unprocessable('DOCUMENTS_PENDING', 'Documents must be verified before KYC or KYB.');
  const type = asType(row.accountType);
  if (input.result === 'VERIFIED' && KYC_CHECKS[type].some((key) => !input.checks[key])) {
    throw errors.unprocessable('KYC_INCOMPLETE', 'Confirm every KYC or KYB check before marking it verified.');
  }
  await prisma.kycRecord.create({
    data: {
      publicId: await nextPublicId('KYC'),
      kind: ORG.has(type) ? 'KYB' : 'KYC',
      subjectId: row.publicId,
      schoolId: row.schoolId,
      status: input.result === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
      notes: input.notes?.trim() || null,
    },
  });
  const profile = profileOf(row.profile);
  for (const key of KYC_CHECKS[type]) profile[`kyc_${key}`] = input.checks[key] ? 'true' : 'false';
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: {
      status: 'KYC_KYB',
      kycResult: input.result,
      kycNotes: input.notes?.trim() || null,
      identityStatus: input.result,
      profile,
      lastActivityAt: new Date(),
    },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: input.result === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED', previousStatus: row.status, newStatus: 'KYC_KYB', reason: input.notes });
  return reload(row.id);
}

export async function verifyContacts(publicId: string, input: { phoneStatus: string; emailStatus: string; addressStatus: string; reference: string }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['KYC_KYB', 'VERIFICATION'], 'Verify contacts after KYC or KYB.');
  if (row.kycResult !== 'VERIFIED') throw errors.unprocessable('KYC_PENDING', 'KYC or KYB must be verified before contact verification.');
  const allowed = new Set(['VERIFIED', 'FAILED', 'PENDING']);
  for (const value of [input.phoneStatus, input.emailStatus, input.addressStatus]) {
    if (!allowed.has(value)) throw errors.unprocessable('VERIFICATION_INVALID', 'Each contact result is verified, failed, or pending.');
  }
  const verified = [input.phoneStatus, input.emailStatus, input.addressStatus].every((value) => value === 'VERIFIED');
  if (verified && input.reference.trim().length < 3) throw errors.unprocessable('REFERENCE_REQUIRED', 'Record the verification reference. Do not store the one-time code.');
  const status = verified ? 'VERIFICATION' : 'KYC_KYB';
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: {
      status,
      phoneStatus: input.phoneStatus,
      emailStatus: input.emailStatus,
      addressStatus: input.addressStatus,
      duplicateResult: 'NOT_CHECKED',
      lastActivityAt: new Date(),
    },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'CONTACTS_VERIFIED', previousStatus: row.status, newStatus: status, reference: input.reference.trim() });
  return reload(row.id);
}

type DuplicateMatch = { source: string; id: string; name: string; reason: 'CONFIRMED' | 'POSSIBLE' };

async function findDuplicates(row: Loaded): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const identity = row.identityNumber?.trim();
  const phone = row.phone.trim();
  const email = row.email?.trim();
  const profile = profileOf(row.profile);
  const registrationNumber = profile.registrationNumber?.trim();
  const accounts = await prisma.openedAccount.findMany({
    where: {
      id: { not: row.id },
      status: { notIn: ['REJECTED', 'CLOSED'] },
      OR: [
        ...(identity ? [{ identityNumber: identity }] : []),
        { phone },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { publicId: true, applicantName: true, accountType: true, identityNumber: true },
  });
  for (const other of accounts) {
    const confirmed = Boolean(identity && other.identityNumber === identity && other.accountType === row.accountType);
    matches.push({ source: 'Account', id: other.publicId, name: other.applicantName, reason: confirmed ? 'CONFIRMED' : 'POSSIBLE' });
  }
  const schools = await prisma.school.findMany({
    where: {
      ...(row.schoolId ? { id: { not: row.schoolId } } : {}),
      OR: [
        ...(registrationNumber ? [{ registrationNumber }] : []),
        { phone },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { publicId: true, schoolName: true, registrationNumber: true },
  });
  for (const school of schools) {
    matches.push({
      source: 'School',
      id: school.publicId,
      name: school.schoolName,
      reason: registrationNumber && school.registrationNumber === registrationNumber ? 'CONFIRMED' : 'POSSIBLE',
    });
  }
  if (identity || email) {
    const guardians = await prisma.guardian.findMany({
      where: {
        ...(row.guardianId ? { id: { not: row.guardianId } } : {}),
        OR: [
          ...(identity ? [{ nationalId: identity }] : []),
          { phone },
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { publicId: true, fullName: true, nationalId: true },
    });
    for (const guardian of guardians) {
      const confirmed = row.accountType === 'PARENT' && Boolean(identity && guardian.nationalId === identity);
      matches.push({ source: 'Guardian', id: guardian.publicId, name: guardian.fullName, reason: confirmed ? 'CONFIRMED' : 'POSSIBLE' });
    }
  }
  if (identity || phone) {
    const students = await prisma.student.findMany({
      where: {
        ...(row.studentId ? { id: { not: row.studentId } } : {}),
        OR: [...(phone ? [{ telephone: phone }] : []), ...(identity ? [{ studentExternalId: identity }] : [])],
      },
      select: { publicId: true, studentName: true, studentExternalId: true },
    });
    for (const student of students) {
      const confirmed = row.accountType === 'STUDENT' && Boolean(identity && student.studentExternalId === identity);
      matches.push({ source: 'Student', id: student.publicId, name: student.studentName, reason: confirmed ? 'CONFIRMED' : 'POSSIBLE' });
    }
  }
  const registrations = await prisma.registration.findMany({
    where: {
      ...(row.registrationId ? { id: { not: row.registrationId } } : {}),
      OR: [
        { phone },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        ...(registrationNumber ? [{ referenceCode: registrationNumber }] : []),
      ],
    },
    select: { publicId: true, displayName: true, referenceCode: true, kind: true },
  });
  for (const registration of registrations) {
    const confirmed = Boolean(registrationNumber && registration.referenceCode === registrationNumber && registration.kind === row.accountType);
    matches.push({ source: 'Registration', id: registration.publicId, name: registration.displayName, reason: confirmed ? 'CONFIRMED' : 'POSSIBLE' });
  }
  return matches;
}

export async function checkDuplicates(publicId: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['VERIFICATION'], 'Run the duplicate check after phone, email, and address are verified.');
  if (row.phoneStatus !== 'VERIFIED' || row.emailStatus !== 'VERIFIED' || row.addressStatus !== 'VERIFIED') {
    throw errors.unprocessable('CONTACTS_PENDING', 'Phone, email, and address must be verified first.');
  }
  const matches = await findDuplicates(row);
  const result = matches.some((item) => item.reason === 'CONFIRMED')
    ? 'CONFIRMED_DUPLICATE'
    : matches.length
      ? 'POSSIBLE_DUPLICATE'
      : 'NO_DUPLICATE';
  const status = result === 'NO_DUPLICATE' ? 'PENDING_APPROVAL' : 'VERIFICATION';
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: { duplicateResult: result, duplicateMatches: matches, status, lastActivityAt: new Date() },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DUPLICATE_CHECKED', previousStatus: row.status, newStatus: status, reason: result, reference: String(matches.length) });
  return reload(row.id);
}

export async function clearDuplicate(publicId: string, note: string, trace: Trace) {
  const row = await load(publicId);
  if (row.duplicateResult !== 'POSSIBLE_DUPLICATE') {
    throw errors.unprocessable('DUPLICATE_CONFIRMED', 'A confirmed duplicate must be linked to the existing record or rejected.');
  }
  if (note.trim().length < 5) throw errors.unprocessable('NOTE_REQUIRED', 'Explain why this possible duplicate can proceed.');
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: { duplicateResult: 'CLEARED', duplicateNote: note.trim(), status: 'PENDING_APPROVAL', lastActivityAt: new Date() },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DUPLICATE_CLEARED', previousStatus: row.status, newStatus: 'PENDING_APPROVAL', reason: note.trim() });
  return reload(row.id);
}

export async function linkParty(publicId: string, partyId: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'KYC_KYB', 'VERIFICATION', 'PENDING_APPROVAL', 'MORE_INFORMATION_REQUIRED'], 'This account is already open.');
  const linked = await resolveParty(asType(row.accountType), partyId);
  const profile = { ...profileOf(row.profile), ...linked.profile };
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: {
      schoolId: linked.schoolId ?? null,
      guardianId: linked.guardianId ?? null,
      studentId: linked.studentId ?? null,
      registrationId: linked.registrationId ?? null,
      profile,
      duplicateResult: 'NOT_CHECKED',
      duplicateMatches: [],
      status: row.status === 'PENDING_APPROVAL' ? 'VERIFICATION' : row.status,
      lastActivityAt: new Date(),
    },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'PARTY_LINKED', previousStatus: row.status, newStatus: row.status, reference: partyId });
  return reload(row.id);
}

export async function saveRisk(publicId: string, input: { riskLevel: string; notes: string; complianceResult: string }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['PENDING_APPROVAL', 'VERIFICATION'], 'Assess risk after the duplicate check.');
  if (!['NO_DUPLICATE', 'CLEARED'].includes(row.duplicateResult)) {
    throw errors.unprocessable('DUPLICATE_PENDING', 'Resolve the duplicate check before the risk assessment.');
  }
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(input.riskLevel)) throw errors.unprocessable('RISK_INVALID', 'Risk is low, medium, or high.');
  if (!['CLEAR', 'REVIEW', 'FAILED'].includes(input.complianceResult)) throw errors.unprocessable('COMPLIANCE_INVALID', 'Compliance is clear, review, or failed.');
  if (input.notes.trim().length < 5) throw errors.unprocessable('NOTE_REQUIRED', 'Record the risk notes.');
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: { riskLevel: input.riskLevel, riskNotes: input.notes.trim(), complianceResult: input.complianceResult, status: 'PENDING_APPROVAL', lastActivityAt: new Date() },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'RISK_RECORDED', previousStatus: row.status, newStatus: 'PENDING_APPROVAL', reason: `${input.riskLevel} / ${input.complianceResult}` });
  return reload(row.id);
}

export async function decide(publicId: string, input: { decision: 'APPROVE' | 'CONDITIONAL' | 'REJECT' | 'MORE_INFORMATION'; conditions?: string; reason?: string }, trace: Trace) {
  const row = await load(publicId);
  const actor = await actorLabel(trace.actorId);
  if (input.decision === 'REJECT') {
    assertStatus(row, OPEN_STATUSES, 'This application is already finished.');
    if (!input.reason || input.reason.trim().length < 5) throw errors.unprocessable('REASON_REQUIRED', 'Record the rejection reason.');
    await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'REJECTED', decision: 'REJECTED', rejectionReason: input.reason.trim(), approvedBy: actor, approvalDate: new Date() } });
    await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'APPLICATION_REJECTED', previousStatus: row.status, newStatus: 'REJECTED', reason: input.reason.trim() });
    return reload(row.id);
  }
  if (input.decision === 'MORE_INFORMATION') {
    assertStatus(row, ['SUBMITTED', 'DOCUMENT_REVIEW', 'KYC_KYB', 'VERIFICATION', 'PENDING_APPROVAL'], 'Ask for more information while the application is still in review.');
    if (!input.reason || input.reason.trim().length < 5) throw errors.unprocessable('REASON_REQUIRED', 'Say what information is still required.');
    await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'MORE_INFORMATION_REQUIRED', decision: 'MORE_INFORMATION', rejectionReason: input.reason.trim(), lastActivityAt: new Date() } });
    await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'INFORMATION_REQUESTED', previousStatus: row.status, newStatus: 'MORE_INFORMATION_REQUIRED', reason: input.reason.trim() });
    return reload(row.id);
  }
  assertStatus(row, ['PENDING_APPROVAL'], 'Approve the application after risk assessment.');
  if (row.kycResult !== 'VERIFIED' || row.documentStatus !== 'VERIFIED') throw errors.unprocessable('REVIEW_INCOMPLETE', 'Documents and KYC or KYB must be verified.');
  if (!['NO_DUPLICATE', 'CLEARED'].includes(row.duplicateResult)) throw errors.unprocessable('DUPLICATE_PENDING', 'Resolve the duplicate check before approval.');
  if (!row.riskLevel) throw errors.unprocessable('RISK_REQUIRED', 'Record the risk assessment before approval.');
  if (row.complianceResult === 'FAILED') throw errors.unprocessable('COMPLIANCE_FAILED', 'Failed compliance cannot be approved.');
  if (input.decision === 'CONDITIONAL' && !input.conditions?.trim()) throw errors.unprocessable('CONDITIONS_REQUIRED', 'Record the approval conditions.');
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: {
      status: 'APPROVED',
      decision: input.decision,
      conditions: input.conditions?.trim() || null,
      approvedBy: actor,
      approvalDate: new Date(),
      roleName: ROLE[asType(row.accountType)],
      lastActivityAt: new Date(),
    },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'APPLICATION_APPROVED', previousStatus: row.status, newStatus: 'APPROVED', reason: input.conditions });
  return reload(row.id);
}

async function ensureRepresentative(schoolId: string, profile: Record<string, string>, row: Loaded) {
  if (!profile.representativeName) return;
  const existing = await prisma.schoolRepresentative.findFirst({ where: { schoolId, fullName: profile.representativeName } });
  if (existing) return;
  await prisma.schoolRepresentative.create({
    data: {
      publicId: await nextPublicId('REP'),
      schoolId,
      fullName: profile.representativeName,
      title: profile.representativeTitle || 'Representative',
      nationalId: profile.representativeId || null,
      phone: profile.representativePhone || row.phone,
      email: profile.representativeEmail || row.email,
      authorized: true,
    },
  });
}

async function ensureBank(schoolId: string, profile: Record<string, string>, actor: string) {
  if (!profile.accountNumber || !profile.bankName || !profile.accountName) return;
  const existing = await prisma.schoolBankAccount.findFirst({ where: { schoolId, accountNumber: profile.accountNumber } });
  if (existing) {
    await prisma.schoolBankAccount.update({ where: { id: existing.id }, data: { accountVerified: true, verifiedBy: actor, verificationDate: new Date(), isPrimary: true } });
    return;
  }
  await prisma.schoolBankAccount.create({
    data: {
      schoolId,
      bankName: profile.bankName,
      branch: profile.branch || null,
      accountName: profile.accountName,
      accountNumber: profile.accountNumber,
      currency: profile.currency || 'RWF',
      isPrimary: true,
      accountVerified: true,
      verifiedBy: actor,
      verificationDate: new Date(),
    },
  });
}

async function materialize(row: Loaded, actor: string) {
  const profile = profileOf(row.profile);
  const type = asType(row.accountType);
  if (type === 'SCHOOL') {
    let school = row.schoolId ? await prisma.school.findUnique({ where: { id: row.schoolId } }) : null;
    if (!school && profile.registrationNumber) school = await prisma.school.findUnique({ where: { registrationNumber: profile.registrationNumber } });
    if (!school) {
      if (!row.email) throw errors.unprocessable('EMAIL_REQUIRED', 'A school account needs an email.');
      school = await prisma.school.create({
        data: {
          publicId: await nextPublicId('SCH'),
          schoolName: profile.schoolName || row.applicantName,
          registrationNumber: profile.registrationNumber,
          schoolType: enumValue(profile.schoolType, ['NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER'] as const, 'OTHER') as SchoolType,
          ownershipType: enumValue(profile.ownershipType, ['PRIVATE', 'PUBLIC', 'GOVERNMENT_AIDED', 'FAITH_BASED', 'COMMUNITY', 'OTHER'] as const, 'PRIVATE') as OwnershipType,
          phone: row.phone,
          email: row.email,
          province: profile.province || row.province || 'Kigali',
          district: profile.district || row.district || 'Gasabo',
          sector: row.sector,
          cell: row.cell,
          village: row.village,
          physicalAddress: row.address,
          status: 'ACTIVE',
          kybStatus: 'VERIFIED',
          registrationVerified: true,
          legalDocumentsVerified: true,
          representativeVerified: true,
          addressVerified: true,
          bankAccountVerified: true,
          documentsComplete: true,
        },
      });
    } else {
      await prisma.school.update({
        where: { id: school.id },
        data: {
          kybStatus: 'VERIFIED',
          registrationVerified: true,
          legalDocumentsVerified: true,
          representativeVerified: true,
          addressVerified: true,
          bankAccountVerified: true,
          documentsComplete: true,
          status: OPENABLE.includes(school.status) ? 'ACTIVE' : school.status,
        },
      });
    }
    await ensureRepresentative(school.id, profile, row);
    await ensureBank(school.id, profile, actor);
    return { schoolId: school.id, guardianId: null, studentId: null, registrationId: null };
  }
  if (type === 'PARENT') {
    let guardian = row.guardianId ? await prisma.guardian.findUnique({ where: { id: row.guardianId } }) : null;
    if (!guardian && row.identityNumber) guardian = await prisma.guardian.findFirst({ where: { nationalId: row.identityNumber } });
    if (!guardian) {
      guardian = await prisma.guardian.create({
        data: {
          publicId: await nextPublicId('GRD'),
          fullName: row.applicantName,
          phone: row.phone,
          email: row.email,
          nationalId: row.identityNumber,
          notifyChannel: row.communicationPreference === 'EMAIL' || row.communicationPreference === 'SMS' ? row.communicationPreference : 'IN_APP',
        },
      });
    }
    let studentId: string | null = null;
    if (profile.studentPublicId) {
      const student = await prisma.student.findUnique({ where: { publicId: profile.studentPublicId } });
      if (student) {
        studentId = student.id;
        await prisma.studentGuardian.upsert({
          where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
          create: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: profile.relationship || 'Guardian',
            isPrimary: true,
            financialResponsibility: profile.financialResponsibility === 'true',
            paymentAuthorization: profile.paymentAuthorization === 'true',
            communicationAuthorization: true,
          },
          update: { relationship: profile.relationship || 'Guardian', isPrimary: true },
        });
      }
    }
    return { schoolId: null, guardianId: guardian.id, studentId, registrationId: null };
  }
  if (type === 'STUDENT') {
    const school = row.schoolId
      ? await prisma.school.findUnique({ where: { id: row.schoolId } })
      : await prisma.school.findUnique({ where: { publicId: profile.schoolPublicId } });
    if (!school) throw errors.unprocessable('SCHOOL_REQUIRED', 'Choose the school this student attends.');
    const externalId = profile.studentNumber || row.identityNumber || row.publicId;
    let student = row.studentId ? await prisma.student.findUnique({ where: { id: row.studentId } }) : await prisma.student.findFirst({ where: { schoolId: school.id, studentExternalId: externalId } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          publicId: await nextPublicId('STD'),
          schoolId: school.id,
          studentExternalId: externalId,
          studentName: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || row.applicantName,
          firstName: profile.firstName || null,
          middleName: profile.middleName || null,
          lastName: profile.lastName || null,
          dateOfBirth: profile.dateOfBirth ? day(profile.dateOfBirth) : null,
          gender: profile.gender === 'MALE' || profile.gender === 'FEMALE' ? profile.gender as StudentGender : null,
          nationality: profile.nationality || 'RW',
          academicYear: profile.academicYear,
          classLevel: profile.classLevel,
          stream: profile.stream || null,
          province: row.province,
          district: row.district,
          sector: row.sector,
          cell: row.cell,
          village: row.village,
          physicalAddress: row.address,
          telephone: row.phone,
          emergencyContact: profile.guardianPhone || null,
          status: 'ACTIVE',
        },
      });
    } else if (student.status !== 'ACTIVE') {
      await prisma.student.update({ where: { id: student.id }, data: { status: 'ACTIVE' } });
    }
    await prisma.studentFinancialAccount.upsert({
      where: { studentId: student.id },
      create: { studentId: student.id, currency: 'RWF', feeStructureLabel: profile.feeCategory || null },
      update: {},
    });
    let guardian = profile.guardianPublicId ? await prisma.guardian.findUnique({ where: { publicId: profile.guardianPublicId } }) : null;
    if (!guardian && profile.guardianPhone) guardian = await prisma.guardian.findFirst({ where: { phone: profile.guardianPhone } });
    if (!guardian && profile.guardianName) {
      guardian = await prisma.guardian.create({ data: { publicId: await nextPublicId('GRD'), fullName: profile.guardianName, phone: profile.guardianPhone || null } });
    }
    if (guardian) {
      await prisma.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
        create: { studentId: student.id, guardianId: guardian.id, relationship: profile.relationship || 'Guardian', isPrimary: true, isEmergencyContact: true, financialResponsibility: true, communicationAuthorization: true },
        update: { relationship: profile.relationship || 'Guardian' },
      });
    }
    return { schoolId: school.id, guardianId: guardian?.id ?? null, studentId: student.id, registrationId: null };
  }
  const kind = type === 'TEACHER' ? 'TEACHER' : 'SUPPLIER';
  const employer = profile.schoolPublicId ? await prisma.school.findUnique({ where: { publicId: profile.schoolPublicId } }) : null;
  let registration = row.registrationId ? await prisma.registration.findUnique({ where: { id: row.registrationId } }) : null;
  if (!registration && row.email) registration = await prisma.registration.findFirst({ where: { kind, email: row.email } });
  const displayName = profile.businessName || row.applicantName;
  if (!registration) {
    registration = await prisma.registration.create({
      data: {
        publicId: await nextPublicId('REG'),
        kind,
        status: 'ACTIVE',
        displayName,
        referenceCode: profile.registrationNumber || row.identityNumber,
        email: row.email,
        phone: row.phone,
        province: row.province,
        district: row.district,
        sector: row.sector,
        cell: row.cell,
        village: row.village,
        physicalAddress: row.address,
        profile: profile as Prisma.InputJsonValue,
        schoolId: employer?.id,
        identityVerified: true,
        documentsVerified: true,
        contactVerified: true,
        addressVerified: true,
        financialVerified: kind === 'SUPPLIER',
        consentCaptured: true,
        duplicateChecked: true,
        decision: 'APPROVED',
        approvedBy: actor,
        approvalDate: new Date(),
      },
    });
  } else {
    await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'ACTIVE', displayName, identityVerified: true, documentsVerified: true, contactVerified: true, addressVerified: true, consentCaptured: true, duplicateChecked: true, decision: 'APPROVED', approvedBy: actor, approvalDate: new Date(), schoolId: employer?.id ?? registration.schoolId },
    });
  }
  return { schoolId: employer?.id ?? null, guardianId: null, studentId: null, registrationId: registration.id };
}

export async function activate(publicId: string, input: { username: string; mfaMethod: string; dailyLimit?: number; transactionLimit?: number }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['APPROVED'], 'Activate an approved account.');
  if (!['APP', 'SMS', 'EMAIL'].includes(input.mfaMethod)) throw errors.unprocessable('MFA_INVALID', 'Choose an app, SMS, or email verification method.');
  if (input.username.trim().length < 3) throw errors.unprocessable('USERNAME_REQUIRED', 'Choose a username of at least 3 characters.');
  const actor = await actorLabel(trace.actorId);
  const links = await materialize(row, actor);
  const defaults = LIMITS[asType(row.accountType)];
  const limits = {
    daily: input.dailyLimit ?? defaults.daily,
    transaction: input.transactionLimit ?? defaults.transaction,
    currency: 'RWF',
  };
  let userId: string | null = null;
  let accessIssued = false;
  if (row.email) {
    const user = await prisma.user.findUnique({ where: { email: row.email } });
    if (user) {
      userId = user.id;
      accessIssued = true;
      if (row.mfaRequired) await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      if (links.schoolId && (row.accountType === 'SCHOOL' || row.accountType === 'TEACHER')) {
        await prisma.schoolUser.upsert({
          where: { schoolId_userId: { schoolId: links.schoolId, userId: user.id } },
          create: { schoolId: links.schoolId, userId: user.id, title: row.roleName },
          update: {},
        });
      }
      if (links.guardianId) {
        const guardian = await prisma.guardian.findUnique({ where: { id: links.guardianId } });
        const taken = await prisma.guardian.findUnique({ where: { userId: user.id } });
        if (guardian && !guardian.userId && !taken) await prisma.guardian.update({ where: { id: guardian.id }, data: { userId: user.id } });
      }
    }
  }
  await prisma.consent.create({
    data: {
      publicId: await nextPublicId('CON'),
      subjectId: row.publicId,
      purpose: 'ACCOUNT_OPENING',
      recipient: 'RUPSA Next',
      scope: ['ACCOUNT', 'PROFILE', 'NOTIFICATIONS'],
      evidenceRef: row.consentVersion || 'account-opening-v1',
      expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.openedAccount.update({
    where: { id: row.id },
    data: {
      ...links,
      status: 'ACTIVE',
      username: input.username.trim(),
      roleName: ROLE[asType(row.accountType)],
      mfaRequired: true,
      mfaMethod: input.mfaMethod,
      limits,
      userId,
      accessIssued,
      activatedAt: new Date(),
      activatedBy: actor,
      lastActivityAt: new Date(),
    },
  });
  await queueNotice({
    channel: row.communicationPreference || 'IN_APP',
    subject: `Welcome to RUPSA Next, ${row.applicantName}`,
    body: `Your ${row.accountType.toLowerCase()} account ${row.publicId} is active. Sign-in name: ${input.username.trim()}.`,
    userId: userId ?? undefined,
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'ACCOUNT_ACTIVATED', previousStatus: 'APPROVED', newStatus: 'ACTIVE', reference: input.username.trim() });
  return reload(row.id);
}

async function closureBlockers(row: Pick<Loaded, 'schoolId' | 'studentId' | 'legalHold' | 'legalHoldReason'>) {
  const blockers: string[] = [];
  if (row.legalHold) blockers.push(row.legalHoldReason || 'Legal hold');
  if (row.schoolId) {
    const [invoices, loans, guarantees, payments] = await Promise.all([
      prisma.invoice.count({ where: { schoolId: row.schoolId, status: { in: [...OPEN_INVOICE] } } }),
      prisma.loan.count({ where: { application: { schoolId: row.schoolId }, status: { in: [...OPEN_LOAN] } } }),
      prisma.guarantee.count({ where: { schoolId: row.schoolId, status: { in: [...OPEN_GUARANTEE] } } }),
      prisma.payment.count({ where: { status: { in: ['PENDING', 'INITIATED'] }, invoice: { schoolId: row.schoolId } } }),
    ]);
    if (invoices) blockers.push(`${invoices} open invoice${invoices === 1 ? '' : 's'}`);
    if (loans) blockers.push(`${loans} open loan${loans === 1 ? '' : 's'}`);
    if (guarantees) blockers.push(`${guarantees} open guarantee${guarantees === 1 ? '' : 's'}`);
    if (payments) blockers.push(`${payments} pending payment${payments === 1 ? '' : 's'}`);
  }
  if (row.studentId) {
    const financial = await prisma.studentFinancialAccount.findUnique({ where: { studentId: row.studentId } });
    if (financial && financial.outstanding.gt(0)) blockers.push(`Student balance ${money(financial.outstanding)} RWF`);
    const invoices = await prisma.invoice.count({ where: { studentId: row.studentId, status: { in: [...OPEN_INVOICE] } } });
    if (invoices) blockers.push(`${invoices} open student invoices`);
  }
  return blockers;
}

export async function suspend(publicId: string, reason: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['ACTIVE', 'DORMANT'], 'Suspend an active or dormant account.');
  if (reason.trim().length < 5) throw errors.unprocessable('REASON_REQUIRED', 'Record the suspension reason.');
  await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.trim(), lastActivityAt: new Date() } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'ACCOUNT_SUSPENDED', previousStatus: row.status, newStatus: 'SUSPENDED', reason: reason.trim() });
  return reload(row.id);
}

export async function reactivate(publicId: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['SUSPENDED', 'DORMANT'], 'Reactivate a suspended or dormant account.');
  if (row.kycResult !== 'VERIFIED') throw errors.unprocessable('KYC_PENDING', 'KYC or KYB must still be verified.');
  if (row.legalHold) throw errors.unprocessable('LEGAL_HOLD', 'Release the legal hold before reactivation.');
  await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'ACTIVE', suspendedAt: null, suspensionReason: null, lastActivityAt: new Date() } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'ACCOUNT_REACTIVATED', previousStatus: row.status, newStatus: 'ACTIVE' });
  return reload(row.id);
}

export async function markDormantAccount(publicId: string, reason: string | undefined, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['ACTIVE'], 'Only an active account can be marked dormant.');
  await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'DORMANT', lastActivityAt: row.lastActivityAt } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DORMANCY_MARKED', previousStatus: 'ACTIVE', newStatus: 'DORMANT', reason: reason?.trim() || 'Marked dormant by an officer' });
  return reload(row.id);
}

export async function setHold(publicId: string, input: { active: boolean; reason?: string }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['ACTIVE', 'SUSPENDED', 'DORMANT', 'APPROVED'], 'A legal hold applies to an open account.');
  if (input.active && !input.reason?.trim()) throw errors.unprocessable('REASON_REQUIRED', 'Record the legal-hold reason.');
  await prisma.openedAccount.update({ where: { id: row.id }, data: { legalHold: input.active, legalHoldReason: input.active ? input.reason!.trim() : null } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: input.active ? 'LEGAL_HOLD_SET' : 'LEGAL_HOLD_RELEASED', previousStatus: row.status, newStatus: row.status, reason: input.reason });
  return reload(row.id);
}

export async function close(publicId: string, reason: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['ACTIVE', 'SUSPENDED', 'DORMANT', 'INACTIVE', 'APPROVED'], 'This account cannot be closed from its current status.');
  if (reason.trim().length < 5) throw errors.unprocessable('REASON_REQUIRED', 'Record the closure reason.');
  const blockers = await closureBlockers(row);
  if (blockers.length) throw errors.unprocessable('CLOSURE_BLOCKED', blockers.join('. ') + '.');
  await prisma.openedAccount.update({ where: { id: row.id }, data: { status: 'CLOSED', closedAt: new Date(), closureReason: reason.trim() } });
  if (row.accountType === 'SCHOOL' && row.schoolId) await prisma.school.update({ where: { id: row.schoolId }, data: { status: 'INACTIVE' } });
  if (row.accountType === 'STUDENT' && row.studentId) await prisma.student.update({ where: { id: row.studentId }, data: { status: 'WITHDRAWN' } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'ACCOUNT_CLOSED', previousStatus: row.status, newStatus: 'CLOSED', reason: reason.trim() });
  return reload(row.id);
}

const CHANGE_FIELDS = ['applicantName', 'phone', 'email', 'address', 'province', 'district', 'sector', 'cell', 'village', 'communicationPreference'] as const;

export async function requestChange(publicId: string, input: { field: string; value: string; reason: string }, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['DRAFT', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'DORMANT'], 'This account does not accept changes.');
  if (input.reason.trim().length < 5) throw errors.unprocessable('REASON_REQUIRED', 'Record why the detail is changing.');
  const value = input.value.trim();
  if (!value) throw errors.unprocessable('VALUE_REQUIRED', 'Enter the new value.');
  const changes = readList<Record<string, string>>(row.changes);
  const actor = await actorLabel(trace.actorId);
  if (input.field.startsWith('profile.')) {
    const key = input.field.slice('profile.'.length);
    if (!/^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(key)) throw errors.unprocessable('FIELD_INVALID', 'Choose a profile field to change.');
    const profile = profileOf(row.profile);
    changes.push({ field: input.field, previous: profile[key] ?? '', value, reason: input.reason.trim(), at: new Date().toISOString(), by: actor });
    profile[key] = value;
    await prisma.openedAccount.update({ where: { id: row.id }, data: { profile, changes, lastActivityAt: new Date() } });
  } else if ((CHANGE_FIELDS as readonly string[]).includes(input.field)) {
    const previous = textOf(row[input.field as keyof Loaded]);
    changes.push({ field: input.field, previous, value, reason: input.reason.trim(), at: new Date().toISOString(), by: actor });
    await prisma.openedAccount.update({ where: { id: row.id }, data: { [input.field]: value, changes, lastActivityAt: new Date() } });
    if (row.schoolId && (input.field === 'phone' || input.field === 'email')) {
      await prisma.school.update({ where: { id: row.schoolId }, data: { [input.field]: value } });
    }
    if (row.guardianId && ['applicantName', 'phone', 'email'].includes(input.field)) {
      const data = input.field === 'applicantName' ? { fullName: value } : { [input.field]: value };
      await prisma.guardian.update({ where: { id: row.guardianId }, data });
    }
    if (row.studentId && input.field === 'phone') await prisma.student.update({ where: { id: row.studentId }, data: { telephone: value } });
    if (row.registrationId && ['applicantName', 'phone', 'email'].includes(input.field)) {
      const data = input.field === 'applicantName' ? { displayName: value } : { [input.field]: value };
      await prisma.registration.update({ where: { id: row.registrationId }, data });
    }
  } else {
    throw errors.unprocessable('FIELD_INVALID', 'That field cannot be changed from this file.');
  }
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DETAILS_CHANGED', previousStatus: row.status, newStatus: row.status, reason: `${input.field}: ${input.reason.trim()}` });
  return reload(row.id);
}

export async function registerDevice(publicId: string, name: string, trace: Trace) {
  const row = await load(publicId);
  assertStatus(row, ['ACTIVE'], 'Register a device on an active account.');
  if (name.trim().length < 2) throw errors.unprocessable('DEVICE_REQUIRED', 'Name the device.');
  const devices = readList<{ name: string; registeredAt: string }>(row.devices);
  devices.push({ name: name.trim(), registeredAt: new Date().toISOString() });
  await prisma.openedAccount.update({ where: { id: row.id }, data: { devices, lastActivityAt: new Date() } });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'DEVICE_REGISTERED', previousStatus: row.status, newStatus: row.status, reference: name.trim() });
  return reload(row.id);
}

export async function linkStudent(publicId: string, input: { studentPublicId: string; relationship: string; financialResponsibility?: boolean; paymentAuthorization?: boolean }, trace: Trace) {
  const row = await load(publicId);
  if (row.accountType !== 'PARENT' || !row.guardianId) throw errors.unprocessable('PARENT_REQUIRED', 'Link a student after the parent account is active.');
  assertStatus(row, ['ACTIVE'], 'Link a student on an active parent account.');
  const student = await prisma.student.findUnique({ where: { publicId: input.studentPublicId } });
  if (!student) throw errors.notFound('STUDENT_NOT_FOUND', 'Student not found.');
  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: student.id, guardianId: row.guardianId } },
    create: {
      studentId: student.id,
      guardianId: row.guardianId,
      relationship: input.relationship.trim() || 'Guardian',
      isPrimary: false,
      financialResponsibility: Boolean(input.financialResponsibility),
      paymentAuthorization: Boolean(input.paymentAuthorization),
      communicationAuthorization: true,
    },
    update: {
      relationship: input.relationship.trim() || 'Guardian',
      financialResponsibility: Boolean(input.financialResponsibility),
      paymentAuthorization: Boolean(input.paymentAuthorization),
    },
  });
  await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'STUDENT_LINKED', previousStatus: row.status, newStatus: row.status, reference: student.publicId });
  return reload(row.id);
}

export async function statement(publicId: string) {
  const row = await load(publicId);
  const where = row.studentId ? { studentId: row.studentId } : row.schoolId ? { schoolId: row.schoolId } : null;
  const financial = row.studentId ? await prisma.studentFinancialAccount.findUnique({ where: { studentId: row.studentId } }) : null;
  const invoices = where
    ? await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { publicId: true, description: true, amount: true, amountPaid: true, balance: true, currency: true, status: true, dueDate: true },
    })
    : [];
  const outstanding = financial ? money(financial.outstanding) : invoices.reduce((sum, invoice) => sum + (OPEN_INVOICE.includes(invoice.status as typeof OPEN_INVOICE[number]) ? money(invoice.balance) : 0), 0);
  return {
    accountId: row.publicId,
    party: partyOf(row),
    currency: financial?.currency ?? 'RWF',
    billed: financial ? money(financial.totalBilled) : invoices.reduce((sum, invoice) => sum + money(invoice.amount), 0),
    paid: financial ? money(financial.totalPaid) : invoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0),
    outstanding,
    blockers: await closureBlockers(row),
    invoices: invoices.map((invoice) => ({
      id: invoice.publicId,
      description: invoice.description,
      amount: money(invoice.amount),
      paid: money(invoice.amountPaid),
      balance: money(invoice.balance),
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
    })),
  };
}

export async function report(type: string) {
  if (type === 'by-type') {
    const groups = await prisma.openedAccount.groupBy({ by: ['accountType'], _count: { _all: true } });
    return groups.map((group) => ({ name: group.accountType, value: group._count._all }));
  }
  const statuses: Record<string, string[]> = {
    applications: OPEN_STATUSES,
    active: ['ACTIVE'],
    suspended: ['SUSPENDED', 'DORMANT'],
    closed: ['CLOSED'],
    rejected: ['REJECTED'],
  };
  const where: Prisma.OpenedAccountWhereInput = type === 'duplicates'
    ? { duplicateResult: { in: ['POSSIBLE_DUPLICATE', 'CONFIRMED_DUPLICATE'] } }
    : { status: { in: statuses[type] ?? OPEN_STATUSES } };
  const rows = await prisma.openedAccount.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map(rowOf);
}

export async function sendMessage(input: { accountId?: string; kind: string; channel: string; subject: string; message: string }, trace: Trace) {
  const row = input.accountId ? await load(input.accountId) : null;
  const actor = await actorLabel(trace.actorId);
  const message = await prisma.accountMessage.create({
    data: {
      publicId: await nextPublicId('AMS'),
      accountId: row?.id,
      accountName: row?.applicantName ?? 'Account holders',
      kind: input.kind,
      channel: input.channel,
      subject: input.subject.trim(),
      message: input.message.trim(),
      sentBy: actor,
      status: 'QUEUED',
    },
  });
  await queueNotice({ channel: input.channel, subject: input.subject.trim(), body: input.message.trim(), userId: row?.userId ?? undefined });
  if (row) await audit({ trace, accountId: row.id, entityId: row.publicId, action: 'NOTICE_QUEUED', previousStatus: row.status, newStatus: row.status, reference: message.publicId });
  return { id: message.publicId, status: message.status };
}

export async function listMessages() {
  const rows = await prisma.accountMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    id: row.publicId,
    account: row.accountName,
    kind: row.kind,
    channel: row.channel,
    subject: row.subject,
    message: row.message,
    sentBy: row.sentBy,
    status: row.status,
    sentAt: row.sentAt.toISOString(),
  }));
}

export async function listAudits() {
  const rows = await prisma.accountAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { account: { select: { publicId: true, applicantName: true } } } });
  return rows.map((row) => ({
    id: row.publicId,
    accountId: row.account.publicId,
    account: row.account.applicantName,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    reason: row.reason,
    actor: row.userId,
    at: row.createdAt.toISOString(),
  }));
}
