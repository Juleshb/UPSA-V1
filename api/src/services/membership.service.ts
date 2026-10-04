import { randomBytes } from 'crypto';
import { MembershipStatus, type MembershipApplication } from '@prisma/client';
import { errors } from '../utils/errors';
import { writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';
import { addDocument, createFee, memberFile, payFee, registerMember } from './membership/members';
import { listCategories } from './membership/office';
import type { Trace } from './membership/shared';
import {
  deliverEmail,
  deskAddress,
  membershipDecisionEmail,
  membershipSubmittedDeskEmail,
  membershipSubmittedEmail,
  membershipVerifyLink,
} from './mailer';

const INSTITUTION_TYPES = new Set(['NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER']);

const DOCUMENT_LABELS: Record<string, string> = {
  REGISTRATION_CERTIFICATE: 'registration certificate',
  TAX_CERTIFICATE: 'tax certificate',
  IDENTIFICATION: 'representative identification',
  PROOF_OF_ADDRESS: 'proof of address',
  BANK_CONFIRMATION: 'bank confirmation',
  AUTHORIZATION_LETTER: 'authorization letter',
  INSTITUTION_PROFILE: 'institution profile',
  OTHER: 'other document',
};

const DECISIONS = ['CONFIRMED', 'REJECTED'] as const;
type Decision = (typeof DECISIONS)[number];

function dayText(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

type ApplicationRecord = {
  publicId: string
  schoolName: string
  registrationNumber: string | null
  contactName: string
  title: string
  phone: string
  email: string
  province: string
  district: string
  sector: string | null
  cell: string | null
  village: string | null
  physicalAddress: string | null
  message: string | null
  categoryCode: string | null
  institutionType: string | null
  dateEstablished: Date | null
  studentCount: number | null
  staffCount: number | null
  website: string | null
  postalAddress: string | null
  alternativePhone: string | null
  registrationCertificateNumber: string | null
  registrationDate: Date | null
  taxIdentificationNumber: string | null
  issuingAuthority: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankBranch: string | null
  currency: string | null
  representativeNationalId: string | null
  representativePhone: string | null
  representativeEmail: string | null
  memberPublicId: string | null
  status: string
  reviewNote: string | null
  reviewedAt: Date | null
  reviewerName: string | null
  reviewerTitle: string | null
  verificationCode: string | null
  createdAt: Date
  documents?: { publicId: string; documentType: string; fileName: string; storedName: string | null }[]
  payment?: {
    amount: number
    currency: string
    method: string | null
    reference: string | null
    externalTransactionId: string | null
    status: string
  } | null
};

function serialize(application: ApplicationRecord) {
  return {
    applicationId: application.publicId,
    memberId: application.memberPublicId,
    schoolName: application.schoolName,
    registrationNumber: application.registrationNumber,
    categoryCode: application.categoryCode,
    institutionType: application.institutionType,
    dateEstablished: dayText(application.dateEstablished),
    studentCount: application.studentCount,
    staffCount: application.staffCount,
    contactName: application.contactName,
    title: application.title,
    phone: application.phone,
    email: application.email,
    website: application.website,
    postalAddress: application.postalAddress,
    alternativePhone: application.alternativePhone,
    registrationCertificateNumber: application.registrationCertificateNumber,
    registrationDate: dayText(application.registrationDate),
    taxIdentificationNumber: application.taxIdentificationNumber,
    issuingAuthority: application.issuingAuthority,
    bankName: application.bankName,
    bankAccountName: application.bankAccountName,
    bankAccountNumber: application.bankAccountNumber,
    bankBranch: application.bankBranch,
    currency: application.currency,
    representativeNationalId: application.representativeNationalId,
    representativePhone: application.representativePhone,
    representativeEmail: application.representativeEmail,
    address: {
      province: application.province,
      district: application.district,
      sector: application.sector,
      cell: application.cell,
      village: application.village,
      physicalAddress: application.physicalAddress,
    },
    message: application.message,
    documents: (application.documents ?? []).map((item) => ({
      documentId: item.publicId,
      documentType: item.documentType,
      fileName: item.fileName,
      hasFile: Boolean(item.storedName),
    })),
    payment: application.payment ?? null,
    status: application.status,
    reviewNote: application.reviewNote,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    reviewerName: application.reviewerName,
    reviewerTitle: application.reviewerTitle,
    verifyUrl: application.verificationCode ? membershipVerifyLink(application.verificationCode) : null,
    createdAt: application.createdAt.toISOString(),
  };
}

function newVerificationCode() {
  return randomBytes(12).toString('base64url');
}

async function sealCertificate(application: MembershipApplication): Promise<MembershipApplication> {
  if (application.status !== 'CONFIRMED') return application;
  const data: { verificationCode?: string; reviewerName?: string; reviewerTitle?: string } = {};
  if (!application.verificationCode) data.verificationCode = newVerificationCode();
  if (!application.reviewerName) {
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'MembershipApplication', entityId: application.publicId, action: 'membership.decide' },
      orderBy: { createdAt: 'desc' },
      include: { actor: true },
    });
    data.reviewerName = audit?.actor?.fullName ?? 'UPSA reader';
    data.reviewerTitle = 'UPSA reader';
  }
  if (Object.keys(data).length === 0) return application;
  return prisma.membershipApplication.update({ where: { id: application.id }, data });
}

