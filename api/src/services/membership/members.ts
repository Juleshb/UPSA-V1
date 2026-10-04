import { Prisma } from '@prisma/client';
import { errors } from '../../utils/errors';
import { prisma } from '../../utils/prisma';
import { membershipVerifyLink } from '../mailer';
import { claimPendingUpload } from '../uploads';
import { createSchool, findSchool } from '../schools.service';
import {
  actorLabel, addMonths, assertAmount, clean, dateOnly, day, dayRequired, decimal, feePaid, id, money,
  notify, outstandingOf, payable, positive, recordAudit, roundMoney, routePayment, schoolType, type Trace,
} from './shared';

const CATEGORIES = [
  { code: 'FULL', name: 'Full Member', fee: 50000, renewal: 40000, eligibility: 'A registered school that meets the full membership requirements.' },
  { code: 'ASSOCIATE', name: 'Associate Member', fee: 25000, renewal: 20000, eligibility: 'An institution seeking a limited membership.' },
  { code: 'INSTITUTIONAL', name: 'Institutional Member', fee: 100000, renewal: 80000, eligibility: 'A school or institution joining in its own name.' },
  { code: 'PARTNER', name: 'Strategic Partner', fee: 0, renewal: 0, eligibility: 'A partner approved by UPSA.' },
] as const;

const REQUIREMENTS = ['REGISTRATION_CERTIFICATE', 'TAX_CERTIFICATE', 'IDENTIFICATION', 'PROOF_OF_ADDRESS', 'BANK_CONFIRMATION', 'AUTHORIZATION_LETTER', 'INSTITUTION_PROFILE'];

export async function ensureCategories() {
  const count = await prisma.membershipCategory.count();
  if (count > 0) return;
  for (const item of CATEGORIES) {
    const category = await prisma.membershipCategory.create({
      data: {
        publicId: await id('MCA'),
        code: item.code,
        name: item.name,
        eligibility: item.eligibility,
        membershipFee: decimal(item.fee),
        renewalFee: decimal(item.renewal),
        periodMonths: 12,
        effectiveDate: new Date(),
        status: 'ACTIVE',
      },
    });
    for (const documentType of REQUIREMENTS) {
      const optional = documentType === 'TAX_CERTIFICATE' || documentType === 'BANK_CONFIRMATION';
      await prisma.membershipRequirement.create({
        data: {
          publicId: await id('MRQ'),
          categoryId: category.id,
          documentType,
          mandatory: !optional,
          verificationRequired: true,
        },
      });
    }
  }
}

async function load(publicId: string) {
  const member = await prisma.member.findUnique({
    where: { publicId },
    include: {
      school: true,
      category: true,
      applications: { orderBy: { createdAt: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      verifications: { orderBy: { reviewedAt: 'desc' } },
      decisions: { orderBy: { decidedAt: 'desc' } },
      fees: { include: { payments: true }, orderBy: { createdAt: 'desc' } },
      certificates: { orderBy: { issuedAt: 'desc' } },
      renewals: { orderBy: { createdAt: 'desc' } },
      changes: { orderBy: { createdAt: 'desc' } },
      suspensions: { orderBy: { createdAt: 'desc' } },
      reactivations: { orderBy: { createdAt: 'desc' } },
      terminations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!member) throw errors.notFound('MEMBER_NOT_FOUND', 'No membership file matches that reference.');
  if (member.status === 'ACTIVE' && member.expiryDate && member.expiryDate < new Date()) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'EXPIRED' } });
    await notify('MEMBERSHIP_EXPIRED', 'Membership expired', `${member.institutionName} reached ${dateOnly(member.expiryDate)}.`, member.publicId);
    member.status = 'EXPIRED';
  }
  return member;
}

