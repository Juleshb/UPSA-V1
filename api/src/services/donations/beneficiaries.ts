import { errors } from '../../utils/errors';
import { nextPublicId } from '../../utils/ids';
import {
  actorLabel,
  dateOnly,
  findBeneficiary,
  iso,
  jsonDocs,
  money,
  prisma,
  readDocs,
  recordAudit,
  type Doc,
  type Trace,
} from './shared';

const PAYMENT_TYPES = ['SCHOOL', 'STUDENT', 'FAMILY', 'INSTITUTION', 'PROJECT', 'PROGRAM'] as const;
const REGISTERED_TYPES = ['SCHOOL', 'INSTITUTION'] as const;

export type BeneficiaryInput = {
  beneficiaryType: 'SCHOOL' | 'STUDENT' | 'FAMILY' | 'COMMUNITY' | 'INSTITUTION' | 'PROJECT' | 'PROGRAM' | 'OTHER';
  name?: string;
  registrationNumber?: string;
  contactPerson?: string;
  telephone?: string;
  email?: string;
  province?: string;
  district?: string;
  sector?: string;
  physicalAddress?: string;
  bankName?: string;
  bankAccount?: string;
  mobileMoneyNumber?: string;
  documents?: Doc[];
};

function clean(value?: string) {
  const text = value?.trim() ?? '';
  return text || null;
}

function assertBeneficiary(input: BeneficiaryInput, mode: 'draft' | 'register') {
  const name = clean(input.name);
  if (!name) throw errors.unprocessable('NAME_REQUIRED', 'Enter the beneficiary name.');
  const needsPayment = PAYMENT_TYPES.includes(input.beneficiaryType as (typeof PAYMENT_TYPES)[number]);
  const needsRegistration = REGISTERED_TYPES.includes(input.beneficiaryType as (typeof REGISTERED_TYPES)[number]);
  if (mode === 'register') {
    if (!clean(input.telephone) || clean(input.telephone)!.replace(/\D/g, '').length < 8) {
      throw errors.unprocessable('TELEPHONE_REQUIRED', 'Enter a telephone number of at least 8 digits.');
    }
    if (!clean(input.physicalAddress)) throw errors.unprocessable('ADDRESS_REQUIRED', 'Enter the physical address.');
    if (input.beneficiaryType !== 'STUDENT' && !clean(input.contactPerson)) {
      throw errors.unprocessable('CONTACT_REQUIRED', 'Enter the contact person.');
    }
    if (needsRegistration && !clean(input.registrationNumber)) {
      throw errors.unprocessable('REGISTRATION_NUMBER_REQUIRED', 'Enter the registration number.');
    }
    if (needsPayment && !clean(input.bankAccount) && !clean(input.mobileMoneyNumber)) {
      throw errors.unprocessable('PAYMENT_DETAILS_REQUIRED', 'Enter a bank account or a mobile money number.');
    }
  }
  const email = clean(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errors.unprocessable('EMAIL_INVALID', 'Enter a valid email address.');
  }
  return {
    beneficiaryType: input.beneficiaryType,
    name,
    registrationNumber: clean(input.registrationNumber),
    contactPerson: clean(input.contactPerson),
    telephone: clean(input.telephone) ?? '',
    email,
    province: clean(input.province),
    district: clean(input.district),
    sector: clean(input.sector),
    physicalAddress: clean(input.physicalAddress) ?? '',
    bankName: clean(input.bankName),
    bankAccount: clean(input.bankAccount),
    mobileMoneyNumber: clean(input.mobileMoneyNumber),
    documents: jsonDocs(readDocs(input.documents)),
  };
}