export async function publicMembershipCategories() {
  const items = await listCategories();
  return {
    items: items.filter((item) => item.status === 'ACTIVE').map((item) => ({
      code: item.code,
      name: item.name,
      eligibility: item.eligibility,
      membershipFee: item.membershipFee,
      currency: item.currency,
      requirements: item.requirements.map((requirement) => ({
        documentType: requirement.documentType,
        mandatory: requirement.mandatory,
      })),
    })),
  };
}

export async function submitMembershipApplication(input: {
  schoolName: string
  registrationNumber: string
  categoryCode: string
  institutionType: string
  dateEstablished?: string
  studentCount?: number
  staffCount?: number
  contactName: string
  title: string
  phone: string
  email: string
  website?: string
  postalAddress?: string
  alternativePhone?: string
  registrationCertificateNumber: string
  registrationDate?: string
  taxIdentificationNumber?: string
  issuingAuthority?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankBranch?: string
  currency?: string
  representativeNationalId?: string
  representativePhone: string
  representativeEmail: string
  address: { province: string; district: string; sector: string; cell: string; village?: string; physicalAddress: string }
  documents: { documentType: string; fileName: string; uploadId: string }[]
  message?: string
  payment?: {
    paymentMethod: string
    payerName: string
    payerPhone?: string
    paymentReference?: string
    externalTransactionId?: string
  }
}, trace: Trace = {}) {
  if (!INSTITUTION_TYPES.has(input.institutionType)) {
    throw errors.unprocessable('INSTITUTION_TYPE_INVALID', 'Choose the institution type.');
  }
  const categories = await listCategories();
  const category = categories.find((item) => item.code === input.categoryCode && item.status === 'ACTIVE');
  if (!category) throw errors.unprocessable('CATEGORY_INVALID', 'Choose an active membership category.');
  const attached = new Set(input.documents.map((item) => item.documentType));
  if (attached.size !== input.documents.length) {
    throw errors.unprocessable('DOCUMENT_DUPLICATE', 'Attach each document type once.');
  }
  const missing = category.requirements.filter((item) => item.mandatory && !attached.has(item.documentType));
  if (missing.length > 0) {
    const names = missing.map((item) => DOCUMENT_LABELS[item.documentType] ?? item.documentType.toLowerCase().replaceAll('_', ' '));
    throw errors.unprocessable('DOCUMENTS_REQUIRED', `Attach the required documents: ${names.join(', ')}.`);
  }
  const email = input.email.trim();
  if (category.membershipFee > 0 && !input.payment?.paymentMethod) {
    throw errors.unprocessable('PAYMENT_REQUIRED', 'Pay the membership fee before submitting this request.');
  }
  let member: { memberId: string } | undefined;
  let application: Awaited<ReturnType<typeof prisma.membershipApplication.create>> | undefined;
  let feeAmount = 0;
  let paymentStatus: string | null = null;
  try {
  member = await registerMember({
    mode: 'submit',
    categoryCode: input.categoryCode,
    institutionName: input.schoolName,
    registrationNumber: input.registrationNumber,
    institutionType: input.institutionType,
    dateEstablished: input.dateEstablished,
    studentCount: input.studentCount,
    staffCount: input.staffCount,
    province: input.address.province,
    district: input.address.district,
    sector: input.address.sector,
    cell: input.address.cell,
    village: input.address.village,
    physicalAddress: input.address.physicalAddress,
    phone: input.phone,
    email,
    website: input.website,
    postalAddress: input.postalAddress,
    alternativePhone: input.alternativePhone,
    registrationCertificateNumber: input.registrationCertificateNumber,
    registrationDate: input.registrationDate,
    taxIdentificationNumber: input.taxIdentificationNumber,
    issuingAuthority: input.issuingAuthority,
    bankName: input.bankName,
    bankAccountName: input.bankAccountName,
    bankAccountNumber: input.bankAccountNumber,
    bankBranch: input.bankBranch,
    currency: input.currency,
    representativeName: input.contactName,
    representativePosition: input.title,
    representativeNationalId: input.representativeNationalId,
    representativePhone: input.representativePhone,
    representativeEmail: input.representativeEmail,
  }, trace);
  const storedDocuments: { documentType: string; fileName: string; storedName: string | null }[] = [];
  for (const document of input.documents) {
    await addDocument(member.memberId, {
      documentType: document.documentType,
      fileName: document.fileName,
      uploadId: document.uploadId,
    }, trace);
    const saved = await prisma.memberDocument.findFirst({
      where: { member: { publicId: member.memberId }, documentType: document.documentType },
      orderBy: { createdAt: 'desc' },
    });
    storedDocuments.push({
      documentType: document.documentType,
      fileName: document.fileName,
      storedName: saved?.storedName ?? null,
    });
  }
  if (category.membershipFee > 0 && input.payment) {
    feeAmount = category.membershipFee;
    await createFee(member.memberId, {
      feeType: 'MEMBERSHIP',
      financialYear: String(new Date().getUTCFullYear()),
      amount: category.membershipFee,
    }, trace);
    const opened = await memberFile(member.memberId);
    const due = opened.fees.find((item) => item.outstanding > 0);
    if (!due) throw errors.unprocessable('FEE_MISSING', 'The membership fee could not be opened.');
    const settled = await payFee(member.memberId, {
      feeId: due.feeId,
      amount: category.membershipFee,
      paymentMethod: input.payment.paymentMethod,
      payerName: input.payment.payerName,
      payerPhone: input.payment.payerPhone,
      paymentReference: input.payment.paymentReference,
      externalTransactionId: input.payment.externalTransactionId,
    }, trace);
    paymentStatus = settled.fees.every((item) => item.outstanding === 0) ? 'PAID' : 'PARTIAL';
  }
  application = await prisma.membershipApplication.create({
    data: {
      publicId: await nextPublicId('MBA'),
      schoolName: input.schoolName.trim(),
      registrationNumber: input.registrationNumber.trim(),
      contactName: input.contactName.trim(),
      title: input.title.trim(),
      phone: input.phone.trim(),
      email,
      province: input.address.province,
      district: input.address.district,
      sector: input.address.sector,
      cell: input.address.cell,
      village: input.address.village?.trim() || null,
      physicalAddress: input.address.physicalAddress.trim(),
      message: input.message?.trim() || null,
      categoryCode: input.categoryCode,
      institutionType: input.institutionType,
      dateEstablished: input.dateEstablished ? new Date(input.dateEstablished) : null,
      studentCount: input.studentCount ?? null,
      staffCount: input.staffCount ?? null,
      website: input.website?.trim() || null,
      postalAddress: input.postalAddress?.trim() || null,
      alternativePhone: input.alternativePhone?.trim() || null,
      registrationCertificateNumber: input.registrationCertificateNumber.trim(),
      registrationDate: input.registrationDate ? new Date(input.registrationDate) : null,
      taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
      issuingAuthority: input.issuingAuthority?.trim() || null,
      bankName: input.bankName?.trim() || null,
      bankAccountName: input.bankAccountName?.trim() || null,
      bankAccountNumber: input.bankAccountNumber?.trim() || null,
      bankBranch: input.bankBranch?.trim() || null,
      currency: input.currency?.trim() || 'RWF',
      representativeNationalId: input.representativeNationalId?.trim() || null,
      representativePhone: input.representativePhone.trim(),
      representativeEmail: input.representativeEmail.trim(),
      memberPublicId: member.memberId,
      status: 'SUBMITTED',
      documents: {
        create: await Promise.all(storedDocuments.map(async (document) => ({
          publicId: await nextPublicId('MAD'),
          documentType: document.documentType,
          fileName: document.fileName,
          storedName: document.storedName,
        }))),
      },
    },
    include: { documents: true },
  });
  } catch (error) {
    if (member && !application) await prisma.member.delete({ where: { publicId: member.memberId } }).catch(() => undefined);
    throw error;
  }
  if (!application) throw errors.unprocessable('APPLICATION_FAILED', 'The membership request could not be saved.');

  const location = [application.sector, application.district, application.province].filter(Boolean).join(', ');
  const emailSent = await deliverEmail({
    to: application.email,
    ...membershipSubmittedEmail({
      contactName: application.contactName,
      schoolName: application.schoolName,
      applicationId: application.publicId,
      email: application.email,
    }),
  });
  const desk = deskAddress();
  if (desk && desk.toLowerCase() !== application.email.toLowerCase()) {
    await deliverEmail({
      to: desk,
      ...membershipSubmittedDeskEmail({
        contactName: application.contactName,
        title: application.title,
        schoolName: application.schoolName,
        applicationId: application.publicId,
        email: application.email,
        phone: application.phone,
        location,
        registrationNumber: application.registrationNumber ?? undefined,
        message: application.message ?? undefined,
      }),
    });
  }

  return {
    applicationId: application.publicId,
    memberId: member.memberId,
    schoolName: application.schoolName,
    email: application.email,
    status: application.status,
    emailSent,
    feeAmount,
    currency: category.currency,
    paymentStatus,
  };
}