function present(member: Awaited<ReturnType<typeof load>>) {
  const fees = member.fees.map((fee) => {
    const position = feePaid(fee);
    return {
      feeId: fee.publicId,
      feeType: fee.feeType,
      financialYear: fee.financialYear,
      amount: money(fee.amount),
      discount: money(fee.discount),
      penalty: money(fee.penalty),
      totalPayable: money(fee.totalPayable),
      currency: fee.currency,
      dueDate: dateOnly(fee.dueDate),
      status: fee.status,
      paid: position.paid,
      outstanding: position.outstanding,
    };
  });
  const due = roundMoney(fees.reduce((sum, fee) => sum + fee.outstanding, 0));
  const collected = roundMoney(fees.reduce((sum, fee) => sum + fee.paid, 0));
  return {
    memberId: member.publicId,
    membershipNumber: member.membershipNumber,
    schoolId: member.school?.publicId ?? null,
    schoolName: member.school?.schoolName ?? null,
    categoryCode: member.category?.code ?? member.membershipType,
    categoryName: member.category?.name ?? member.membershipType,
    membershipType: member.membershipType,
    institutionName: member.institutionName,
    registrationNumber: member.registrationNumber,
    institutionType: member.institutionType,
    dateEstablished: dateOnly(member.dateEstablished),
    studentCount: member.studentCount,
    staffCount: member.staffCount,
    province: member.province,
    district: member.district,
    sector: member.sector,
    cell: member.cell,
    village: member.village,
    physicalAddress: member.physicalAddress,
    phone: member.phone,
    email: member.email,
    website: member.website,
    postalAddress: member.postalAddress,
    alternativePhone: member.alternativePhone,
    registrationCertificateNumber: member.registrationCertificateNumber,
    registrationDate: dateOnly(member.registrationDate),
    taxIdentificationNumber: member.taxIdentificationNumber,
    issuingAuthority: member.issuingAuthority,
    bankName: member.bankName,
    bankAccountName: member.bankAccountName,
    bankAccountNumber: member.bankAccountNumber,
    bankBranch: member.bankBranch,
    currency: member.currency,
    representativeName: member.representativeName,
    representativePosition: member.representativePosition,
    representativeNationalId: member.representativeNationalId,
    representativePhone: member.representativePhone,
    representativeEmail: member.representativeEmail,
    status: member.status,
    startDate: dateOnly(member.startDate),
    expiryDate: dateOnly(member.expiryDate),
    feeDue: due,
    feeCollected: collected,
    applications: member.applications.map((item) => ({
      applicationId: item.publicId,
      categoryCode: item.categoryCode,
      requestedType: item.requestedType,
      applicationDate: dateOnly(item.applicationDate),
      reason: item.reason,
      referredBy: item.referredBy,
      accurate: item.accurate,
      termsAccepted: item.termsAccepted,
      verifyAuthorized: item.verifyAuthorized,
      status: item.status,
    })),
    documents: member.documents.map((item) => ({
      documentId: item.publicId,
      documentType: item.documentType,
      documentNumber: item.documentNumber,
      issueDate: dateOnly(item.issueDate),
      expiryDate: dateOnly(item.expiryDate),
      issuingAuthority: item.issuingAuthority,
      fileName: item.fileName,
      hasFile: Boolean(item.storedName),
      status: item.status,
      comment: item.comment,
    })),
    verification: member.verifications[0]
      ? {
        result: member.verifications[0].result,
        officerName: member.verifications[0].officerName,
        reviewedAt: member.verifications[0].reviewedAt.toISOString(),
        comments: member.verifications[0].comments,
        registrationVerified: member.verifications[0].registrationVerified,
        nameVerified: member.verifications[0].nameVerified,
        numberVerified: member.verifications[0].numberVerified,
        addressVerified: member.verifications[0].addressVerified,
        legalVerified: member.verifications[0].legalVerified,
        identityVerified: member.verifications[0].identityVerified,
        authorityVerified: member.verifications[0].authorityVerified,
        contactVerified: member.verifications[0].contactVerified,
        bankVerified: member.verifications[0].bankVerified,
        bankBelongsToInstitution: member.verifications[0].bankBelongsToInstitution,
      }
      : null,
    decision: member.decisions[0]
      ? {
        decision: member.decisions[0].decision,
        comment: member.decisions[0].comment,
        conditions: member.decisions[0].conditions,
        officerName: member.decisions[0].officerName,
        decidedAt: dateOnly(member.decisions[0].decidedAt),
      }
      : null,
    fees,
    payments: member.fees.flatMap((fee) => fee.payments.map((payment) => ({
      paymentId: payment.publicId,
      feeId: fee.publicId,
      amount: money(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      payerName: payment.payerName,
      externalTransactionId: payment.externalTransactionId,
      railCode: payment.railCode,
      paymentDate: dateOnly(payment.paymentDate),
      status: payment.status,
      reconciliationStatus: payment.reconciliationStatus,
    }))),
    certificate: member.certificates[0]
      ? {
        certificateNumber: member.certificates[0].certificateNumber,
        membershipNumber: member.certificates[0].membershipNumber,
        institutionName: member.certificates[0].institutionName,
        registrationNumber: member.certificates[0].registrationNumber,
        categoryName: member.certificates[0].categoryName,
        startDate: dateOnly(member.certificates[0].startDate),
        expiryDate: dateOnly(member.certificates[0].expiryDate),
        issuedAt: dateOnly(member.certificates[0].issuedAt),
        signatory: member.certificates[0].signatory,
        location: [member.sector, member.district, member.province].filter(Boolean).join(', '),
        verifyUrl: membershipVerifyLink(member.certificates[0].certificateNumber),
      }
      : null,
  };
}

export async function listMembers(query: { status?: string; q?: string }) {
  await ensureCategories();
  const rows = await prisma.member.findMany({
    where: query.status ? { status: query.status } : undefined,
    include: { category: true, fees: { include: { payments: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const needle = query.q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (!needle) return true;
    return [row.publicId, row.membershipNumber, row.institutionName, row.registrationNumber, row.phone, row.email, row.district, row.category?.code, row.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }).map((row) => {
    const due = row.fees.reduce((sum, fee) => sum + feePaid(fee).outstanding, 0);
    return {
      memberId: row.publicId,
      membershipNumber: row.membershipNumber,
      institutionName: row.institutionName,
      registrationNumber: row.registrationNumber,
      category: row.category?.name ?? row.membershipType,
      district: row.district,
      status: row.status,
      expiryDate: dateOnly(row.expiryDate),
      payment: due > 0 ? 'DUE' : row.fees.length ? 'PAID' : 'NONE',
    };
  });
}

export async function registerMember(input: {
  mode?: string
  schoolId?: string
  categoryCode: string
  institutionName: string
  registrationNumber: string
  institutionType: string
  dateEstablished?: string
  studentCount?: number
  staffCount?: number
  province: string
  district: string
  sector: string
  cell: string
  village?: string
  physicalAddress: string
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
  representativeName: string
  representativePosition: string
  representativeNationalId?: string
  representativePhone: string
  representativeEmail: string
}, trace: Trace) {
  await ensureCategories();
  const category = await prisma.membershipCategory.findUnique({ where: { code: input.categoryCode } });
  if (!category || category.status !== 'ACTIVE') throw errors.unprocessable('CATEGORY_INVALID', 'Choose an active membership category.');
  const school = await attachSchool(input, trace);
  const status = input.mode === 'draft' ? 'DRAFT' : 'SUBMITTED';
  const member = await prisma.member.create({
    data: {
      publicId: await id('MEM'),
      schoolId: school.id,
      categoryId: category.id,
      membershipType: category.code,
      institutionName: input.institutionName.trim(),
      registrationNumber: input.registrationNumber.trim(),
      institutionType: input.institutionType,
      dateEstablished: day(input.dateEstablished),
      studentCount: input.studentCount ?? null,
      staffCount: input.staffCount ?? null,
      province: input.province,
      district: input.district,
      sector: input.sector,
      cell: input.cell,
      village: clean(input.village),
      physicalAddress: input.physicalAddress.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      website: clean(input.website),
      postalAddress: clean(input.postalAddress),
      alternativePhone: clean(input.alternativePhone),
      registrationCertificateNumber: input.registrationCertificateNumber.trim(),
      registrationDate: day(input.registrationDate),
      taxIdentificationNumber: clean(input.taxIdentificationNumber),
      issuingAuthority: clean(input.issuingAuthority),
      bankName: clean(input.bankName),
      bankAccountName: clean(input.bankAccountName),
      bankAccountNumber: clean(input.bankAccountNumber),
      bankBranch: clean(input.bankBranch),
      currency: input.currency?.trim() || 'RWF',
      representativeName: input.representativeName.trim(),
      representativePosition: input.representativePosition.trim(),
      representativeNationalId: clean(input.representativeNationalId),
      representativePhone: input.representativePhone.trim(),
      representativeEmail: input.representativeEmail.trim(),
      status,
    },
  });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'Member', entityId: member.publicId, action: 'membership.register', newStatus: status });
  if (status === 'SUBMITTED') await notify('APPLICATION_RECEIVED', 'Membership application received', `${member.institutionName} submitted a membership file.`, member.publicId);
  return { memberId: member.publicId, schoolId: school.publicId, status };
}

async function attachSchool(input: { schoolId?: string; registrationNumber: string; institutionName: string; phone: string; email: string; province: string; district: string; sector: string; cell: string; village?: string; physicalAddress: string; taxIdentificationNumber?: string; alternativePhone?: string; website?: string; postalAddress?: string; studentCount?: number; staffCount?: number; institutionType: string; dateEstablished?: string }, trace: Trace) {
  const existing = input.schoolId
    ? await findSchool(input.schoolId)
    : await prisma.school.findUnique({ where: { registrationNumber: input.registrationNumber.trim() } });
  if (existing) {
    const taken = await prisma.member.findUnique({ where: { schoolId: existing.id } });
    if (taken) throw errors.conflict('MEMBER_EXISTS', 'This school already has a membership file.');
    return existing;
  }
  const created = await createSchool({
    schoolName: input.institutionName.trim(),
    registrationNumber: input.registrationNumber.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    taxIdentificationNumber: clean(input.taxIdentificationNumber) ?? undefined,
    address: { province: input.province, district: input.district, sector: input.sector },
  }, trace.actorId);
  const school = await findSchool(created.schoolId);
  await prisma.school.update({
    where: { id: school.id },
    data: {
      schoolType: schoolType(input.institutionType),
      cell: input.cell,
      village: clean(input.village),
      physicalAddress: input.physicalAddress.trim(),
      alternativePhone: clean(input.alternativePhone),
      website: clean(input.website),
      postalAddress: clean(input.postalAddress),
      studentCount: input.studentCount,
      staffCount: input.staffCount,
      dateEstablished: day(input.dateEstablished),
    },
  });
  return school;
}

export async function memberFile(memberId: string) {
  return present(await load(memberId));
}

export async function submitApplication(memberId: string, input: {
  reason: string
  referredBy?: string
  accurate: boolean
  termsAccepted: boolean
  verifyAuthorized: boolean
  applicationDate?: string
}, trace: Trace) {
  const member = await load(memberId);
  if (!input.accurate || !input.termsAccepted || !input.verifyAuthorized) {
    throw errors.unprocessable('DECLARATION_REQUIRED', 'The institution must confirm the information, the terms, and the verification authority.');
  }
  if (['REJECTED', 'TERMINATED', 'ACTIVE'].includes(member.status)) {
    throw errors.conflict('APPLICATION_CLOSED', 'This membership file is not open for a new application.');
  }
  const application = await prisma.memberApplication.create({
    data: {
      publicId: await id('MAP'),
      memberId: member.id,
      categoryCode: member.category?.code ?? member.membershipType,
      requestedType: member.membershipType,
      applicationDate: day(input.applicationDate) ?? new Date(),
      reason: input.reason.trim(),
      referredBy: clean(input.referredBy),
      accurate: true,
      termsAccepted: true,
      verifyAuthorized: true,
      status: 'SUBMITTED',
    },
  });
  const previous = member.status;
  await prisma.member.update({ where: { id: member.id }, data: { status: 'SUBMITTED' } });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MemberApplication', entityId: application.publicId, action: 'membership.apply', previousStatus: previous, newStatus: 'SUBMITTED', reference: member.publicId });
  await notify('APPLICATION_RECEIVED', 'Membership application received', `${member.institutionName} submitted application ${application.publicId}.`, member.publicId);
  return memberFile(member.publicId);
}

export async function addDocument(memberId: string, input: {
  documentType: string
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  issuingAuthority?: string
  fileName: string
  uploadId?: string
}, trace: Trace) {
  const member = await load(memberId);
  const storedName = input.uploadId ? await claimPendingUpload(input.uploadId) : null;
  const document = await prisma.memberDocument.create({
    data: {
      publicId: await id('MDC'),
      memberId: member.id,
      documentType: input.documentType,
      documentNumber: clean(input.documentNumber),
      issueDate: day(input.issueDate),
      expiryDate: day(input.expiryDate),
      issuingAuthority: clean(input.issuingAuthority),
      fileName: input.fileName.trim(),
      storedName,
      status: 'PENDING',
    },
  });
  if (member.status === 'SUBMITTED' || member.status === 'RESUBMITTED') {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'DOCUMENT_REVIEW' } });
  }
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MemberDocument', entityId: document.publicId, action: 'membership.document', newStatus: 'PENDING' });
  return memberFile(member.publicId);
}

