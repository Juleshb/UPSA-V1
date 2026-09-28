import { Router } from 'express';
import { asyncHandler } from '../utils/async';
import { money } from '../utils/money';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';
import { facilitySnapshot } from '../services/guarantees.service';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function yearMonths(year = new Date().getFullYear()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1);
    return {
      key: monthKey(date),
      label: date.toLocaleString('en-GB', { month: 'short' }),
    };
  });
}

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get(
  '/overview',
  requirePermission('report.read'),
  asyncHandler(async (_req, res) => {
    const [schools, students, invoices, payments, loans, guaranteeFacility] = await Promise.all([
      prisma.school.count(),
      prisma.student.count(),
      prisma.invoice.findMany(),
      prisma.payment.findMany(),
      prisma.loan.findMany(),
      facilitySnapshot(),
    ]);

    const billed = invoices.reduce((sum, invoice) => sum + money(invoice.amount), 0);
    const collected = invoices.reduce((sum, invoice) => sum + money(invoice.amountPaid), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + money(invoice.balance), 0);
    const loanBook = loans.reduce((sum, loan) => sum + money(loan.principalOutstanding), 0);
    const months = yearMonths();
    const series = months.map((month) => {
      const billedInMonth = invoices
        .filter((invoice) => monthKey(invoice.createdAt) === month.key && invoice.status !== 'CANCELLED')
        .reduce((sum, invoice) => sum + money(invoice.amount), 0);
      const collectedInMonth = payments
        .filter((payment) => monthKey(payment.createdAt) === month.key && payment.status === 'SUCCESS')
        .reduce((sum, payment) => sum + money(payment.amount), 0);
      return { month: month.label, billed: billedInMonth, collected: collectedInMonth };
    });
    const invoiceStatus = Object.entries(
      invoices.reduce<Record<string, { count: number; amount: number }>>((acc, invoice) => {
        const current = acc[invoice.status] ?? { count: 0, amount: 0 };
        current.count += 1;
        current.amount += money(money(invoice.balance) > 0 ? invoice.balance : invoice.amount);
        acc[invoice.status] = current;
        return acc;
      }, {}),
    ).map(([status, value]) => ({ status, ...value }));
    const channels = Object.entries(
      payments.reduce<Record<string, number>>((acc, payment) => {
        if (payment.status !== 'SUCCESS') return acc;
        acc[payment.paymentChannel] = (acc[payment.paymentChannel] ?? 0) + money(payment.amount);
        return acc;
      }, {}),
    ).map(([channel, amount]) => ({ channel, amount }));

    res.json({
      schools,
      students,
      invoices: invoices.length,
      payments: payments.length,
      collections: {
        billed,
        collected,
        outstanding,
        collectionRate: billed === 0 ? 0 : Number(((collected / billed) * 100).toFixed(1)),
        currency: 'RWF',
        series,
      },
      invoicesByStatus: invoiceStatus,
      paymentChannels: channels,
      credit: {
        activeLoans: loans.filter((loan) => loan.status === 'ACTIVE' || loan.status === 'IN_ARREARS').length,
        principalOutstanding: loanBook,
        currency: 'RWF',
      },
      guarantee: guaranteeFacility,
    });
  }),
);