export async function applicationDocumentFile(applicationId: string, documentId: string) {
  const document = await prisma.membershipApplicationDocument.findFirst({
    where: { publicId: documentId, application: { publicId: applicationId } },
  });
  if (!document?.storedName) throw errors.notFound('FILE_NOT_STORED', 'This document was recorded by name, and no file was uploaded.');
  return { storedName: document.storedName, fileName: document.fileName };
}

export async function publicMembershipStatus(applicationId: string, email: string) {
  const found = await prisma.membershipApplication.findUnique({ where: { publicId: applicationId } });
  const matches = found && found.email.trim().toLowerCase() === email.trim().toLowerCase();
  if (!found || !matches) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No membership request matches that reference and email.');
  }
  const application = await sealCertificate(found);
  return {
    applicationId: application.publicId,
    schoolName: application.schoolName,
    email: application.email,
    status: application.status,
    contactName: application.contactName,
    title: application.title,
    location: [application.sector, application.district, application.province].filter(Boolean).join(', '),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    reviewerName: application.reviewerName,
    reviewerTitle: application.reviewerTitle,
    verifyUrl: application.verificationCode ? membershipVerifyLink(application.verificationCode) : null,
  };
}

export async function verifyMembershipCertificate(code: string) {
  const trimmed = code.trim();
  const application = await prisma.membershipApplication.findUnique({ where: { verificationCode: trimmed } });
  if (application?.status === 'CONFIRMED') {
    return {
      verified: true as const,
      applicationId: application.publicId,
      schoolName: application.schoolName,
      location: [application.sector, application.district, application.province].filter(Boolean).join(', '),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewerName: application.reviewerName ?? 'UPSA reader',
      reviewerTitle: application.reviewerTitle ?? 'UPSA reader',
      membershipNumber: null,
      status: 'CONFIRMED',
    };
  }
  const certificate = await prisma.membershipCertificate.findFirst({
    where: { OR: [{ certificateNumber: trimmed }, { publicId: trimmed }, { membershipNumber: trimmed }] },
    include: { member: true },
    orderBy: { issuedAt: 'desc' },
  });
  if (!certificate) return { verified: false as const };
  const expired = certificate.expiryDate.getTime() < Date.now();
  const active = certificate.member.status === 'ACTIVE' && !expired;
  return {
    verified: active,
    applicationId: certificate.certificateNumber,
    schoolName: certificate.institutionName,
    location: [certificate.member.sector, certificate.member.district, certificate.member.province].filter(Boolean).join(', '),
    reviewedAt: certificate.issuedAt.toISOString(),
    reviewerName: certificate.signatory,
    reviewerTitle: certificate.categoryName,
    membershipNumber: certificate.membershipNumber,
    status: expired ? 'EXPIRED' : certificate.member.status,
  };
}