export async function memberDocumentFile(memberId: string, documentId: string) {
  const member = await load(memberId);
  const document = member.documents.find((item) => item.publicId === documentId);
  if (!document?.storedName) throw errors.notFound('FILE_NOT_STORED', 'This document was recorded by name, and no file was uploaded.');
  return { storedName: document.storedName, fileName: document.fileName };
}

export async function reviewDocument(memberId: string, documentId: string, input: { status: string; comment?: string }, trace: Trace) {
  const member = await load(memberId);
  const document = member.documents.find((item) => item.publicId === documentId);
  if (!document) throw errors.notFound('DOCUMENT_NOT_FOUND', 'That document is not on this membership file.');
  if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(input.status)) throw errors.unprocessable('STATUS_INVALID', 'Mark the document pending, verified, or rejected.');
  const officer = await actorLabel(trace.actorId);
  await prisma.memberDocument.update({
    where: { id: document.id },
    data: { status: input.status, comment: clean(input.comment), verifiedBy: officer, verifiedAt: new Date() },
  });
  if (input.status === 'REJECTED') await notify('DOCUMENTS_REQUIRED', 'Membership document needs attention', `${document.documentType} on ${member.institutionName} was not accepted.`, member.publicId);
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MemberDocument', entityId: document.publicId, action: 'membership.document.review', previousStatus: document.status, newStatus: input.status, reason: input.comment });
  return memberFile(member.publicId);
}

