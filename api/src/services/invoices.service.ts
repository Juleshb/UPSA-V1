import { InvoiceStatus } from '@prisma/client';
import { errors } from '../utils/errors';
import { EventTypes, publishEvent, writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { decimal, money } from '../utils/money';
import { prisma } from '../utils/prisma';
import { assertParentOwnsStudent, parentStudentScope, type AccessActor } from './family.service';
import { findSchool } from './schools.service';
import { findStudent, refreshStudentAccount } from './students.service';

export async function createInvoice(input: {
  schoolId: string;
  studentId: string;
  currency?: string;
  amount: number;
  description: string;
  dueDate: string;
}, actorId?: string) {
  const school = await findSchool(input.schoolId);
  const student = await findStudent(input.studentId);
  if (student.schoolId !== school.id) {
    throw errors.unprocessable('STUDENT_SCHOOL_MISMATCH', 'The student does not belong to this school.');
  }

  const amount = decimal(input.amount);
  const invoice = await prisma.invoice.create({
    data: {
      publicId: await nextPublicId('INV'),
      schoolId: school.id,
      studentId: student.id,
      currency: input.currency ?? 'RWF',
      amount,
      balance: amount,
      description: input.description,
      dueDate: new Date(input.dueDate),
      status: InvoiceStatus.ISSUED,
      lineItems: {
        create: [{ description: input.description, amount }],
      },
    },
  });

  await refreshStudentAccount(student.id);
  await publishEvent(EventTypes.invoiceCreated, invoice.publicId, {
    invoiceId: invoice.publicId,
    amount: input.amount,
  });
  await writeAudit({
    actorId,
    action: 'invoice.create',
    entityType: 'Invoice',
    entityId: invoice.publicId,
  });

  return serialize(invoice, student.publicId);
}

export async function getInvoice(invoiceId: string, actor?: AccessActor) {
  const invoice = await findInvoice(invoiceId);
  await assertParentOwnsStudent(actor, invoice.studentId, {
    code: 'INVOICE_NOT_FOUND',
    message: 'The requested invoice could not be found.',
  });
  const student = await prisma.student.findUniqueOrThrow({ where: { id: invoice.studentId } });
  return serialize(invoice, student.publicId);
}

export async function listInvoices(filters: { schoolId?: string; studentId?: string; status?: InvoiceStatus }, actor?: AccessActor) {
  const school = filters.schoolId ? await findSchool(filters.schoolId) : null;
  const student = filters.studentId ? await findStudent(filters.studentId) : null;
  const scope = await parentStudentScope(actor);
  if (student && scope && !scope.includes(student.id)) {
    throw errors.notFound('STUDENT_NOT_FOUND', 'The requested student could not be found.');
  }
  const invoices = await prisma.invoice.findMany({
    where: {
      schoolId: school?.id,
      studentId: student?.id ?? (scope ? { in: scope } : undefined),
      status: filters.status,
    },
    include: { student: true },
    orderBy: { createdAt: 'desc' },
  });
  return invoices.map((invoice) => serialize(invoice, invoice.student.publicId));
}

export async function updateInvoice(invoiceId: string, input: {
  amount?: number;
  description?: string;
  dueDate?: string;
}, actorId?: string) {
  const current = await findInvoice(invoiceId);
  if (current.status !== InvoiceStatus.ISSUED || money(current.amountPaid) > 0) {
    throw errors.unprocessable('INVOICE_LOCKED', 'Only unpaid issued invoices can be edited.');
  }
  const amount = input.amount != null ? decimal(input.amount) : current.amount;
  const invoice = await prisma.invoice.update({
    where: { id: current.id },
    data: {
      amount,
      balance: amount,
      description: input.description ?? current.description,
      dueDate: input.dueDate ? new Date(input.dueDate) : current.dueDate,
    },
  });
  await refreshStudentAccount(current.studentId);
  await writeAudit({
    actorId,
    action: 'invoice.update',
    entityType: 'Invoice',
    entityId: invoice.publicId,
  });
  const student = await prisma.student.findUniqueOrThrow({ where: { id: invoice.studentId } });
  return serialize(invoice, student.publicId);
}

export async function cancelInvoice(invoiceId: string, actorId?: string) {
  const current = await findInvoice(invoiceId);
  if (current.status === InvoiceStatus.PAID || current.status === InvoiceStatus.CANCELLED) {
    throw errors.unprocessable('INVOICE_NOT_CANCELLABLE', 'This invoice can no longer be cancelled.');
  }
  const invoice = await prisma.invoice.update({
    where: { id: current.id },
    data: { status: InvoiceStatus.CANCELLED, balance: decimal(0) },
  });
  await refreshStudentAccount(current.studentId);
  await writeAudit({
    actorId,
    action: 'invoice.cancel',
    entityType: 'Invoice',
    entityId: invoice.publicId,
  });
  const student = await prisma.student.findUniqueOrThrow({ where: { id: invoice.studentId } });
  return serialize(invoice, student.publicId);
}

export async function findInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { publicId: invoiceId } });
  if (!invoice) throw errors.notFound('INVOICE_NOT_FOUND', 'The requested invoice could not be found.');
  return invoice;
}

export function invoiceStatusFor(amount: number, amountPaid: number): InvoiceStatus {
  if (amountPaid <= 0) return InvoiceStatus.ISSUED;
  if (amountPaid >= amount) return InvoiceStatus.PAID;
  return InvoiceStatus.PARTIALLY_PAID;
}

function serialize(
  invoice: {
    publicId: string;
    amount: unknown;
    amountPaid: unknown;
    balance: unknown;
    currency: string;
    status: InvoiceStatus;
    description: string;
    dueDate: Date;
  },
  studentId: string,
) {
  return {
    invoiceId: invoice.publicId,
    studentId,
    amount: money(invoice.amount as never),
    amountPaid: money(invoice.amountPaid as never),
    balance: money(invoice.balance as never),
    currency: invoice.currency,
    status: invoice.status,
    description: invoice.description,
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
  };
}
