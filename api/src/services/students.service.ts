import { DocumentVerificationStatus, Prisma, StudentGender, StudentStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { money } from '../utils/money';
import { prisma } from '../utils/prisma';
import { claimPendingUpload } from './uploads';
import { findSchool } from './schools.service';
import { findGuardian } from './guardians.service';
import { assertParentOwnsStudent, parentStudentScope, type AccessActor } from './family.service';

const DOCUMENT_TYPES = new Set([
  'BIRTH_CERTIFICATE',
  'STUDENT_ID',
  'PREVIOUS_SCHOOL_RECORDS',
  'TRANSFER_CERTIFICATE',
  'MEDICAL',
  'OTHER',
]);

type GuardianInput = {
  guardianId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  relationship: string;
  primary?: boolean;
  emergencyContact?: boolean;
  financialResponsibility?: boolean;
  communicationAuthorization?: boolean;
  paymentAuthorization?: boolean;
};

type DocumentInput = {
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName: string;
  uploadId?: string;
};

function day(value?: string) {
  return value ? new Date(value) : undefined;
}

function displayName(input: { studentName?: string; firstName?: string; middleName?: string; lastName?: string }) {
  const parts = [input.firstName, input.middleName, input.lastName].map((part) => part?.trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return input.studentName?.trim() ?? '';
}

export async function createStudent(input: {
  schoolId: string;
  studentExternalId: string;
  studentName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: StudentGender;
  nationality?: string;
  photoUploadId?: string;
  previousSchool?: string;
  admissionDate?: string;
  academicYear: string;
  classLevel: string;
  stream?: string;
  grade?: string;
  status?: StudentStatus;
  feeCategory?: string;
  guardianId?: string;
  address?: {
    province?: string;
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
    physicalAddress?: string;
    telephone?: string;
    emergencyContact?: string;
  };
  guardians?: GuardianInput[];
  documents?: DocumentInput[];
  financial?: {
    feeStructure?: string;
    scholarship?: string;
    discount?: number;
    paymentPlan?: string;
  };
}) {
  const studentName = displayName(input);
  if (studentName.length < 2) {
    throw errors.unprocessable('STUDENT_NAME_REQUIRED', 'Enter the student’s first and last name.');
  }
  const school = await findSchool(input.schoolId);
  const legacyGuardian = input.guardianId ? await findGuardian(input.guardianId) : null;
  const guardians = input.guardians?.length
    ? input.guardians
    : legacyGuardian
      ? [{ guardianId: legacyGuardian.publicId, relationship: 'Guardian', primary: true, financialResponsibility: true, communicationAuthorization: true }]
      : [];
  if (input.documents?.some((document) => !DOCUMENT_TYPES.has(document.documentType))) {
    throw errors.unprocessable('DOCUMENT_TYPE_INVALID', 'One of the documents uses an unknown type.');
  }
  for (const guardian of guardians) {
    if (!guardian.guardianId && (guardian.fullName?.trim().length ?? 0) < 2) {
      throw errors.unprocessable('GUARDIAN_NAME_REQUIRED', 'Enter each guardian’s name, or choose an existing guardian.');
    }
  }
  const primaryIndex = Math.max(0, guardians.findIndex((guardian) => guardian.primary));
  const photoStoredName = input.photoUploadId ? await claimPendingUpload(input.photoUploadId) : undefined;
  const preparedDocuments = await Promise.all((input.documents ?? []).map(async (document) => ({
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    issueDate: day(document.issueDate),
    expiryDate: day(document.expiryDate),
    fileRef: document.fileName,
    storedName: document.uploadId ? await claimPendingUpload(document.uploadId) : null,
  })));

  let student;
  try {
    student = await prisma.$transaction(async (tx) => {
      const preparedGuardians = [];
      for (const [index, guardian] of guardians.entries()) {
        const record = guardian.guardianId
          ? await findGuardian(guardian.guardianId)
          : await tx.guardian.create({
            data: {
              publicId: await nextPublicId('GRD'),
              fullName: guardian.fullName!.trim(),
              phone: guardian.phone,
              email: guardian.email,
              nationalId: guardian.nationalId,
            },
          });
        preparedGuardians.push({
          guardianId: record.id,
          relationship: guardian.relationship,
          isPrimary: index === primaryIndex,
          isEmergencyContact: Boolean(guardian.emergencyContact),
          financialResponsibility: Boolean(guardian.financialResponsibility),
          communicationAuthorization: Boolean(guardian.communicationAuthorization),
          paymentAuthorization: Boolean(guardian.paymentAuthorization),
        });
      }
      return tx.student.create({
        data: {
          publicId: await nextPublicId('STD'),
          schoolId: school.id,
          studentExternalId: input.studentExternalId,
          studentName,
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          dateOfBirth: day(input.dateOfBirth),
          gender: input.gender,
          nationality: input.nationality,
          photoStoredName,
          previousSchool: input.previousSchool,
          admissionDate: day(input.admissionDate),
          academicYear: input.academicYear,
          classLevel: input.classLevel,
          stream: input.stream,
          grade: input.grade,
          feeCategory: input.feeCategory,
          province: input.address?.province,
          district: input.address?.district,
          sector: input.address?.sector,
          cell: input.address?.cell,
          village: input.address?.village,
          physicalAddress: input.address?.physicalAddress,
          telephone: input.address?.telephone,
          emergencyContact: input.address?.emergencyContact,
          status: input.status ?? StudentStatus.APPLICANT,
          financialAccount: {
            create: {
              currency: 'RWF',
              feeStructureLabel: input.financial?.feeStructure,
              scholarship: input.financial?.scholarship,
              discountAmount: input.financial?.discount,
              paymentPlan: input.financial?.paymentPlan,
            },
          },
          guardians: preparedGuardians.length ? { create: preparedGuardians } : undefined,
          documents: preparedDocuments.length ? { create: preparedDocuments } : undefined,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errors.conflict('STUDENT_EXISTS', 'This school already has a student with that admission number.');
    }
    throw error;
  }

  return getStudentFile(student.publicId);
}

export async function getStudent(studentId: string, actor?: AccessActor) {
  const student = await findStudent(studentId);
  await assertParentOwnsStudent(actor, student.id, {
    code: 'STUDENT_NOT_FOUND',
    message: 'The requested student could not be found.',
  });
  const school = await prisma.school.findUniqueOrThrow({ where: { id: student.schoolId } });
  const link = await prisma.studentGuardian.findFirst({
    where: { studentId: student.id, isPrimary: true },
    include: { guardian: true },
  });
  return serialize(student, school.publicId, link?.guardian.publicId);
}

export async function listStudents(schoolId?: string, actor?: AccessActor) {
  const school = schoolId ? await findSchool(schoolId) : null;
  const scope = await parentStudentScope(actor);
  const students = await prisma.student.findMany({
    where: {
      ...(school ? { schoolId: school.id } : {}),
      ...(scope ? { id: { in: scope } } : {}),
    },
    include: { school: true, guardians: { include: { guardian: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return students.map((student) =>
    serialize(
      student,
      student.school.publicId,
      student.guardians.find((g) => g.isPrimary)?.guardian.publicId,
    ),
  );
}

export async function getStudentFile(studentId: string, actor?: AccessActor) {
  const student = await findStudent(studentId);
  await assertParentOwnsStudent(actor, student.id, {
    code: 'STUDENT_NOT_FOUND',
    message: 'The requested student could not be found.',
  });
  const [school, links, documents, account] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: student.schoolId } }),
    prisma.studentGuardian.findMany({ where: { studentId: student.id }, include: { guardian: true }, orderBy: { isPrimary: 'desc' } }),
    prisma.studentDocument.findMany({ where: { studentId: student.id }, orderBy: { uploadedAt: 'asc' } }),
    prisma.studentFinancialAccount.findUnique({ where: { studentId: student.id } }),
  ]);
  return {
    ...serialize(student, school.publicId, links.find((link) => link.isPrimary)?.guardian.publicId),
    schoolName: school.schoolName,
    firstName: student.firstName,
    middleName: student.middleName,
    lastName: student.lastName,
    dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: student.gender,
    nationality: student.nationality,
    hasPhoto: Boolean(student.photoStoredName),
    previousSchool: student.previousSchool,
    admissionDate: student.admissionDate?.toISOString().slice(0, 10) ?? null,
    stream: student.stream,
    grade: student.grade,
    address: {
      province: student.province,
      district: student.district,
      sector: student.sector,
      cell: student.cell,
      village: student.village,
      physicalAddress: student.physicalAddress,
      telephone: student.telephone,
      emergencyContact: student.emergencyContact,
    },
    guardians: links.map((link) => ({
      guardianId: link.guardian.publicId,
      fullName: link.guardian.fullName,
      phone: link.guardian.phone,
      email: link.guardian.email,
      nationalId: link.guardian.nationalId,
      relationship: link.relationship,
      primary: link.isPrimary,
      emergencyContact: link.isEmergencyContact,
      financialResponsibility: link.financialResponsibility,
      communicationAuthorization: link.communicationAuthorization,
      paymentAuthorization: link.paymentAuthorization,
    })),
    documents: documents.map((document) => ({
      documentId: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      issueDate: document.issueDate?.toISOString().slice(0, 10) ?? null,
      expiryDate: document.expiryDate?.toISOString().slice(0, 10) ?? null,
      fileName: document.fileRef,
      verificationStatus: document.verificationStatus,
    })),
    financial: {
      invoiceAccount: student.publicId,
      currency: account?.currency ?? 'RWF',
      feeCategory: student.feeCategory,
      academicYear: student.academicYear,
      feeStructure: account?.feeStructureLabel ?? null,
      scholarship: account?.scholarship ?? null,
      discount: account?.discountAmount != null ? money(account.discountAmount) : null,
      paymentPlan: account?.paymentPlan ?? null,
      outstandingBalance: account ? money(account.outstanding) : 0,
      ledger: 'The school ledger is the source of the outstanding balance. This figure is calculated from invoices.',
    },
  };
}

export async function addStudentGuardian(studentId: string, input: GuardianInput) {
  const student = await findStudent(studentId);
  if (!input.guardianId && (input.fullName?.trim().length ?? 0) < 2) {
    throw errors.unprocessable('GUARDIAN_NAME_REQUIRED', 'Enter the guardian’s name, or choose an existing guardian.');
  }
  const guardian = input.guardianId
    ? await findGuardian(input.guardianId)
    : await prisma.guardian.create({
      data: {
        publicId: await nextPublicId('GRD'),
        fullName: input.fullName!.trim(),
        phone: input.phone,
        email: input.email,
        nationalId: input.nationalId,
      },
    });
  if (input.primary) {
    await prisma.studentGuardian.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
  }
  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
    create: {
      studentId: student.id,
      guardianId: guardian.id,
      relationship: input.relationship,
      isPrimary: Boolean(input.primary),
      isEmergencyContact: Boolean(input.emergencyContact),
      financialResponsibility: Boolean(input.financialResponsibility),
      communicationAuthorization: Boolean(input.communicationAuthorization),
      paymentAuthorization: Boolean(input.paymentAuthorization),
    },
    update: {
      relationship: input.relationship,
      isPrimary: Boolean(input.primary),
      isEmergencyContact: Boolean(input.emergencyContact),
      financialResponsibility: Boolean(input.financialResponsibility),
      communicationAuthorization: Boolean(input.communicationAuthorization),
      paymentAuthorization: Boolean(input.paymentAuthorization),
    },
  });
  return getStudentFile(student.publicId);
}

export async function addStudentDocument(studentId: string, input: DocumentInput) {
  const student = await findStudent(studentId);
  if (!DOCUMENT_TYPES.has(input.documentType)) {
    throw errors.unprocessable('DOCUMENT_TYPE_INVALID', 'Choose one of the student document types.');
  }
  await prisma.studentDocument.create({
    data: {
      studentId: student.id,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      issueDate: day(input.issueDate),
      expiryDate: day(input.expiryDate),
      fileRef: input.fileName,
      storedName: input.uploadId ? await claimPendingUpload(input.uploadId) : null,
    },
  });
  return getStudentFile(student.publicId);
}

export async function reviewStudentDocument(studentId: string, documentId: string, verificationStatus: DocumentVerificationStatus) {
  const student = await findStudent(studentId);
  const document = await prisma.studentDocument.findFirst({ where: { id: documentId, studentId: student.id } });
  if (!document) throw errors.notFound('DOCUMENT_NOT_FOUND', 'That document is not on this student file.');
  await prisma.studentDocument.update({ where: { id: document.id }, data: { verificationStatus } });
  return getStudentFile(student.publicId);
}

export async function studentPhoto(studentId: string, actor?: AccessActor) {
  const student = await findStudent(studentId);
  await assertParentOwnsStudent(actor, student.id, {
    code: 'STUDENT_NOT_FOUND',
    message: 'The requested student could not be found.',
  });
  if (!student.photoStoredName) throw errors.notFound('PHOTO_NOT_FOUND', 'This student has no photo on file.');
  return student.photoStoredName;
}

export async function studentDocumentFile(studentId: string, documentId: string, actor?: AccessActor) {
  const student = await findStudent(studentId);
  await assertParentOwnsStudent(actor, student.id, {
    code: 'STUDENT_NOT_FOUND',
    message: 'The requested student could not be found.',
  });
  const document = await prisma.studentDocument.findFirst({ where: { id: documentId, studentId: student.id } });
  if (!document?.storedName) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  return { storedName: document.storedName, fileName: document.fileRef };
}

export async function financialSummary(studentId: string, actor?: AccessActor) {
  const student = await findStudent(studentId);
  await assertParentOwnsStudent(actor, student.id, {
    code: 'STUDENT_NOT_FOUND',
    message: 'The requested student could not be found.',
  });
  const account = await prisma.studentFinancialAccount.findUnique({
    where: { studentId: student.id },
  });
  if (!account) {
    return {
      studentId: student.publicId,
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      currency: 'RWF',
    };
  }
  return {
    studentId: student.publicId,
    totalBilled: money(account.totalBilled),
    totalPaid: money(account.totalPaid),
    outstanding: money(account.outstanding),
    currency: account.currency,
  };
}

export async function updateStudent(studentId: string, input: {
  studentName?: string;
  studentExternalId?: string;
  academicYear?: string;
  classLevel?: string;
  feeCategory?: string;
  status?: StudentStatus;
}) {
  const current = await findStudent(studentId);
  const student = await prisma.student.update({
    where: { id: current.id },
    data: {
      studentName: input.studentName,
      studentExternalId: input.studentExternalId,
      academicYear: input.academicYear,
      classLevel: input.classLevel,
      feeCategory: input.feeCategory,
      status: input.status,
    },
  });
  const school = await prisma.school.findUniqueOrThrow({ where: { id: student.schoolId } });
  return serialize(student, school.publicId);
}

export async function deactivateStudent(studentId: string) {
  return updateStudent(studentId, { status: 'INACTIVE' });
}

export async function findStudent(studentId: string) {
  const student = await prisma.student.findUnique({ where: { publicId: studentId } });
  if (!student) throw errors.notFound('STUDENT_NOT_FOUND', 'The requested student could not be found.');
  return student;
}

export async function refreshStudentAccount(studentId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { studentId, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
  });
  const totalBilled = invoices.reduce((sum, invoice) => sum + money(invoice.amount), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0);
  await prisma.studentFinancialAccount.upsert({
    where: { studentId },
    create: {
      studentId,
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
    },
    update: {
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
    },
  });
}

function serialize(
  student: { publicId: string; studentExternalId: string; studentName: string; academicYear: string; classLevel: string; feeCategory: string | null; status: string },
  schoolId: string,
  guardianId?: string,
) {
  return {
    studentId: student.publicId,
    schoolId,
    studentExternalId: student.studentExternalId,
    studentName: student.studentName,
    academicYear: student.academicYear,
    classLevel: student.classLevel,
    feeCategory: student.feeCategory,
    guardianId: guardianId ?? null,
    status: student.status,
  };
}