export async function verifyMember(memberId: string, input: {
  registrationVerified: boolean
  nameVerified: boolean
  numberVerified: boolean
  addressVerified: boolean
  legalVerified: boolean
  identityVerified: boolean
  authorityVerified: boolean
  contactVerified: boolean
  bankVerified: boolean
  bankBelongsToInstitution: boolean
  result: 'PENDING' | 'VERIFIED' | 'MORE_INFORMATION_REQUIRED' | 'REJECTED'
  comments?: string
}, trace: Trace) {
  const member = await load(memberId);
  const officer = await actorLabel(trace.actorId);
  await prisma.memberVerification.create({
    data: {
      publicId: await id('MVF'),
      memberId: member.id,
      ...input,
      comments: clean(input.comments),
      officerId: trace.actorId,
      officerName: officer,
      reviewedAt: new Date(),
    },
  });
  const settled = ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'FEE_PAYMENT'].includes(member.status);
  const next = settled
    ? member.status
    : input.result === 'VERIFIED' ? 'PENDING_APPROVAL' : input.result === 'MORE_INFORMATION_REQUIRED' ? 'MORE_INFORMATION_REQUIRED' : input.result === 'REJECTED' ? 'REJECTED' : 'VERIFICATION';
  if (!settled) await prisma.member.update({ where: { id: member.id }, data: { status: next } });
  if (member.schoolId && !settled) {
    await prisma.school.update({
      where: { id: member.schoolId },
      data: {
        registrationVerified: input.registrationVerified && input.numberVerified,
        legalDocumentsVerified: input.legalVerified,
        representativeVerified: input.identityVerified && input.authorityVerified,
        addressVerified: input.addressVerified,
        bankAccountVerified: input.bankVerified && input.bankBelongsToInstitution,
        membershipStatus: next === 'REJECTED' ? 'REJECTED' : 'PENDING',
      },
    });
  }
  await recordAudit({ trace, memberId: member.publicId, entityType: 'Member', entityId: member.publicId, action: 'membership.verify', previousStatus: member.status, newStatus: next, reason: input.comments });
  if (next === 'MORE_INFORMATION_REQUIRED') await notify('DOCUMENTS_REQUIRED', 'More membership information is required', member.institutionName, member.publicId);
  return memberFile(member.publicId);
}

