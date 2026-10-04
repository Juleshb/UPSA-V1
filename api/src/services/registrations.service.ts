import {
  Prisma,
  type DocumentVerificationStatus,
  type RegistrationKind,
  type RegistrationStatus,
  type SchoolStatus,
} from '@prisma/client';
import { z } from 'zod';
import { errors } from '../utils/errors';
import { publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';
import { claimPendingUpload } from './uploads';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const gender = z.enum(['FEMALE', 'MALE']);

const parentSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  dateOfBirth: day.optional(),
  gender: gender.optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER']).optional(),
  phone: z.string().min(6),
  alternativePhone: z.string().optional(),
  email: z.string().email(),
  province: z.string().min(1),
  district: z.string().min(1),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  physicalAddress: z.string().optional(),
  idType: z.enum(['NATIONAL_ID', 'PASSPORT']).optional(),
  idNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  issueDate: day.optional(),
  expiryDate: day.optional(),
  membershipUserId: z.string().optional(),
  studentId: z.string().optional(),
  relationship: z.enum(['Father', 'Mother', 'Guardian', 'Sponsor', 'Other authorized relationship']).optional(),
  primaryGuardian: z.boolean().optional(),
  financiallyResponsible: z.boolean().optional(),
  schoolCommunication: z.boolean().optional(),
  paymentAuthorization: z.boolean().optional(),
  consentIdentity: z.literal(true, { errorMap: () => ({ message: 'Identity verification consent is required.' }) }),
  consentTerms: z.literal(true, { errorMap: () => ({ message: 'Terms consent is required.' }) }),
}).superRefine((value, context) => {
  if (value.studentId && !value.relationship) {
    context.addIssue({ code: 'custom', message: 'Choose the relationship to the student.', path: ['relationship'] });
  }
});

const teacherSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  dateOfBirth: day.optional(),
  gender: gender.optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  employeeNumber: z.string().optional(),
  schoolId: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  employmentType: z.enum(['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'CONSULTANT', 'VOLUNTEER']),
  dateJoined: day.optional(),
  contractStart: day.optional(),
  contractEnd: day.optional(),
  staffStatus: z.enum(['APPLICANT', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
  qualification: z.string().optional(),
  institution: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  graduationYear: z.string().optional(),
  teachingSubject: z.string().optional(),
  professionalCertificate: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: day.optional(),
  yearsExperience: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email(),
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  physicalAddress: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const supplierSchema = z.object({
  supplierCode: z.string().optional(),
  businessName: z.string().min(2),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  businessType: z.enum(['GOODS', 'SERVICE', 'CONTRACTOR', 'TECHNOLOGY', 'TRANSPORT', 'CONSULTANT', 'OTHER']),
  businessSector: z.string().optional(),
  dateEstablished: day.optional(),
  contactPerson: z.string().min(2),
  position: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email(),
  website: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  physicalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  bankName: z.string().optional(),
  branch: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  currency: z.string().optional(),
  swiftCode: z.string().optional(),
  businessVerification: z.boolean().optional(),
  ownershipVerification: z.boolean().optional(),
  taxVerification: z.boolean().optional(),
  bankVerification: z.boolean().optional(),
  complianceVerification: z.boolean().optional(),
  conflictOfInterest: z.boolean().optional(),
  requiredDocumentsDeclared: z.boolean().optional(),
});

const investorSchema = z.object({
  investorType: z.enum(['INDIVIDUAL', 'COMPANY', 'INSTITUTION', 'FUND', 'ORGANIZATION', 'OTHER']),
  investorName: z.string().min(2),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  nationalId: z.string().optional(),
  dateOfBirth: day.optional(),
  country: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email(),
  investmentCategory: z.string().optional(),
  investmentObjective: z.string().optional(),
  expectedAmount: z.string().optional(),
  preferredType: z.string().optional(),
  investmentPeriod: z.string().optional(),
  currency: z.string().optional(),
  existingExposure: z.string().optional(),
  riskInformation: z.string().optional(),
  sourceOfFunds: z.string().optional(),
  ownershipInformation: z.string().optional(),
  directors: z.string().optional(),
  authorizedRepresentative: z.string().optional(),
  beneficialOwnership: z.string().optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankCurrency: z.string().optional(),
  consentIdentity: z.literal(true, { errorMap: () => ({ message: 'Identity verification consent is required.' }) }),
  consentFinancial: z.boolean().optional(),
  consentProcessing: z.literal(true, { errorMap: () => ({ message: 'Consent to process personal information is required.' }) }),
  consentCommunications: z.boolean().optional(),
  consentTerms: z.literal(true, { errorMap: () => ({ message: 'Acceptance of investment terms is required.' }) }),
});

const donorSchema = z.object({
  donorType: z.enum(['INDIVIDUAL', 'COMPANY', 'FOUNDATION', 'ORGANIZATION', 'INSTITUTION', 'PARTNER', 'ANONYMOUS']),
  donorName: z.string().optional(),
  organizationName: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  contactPerson: z.string().optional(),
  position: z.string().optional(),
  preferredChannel: z.enum(['SMS', 'EMAIL', 'IN_APP', 'PHONE']).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactAddress: z.string().optional(),
  donationType: z.string().optional(),
  campaign: z.string().optional(),
  cause: z.string().optional(),
  oneTime: z.boolean().optional(),
  recurring: z.boolean().optional(),
  anonymousPreference: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.donorType !== 'ANONYMOUS' && !value.donorName) {
    context.addIssue({ code: 'custom', message: 'Enter the donor name.', path: ['donorName'] });
  }
  if (value.donorType !== 'ANONYMOUS' && !value.email) {
    context.addIssue({ code: 'custom', message: 'Enter an email address.', path: ['email'] });
  }
});

const schemas = {
  PARENT: parentSchema,
  TEACHER: teacherSchema,
  SUPPLIER: supplierSchema,
  INVESTOR: investorSchema,
  DONOR: donorSchema,
} as const;

const PENDING: RegistrationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENT_REVIEW',
  'VERIFICATION',
  'PENDING_APPROVAL',
  'MORE_INFORMATION_REQUIRED',
  'RESUBMITTED',
];

const REVIEW: RegistrationStatus[] = ['DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL'];

export type RegistryKind = RegistrationKind | 'SCHOOL' | 'STUDENT';

export type Trace = {
  actorId?: string;
  actorPublicId?: string;
  requestId?: string;
  ip?: string;
};

type DocumentInput = {
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  fileName: string;
  uploadId?: string;
  comments?: string;
};

const fileInclude = {
  documents: { orderBy: { uploadedAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'desc' as const } },
  school: true,
  guardian: true,
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProfile(profile: Record<string, string | boolean | number>) {
  const out: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number') out[key] = String(value);
    else if (text(value)) out[key] = text(value);
  }
  return out;
}

function parseProfile(kind: RegistrationKind, profile: Record<string, string | boolean | number>) {
  const parsed = schemas[kind].safeParse(normalizeProfile(profile));
  if (!parsed.success) {
    throw errors.badRequest(parsed.error.issues[0]?.message ?? 'The registration form is incomplete.');
  }
  return parsed.data as Record<string, string | boolean | undefined>;
}

function personName(profile: Record<string, string | boolean | undefined>) {
  return [profile.firstName, profile.middleName, profile.lastName].filter((part) => typeof part === 'string' && part).join(' ');
}

function identityFor(kind: RegistrationKind, profile: Record<string, string | boolean | undefined>) {
  if (kind === 'PARENT' || kind === 'TEACHER') {
    return {
      displayName: personName(profile),
      referenceCode: text(profile.employeeNumber) || text(profile.nationalId) || null,
    };
  }
  if (kind === 'SUPPLIER') {
    return { displayName: text(profile.businessName), referenceCode: text(profile.supplierCode) || text(profile.registrationNumber) || text(profile.taxId) || null };
  }
  if (kind === 'INVESTOR') {
    return { displayName: text(profile.investorName), referenceCode: text(profile.registrationNumber) || text(profile.nationalId) || null };
  }
  return {
    displayName: text(profile.donorName) || text(profile.organizationName) || 'Anonymous donor',
    referenceCode: text(profile.registrationNumber) || text(profile.taxId) || null,
  };
}

function contact(profile: Record<string, string | boolean | undefined>) {
  return {
    email: text(profile.email) || null,
    phone: text(profile.phone) || null,
    alternativePhone: text(profile.alternativePhone) || null,
    province: text(profile.province) || null,
    district: text(profile.district) || null,
    sector: text(profile.sector) || null,
    cell: text(profile.cell) || null,
    village: text(profile.village) || null,
    physicalAddress: text(profile.physicalAddress) || text(profile.address) || null,
    postalAddress: text(profile.postalAddress) || null,
    website: text(profile.website) || null,
  };
}

function dateOnly(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function isoDay(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

async function traceEvent(
  registrationId: string,
  action: string,
  previousStatus: RegistrationStatus | null,
  newStatus: RegistrationStatus | null,
  trace: Trace,
  reason?: string,
) {
  await prisma.registrationEvent.create({
    data: {
      registrationId,
      actorId: trace.actorId,
      action,
      previousStatus,
      newStatus,
      reason,
      requestId: trace.requestId,
      ip: trace.ip,
    },
  });
  await writeAudit({
    actorId: trace.actorId,
    action,
    entityType: 'Registration',
    entityId: registrationId,
    requestId: trace.requestId,
    metadata: { previousStatus, newStatus, reason, ip: trace.ip },
  });
}

async function notify(subject: string, body: string, userId?: string) {
  await prisma.notification.create({
    data: {
      publicId: await nextPublicId('NTF'),
      userId,
      channel: 'IN_APP',
      subject,
      body,
      status: 'QUEUED',
    },
  });
}

export async function registrationSummary() {
  const openSchools: SchoolStatus[] = ['APPLICATION', 'SUBMITTED', 'DOCUMENT_REVIEW', 'PENDING_VERIFICATION', 'VERIFICATION'];
  const pendingSchool = { status: { in: openSchools } };
  const [
    users,
    schools,
    parents,
    students,
    teachers,
    suppliers,
    investors,
    donors,
    pendingSchools,
    pendingStudents,
    pendingParties,
    reviewSchools,
    reviewParties,
    approvedSchools,
    approvedParties,
    rejectedSchools,
    rejectedParties,
    suspendedSchools,
    suspendedStudents,
    suspendedParties,
    suspendedUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.school.count(),
    prisma.guardian.count(),
    prisma.student.count(),
    prisma.registration.count({ where: { kind: 'TEACHER' } }),
    prisma.registration.count({ where: { kind: 'SUPPLIER' } }),
    prisma.registration.count({ where: { kind: 'INVESTOR' } }),
    prisma.registration.count({ where: { kind: 'DONOR' } }),
    prisma.school.count({ where: pendingSchool }),
    prisma.student.count({ where: { status: 'APPLICANT' } }),
    prisma.registration.count({ where: { status: { in: PENDING } } }),
    prisma.school.count({ where: { reviewStatus: 'PENDING', ...pendingSchool } }),
    prisma.registration.count({ where: { status: { in: REVIEW } } }),
    prisma.school.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } }),
    prisma.registration.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } }),
    prisma.school.count({ where: { reviewStatus: 'REJECTED' } }),
    prisma.registration.count({ where: { status: 'REJECTED' } }),
    prisma.school.count({ where: { status: 'SUSPENDED' } }),
    prisma.student.count({ where: { status: 'SUSPENDED' } }),
    prisma.registration.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
  ]);

  return {
    users,
    schools,
    parents,
    students,
    teachers,
    suppliers,
    investors,
    donors,
    pending: pendingSchools + pendingStudents + pendingParties,
    pendingVerification: reviewSchools + reviewParties,
    approved: approvedSchools + approvedParties,
    rejected: rejectedSchools + rejectedParties,
    suspended: suspendedSchools + suspendedStudents + suspendedParties + suspendedUsers,
  };
}