async function paymentsByMember(publicIds: Array<string | null>) {
  const ids = publicIds.filter((item): item is string => Boolean(item));
  const members = ids.length === 0 ? [] : await prisma.member.findMany({
    where: { publicId: { in: ids } },
    include: { fees: { include: { payments: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } } },
  });
  return new Map(members.map((member) => {
    const fee = member.fees.find((item) => item.feeType === 'MEMBERSHIP') ?? member.fees[0];
    const payment = fee?.payments[0];
    return [member.publicId, fee ? {
      amount: Number(fee.totalPayable),
      currency: fee.currency,
      method: payment?.paymentMethod ?? null,
      reference: payment?.paymentReference ?? null,
      externalTransactionId: payment?.externalTransactionId ?? null,
      status: fee.status,
    } : null] as const;
  }));
}

export async function listMembershipApplications() {
  const rows = await prisma.membershipApplication.findMany({ include: { documents: true }, orderBy: { createdAt: 'desc' } });
  const sealed = await Promise.all(rows.map(async (row) => {
    const next = await sealCertificate(row);
    return { ...row, ...next, documents: row.documents };
  }));
  const payments = await paymentsByMember(sealed.map((row) => row.memberPublicId));
  return { items: sealed.map((row) => serialize({ ...row, payment: row.memberPublicId ? payments.get(row.memberPublicId) ?? null : null })) };
}