async function issueCertificate(member: Awaited<ReturnType<typeof load>>, signatory: string) {
  const months = member.category?.periodMonths ?? 12;
  const start = new Date();
  const expiry = addMonths(start, months);
  const number = member.membershipNumber ?? await id('MBR');
  await prisma.member.update({
    where: { id: member.id },
    data: { status: 'ACTIVE', membershipNumber: number, startDate: start, expiryDate: expiry },
  });
  const certificate = await prisma.membershipCertificate.create({
    data: {
      publicId: await id('MCF'),
      certificateNumber: await id('MCF'),
      memberId: member.id,
      institutionName: member.institutionName,
      registrationNumber: member.registrationNumber,
      categoryName: member.category?.name ?? member.membershipType,
      membershipNumber: number,
      startDate: start,
      expiryDate: expiry,
      issuedAt: new Date(),
      signatory,
    },
  });
  if (member.schoolId) {
    await prisma.school.update({
      where: { id: member.schoolId },
      data: { membershipStatus: 'VERIFIED', rupsaMemberId: member.school?.rupsaMemberId ?? number },
    });
  }
  await notify('MEMBERSHIP_ACTIVATED', 'Membership is active', `${member.institutionName} is active until ${dateOnly(expiry)}. Certificate ${certificate.certificateNumber}.`, member.publicId);
  return certificate.certificateNumber;
}