export function serializeBeneficiary(row: Awaited<ReturnType<typeof findBeneficiary>>) {
  return {
    id: row.publicId,
    beneficiaryType: row.beneficiaryType,
    status: row.status,
    name: row.name,
    registrationNumber: row.registrationNumber,
    contactPerson: row.contactPerson,
    telephone: row.telephone,
    email: row.email,
    province: row.province,
    district: row.district,
    sector: row.sector,
    physicalAddress: row.physicalAddress,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    mobileMoneyNumber: row.mobileMoneyNumber,
    identityVerified: row.identityVerified,
    registrationVerified: row.registrationVerified,
    locationVerified: row.locationVerified,
    eligibilityVerified: row.eligibilityVerified,
    documentsVerified: row.documentsVerified,
    paymentInfoVerified: row.paymentInfoVerified,
    verificationDecision: row.verificationDecision,
    verifiedBy: row.verifiedBy,
    verificationDate: iso(row.verificationDate),
    verificationComments: row.verificationComments,
    documents: readDocs(row.documents),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBeneficiaries(query: { q?: string; status?: string; beneficiaryType?: string }) {
  const rows = await prisma.beneficiary.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows
    .filter((row) => !query.status || row.status === query.status)
    .filter((row) => !query.beneficiaryType || row.beneficiaryType === query.beneficiaryType)
    .filter((row) => !needle || [row.publicId, row.name, row.telephone, row.registrationNumber, row.district]
      .some((part) => String(part ?? '').toLowerCase().includes(needle)))
    .map(serializeBeneficiary);
}

export async function getBeneficiary(id: string) {
  const beneficiary = await findBeneficiary(id);
  const allocations = await prisma.allocation.findMany({
    where: { beneficiaryId: beneficiary.id },
    include: { donation: true, distributions: true },
    orderBy: { createdAt: 'desc' },
  });
  const audits = await prisma.donationAudit.findMany({
    where: { entityType: 'Beneficiary', entityId: beneficiary.publicId },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  return {
    ...serializeBeneficiary(beneficiary),
    allocations: allocations.map((row) => ({
      id: row.publicId,
      donationId: row.donation.publicId,
      amount: money(row.amount),
      currency: row.currency,
      purpose: row.purpose,
      category: row.category,
      status: row.status,
      date: dateOnly(row.allocationDate),
      distributed: row.distributions.some((item) => item.status === 'CONFIRMED'),
    })),
    history: audits.map((row) => ({
      id: row.publicId,
      action: row.action,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      userId: row.userId,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function saveBeneficiary(input: BeneficiaryInput, mode: 'draft' | 'register', trace: Trace, id?: string) {
  const data = assertBeneficiary(input, mode);
  const existing = id ? await findBeneficiary(id) : null;
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'MORE_INFORMATION_REQUIRED') {
    throw errors.unprocessable('BENEFICIARY_LOCKED', 'This beneficiary can be edited only while the file is a draft or more information is required.');
  }
  const status = mode === 'register' ? 'REGISTERED' : 'DRAFT';
  const saved = existing
    ? await prisma.beneficiary.update({ where: { id: existing.id }, data: { ...data, status, verificationDecision: null } })
    : await prisma.beneficiary.create({ data: { ...data, publicId: await nextPublicId('BNF'), status } });
  await recordAudit({
    trace,
    entityType: 'Beneficiary',
    entityId: saved.publicId,
    action: mode === 'register' ? 'Beneficiary registered' : 'Beneficiary draft saved',
    previousStatus: existing?.status,
    newStatus: status,
  });
  return getBeneficiary(saved.publicId);
}

export async function verifyBeneficiary(id: string, input: {
  decision: 'VERIFIED' | 'NOT_VERIFIED' | 'MORE_INFORMATION_REQUIRED';
  identityVerified: boolean;
  registrationVerified: boolean;
  locationVerified: boolean;
  eligibilityVerified: boolean;
  documentsVerified: boolean;
  paymentInfoVerified: boolean;
  comments?: string;
}, trace: Trace) {
  const beneficiary = await findBeneficiary(id);
  if (beneficiary.status === 'DRAFT') {
    throw errors.unprocessable('BENEFICIARY_NOT_REGISTERED', 'Register the beneficiary before verification.');
  }
  const needsPayment = PAYMENT_TYPES.includes(beneficiary.beneficiaryType as (typeof PAYMENT_TYPES)[number]);
  if (input.decision === 'VERIFIED') {
    const missing = [
      ['identity', input.identityVerified],
      ['registration', input.registrationVerified],
      ['location', input.locationVerified],
      ['eligibility', input.eligibilityVerified],
      ['documents', input.documentsVerified],
      ['payment information', !needsPayment || input.paymentInfoVerified],
    ].filter((item) => !item[1]).map((item) => String(item[0]));
    if (missing.length) {
      throw errors.unprocessable('VERIFICATION_INCOMPLETE', `Complete these checks before verifying the beneficiary: ${missing.join(', ')}.`);
    }
    if (readDocs(beneficiary.documents).length === 0) {
      throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Attach the supporting documents before confirming them.');
    }
    if (needsPayment && !beneficiary.bankAccount && !beneficiary.mobileMoneyNumber) {
      throw errors.unprocessable('PAYMENT_DETAILS_REQUIRED', 'Record a bank account or mobile money number before confirming payment information.');
    }
  }
  const status = input.decision === 'VERIFIED'
    ? 'VERIFIED'
    : input.decision === 'NOT_VERIFIED'
      ? 'NOT_VERIFIED'
      : 'MORE_INFORMATION_REQUIRED';
  const officer = await actorLabel(trace.actorId);
  await prisma.beneficiary.update({
    where: { id: beneficiary.id },
    data: {
      identityVerified: input.identityVerified,
      registrationVerified: input.registrationVerified,
      locationVerified: input.locationVerified,
      eligibilityVerified: input.eligibilityVerified,
      documentsVerified: input.documentsVerified,
      paymentInfoVerified: input.paymentInfoVerified,
      verificationDecision: input.decision,
      verifiedBy: officer,
      verificationDate: new Date(),
      verificationComments: clean(input.comments),
      status,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Beneficiary',
    entityId: beneficiary.publicId,
    action: 'Beneficiary verification',
    previousStatus: beneficiary.status,
    newStatus: status,
    reason: input.comments,
    reference: input.decision,
  });
  return getBeneficiary(beneficiary.publicId);
}
