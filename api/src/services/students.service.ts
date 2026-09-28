import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { money } from '../utils/money';
import { prisma } from '../utils/prisma';
import { findSchool } from './schools.service';
import { findGuardian } from './guardians.service';
import { assertParentOwnsStudent, parentStudentScope, type AccessActor } from './family.service';

export async function createStudent(input: {
  schoolId: string;
  studentExternalId: string;
  studentName: string;
  academicYear: string;
  classLevel: string;
  guardianId?: string;
  feeCategory?: string;
}) {
  const school = await findSchool(input.schoolId);
  const guardian = input.guardianId ? await findGuardian(input.guardianId) : null;

  const student = await prisma.student.create({
    data: {
      publicId: await nextPublicId('STD'),
      schoolId: school.id,
      studentExternalId: input.studentExternalId,
      studentName: input.studentName,
      academicYear: input.academicYear,
      classLevel: input.classLevel,
      feeCategory: input.feeCategory,
      financialAccount: {
        create: { currency: 'RWF' },
      },
      ...(guardian
        ? {
            guardians: {
              create: { guardianId: guardian.id, isPrimary: true },
            },
          }
        : {}),
    },
  });

  return serialize(student, school.publicId, guardian?.publicId);
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
  status?: string;
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