export async function decideMember(memberId: string, input: { decision: 'APPROVE' | 'CONDITIONAL' | 'MORE_INFORMATION' | 'REJECT'; comment?: string; conditions?: string }, trace: Trace) {
  const member = await load(memberId);
  if (!['PENDING_APPROVAL', 'VERIFICATION', 'MORE_INFORMATION_REQUIRED'].includes(member.status)) {
    throw errors.conflict('NOT_READY', 'Verify the membership file before the approval decision.');
  }
  const officer = await actorLabel(trace.actorId);
  await prisma.memberDecision.create({
    data: {
      publicId: await id('MDS'),
      memberId: member.id,
      decision: input.decision,
      comment: clean(input.comment),
      conditions: clean(input.conditions),
      officerId: trace.actorId,
      officerName: officer,
      decidedAt: new Date(),
    },
  });
  if (input.decision === 'REJECT') {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'REJECTED' } });
    await notify('APPLICATION_REJECTED', 'Membership application was not approved', member.institutionName, member.publicId);
  } else if (input.decision === 'MORE_INFORMATION') {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'MORE_INFORMATION_REQUIRED' } });
    await notify('DOCUMENTS_REQUIRED', 'More membership information is required', member.institutionName, member.publicId);
  } else {
    const feeAmount = money(member.category?.membershipFee ?? 0);
    const membershipFees = member.fees.filter((item) => item.feeType === 'MEMBERSHIP');
    const alreadyPaid = membershipFees.length > 0 && membershipFees.every((item) => feePaid(item).outstanding === 0);
    if (alreadyPaid || feeAmount === 0) {
      await prisma.member.update({ where: { id: member.id }, data: { status: 'APPROVED' } });
      await issueCertificate(await load(member.publicId), officer);
    } else if (membershipFees.some((item) => feePaid(item).outstanding > 0)) {
      await prisma.member.update({ where: { id: member.id }, data: { status: 'FEE_PAYMENT' } });
      await notify('APPLICATION_APPROVED', 'Membership approved, fee due', `${member.institutionName} still has a membership fee outstanding.`, member.publicId);
    } else if (feeAmount > 0) {
      await prisma.membershipFee.create({
        data: {
          publicId: await id('MFE'),
          memberId: member.id,
          feeType: 'MEMBERSHIP',
          financialYear: String(new Date().getUTCFullYear()),
          amount: decimal(feeAmount),
          totalPayable: decimal(feeAmount),
          currency: member.currency,
          dueDate: addMonths(new Date(), 1),
          status: 'DUE',
        },
      });
      await prisma.member.update({ where: { id: member.id }, data: { status: 'FEE_PAYMENT' } });
      await notify('APPLICATION_APPROVED', 'Membership approved, fee due', `${member.institutionName} owes ${feeAmount} ${member.currency}.`, member.publicId);
    } else {
      await prisma.member.update({ where: { id: member.id }, data: { status: 'APPROVED' } });
      await issueCertificate(await load(member.publicId), officer);
    }
  }
  await recordAudit({ trace, memberId: member.publicId, entityType: 'Member', entityId: member.publicId, action: 'membership.decide', previousStatus: member.status, newStatus: input.decision, reason: input.comment });
  return memberFile(member.publicId);
}

export async function createFee(memberId: string, input: { feeType: string; financialYear: string; amount: number; discount?: number; penalty?: number; dueDate?: string }, trace: Trace) {
  const member = await load(memberId);
  const total = payable(input.amount, input.discount ?? 0, input.penalty ?? 0);
  const fee = await prisma.membershipFee.create({
    data: {
      publicId: await id('MFE'),
      memberId: member.id,
      feeType: input.feeType,
      financialYear: input.financialYear,
      amount: decimal(assertAmount(input.amount, 'Fee')),
      discount: decimal(assertAmount(input.discount ?? 0, 'Discount')),
      penalty: decimal(assertAmount(input.penalty ?? 0, 'Penalty')),
      totalPayable: decimal(total),
      currency: member.currency,
      dueDate: day(input.dueDate),
      status: total === 0 ? 'PAID' : 'DUE',
    },
  });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipFee', entityId: fee.publicId, action: 'membership.fee', newStatus: fee.status, reason: String(total) });
  return memberFile(member.publicId);
}

export async function payFee(memberId: string, input: {
  feeId: string
  amount: number
  paymentMethod: string
  payerName: string
  payerPhone?: string
  paymentReference?: string
  externalTransactionId?: string
  paymentDate?: string
}, trace: Trace) {
  const member = await load(memberId);
  const fee = member.fees.find((item) => item.publicId === input.feeId);
  if (!fee) throw errors.notFound('FEE_NOT_FOUND', 'That fee is not on this membership file.');
  const position = feePaid(fee);
  const amount = positive(input.amount, 'Payment');
  if (amount > position.outstanding) throw errors.unprocessable('ABOVE_DUE', 'The payment cannot exceed the amount still due.');
  const routed = await routePayment(input.paymentMethod, input.externalTransactionId);
  const payment = await prisma.membershipFeePayment.create({
    data: {
      publicId: await id('MPY'),
      memberId: member.id,
      feeId: fee.id,
      amount: decimal(amount),
      currency: member.currency,
      paymentMethod: input.paymentMethod,
      payerName: input.payerName.trim(),
      payerPhone: clean(input.payerPhone),
      paymentReference: clean(input.paymentReference),
      externalTransactionId: routed.value,
      railCode: routed.railCode,
      paymentDate: day(input.paymentDate) ?? new Date(),
      status: routed.status,
      reconciliationStatus: routed.reconciliationStatus,
    },
  });
  const remaining = roundMoney(position.outstanding - amount);
  await prisma.membershipFee.update({ where: { id: fee.id }, data: { status: remaining === 0 ? 'PAID' : 'PARTIAL' } });
  await notify('PAYMENT_RECEIVED', 'Membership payment received', `${member.institutionName} paid ${amount} ${member.currency}.`, member.publicId);
  const stillDue = await outstandingOf(member.id);
  if (stillDue === 0 && ['FEE_PAYMENT', 'APPROVED', 'EXPIRED'].includes(member.status)) {
    await issueCertificate(await load(member.publicId), await actorLabel(trace.actorId));
  }
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipFeePayment', entityId: payment.publicId, action: 'membership.pay', newStatus: routed.status, reference: routed.value, reason: String(amount) });
  return memberFile(member.publicId);
}

