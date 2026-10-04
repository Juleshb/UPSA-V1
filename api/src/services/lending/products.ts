import { Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { prisma } from '../../utils/prisma';
import { dateOnly, dayRequired, decimal, id, money, recordAudit, type Trace } from './shared';

const SEED: Prisma.LoanProductCreateInput[] = [
  product('SCHOOL_WORKING_CAPITAL', 'School working capital', 'SCHOOL', 'Salaries, supplies, utilities, and short cash-flow gaps', 18, 100_000, 20_000_000, 1, 12, 0, false, false),
  product('SCHOOL_DEVELOPMENT', 'School development loan', 'SCHOOL', 'Classrooms, laboratories, buildings, ICT, and expansion', 16, 1_000_000, 500_000_000, 12, 84, 6, true, true),
  product('SCHOOL_EQUIPMENT', 'School equipment financing', 'SCHOOL', 'Computers, buses, furniture, laboratories, solar, and kitchen equipment', 17, 500_000, 150_000_000, 6, 60, 1, false, true),
  product('EDUCATION_FEE', 'Education fee financing', 'PARENT', 'Approved school fees linked to an invoice', 15, 50_000, 5_000_000, 1, 12, 0, false, false),
  product('SUPPLIER_FINANCE', 'Supplier financing', 'SUPPLIER', 'Working capital, purchase orders, invoices, and contracts', 18, 200_000, 100_000_000, 1, 12, 0, false, false),
  product('INVESTMENT_BUSINESS', 'Investment and business loan', 'MEMBER', 'Approved investment activity', 17, 500_000, 200_000_000, 6, 60, 3, true, false),
  product('EMERGENCY', 'Emergency short-term loan', 'SCHOOL', 'Eligible short-term needs', 20, 50_000, 5_000_000, 1, 6, 0, true, false),
  product('ASSET_FINANCE', 'Asset finance', 'SCHOOL', 'A specific vehicle, bus, computer, solar system, or other approved asset', 16, 500_000, 200_000_000, 6, 60, 1, false, true),
  product('INVOICE_FINANCE', 'Invoice financing', 'SUPPLIER', 'An eligible outstanding invoice', 14, 100_000, 50_000_000, 1, 6, 0, false, false),
  product('PURCHASE_ORDER', 'Purchase order financing', 'SUPPLIER', 'Financing against an approved purchase order', 16, 100_000, 50_000_000, 1, 6, 0, false, false),
  product('BRIDGE', 'Bridge financing', 'SCHOOL', 'Short-term finance against an identifiable future cash flow', 18, 200_000, 50_000_000, 1, 9, 0, false, false),
  product('GUARANTEE_BACKED', 'Guarantee-backed loan', 'SCHOOL', 'A loan linked to the guarantee register', 15, 500_000, 300_000_000, 3, 60, 1, true, false),
];

function product(code: string, name: string, customerType: string, purpose: string, rate: number, minimum: number, maximum: number, minTenor: number, maxTenor: number, grace: number, guarantee: boolean, collateral: boolean): Prisma.LoanProductCreateInput {
  return {
    publicId: code,
    code,
    name,
    customerType,
    purpose,
    interestRate: rate,
    processingFeeRate: 1,
    lateFeeRate: 2,
    minimumAmount: minimum,
    maximumAmount: maximum,
    minimumTenor: minTenor,
    maximumTenor: maxTenor,
    graceMonths: grace,
    guaranteeRequired: guarantee,
    collateralRequired: collateral,
    eligibility: 'The applicant is a registered school, member, supplier, or parent on this platform.',
    debtServiceRule: 'Free cash flow should cover the proposed installment.',
    status: 'ACTIVE',
  };
}

export async function ensureProducts() {
  const count = await prisma.loanProduct.count();
  if (count > 0) return;
  for (const row of SEED) {
    await prisma.loanProduct.create({ data: { ...row, publicId: await id('LPD') } });
  }
}

export async function listProducts() {
  await ensureProducts();
  const rows = await prisma.loanProduct.findMany({ orderBy: { name: 'asc' } });
  return rows.map(presentProduct);
}

export function presentProduct(row: {
  publicId: string
  code: string
  name: string
  description: string | null
  customerType: string
  purpose: string
  currency: string
  status: string
  interestRate: { toString(): string }
  interestMethod: string
  processingFeeRate: { toString(): string }
  insuranceFeeRate: { toString(): string }
  guaranteeFeeRate: { toString(): string }
  lateFeeRate: { toString(): string }
  otherCharges: { toString(): string }
  minimumAmount: { toString(): string }
  maximumAmount: { toString(): string }
  minimumTenor: number
  maximumTenor: number
  graceMonths: number
  repaymentFrequency: string
  eligibility: string | null
  maximumExposure: { toString(): string } | null
  debtServiceRule: string | null
  guaranteeRequired: boolean
  collateralRequired: boolean
  allocationOrder: string
}) {
  return {
    productId: row.publicId,
    code: row.code,
    name: row.name,
    description: row.description,
    customerType: row.customerType,
    purpose: row.purpose,
    currency: row.currency,
    status: row.status,
    interestRate: money(row.interestRate.toString()),
    interestMethod: row.interestMethod,
    processingFeeRate: money(row.processingFeeRate.toString()),
    insuranceFeeRate: money(row.insuranceFeeRate.toString()),
    guaranteeFeeRate: money(row.guaranteeFeeRate.toString()),
    lateFeeRate: money(row.lateFeeRate.toString()),
    otherCharges: money(row.otherCharges.toString()),
    minimumAmount: money(row.minimumAmount.toString()),
    maximumAmount: money(row.maximumAmount.toString()),
    minimumTenor: row.minimumTenor,
    maximumTenor: row.maximumTenor,
    graceMonths: row.graceMonths,
    repaymentFrequency: row.repaymentFrequency,
    eligibility: row.eligibility,
    maximumExposure: row.maximumExposure ? money(row.maximumExposure.toString()) : null,
    debtServiceRule: row.debtServiceRule,
    guaranteeRequired: row.guaranteeRequired,
    collateralRequired: row.collateralRequired,
    allocationOrder: row.allocationOrder,
  };
}

export async function saveProduct(input: {
  code: string
  name: string
  description?: string
  customerType: string
  purpose: string
  interestRate: number
  interestMethod?: string
  processingFeeRate?: number
  insuranceFeeRate?: number
  guaranteeFeeRate?: number
  lateFeeRate?: number
  otherCharges?: number
  minimumAmount: number
  maximumAmount: number
  minimumTenor: number
  maximumTenor: number
  graceMonths?: number
  repaymentFrequency?: string
  eligibility?: string
  maximumExposure?: number
  debtServiceRule?: string
  guaranteeRequired?: boolean
  collateralRequired?: boolean
  allocationOrder?: string
  status?: string
}, trace: Trace) {
  if (input.minimumAmount > input.maximumAmount) throw errors.unprocessable('AMOUNT_INVALID', 'The minimum amount cannot exceed the maximum.');
  if (input.minimumTenor > input.maximumTenor) throw errors.unprocessable('TENOR_INVALID', 'The minimum tenor cannot exceed the maximum.');
  const code = input.code.trim().toUpperCase();
  const existing = await prisma.loanProduct.findUnique({ where: { code } });
  if (existing) throw errors.conflict('PRODUCT_EXISTS', 'That product code is already in use.');
  const row = await prisma.loanProduct.create({
    data: {
      publicId: await id('LPD'),
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      customerType: input.customerType,
      purpose: input.purpose.trim(),
      interestRate: decimal(input.interestRate),
      interestMethod: input.interestMethod ?? 'DECLINING',
      processingFeeRate: decimal(input.processingFeeRate ?? 0),
      insuranceFeeRate: decimal(input.insuranceFeeRate ?? 0),
      guaranteeFeeRate: decimal(input.guaranteeFeeRate ?? 0),
      lateFeeRate: decimal(input.lateFeeRate ?? 0),
      otherCharges: decimal(input.otherCharges ?? 0),
      minimumAmount: decimal(input.minimumAmount),
      maximumAmount: decimal(input.maximumAmount),
      minimumTenor: input.minimumTenor,
      maximumTenor: input.maximumTenor,
      graceMonths: input.graceMonths ?? 0,
      repaymentFrequency: input.repaymentFrequency ?? 'MONTHLY',
      eligibility: input.eligibility?.trim() || null,
      maximumExposure: input.maximumExposure == null ? null : decimal(input.maximumExposure),
      debtServiceRule: input.debtServiceRule?.trim() || null,
      guaranteeRequired: input.guaranteeRequired ?? false,
      collateralRequired: input.collateralRequired ?? false,
      allocationOrder: input.allocationOrder?.trim() || 'FEES,INTEREST,PENALTY,PRINCIPAL',
      status: input.status ?? 'ACTIVE',
    },
  });
  await recordAudit({ trace, entityType: 'LoanProduct', entityId: row.publicId, action: 'lending.product', newStatus: row.status });
  return { productId: row.publicId };
}

export async function findProduct(code: string) {
  await ensureProducts();
  const productRow = await prisma.loanProduct.findUnique({ where: { code } });
  if (!productRow || productRow.status !== 'ACTIVE') throw errors.unprocessable('PRODUCT_INVALID', 'Choose an active lending product.');
  return productRow;
}

export { dateOnly, dayRequired };