export async function decideMembershipApplication(
  applicationId: string,
  input: { decision: Decision; note?: string },
  actorId?: string,
) {
  if (!DECISIONS.includes(input.decision)) {
    throw errors.unprocessable('DECISION_INVALID', 'Confirm or reject the membership request.');
  }
  const application = await prisma.membershipApplication.findUnique({ where: { publicId: applicationId } });
  if (!application) {
    throw errors.notFound('APPLICATION_NOT_FOUND', 'No membership request matches that reference.');
  }
  if (application.status !== 'SUBMITTED') {
    throw errors.conflict('ALREADY_DECIDED', 'This request already has an administrator decision.');
  }
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
  const updated = await prisma.membershipApplication.update({
    where: { id: application.id },
    data: {
      status: input.decision,
      reviewNote: input.note?.trim() || null,
      reviewedAt: new Date(),
      ...(input.decision === 'CONFIRMED'
        ? {
          verificationCode: newVerificationCode(),
          reviewerName: actor?.fullName ?? 'UPSA reader',
          reviewerTitle: 'UPSA reader',
        }
        : {}),
    },
  });
  await writeAudit({
    actorId,
    action: 'membership.decide',
    entityType: 'MembershipApplication',
    entityId: updated.publicId,
    metadata: { decision: input.decision },
  });
  if (input.decision === 'CONFIRMED') {
    await prisma.school.updateMany({
      where: { membershipApplicationId: updated.id },
      data: { membershipStatus: MembershipStatus.VERIFIED, rupsaMemberId: updated.publicId },
    });
  }
  if (input.decision === 'REJECTED') {
    await prisma.school.updateMany({
      where: { membershipApplicationId: updated.id },
      data: { membershipStatus: MembershipStatus.REJECTED },
    });
  }
  await deliverEmail({
    to: updated.email,
    ...membershipDecisionEmail({
      contactName: updated.contactName,
      schoolName: updated.schoolName,
      applicationId: updated.publicId,
      email: updated.email,
      decision: input.decision,
      note: updated.reviewNote ?? undefined,
    }),
  });
  return serialize(updated);
}