export async function renewMember(memberId: string, input: {
  discount?: number
  penalty?: number
  informationConfirmed: boolean
  documentsValid: boolean
  requirementsMet: boolean
  feePaid: boolean
}, trace: Trace) {
  const member = await load(memberId);
  if (!['ACTIVE', 'EXPIRED'].includes(member.status)) throw errors.conflict('NOT_RENEWABLE', 'Renew an active or expired membership.');
  if (!input.informationConfirmed || !input.documentsValid || !input.requirementsMet) {
    throw errors.unprocessable('RENEWAL_INCOMPLETE', 'Confirm the member information, the documents, and the membership requirements.');
  }
  const base = money(member.category?.renewalFee ?? 0);
  const total = payable(base, input.discount ?? 0, input.penalty ?? 0);
  const outstanding = await outstandingOf(member.id);
  const renewal = await prisma.membershipRenewal.create({
    data: {
      publicId: await id('MRN'),
      memberId: member.id,
      currentExpiry: member.expiryDate,
      renewalFee: decimal(base),
      outstanding: decimal(outstanding),
      discount: decimal(assertAmount(input.discount ?? 0, 'Discount')),
      penalty: decimal(assertAmount(input.penalty ?? 0, 'Penalty')),
      totalPayable: decimal(total),
      informationConfirmed: true,
      documentsValid: true,
      requirementsMet: true,
      feePaid: input.feePaid && total === 0,
      status: total === 0 ? 'RENEWED' : 'FEE_DUE',
      newExpiry: total === 0 ? addMonths(member.expiryDate && member.expiryDate > new Date() ? member.expiryDate : new Date(), member.category?.periodMonths ?? 12) : null,
    },
  });
  if (total === 0) {
    const expiry = addMonths(member.expiryDate && member.expiryDate > new Date() ? member.expiryDate : new Date(), member.category?.periodMonths ?? 12);
    await prisma.member.update({ where: { id: member.id }, data: { status: 'ACTIVE', expiryDate: expiry } });
    await notify('MEMBERSHIP_RENEWED', 'Membership renewed', `${member.institutionName} is renewed until ${dateOnly(expiry)}.`, member.publicId);
  } else {
    await prisma.membershipFee.create({
      data: {
        publicId: await id('MFE'),
        memberId: member.id,
        feeType: 'RENEWAL',
        financialYear: String(new Date().getUTCFullYear()),
        amount: decimal(base),
        discount: decimal(assertAmount(input.discount ?? 0, 'Discount')),
        penalty: decimal(assertAmount(input.penalty ?? 0, 'Penalty')),
        totalPayable: decimal(total),
        currency: member.currency,
        dueDate: addMonths(new Date(), 1),
        status: 'DUE',
      },
    });
    if (member.status === 'ACTIVE') await prisma.member.update({ where: { id: member.id }, data: { status: 'FEE_PAYMENT' } });
  }
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipRenewal', entityId: renewal.publicId, action: 'membership.renew', newStatus: renewal.status, reason: String(total) });
  return memberFile(member.publicId);
}

export async function updateProfile(memberId: string, input: {
  institutionName?: string
  physicalAddress?: string
  phone?: string
  email?: string
  representativeName?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  studentCount?: number
  staffCount?: number
  taxIdentificationNumber?: string
  reason: string
}, trace: Trace) {
  const member = await load(memberId);
  const previous = {
    institutionName: member.institutionName,
    physicalAddress: member.physicalAddress,
    phone: member.phone,
    email: member.email,
    representativeName: member.representativeName,
    bankName: member.bankName,
    bankAccountName: member.bankAccountName,
    bankAccountNumber: member.bankAccountNumber,
    studentCount: member.studentCount,
    staffCount: member.staffCount,
    taxIdentificationNumber: member.taxIdentificationNumber,
  };
  const next = {
    institutionName: clean(input.institutionName) ?? member.institutionName,
    physicalAddress: clean(input.physicalAddress) ?? member.physicalAddress,
    phone: clean(input.phone) ?? member.phone,
    email: clean(input.email) ?? member.email,
    representativeName: clean(input.representativeName) ?? member.representativeName,
    bankName: input.bankName === undefined ? member.bankName : clean(input.bankName),
    bankAccountName: input.bankAccountName === undefined ? member.bankAccountName : clean(input.bankAccountName),
    bankAccountNumber: input.bankAccountNumber === undefined ? member.bankAccountNumber : clean(input.bankAccountNumber),
    studentCount: input.studentCount ?? member.studentCount,
    staffCount: input.staffCount ?? member.staffCount,
    taxIdentificationNumber: input.taxIdentificationNumber === undefined ? member.taxIdentificationNumber : clean(input.taxIdentificationNumber),
  };
  const officer = await actorLabel(trace.actorId);
  await prisma.member.update({ where: { id: member.id }, data: next });
  const change = await prisma.memberChange.create({
    data: {
      publicId: await id('MCH'),
      memberId: member.id,
      previousValue: previous as Prisma.InputJsonValue,
      newValue: next as Prisma.InputJsonValue,
      reason: input.reason.trim(),
      requestedBy: officer,
      approvedBy: officer,
    },
  });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MemberChange', entityId: change.publicId, action: 'membership.update', reason: input.reason });
  return memberFile(member.publicId);
}