export async function searchRegistry(query: { q?: string; kind?: string; status?: string }) {
  const needle = query.q?.trim().toLowerCase() ?? '';
  const [schools, guardians, students, parties] = await Promise.all([
    prisma.school.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.guardian.findMany({ include: { registration: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.student.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.registration.findMany({
      where: { kind: { not: 'PARENT' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const rows = [
    ...schools.map((school) => ({
      id: school.publicId,
      kind: 'SCHOOL' as const,
      name: school.schoolName,
      reference: school.registrationNumber,
      phone: school.phone,
      email: school.email,
      status: school.status,
      createdAt: school.createdAt.toISOString(),
      href: `/app/schools/${school.publicId}`,
    })),
    ...guardians.map((guardian) => ({
      id: guardian.registration?.publicId ?? guardian.publicId,
      kind: 'PARENT' as const,
      name: guardian.fullName,
      reference: guardian.nationalId,
      phone: guardian.phone,
      email: guardian.email,
      status: guardian.registration?.status ?? 'ACTIVE',
      createdAt: (guardian.registration?.createdAt ?? guardian.createdAt).toISOString(),
      href: guardian.registration ? `/app/registration/${guardian.registration.publicId}` : null,
    })),
    ...students.map((student) => ({
      id: student.publicId,
      kind: 'STUDENT' as const,
      name: student.studentName,
      reference: student.studentExternalId,
      phone: student.telephone,
      email: null as string | null,
      status: student.status,
      createdAt: student.createdAt.toISOString(),
      href: `/app/students/${student.publicId}`,
    })),
    ...parties.map((party) => ({
      id: party.publicId,
      kind: party.kind,
      name: party.displayName,
      reference: party.referenceCode,
      phone: party.phone,
      email: party.email,
      status: party.status,
      createdAt: party.createdAt.toISOString(),
      href: `/app/registration/${party.publicId}`,
    })),
  ];

  return rows
    .filter((row) => !query.kind || row.kind === query.kind)
    .filter((row) => !query.status || row.status === query.status)
    .filter((row) => !needle || [row.id, row.name, row.reference, row.phone, row.email, row.kind, row.status]
      .some((part) => String(part ?? '').toLowerCase().includes(needle)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 200);
}

async function findRegistration(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { publicId: registrationId },
    include: fileInclude,
  });
  if (!registration) throw errors.notFound('REGISTRATION_NOT_FOUND', 'The requested registration could not be found.');
  return registration;
}

function serialize(registration: Awaited<ReturnType<typeof findRegistration>>) {
  return {
    registrationId: registration.publicId,
    kind: registration.kind,
    status: registration.status,
    displayName: registration.displayName,
    referenceCode: registration.referenceCode,
    email: registration.email,
    phone: registration.phone,
    alternativePhone: registration.alternativePhone,
    website: registration.website,
    address: {
      province: registration.province,
      district: registration.district,
      sector: registration.sector,
      cell: registration.cell,
      village: registration.village,
      physicalAddress: registration.physicalAddress,
      postalAddress: registration.postalAddress,
    },
    schoolId: registration.school?.publicId ?? null,
    schoolName: registration.school?.schoolName ?? null,
    guardianId: registration.guardian?.publicId ?? null,
    profile: registration.profile,
    checklist: {
      identityVerified: registration.identityVerified,
      documentsVerified: registration.documentsVerified,
      contactVerified: registration.contactVerified,
      addressVerified: registration.addressVerified,
      financialVerified: registration.financialVerified,
      consentCaptured: registration.consentCaptured,
      duplicateChecked: registration.duplicateChecked,
    },
    decision: registration.decision,
    approvedBy: registration.approvedBy,
    approvalDate: registration.approvalDate?.toISOString() ?? null,
    conditions: registration.conditions,
    comments: registration.comments,
    documents: registration.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      issueDate: isoDay(document.issueDate),
      expiryDate: isoDay(document.expiryDate),
      issuingAuthority: document.issuingAuthority,
      fileName: document.fileRef,
      hasFile: Boolean(document.storedName),
      verificationStatus: document.verificationStatus,
      verifiedBy: document.verifiedBy,
      verificationDate: document.verificationDate?.toISOString() ?? null,
      comments: document.comments,
      uploadedAt: document.uploadedAt.toISOString(),
    })),
    events: registration.events.map((event) => ({
      id: event.id,
      action: event.action,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      reason: event.reason,
      requestId: event.requestId,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
  };
}

async function createGuardianRecord(input: {
  fullName: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const guardian = await prisma.guardian.create({
        data: {
          publicId: await nextPublicId('GRD'),
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          nationalId: input.nationalId,
        },
      });
      return guardian.id;
    } catch (error) {
      const collided = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!collided || attempt === 4) throw error;
    }
  }
  throw errors.conflict('GUARDIAN_EXISTS', 'A guardian record could not be issued. Submit the registration again.');
}

async function storedDocuments(documents: DocumentInput[] | undefined) {
  const prepared = [];
  for (const document of documents ?? []) {
    prepared.push({
      documentType: document.documentType,
      documentNumber: document.documentNumber || null,
      issueDate: dateOnly(document.issueDate),
      expiryDate: dateOnly(document.expiryDate),
      issuingAuthority: document.issuingAuthority || null,
      fileRef: document.fileName,
      storedName: document.uploadId ? await claimPendingUpload(document.uploadId) : null,
      comments: document.comments || null,
    });
  }
  return prepared;
}

export async function createRegistration(input: {
  kind: RegistrationKind;
  profile: Record<string, string | boolean | number>;
  documents?: DocumentInput[];
}, trace: Trace) {
  const profile = parseProfile(input.kind, input.profile);
  const identity = identityFor(input.kind, profile);
  const details = contact(profile);
  if (details.email) {
    const clash = await prisma.registration.findFirst({
      where: { kind: input.kind, email: { equals: details.email, mode: 'insensitive' } },
    });
    if (clash) throw errors.conflict('REGISTRATION_EXISTS', 'A registration with this email already exists for that party.');
  }
  if (identity.referenceCode) {
    const clash = await prisma.registration.findFirst({
      where: { kind: input.kind, referenceCode: identity.referenceCode },
    });
    if (clash) throw errors.conflict('REGISTRATION_EXISTS', 'A registration with this reference number already exists.');
  }

  let schoolId: string | null = null;
  if (input.kind === 'TEACHER') {
    const school = await prisma.school.findUnique({ where: { publicId: text(profile.schoolId) } });
    if (!school) throw errors.notFound('SCHOOL_NOT_FOUND', 'Choose a school that is already on the platform.');
    schoolId = school.id;
  }

  let guardianId: string | null = null;
  let linkedStudentId: string | null = null;
  if (input.kind === 'PARENT' && text(profile.studentId)) {
    const student = await prisma.student.findUnique({ where: { publicId: text(profile.studentId) } });
    if (!student) throw errors.notFound('STUDENT_NOT_FOUND', 'Enter a student ID that already exists.');
    linkedStudentId = student.id;
  }

  if (input.kind === 'PARENT') {
    const matches = [
      details.email ? { email: details.email } : null,
      text(profile.nationalId) ? { nationalId: text(profile.nationalId) } : null,
    ].filter((item): item is { email: string } | { nationalId: string } => Boolean(item));
    const existing = matches.length
      ? await prisma.guardian.findFirst({ where: { OR: matches }, include: { registration: true } })
      : null;
    if (existing?.registration) {
      throw errors.conflict('REGISTRATION_EXISTS', 'This parent already has a registration record.');
    }
    if (existing) {
      guardianId = existing.id;
      await prisma.guardian.update({
        where: { id: existing.id },
        data: {
          fullName: identity.displayName,
          phone: details.phone,
          email: details.email,
          nationalId: text(profile.nationalId) || existing.nationalId,
        },
      });
    } else {
      guardianId = await createGuardianRecord({
        fullName: identity.displayName,
        phone: details.phone,
        email: details.email,
        nationalId: text(profile.nationalId) || null,
      });
    }
  }

  const documents = await storedDocuments(input.documents);
  const registration = await prisma.registration.create({
    data: {
      publicId: await nextPublicId('REG'),
      kind: input.kind,
      status: 'SUBMITTED',
      displayName: identity.displayName,
      referenceCode: identity.referenceCode,
      ...details,
      profile: JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue,
      schoolId,
      guardianId,
      consentCaptured: input.kind === 'PARENT' || input.kind === 'INVESTOR',
      duplicateChecked: true,
      documents: documents.length ? { create: documents } : undefined,
    },
  });

  if (guardianId && linkedStudentId) {
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: linkedStudentId, guardianId } },
      create: {
        studentId: linkedStudentId,
        guardianId,
        relationship: text(profile.relationship) || 'Guardian',
        isPrimary: Boolean(profile.primaryGuardian),
        financialResponsibility: Boolean(profile.financiallyResponsible),
        communicationAuthorization: Boolean(profile.schoolCommunication),
        paymentAuthorization: Boolean(profile.paymentAuthorization),
      },
      update: {
        relationship: text(profile.relationship) || 'Guardian',
        isPrimary: Boolean(profile.primaryGuardian),
        financialResponsibility: Boolean(profile.financiallyResponsible),
        communicationAuthorization: Boolean(profile.schoolCommunication),
        paymentAuthorization: Boolean(profile.paymentAuthorization),
      },
    });
  }

  await traceEvent(registration.id, 'Submitted', null, 'SUBMITTED', trace, 'Registration submitted');
  await publishEvent('registration.submitted', registration.publicId, { kind: input.kind, name: identity.displayName });
  await notify(
    'Registration submitted',
    `${identity.displayName} was submitted as a ${input.kind.toLowerCase()} registration.`,
    trace.actorId,
  );
  return serialize(await findRegistration(registration.publicId));
}

export async function getRegistration(registrationId: string) {
  return serialize(await findRegistration(registrationId));
}

export async function verifyRegistration(registrationId: string, input: {
  result: 'VERIFIED' | 'MORE_INFORMATION_REQUIRED' | 'REJECTED' | 'ESCALATED';
  identityVerified: boolean;
  documentsVerified: boolean;
  contactVerified: boolean;
  addressVerified: boolean;
  financialVerified: boolean;
  consentCaptured: boolean;
  duplicateChecked: boolean;
  comments?: string;
}, trace: Trace) {
  const current = await findRegistration(registrationId);
  const nextStatus: RegistrationStatus = input.result === 'VERIFIED'
    ? 'PENDING_APPROVAL'
    : input.result === 'MORE_INFORMATION_REQUIRED'
      ? 'MORE_INFORMATION_REQUIRED'
      : input.result === 'REJECTED'
        ? 'REJECTED'
        : 'VERIFICATION';
  await prisma.registration.update({
    where: { id: current.id },
    data: {
      status: nextStatus,
      identityVerified: input.identityVerified,
      documentsVerified: input.documentsVerified,
      contactVerified: input.contactVerified,
      addressVerified: input.addressVerified,
      financialVerified: input.financialVerified,
      consentCaptured: input.consentCaptured,
      duplicateChecked: input.duplicateChecked,
      comments: input.comments || current.comments,
    },
  });
  await traceEvent(current.id, 'Verification recorded', current.status, nextStatus, trace, input.comments);
  await publishEvent('registration.verification', current.publicId, { result: input.result, status: nextStatus });
  await notify('Registration verification updated', `${current.displayName} is now ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`, trace.actorId);
  return serialize(await findRegistration(registrationId));
}

export async function approveRegistration(registrationId: string, input: {
  decision: 'APPROVE' | 'CONDITIONAL' | 'MORE_INFORMATION' | 'REJECT';
  conditions?: string;
  comments?: string;
}, trace: Trace) {
  const current = await findRegistration(registrationId);
  if (input.decision === 'CONDITIONAL' && !input.conditions?.trim()) {
    throw errors.badRequest('Record the conditions for a conditional approval.');
  }
  const nextStatus: RegistrationStatus = input.decision === 'APPROVE' || input.decision === 'CONDITIONAL'
    ? 'ACTIVE'
    : input.decision === 'MORE_INFORMATION'
      ? 'MORE_INFORMATION_REQUIRED'
      : 'REJECTED';
  const approved = nextStatus === 'ACTIVE';
  await prisma.registration.update({
    where: { id: current.id },
    data: {
      status: nextStatus,
      decision: input.decision,
      approvedBy: approved ? trace.actorPublicId ?? null : current.approvedBy,
      approvalDate: approved ? new Date() : current.approvalDate,
      conditions: input.conditions || null,
      comments: input.comments || current.comments,
    },
  });
  const action = approved ? 'Approved' : input.decision === 'REJECT' ? 'Rejected' : 'More information requested';
  await traceEvent(current.id, action, current.status, nextStatus, trace, input.comments || input.conditions);
  await publishEvent('registration.approval', current.publicId, { decision: input.decision, status: nextStatus });
  await notify(
    approved ? 'Registration approved' : 'Registration decision recorded',
    `${current.displayName}: ${action}.`,
    trace.actorId,
  );
  return serialize(await findRegistration(registrationId));
}

export async function addRegistrationDocument(registrationId: string, input: DocumentInput, trace: Trace) {
  const current = await findRegistration(registrationId);
  const [document] = await storedDocuments([input]);
  await prisma.registrationDocument.create({
    data: { registrationId: current.id, ...document },
  });
  await traceEvent(current.id, 'Document added', current.status, current.status, trace, input.documentType);
  return serialize(await findRegistration(registrationId));
}

export async function reviewRegistrationDocument(
  registrationId: string,
  documentId: string,
  verificationStatus: DocumentVerificationStatus,
  trace: Trace,
) {
  const current = await findRegistration(registrationId);
  const document = current.documents.find((item) => item.id === documentId);
  if (!document) throw errors.notFound('DOCUMENT_NOT_FOUND', 'The requested document could not be found.');
  await prisma.registrationDocument.update({
    where: { id: document.id },
    data: {
      verificationStatus,
      verifiedBy: trace.actorPublicId,
      verificationDate: new Date(),
    },
  });
  await traceEvent(current.id, 'Document reviewed', current.status, current.status, trace, verificationStatus);
  return serialize(await findRegistration(registrationId));
}

export async function registrationDocumentFile(registrationId: string, documentId: string) {
  const current = await findRegistration(registrationId);
  const document = current.documents.find((item) => item.id === documentId);
  if (!document?.storedName) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  return { storedName: document.storedName, fileName: document.fileRef };
}
