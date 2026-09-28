import { KybStatus, MembershipStatus, Prisma, SchoolStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { money } from '../utils/money';
import { prisma } from '../utils/prisma';
import {
  deliverEmail,
  deskAddress,
  schoolSubmittedDeskEmail,
  schoolSubmittedEmail,
} from './mailer';
import { claimPendingUpload, schoolUploadPath, uploadContentType } from './uploads';

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

async function resolveMembershipLink(
  reference: string,
  school: { id?: string; schoolName: string; email: string; registrationNumber?: string | null },
) {
  const application = await prisma.membershipApplication.findUnique({ where: { publicId: reference.trim() } });
  if (!application) {
    throw errors.unprocessable('MEMBERSHIP_NOT_FOUND', 'No UPSA membership request matches that reference.');
  }
  if (application.status === 'REJECTED') {
    throw errors.unprocessable('MEMBERSHIP_REJECTED', 'That membership request was not confirmed. Submit a new membership request, then add the new reference.');
  }
  const matches = sameText(application.schoolName, school.schoolName)
    || sameText(application.email, school.email)
    || Boolean(application.registrationNumber && school.registrationNumber && sameText(application.registrationNumber, school.registrationNumber));
  if (!matches) {
    throw errors.unprocessable('MEMBERSHIP_MISMATCH', 'That membership reference belongs to a different school.');
  }
  const taken = await prisma.school.findFirst({
    where: {
      membershipApplicationId: application.id,
      ...(school.id ? { id: { not: school.id } } : {}),
    },
  });
  if (taken) {
    throw errors.conflict('MEMBERSHIP_ALREADY_LINKED', 'That membership is already linked to another school.');
  }
  return application;
}

function linkedMembership(application: { id: string; publicId: string; status: string }) {
  return {
    membershipApplicationId: application.id,
    rupsaMemberId: application.publicId,
    membershipStatus: application.status === 'CONFIRMED' ? MembershipStatus.VERIFIED : MembershipStatus.PENDING,
  };
}

export async function createSchool(input: {
  rupsaMemberId?: string;
  schoolName: string;
  registrationNumber: string;
  taxIdentificationNumber?: string;
  phone: string;
  email: string;
  address: { province: string; district: string; sector?: string };
}, actorId?: string) {
  let school;
  try {
    school = await prisma.school.create({
      data: {
        publicId: await nextPublicId('SCH'),
        rupsaMemberId: input.rupsaMemberId,
        schoolName: input.schoolName,
        registrationNumber: input.registrationNumber,
        taxIdentificationNumber: input.taxIdentificationNumber,
        phone: input.phone,
        email: input.email,
        province: input.address.province,
        district: input.address.district,
        sector: input.address.sector,
        status: SchoolStatus.APPLICATION,
        membershipStatus: MembershipStatus.UNVERIFIED,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errors.conflict('SCHOOL_EXISTS', 'A school with this registration number or member ID already exists.');
    }
    throw error;
  }

  await publishEvent(EventTypes.schoolCreated, school.publicId, { schoolId: school.publicId });
  await writeAudit({
    actorId,
    action: 'school.create',
    entityType: 'School',
    entityId: school.publicId,
  });

  return {
    schoolId: school.publicId,
    status: school.status,
    createdAt: school.createdAt.toISOString(),
  };
}

export async function getSchool(schoolId: string) {
  const school = await findSchool(schoolId);
  return serializeSchool(school);
}

export async function listSchools(status?: SchoolStatus) {
  const schools = await prisma.school.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return schools.map(serializeSchool);
}

export async function updateSchool(schoolId: string, input: {
  schoolName?: string;
  phone?: string;
  email?: string;
  province?: string;
  district?: string;
  sector?: string;
  rupsaMemberId?: string;
  taxIdentificationNumber?: string;
}, actorId?: string) {
  const current = await findSchool(schoolId);
  assertEditable(current.status);
  const school = await prisma.school.update({
    where: { id: current.id },
    data: {
      schoolName: input.schoolName,
      phone: input.phone,
      email: input.email,
      province: input.province,
      district: input.district,
      sector: input.sector,
      rupsaMemberId: input.rupsaMemberId,
      taxIdentificationNumber: input.taxIdentificationNumber,
    },
  });

  await writeAudit({
    actorId,
    action: 'school.update',
    entityType: 'School',
    entityId: school.publicId,
    metadata: JSON.parse(JSON.stringify(input)),
  });

  return serializeSchool(school);
}

export async function getFinancialProfile(schoolId: string) {
  const school = await findSchool(schoolId);
  const latest = await prisma.financialProfile.findFirst({
    where: { schoolId: school.id },
    orderBy: { dataAsOf: 'desc' },
  });

  if (latest) {
    return {
      schoolId: school.publicId,
      profileStatus: latest.profileStatus,
      studentCount: latest.studentCount,
      averageMonthlyCollections: money(latest.averageMonthlyCollections),
      collectionRate: money(latest.collectionRate),
      existingLoanExposure: money(latest.existingLoanExposure),
      dataAsOf: latest.dataAsOf.toISOString().slice(0, 10),
    };
  }

  const studentCount = await prisma.student.count({ where: { schoolId: school.id } });
  const invoices = await prisma.invoice.findMany({ where: { schoolId: school.id } });
  const totalBilled = invoices.reduce((sum, invoice) => sum + money(invoice.amount), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0);
  const loans = await prisma.loan.findMany({
    where: { application: { schoolId: school.id }, status: { in: ['ACTIVE', 'IN_ARREARS', 'DISBURSING'] } },
    include: { application: true },
  });
  const exposure = loans.reduce((sum, loan) => sum + money(loan.principalOutstanding), 0);

  return {
    schoolId: school.publicId,
    profileStatus: school.kybStatus === 'VERIFIED' ? 'VERIFIED' : 'DERIVED',
    studentCount,
    averageMonthlyCollections: totalPaid,
    collectionRate: totalBilled === 0 ? 0 : Number(((totalPaid / totalBilled) * 100).toFixed(1)),
    existingLoanExposure: exposure,
    dataAsOf: new Date().toISOString().slice(0, 10),
  };
}

export async function findSchool(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { publicId: schoolId } });
  if (!school) throw errors.notFound('SCHOOL_NOT_FOUND', 'The requested school could not be found.');
  return school;
}

function serializeSchool(school: Awaited<ReturnType<typeof findSchool>>) {
  return {
    schoolId: school.publicId,
    rupsaMemberId: school.rupsaMemberId,
    schoolName: school.schoolName,
    registrationNumber: school.registrationNumber,
    taxIdentificationNumber: school.taxIdentificationNumber,
    phone: school.phone,
    email: school.email,
    address: {
      province: school.province,
      district: school.district,
      sector: school.sector,
    },
    status: school.status,
    kybStatus: school.kybStatus,
    membershipStatus: school.membershipStatus,
    createdAt: school.createdAt.toISOString(),
    updatedAt: school.updatedAt.toISOString(),
  };
}

const NEXT_STATUS: Record<SchoolStatus, SchoolStatus[]> = {
  APPLICATION: [SchoolStatus.SUBMITTED],
  SUBMITTED: [SchoolStatus.DOCUMENT_REVIEW],
  DOCUMENT_REVIEW: [SchoolStatus.PENDING_VERIFICATION],
  PENDING_VERIFICATION: [SchoolStatus.VERIFICATION],
  VERIFICATION: [SchoolStatus.APPROVED],
  APPROVED: [SchoolStatus.ACTIVE],
  ACTIVE: [SchoolStatus.SUSPENDED, SchoolStatus.INACTIVE],
  SUSPENDED: [SchoolStatus.ACTIVE, SchoolStatus.INACTIVE],
  INACTIVE: [],
};

const OPEN_FOR_EDIT: SchoolStatus[] = [
  SchoolStatus.APPLICATION,
  SchoolStatus.SUBMITTED,
  SchoolStatus.DOCUMENT_REVIEW,
  SchoolStatus.PENDING_VERIFICATION,
  SchoolStatus.VERIFICATION,
];

export function registrationWorkflow(status: SchoolStatus) {
  return {
    current: status,
    next: NEXT_STATUS[status],
  };
}

export async function getRegistration(schoolId: string) {
  const school = await findSchool(schoolId);
  const [ownership, people, bankAccounts, documents, kyc] = await Promise.all([
    prisma.schoolOwnership.findMany({ where: { schoolId: school.id }, orderBy: { ownerName: 'asc' } }),
    prisma.schoolRepresentative.findMany({ where: { schoolId: school.id }, orderBy: { fullName: 'asc' } }),
    prisma.schoolBankAccount.findMany({ where: { schoolId: school.id }, orderBy: { isPrimary: 'desc' } }),
    prisma.schoolDocument.findMany({ where: { schoolId: school.id }, orderBy: { uploadedAt: 'desc' } }),
    prisma.kycRecord.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    school: serializeSchool(school),
    workflow: registrationWorkflow(school.status),
    ownership: ownership.map((row) => ({
      id: row.id,
      ownerName: row.ownerName,
      ownershipPct: money(row.ownershipPct),
      nationalId: row.nationalId,
    })),
    management: people.filter((row) => !row.authorized).map(serializePerson),
    signatories: people.filter((row) => row.authorized).map(serializePerson),
    bankAccounts: bankAccounts.map((row) => ({
      id: row.id,
      bankName: row.bankName,
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      currency: row.currency,
      isPrimary: row.isPrimary,
    })),
    documents: documents.map((row) => ({
      id: row.id,
      documentType: row.documentType,
      fileName: row.fileRef,
      status: row.status,
      uploadedAt: row.uploadedAt.toISOString(),
      viewable: Boolean(row.storedName),
    })),
    kyc: kyc.map((row) => ({
      id: row.publicId,
      kind: row.kind,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function serializePerson(row: { id: string; fullName: string; title: string; phone: string | null; email: string | null; authorized: boolean }) {
  return {
    id: row.id,
    fullName: row.fullName,
    title: row.title,
    phone: row.phone,
    email: row.email,
    role: row.authorized ? 'SIGNATORY' : 'MANAGEMENT',
  };
}

function assertEditable(status: SchoolStatus) {
  if (!OPEN_FOR_EDIT.includes(status)) {
    throw errors.unprocessable('SCHOOL_LOCKED', 'This school record is locked. Change its status before editing the registration file.');
  }
}

export async function addOwnership(schoolId: string, input: {
  ownerName: string;
  ownershipPct: number;
  nationalId?: string;
}, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  if (input.ownershipPct <= 0 || input.ownershipPct > 100) {
    throw errors.unprocessable('OWNERSHIP_OUT_OF_RANGE', 'Ownership must be between 0 and 100 percent.');
  }
  const row = await prisma.schoolOwnership.create({
    data: {
      schoolId: school.id,
      ownerName: input.ownerName,
      ownershipPct: input.ownershipPct,
      nationalId: input.nationalId,
    },
  });
  await writeAudit({ actorId, action: 'school.ownership.add', entityType: 'School', entityId: school.publicId });
  return { id: row.id, ownerName: row.ownerName, ownershipPct: money(row.ownershipPct), nationalId: row.nationalId };
}

export async function removeOwnership(schoolId: string, ownershipId: string, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.schoolOwnership.findFirst({ where: { id: ownershipId, schoolId: school.id } });
  if (!row) throw errors.notFound('OWNERSHIP_NOT_FOUND', 'That ownership record is not on this school.');
  await prisma.schoolOwnership.delete({ where: { id: row.id } });
  await writeAudit({ actorId, action: 'school.ownership.remove', entityType: 'School', entityId: school.publicId });
}

export async function addPerson(schoolId: string, input: {
  fullName: string;
  title: string;
  phone?: string;
  email?: string;
  role: 'MANAGEMENT' | 'SIGNATORY';
}, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.schoolRepresentative.create({
    data: {
      schoolId: school.id,
      fullName: input.fullName,
      title: input.title,
      phone: input.phone,
      email: input.email,
      authorized: input.role === 'SIGNATORY',
    },
  });
  await writeAudit({ actorId, action: 'school.person.add', entityType: 'School', entityId: school.publicId, metadata: { role: input.role } });
  return serializePerson(row);
}

export async function removePerson(schoolId: string, personId: string, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.schoolRepresentative.findFirst({ where: { id: personId, schoolId: school.id } });
  if (!row) throw errors.notFound('PERSON_NOT_FOUND', 'That person is not on this school file.');
  await prisma.schoolRepresentative.delete({ where: { id: row.id } });
  await writeAudit({ actorId, action: 'school.person.remove', entityType: 'School', entityId: school.publicId });
}

export async function addBankAccount(schoolId: string, input: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency?: string;
  isPrimary?: boolean;
}, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.schoolBankAccount.updateMany({ where: { schoolId: school.id }, data: { isPrimary: false } });
    }
    return tx.schoolBankAccount.create({
      data: {
        schoolId: school.id,
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        currency: input.currency ?? 'RWF',
        isPrimary: input.isPrimary ?? false,
      },
    });
  });
  await writeAudit({ actorId, action: 'school.bank.add', entityType: 'School', entityId: school.publicId });
  return {
    id: row.id,
    bankName: row.bankName,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    currency: row.currency,
    isPrimary: row.isPrimary,
  };
}

export async function removeBankAccount(schoolId: string, accountId: string, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.schoolBankAccount.findFirst({ where: { id: accountId, schoolId: school.id } });
  if (!row) throw errors.notFound('ACCOUNT_NOT_FOUND', 'That bank account is not on this school file.');
  await prisma.schoolBankAccount.delete({ where: { id: row.id } });
  await writeAudit({ actorId, action: 'school.bank.remove', entityType: 'School', entityId: school.publicId });
}

export async function addDocument(schoolId: string, input: {
  documentType: string;
  fileName: string;
  storedName?: string;
}, actorId?: string) {
  const school = await findSchool(schoolId);
  assertEditable(school.status);
  const row = await prisma.schoolDocument.create({
    data: {
      schoolId: school.id,
      documentType: input.documentType,
      fileRef: input.fileName,
      storedName: input.storedName,
      status: 'SUBMITTED',
    },
  });
  await writeAudit({ actorId, action: 'school.document.add', entityType: 'School', entityId: school.publicId, metadata: { documentType: input.documentType } });
  return {
    id: row.id,
    documentType: row.documentType,
    fileName: row.fileRef,
    status: row.status,
    uploadedAt: row.uploadedAt.toISOString(),
    viewable: Boolean(row.storedName),
  };
}

export async function listUploadedDocuments() {
  const rows = await prisma.schoolDocument.findMany({
    orderBy: { uploadedAt: 'desc' },
    take: 24,
    include: { school: { select: { publicId: true, schoolName: true } } },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      schoolId: row.school.publicId,
      schoolName: row.school.schoolName,
      documentType: row.documentType,
      fileName: row.fileRef,
      status: row.status,
      uploadedAt: row.uploadedAt.toISOString(),
      viewable: Boolean(row.storedName),
    })),
  };
}

export async function openSchoolDocument(schoolId: string, documentId: string) {
  const school = await findSchool(schoolId);
  const row = await prisma.schoolDocument.findFirst({ where: { id: documentId, schoolId: school.id } });
  if (!row?.storedName) {
    throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  }
  const filePath = schoolUploadPath(row.storedName);
  if (!filePath) {
    throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  }
  return { filePath, fileName: row.fileRef, contentType: uploadContentType(row.storedName) };
}

export async function reviewDocument(schoolId: string, documentId: string, status: 'ACCEPTED' | 'REJECTED', actorId?: string) {
  const school = await findSchool(schoolId);
  const row = await prisma.schoolDocument.findFirst({ where: { id: documentId, schoolId: school.id } });
  if (!row) throw errors.notFound('DOCUMENT_NOT_FOUND', 'That document is not on this school file.');
  const updated = await prisma.schoolDocument.update({ where: { id: row.id }, data: { status } });
  await writeAudit({ actorId, action: 'school.document.review', entityType: 'School', entityId: school.publicId, metadata: { status } });
  return { id: updated.id, documentType: updated.documentType, fileName: updated.fileRef, status: updated.status };
}

export async function decideMembership(schoolId: string, input: {
  decision: MembershipStatus;
  rupsaMemberId?: string;
}, actorId?: string) {
  const school = await findSchool(schoolId);
  const reference = input.rupsaMemberId?.trim() || school.rupsaMemberId || '';
  if (input.decision === MembershipStatus.VERIFIED) {
    if (!reference) {
      throw errors.unprocessable('MEMBER_ID_REQUIRED', 'Enter the UPSA membership reference before this school can be verified.');
    }
    const application = await resolveMembershipLink(reference, school);
    if (application.status !== 'CONFIRMED') {
      throw errors.unprocessable('MEMBERSHIP_NOT_CONFIRMED', 'This membership is still in review. The school can be verified after a UPSA reader confirms it.');
    }
    const updated = await prisma.school.update({
      where: { id: school.id },
      data: linkedMembership(application),
    });
    await writeAudit({
      actorId,
      action: 'school.membership.decide',
      entityType: 'School',
      entityId: school.publicId,
      metadata: { decision: input.decision, membershipReference: application.publicId },
    });
    return serializeSchool(updated);
  }
  if (input.decision === MembershipStatus.PENDING && reference) {
    const existing = await prisma.membershipApplication.findUnique({ where: { publicId: reference } });
    if (existing) {
      const application = await resolveMembershipLink(reference, school);
      const updated = await prisma.school.update({
        where: { id: school.id },
        data: linkedMembership(application),
      });
      await writeAudit({
        actorId,
        action: 'school.membership.decide',
        entityType: 'School',
        entityId: school.publicId,
        metadata: { decision: updated.membershipStatus, membershipReference: application.publicId },
      });
      return serializeSchool(updated);
    }
  }
  const updated = await prisma.school.update({
    where: { id: school.id },
    data: {
      membershipStatus: input.decision,
      rupsaMemberId: input.rupsaMemberId?.trim() || school.rupsaMemberId,
      ...(input.decision === MembershipStatus.REJECTED
        ? { membershipApplicationId: null }
        : {}),
    },
  });
  await writeAudit({
    actorId,
    action: 'school.membership.decide',
    entityType: 'School',
    entityId: school.publicId,
    metadata: { decision: input.decision },
  });
  return serializeSchool(updated);
}

export async function recordKyc(schoolId: string, input: {
  kind: 'KYC' | 'KYB';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  notes?: string;
}, actorId?: string) {
  const school = await findSchool(schoolId);
  const record = await prisma.kycRecord.create({
    data: {
      publicId: await nextPublicId('KYC'),
      kind: input.kind,
      subjectId: school.publicId,
      schoolId: school.id,
      status: input.status,
      notes: input.notes,
    },
  });
  if (input.kind === 'KYB') {
    const kybStatus = input.status === 'VERIFIED'
      ? KybStatus.VERIFIED
      : input.status === 'REJECTED'
        ? KybStatus.REJECTED
        : KybStatus.IN_REVIEW;
    await prisma.school.update({ where: { id: school.id }, data: { kybStatus } });
  }
  await writeAudit({
    actorId,
    action: 'school.kyc.record',
    entityType: 'School',
    entityId: school.publicId,
    metadata: { kind: input.kind, status: input.status },
  });
  return {
    id: record.publicId,
    kind: record.kind,
    status: record.status,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function transitionSchool(schoolId: string, status: SchoolStatus, actorId?: string) {
  const school = await findSchool(schoolId);
  const allowed = NEXT_STATUS[school.status];
  if (!allowed.includes(status)) {
    throw errors.unprocessable('INVALID_SCHOOL_STATUS', `A school in ${school.status} cannot move to ${status}.`);
  }

  if (status === SchoolStatus.SUBMITTED) {
    if (!school.registrationNumber || !school.phone || !school.email || !school.province || !school.district) {
      throw errors.unprocessable('APPLICATION_INCOMPLETE', 'Registration number, contact details and location are required before submission.');
    }
  }
  if (status === SchoolStatus.PENDING_VERIFICATION) {
    const documents = await prisma.schoolDocument.count({
      where: { schoolId: school.id, status: { not: 'REJECTED' } },
    });
    if (documents < 1) {
      throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Upload at least one licensing or registration document before membership verification.');
    }
  }
  if (status === SchoolStatus.VERIFICATION || status === SchoolStatus.APPROVED) {
    await assertConfirmedMembership(school);
  }
  if (status === SchoolStatus.APPROVED) {
    if (school.kybStatus !== KybStatus.VERIFIED) {
      throw errors.unprocessable('KYB_REQUIRED', 'KYB must be verified before the school can be approved.');
    }
    const signatories = await prisma.schoolRepresentative.count({ where: { schoolId: school.id, authorized: true } });
    if (signatories < 1) {
      throw errors.unprocessable('SIGNATORY_REQUIRED', 'Record at least one authorized signatory before approval.');
    }
  }

  const updated = await prisma.school.update({ where: { id: school.id }, data: { status } });
  if (status === SchoolStatus.APPROVED || status === SchoolStatus.ACTIVE) {
    await publishEvent(EventTypes.schoolVerified, updated.publicId, { schoolId: updated.publicId, status });
  }
  await writeAudit({
    actorId,
    action: 'school.status',
    entityType: 'School',
    entityId: updated.publicId,
    metadata: { from: school.status, to: status },
  });
  return serializeSchool(updated);
}

async function assertConfirmedMembership(school: { membershipApplicationId: string | null; membershipStatus: MembershipStatus }) {
  if (school.membershipStatus !== MembershipStatus.VERIFIED || !school.membershipApplicationId) {
    throw errors.unprocessable('MEMBERSHIP_REQUIRED', 'Link a confirmed UPSA membership before this school can be verified.');
  }
  const application = await prisma.membershipApplication.findUnique({ where: { id: school.membershipApplicationId } });
  if (!application || application.status !== 'CONFIRMED') {
    throw errors.unprocessable('MEMBERSHIP_NOT_CONFIRMED', 'This school can be verified after its UPSA membership is confirmed.');
  }
}

const PUBLIC_DOCUMENTS = new Set([
  'LICENSE',
  'REGISTRATION_CERTIFICATE',
  'TIN_CERTIFICATE',
  'RUPSA_MEMBERSHIP',
  'OWNER_IDENTITY',
  'BANK_LETTER',
  'OTHER',
]);

export async function submitPublicApplication(input: {
  rupsaMemberId?: string;
  schoolName: string;
  registrationNumber: string;
  taxIdentificationNumber?: string;
  phone: string;
  email: string;
  address: { province: string; district: string; sector?: string };
  owners: { ownerName: string; ownershipPct: number; nationalId?: string }[];
  management: { fullName: string; title: string; phone?: string; email?: string }[];
  signatories: { fullName: string; title: string; phone?: string; email?: string }[];
  bankAccount: { bankName: string; accountName: string; accountNumber: string; currency?: string };
  documents: { documentType: string; fileName: string; uploadId?: string }[];
}) {
  if (input.owners.length < 1) {
    throw errors.unprocessable('OWNERS_REQUIRED', 'Record at least one owner.');
  }
  if (input.management.length < 1) {
    throw errors.unprocessable('MANAGEMENT_REQUIRED', 'Record at least one manager.');
  }
  if (input.signatories.length < 1) {
    throw errors.unprocessable('SIGNATORY_REQUIRED', 'Record at least one authorized signatory.');
  }
  if (input.documents.length < 1) {
    throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Attach at least one licensing or registration document.');
  }
  const ownershipTotal = input.owners.reduce((sum, owner) => sum + owner.ownershipPct, 0);
  if (input.owners.some((owner) => owner.ownershipPct <= 0 || owner.ownershipPct > 100) || ownershipTotal > 100) {
    throw errors.unprocessable('OWNERSHIP_OUT_OF_RANGE', 'Each ownership share must be between 0 and 100 percent, and the total cannot exceed 100.');
  }
  if (input.documents.some((document) => !PUBLIC_DOCUMENTS.has(document.documentType))) {
    throw errors.unprocessable('DOCUMENT_TYPE_INVALID', 'One of the documents uses an unknown type.');
  }

  const membership = input.rupsaMemberId
    ? linkedMembership(await resolveMembershipLink(input.rupsaMemberId, {
      schoolName: input.schoolName,
      email: input.email,
      registrationNumber: input.registrationNumber,
    }))
    : null;

  const preparedDocuments = await Promise.all(input.documents.map(async (document) => ({
    documentType: document.documentType,
    fileRef: document.fileName,
    storedName: document.uploadId ? await claimPendingUpload(document.uploadId) : null,
    status: 'SUBMITTED',
  })));

  const publicId = await nextPublicId('SCH');
  let school;
  try {
    school = await prisma.school.create({
      data: {
        publicId,
        rupsaMemberId: membership?.rupsaMemberId,
        membershipApplicationId: membership?.membershipApplicationId,
        schoolName: input.schoolName,
        registrationNumber: input.registrationNumber,
        taxIdentificationNumber: input.taxIdentificationNumber,
        phone: input.phone,
        email: input.email.trim(),
        province: input.address.province,
        district: input.address.district,
        sector: input.address.sector,
        status: SchoolStatus.SUBMITTED,
        membershipStatus: membership?.membershipStatus ?? MembershipStatus.UNVERIFIED,
        ownerships: {
          create: input.owners.map((owner) => ({
            ownerName: owner.ownerName,
            ownershipPct: owner.ownershipPct,
            nationalId: owner.nationalId,
          })),
        },
        representatives: {
          create: [
            ...input.management.map((person) => ({
              fullName: person.fullName,
              title: person.title,
              phone: person.phone,
              email: person.email,
              authorized: false,
            })),
            ...input.signatories.map((person) => ({
              fullName: person.fullName,
              title: person.title,
              phone: person.phone,
              email: person.email,
              authorized: true,
            })),
          ],
        },
        bankAccounts: {
          create: {
            bankName: input.bankAccount.bankName,
            accountName: input.bankAccount.accountName,
            accountNumber: input.bankAccount.accountNumber,
            currency: input.bankAccount.currency ?? 'RWF',
            isPrimary: true,
          },
        },
        documents: {
          create: preparedDocuments,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errors.conflict('SCHOOL_EXISTS', 'A school with this registration number or member ID already exists.');
    }
    throw error;
  }

  await publishEvent(EventTypes.schoolCreated, school.publicId, { schoolId: school.publicId, source: 'public' });
  await writeAudit({
    action: 'school.apply',
    entityType: 'School',
    entityId: school.publicId,
    metadata: { source: 'public', status: school.status },
  });

  const location = [school.sector, school.district, school.province].filter(Boolean).join(', ');
  const emailSent = await deliverEmail({
    to: school.email,
    ...schoolSubmittedEmail({
      schoolName: school.schoolName,
      schoolId: school.publicId,
      email: school.email,
      membershipReference: school.rupsaMemberId ?? undefined,
      membershipConfirmed: school.membershipStatus === MembershipStatus.VERIFIED,
    }),
  });
  const desk = deskAddress();
  if (desk && desk.toLowerCase() !== school.email.toLowerCase()) {
    await deliverEmail({
      to: desk,
      ...schoolSubmittedDeskEmail({
        schoolName: school.schoolName,
        schoolId: school.publicId,
        email: school.email,
        phone: school.phone,
        location,
        memberId: school.rupsaMemberId ?? undefined,
      }),
    });
  }

  return {
    schoolId: school.publicId,
    schoolName: school.schoolName,
    status: school.status,
    email: school.email,
    emailSent,
    membershipStatus: school.membershipStatus,
    membershipReference: school.rupsaMemberId,
  };
}

export async function linkPublicMembership(schoolId: string, email: string, membershipReference: string) {
  const school = await prisma.school.findUnique({ where: { publicId: schoolId } });
  const matches = school && school.email.trim().toLowerCase() === email.trim().toLowerCase();
  if (!school || !matches) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No application matches that reference and email.');
  }
  if (school.membershipStatus === MembershipStatus.VERIFIED && school.membershipApplicationId) {
    throw errors.conflict('MEMBERSHIP_ALREADY_LINKED', 'This school is already linked to a confirmed UPSA membership.');
  }
  const application = await resolveMembershipLink(membershipReference, school);
  const updated = await prisma.school.update({
    where: { id: school.id },
    data: linkedMembership(application),
  });
  await writeAudit({
    action: 'school.membership.link',
    entityType: 'School',
    entityId: updated.publicId,
    metadata: { membershipReference: application.publicId, membershipStatus: application.status },
  });
  return publicApplicationStatus(updated.publicId, updated.email);
}

export async function publicApplicationStatus(schoolId: string, email: string) {
  const school = await prisma.school.findUnique({ where: { publicId: schoolId } });
  const matches = school && school.email.trim().toLowerCase() === email.trim().toLowerCase();
  if (!school || !matches) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No application matches that reference and email.');
  }
  return {
    schoolId: school.publicId,
    schoolName: school.schoolName,
    email: school.email,
    status: school.status,
    membershipStatus: school.membershipStatus,
    membershipReference: school.rupsaMemberId,
    kybStatus: school.kybStatus,
  };
}