export async function suspendMember(memberId: string, input: { decision: 'SUSPEND' | 'CANCEL' | 'KEEP_ACTIVE'; reason: string; effectiveDate: string; reviewDate?: string; evidence?: string; comments?: string }, trace: Trace) {
  const member = await load(memberId);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.membershipSuspension.create({
    data: {
      publicId: await id('MSP'),
      memberId: member.id,
      decision: input.decision,
      reason: input.reason.trim(),
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      reviewDate: day(input.reviewDate),
      evidence: clean(input.evidence),
      comments: clean(input.comments),
      officerName: officer,
    },
  });
  const next = input.decision === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
  if (input.decision === 'SUSPEND' && member.status !== 'ACTIVE') throw errors.conflict('NOT_ACTIVE', 'Suspend an active membership.');
  if (input.decision !== 'KEEP_ACTIVE') await prisma.member.update({ where: { id: member.id }, data: { status: next } });
  if (next === 'SUSPENDED') await notify('MEMBERSHIP_SUSPENDED', 'Membership suspended', member.institutionName, member.publicId);
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipSuspension', entityId: row.publicId, action: 'membership.suspend', previousStatus: member.status, newStatus: input.decision === 'KEEP_ACTIVE' ? member.status : next, reason: input.reason });
  return memberFile(member.publicId);
}

export async function reactivateMember(memberId: string, input: { reason: string; requirements?: string; documentsVerified: boolean; reactivationDate: string }, trace: Trace) {
  const member = await load(memberId);
  if (member.status !== 'SUSPENDED') throw errors.conflict('NOT_SUSPENDED', 'Reactivate a suspended membership.');
  if (!input.documentsVerified) throw errors.unprocessable('DOCUMENTS_UNVERIFIED', 'Confirm that the documents are still valid.');
  const due = await outstandingOf(member.id);
  if (due > 0) throw errors.unprocessable('FEES_OUTSTANDING', 'Clear the outstanding membership fee before reactivation.');
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.membershipReactivation.create({
    data: {
      publicId: await id('MRA'),
      memberId: member.id,
      previousStatus: member.status,
      reason: input.reason.trim(),
      outstandingFees: decimal(due),
      requirements: clean(input.requirements),
      documentsVerified: true,
      reactivationDate: dayRequired(input.reactivationDate, 'Reactivation date'),
      officerName: officer,
    },
  });
  await prisma.member.update({ where: { id: member.id }, data: { status: 'ACTIVE' } });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipReactivation', entityId: row.publicId, action: 'membership.reactivate', previousStatus: 'SUSPENDED', newStatus: 'ACTIVE', reason: input.reason });
  return memberFile(member.publicId);
}

export async function terminateMember(memberId: string, input: { reason: string; effectiveDate: string; refundDue?: number; evidence?: string; confirmed: boolean }, trace: Trace) {
  const member = await load(memberId);
  if (!input.confirmed) throw errors.unprocessable('CONFIRMATION_REQUIRED', 'Confirm that the termination has been authorized.');
  if (member.status === 'TERMINATED') throw errors.conflict('ALREADY_TERMINATED', 'This membership is already terminated.');
  const due = await outstandingOf(member.id);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.membershipTermination.create({
    data: {
      publicId: await id('MTM'),
      memberId: member.id,
      reason: input.reason.trim(),
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      outstanding: decimal(due),
      refundDue: decimal(assertAmount(input.refundDue ?? 0, 'Refund')),
      evidence: clean(input.evidence),
      confirmed: true,
      officerName: officer,
    },
  });
  await prisma.member.update({ where: { id: member.id }, data: { status: 'TERMINATED' } });
  await recordAudit({ trace, memberId: member.publicId, entityType: 'MembershipTermination', entityId: row.publicId, action: 'membership.terminate', previousStatus: member.status, newStatus: 'TERMINATED', reason: input.reason });
  return memberFile(member.publicId);
}
