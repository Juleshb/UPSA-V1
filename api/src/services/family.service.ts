import type { UserRole } from '@prisma/client';
import { errors } from '../utils/errors';
import { money } from '../utils/money';
import { parentContext } from './parent.service';
import { prisma } from '../utils/prisma';

export type AccessActor = {
  id: string;
  role: UserRole;
};

export async function linkedStudentIds(userId: string): Promise<string[]> {
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!guardian) return [];
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: guardian.id },
    select: { studentId: true },
  });
  return links.map((link) => link.studentId);
}

/** `null` means the caller is not a parent and should see the existing unscoped lists. */
export async function parentStudentScope(actor?: AccessActor): Promise<string[] | null> {
  if (!actor || actor.role !== 'PARENT') return null;
  return linkedStudentIds(actor.id);
}

export async function assertParentOwnsStudent(
  actor: AccessActor | undefined,
  studentId: string,
  missing: { code: string; message: string },
): Promise<void> {
  const scope = await parentStudentScope(actor);
  if (scope && !scope.includes(studentId)) {
    throw errors.notFound(missing.code, missing.message);
  }
}

export async function familyHome(userId: string) {
  const context = await parentContext(userId);
  if (!context) {
    return {
      guardian: null,
      identity: { status: 'NOT_SUBMITTED' as const, nationalIdMask: null, updatedAt: null },
      authorization: null,
      preferences: { paymentChannel: null, originCountry: 'RW', notifyChannel: 'IN_APP' },
      schools: [],
      notifications: [],
      childRecords: 'WITHHELD' as const,
      currency: 'RWF',
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      students: [],
      payments: [],
      receipts: [],
    };
  }

  if (!context.authorization) {
    return {
      ...context,
      schools: [],
      childRecords: 'WITHHELD' as const,
      currency: 'RWF',
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      students: [],
      payments: [],
      receipts: [],
    };
  }

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { userId } });

  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: guardian.id },
    include: {
      student: {
        include: {
          school: true,
          invoices: {
            orderBy: { dueDate: 'asc' },
            include: {
              payments: {
                orderBy: { createdAt: 'desc' },
                include: { rail: true, corridor: true },
              },
              receipts: { orderBy: { issuedAt: 'desc' } },
            },
          },
        },
      },
    },
    orderBy: { student: { studentName: 'asc' } },
  });

  const students = links.map((link) => {
    const student = link.student;
    const openInvoices = student.invoices.filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'WRITTEN_OFF');
    const totalBilled = openInvoices.reduce((sum, invoice) => sum + money(invoice.amount), 0);
    const totalPaid = openInvoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0);
    return {
      studentId: student.publicId,
      studentName: student.studentName,
      classLevel: student.classLevel,
      academicYear: student.academicYear,
      feeCategory: student.feeCategory,
      status: student.status,
      schoolId: student.school.publicId,
      schoolName: student.school.schoolName,
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
  });

  const payments = links.flatMap((link) =>
    link.student.invoices.flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        paymentId: payment.publicId,
        invoiceId: invoice.publicId,
        studentId: link.student.publicId,
        studentName: link.student.studentName,
        schoolName: link.student.school.schoolName,
        description: invoice.description,
        amount: money(payment.amount),
        currency: payment.currency,
        paymentChannel: payment.paymentChannel,
        status: payment.status,
        flowCode: payment.flowCode,
        railName: payment.rail?.name ?? null,
        railInfrastructure: payment.rail?.infrastructure ?? null,
        corridorLabel: payment.corridor
          ? `${payment.corridor.originLabel} ↔ ${payment.corridor.destinationLabel}`
          : null,
        settlementReference: payment.settlementReference,
        createdAt: payment.createdAt.toISOString(),
      })),
    ),
  ).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const receipts = links.flatMap((link) =>
    link.student.invoices.flatMap((invoice) =>
      invoice.receipts.map((receipt) => ({
        receiptId: receipt.publicId,
        invoiceId: invoice.publicId,
        paymentId: invoice.payments.find((payment) => payment.id === receipt.paymentId)?.publicId ?? null,
        studentId: link.student.publicId,
        studentName: link.student.studentName,
        schoolName: link.student.school.schoolName,
        description: invoice.description,
        amount: money(receipt.amount),
        currency: receipt.currency,
        issuedAt: receipt.issuedAt.toISOString(),
      })),
    ),
  ).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  const schools = [...new Map(students.map((student) => [student.schoolId, {
    schoolId: student.schoolId,
    schoolName: student.schoolName,
    district: links.find((link) => link.student.publicId === student.studentId)?.student.school.district ?? '',
  }])).values()];

  return {
    ...context,
    schools,
    childRecords: 'AVAILABLE' as const,
    currency: 'RWF',
    totalBilled: students.reduce((sum, student) => sum + student.totalBilled, 0),
    totalPaid: students.reduce((sum, student) => sum + student.totalPaid, 0),
    outstanding: students.reduce((sum, student) => sum + student.outstanding, 0),
    students,
    payments,
    receipts,
  };
}

export type FamilyHome = Awaited<ReturnType<typeof familyHome>>;
