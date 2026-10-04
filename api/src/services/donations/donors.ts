import { ORG_DONOR_TYPES, actorLabel, dateOnly, findDonor, iso, jsonDocs, prisma, readDocs, recordAudit, type Doc, type Trace } from './shared';
import { errors } from '../../utils/errors';
import { nextPublicId } from '../../utils/ids';

export type DonorInput = {
  donorType: 'INDIVIDUAL' | 'COMPANY' | 'ORGANIZATION' | 'FOUNDATION' | 'INSTITUTION' | 'PARTNER' | 'ANONYMOUS';
  name?: string;
  organizationName?: string;
  registrationNumber?: string;
  taxId?: string;
  country?: string;
  district?: string;
  address?: string;
  telephone?: string;
  email?: string;
  website?: string;
  contactName?: string;
  contactPosition?: string;
  contactTelephone?: string;
  contactEmail?: string;
  contactIdentification?: string;
  authorizationLetter?: string;
  documents?: Doc[];
};

function clean(value?: string) {
  const text = value?.trim() ?? '';
  return text || null;
}

function assertEmail(value?: string) {
  const email = clean(value);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errors.unprocessable('EMAIL_INVALID', 'Enter a valid email address.');
  }
  return email;
}

function assertDonor(input: DonorInput, mode: 'draft' | 'register') {
  const name = input.donorType === 'ANONYMOUS' ? (clean(input.name) ?? 'Anonymous donor') : clean(input.name);
  if (!name) throw errors.unprocessable('NAME_REQUIRED', 'Enter the donor name.');
  const organization = ORG_DONOR_TYPES.includes(input.donorType as (typeof ORG_DONOR_TYPES)[number]);
  if (mode === 'register') {
    if (!clean(input.country)) throw errors.unprocessable('COUNTRY_REQUIRED', 'Select the donor country.');
    if (!clean(input.address) || clean(input.address)!.length < 3) {
      throw errors.unprocessable('ADDRESS_REQUIRED', 'Enter the donor address.');
    }
    if (!clean(input.telephone) || clean(input.telephone)!.replace(/\D/g, '').length < 8) {
      throw errors.unprocessable('TELEPHONE_REQUIRED', 'Enter a telephone number of at least 8 digits.');
    }
    if (organization) {
      if (!clean(input.organizationName)) {
        throw errors.unprocessable('ORGANIZATION_REQUIRED', 'Enter the organisation name for this donor type.');
      }
      if (!clean(input.registrationNumber)) {
        throw errors.unprocessable('REGISTRATION_NUMBER_REQUIRED', 'Enter the organisation registration number.');
      }
      if (!clean(input.taxId)) {
        throw errors.unprocessable('TAX_ID_REQUIRED', 'Enter the organisation tax ID.');
      }
      if (!clean(input.contactName) || !clean(input.contactTelephone)) {
        throw errors.unprocessable('CONTACT_REQUIRED', 'Enter the contact person name and telephone.');
      }
    }
  }
  return {
    donorType: input.donorType,
    name,
    organizationName: organization ? clean(input.organizationName) : null,
    registrationNumber: organization ? clean(input.registrationNumber) : null,
    taxId: organization ? clean(input.taxId) : null,
    country: clean(input.country) ?? 'RW',
    district: clean(input.district),
    address: clean(input.address) ?? '',
    telephone: clean(input.telephone) ?? '',
    email: assertEmail(input.email),
    website: clean(input.website),
    contactName: clean(input.contactName),
    contactPosition: clean(input.contactPosition),
    contactTelephone: clean(input.contactTelephone),
    contactEmail: assertEmail(input.contactEmail),
    contactIdentification: clean(input.contactIdentification),
    authorizationLetter: clean(input.authorizationLetter),
    documents: jsonDocs(readDocs(input.documents)),
  };
}

export function serializeDonor(donor: Awaited<ReturnType<typeof findDonor>>) {
  return {
    id: donor.publicId,
    donorType: donor.donorType,
    status: donor.status,
    name: donor.name,
    organizationName: donor.organizationName,
    registrationNumber: donor.registrationNumber,
    taxId: donor.taxId,
    country: donor.country,
    district: donor.district,
    address: donor.address,
    telephone: donor.telephone,
    email: donor.email,
    website: donor.website,
    contactName: donor.contactName,
    contactPosition: donor.contactPosition,
    contactTelephone: donor.contactTelephone,
    contactEmail: donor.contactEmail,
    contactIdentification: donor.contactIdentification,
    authorizationLetter: donor.authorizationLetter,
    identityVerified: donor.identityVerified,
    organizationVerified: donor.organizationVerified,
    registrationVerified: donor.registrationVerified,
    contactVerified: donor.contactVerified,
    documentsVerified: donor.documentsVerified,
    complianceVerified: donor.complianceVerified,
    verificationResult: donor.verificationResult,
    verifiedBy: donor.verifiedBy,
    verificationDate: iso(donor.verificationDate),
    verificationComments: donor.verificationComments,
    documents: readDocs(donor.documents),
    createdAt: donor.createdAt.toISOString(),
    updatedAt: donor.updatedAt.toISOString(),
  };
}

export async function listDonors(query: { q?: string; status?: string; donorType?: string }) {
  const rows = await prisma.donor.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  const needle = query.q?.trim().toLowerCase() ?? '';
  return rows
    .filter((row) => !query.status || row.status === query.status)
    .filter((row) => !query.donorType || row.donorType === query.donorType)
    .filter((row) => !needle || [row.publicId, row.name, row.organizationName, row.email, row.telephone, row.taxId]
      .some((part) => String(part ?? '').toLowerCase().includes(needle)))
    .map(serializeDonor);
}

export async function getDonor(id: string) {
  const donor = await findDonor(id);
  const [pledges, donations, messages, audits] = await Promise.all([
    prisma.pledge.findMany({ where: { donorId: donor.id }, include: { campaign: true }, orderBy: { createdAt: 'desc' } }),
    prisma.donation.findMany({ where: { donorId: donor.id }, include: { campaign: true }, orderBy: { createdAt: 'desc' } }),
    prisma.donorMessage.findMany({ where: { donorId: donor.id }, orderBy: { sentAt: 'desc' }, take: 30 }),
    prisma.donationAudit.findMany({ where: { entityType: 'Donor', entityId: donor.publicId }, orderBy: { createdAt: 'desc' }, take: 40 }),
  ]);
  return {
    ...serializeDonor(donor),
    pledges: pledges.map((row) => ({
      id: row.publicId,
      campaign: row.campaign.name,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      pledgeDate: dateOnly(row.pledgeDate),
    })),
    donations: donations.map((row) => ({
      id: row.publicId,
      campaign: row.campaign?.name ?? '—',
      amount: Number(row.amount),
      currency: row.currency,
      type: row.donationType,
      status: row.status,
      date: dateOnly(row.donationDate),
    })),
    messages: messages.map((row) => ({
      id: row.publicId,
      type: row.communicationType,
      channel: row.channel,
      subject: row.subject,
      sentAt: row.sentAt.toISOString(),
      status: row.deliveryStatus,
    })),
    history: audits.map(serializeAudit),
  };
}

function serializeAudit(row: {
  publicId: string;
  userId: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  amount: { toString(): string } | null;
  reason: string | null;
  reference: string | null;
  ip: string | null;
  sessionId: string | null;
  createdAt: Date;
  donation?: { publicId: string } | null;
}) {
  return {
    id: row.publicId,
    donationId: row.donation?.publicId ?? null,
    userId: row.userId,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    amount: row.amount == null ? null : Number(row.amount),
    reason: row.reason,
    reference: row.reference,
    ip: row.ip,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveDonor(input: DonorInput, mode: 'draft' | 'register', trace: Trace) {
  const data = assertDonor(input, mode);
  const created = await prisma.donor.create({
    data: {
      ...data,
      publicId: await nextPublicId('DNR'),
      status: mode === 'register' ? 'REGISTERED' : 'DRAFT',
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donor',
    entityId: created.publicId,
    action: mode === 'register' ? 'Registered' : 'Draft saved',
    newStatus: created.status,
  });
  return getDonor(created.publicId);
}

export async function updateDonor(id: string, input: DonorInput, mode: 'draft' | 'register', trace: Trace) {
  const donor = await findDonor(id);
  if (donor.status !== 'DRAFT' && donor.status !== 'MORE_INFORMATION_REQUIRED') {
    throw errors.unprocessable('DONOR_LOCKED', 'This donor can be edited only while the file is a draft or more information is required.');
  }
  const data = assertDonor(input, mode);
  const next = mode === 'register' ? 'REGISTERED' : donor.status === 'MORE_INFORMATION_REQUIRED' ? 'REGISTERED' : 'DRAFT';
  await prisma.donor.update({
    where: { id: donor.id },
    data: { ...data, status: next, verificationResult: null },
  });
  await recordAudit({
    trace,
    entityType: 'Donor',
    entityId: donor.publicId,
    action: mode === 'register' ? 'Registered' : 'Draft updated',
    previousStatus: donor.status,
    newStatus: next,
  });
  return getDonor(donor.publicId);
}

export async function verifyDonor(id: string, input: {
  result: 'PENDING' | 'VERIFIED' | 'MORE_INFORMATION_REQUIRED' | 'REJECTED';
  identityVerified: boolean;
  organizationVerified: boolean;
  registrationVerified: boolean;
  contactVerified: boolean;
  documentsVerified: boolean;
  complianceVerified: boolean;
  comments?: string;
}, trace: Trace) {
  const donor = await findDonor(id);
  if (donor.status === 'DRAFT') {
    throw errors.unprocessable('DONOR_NOT_REGISTERED', 'Register the donor before verification.');
  }
  const organization = ORG_DONOR_TYPES.includes(donor.donorType as (typeof ORG_DONOR_TYPES)[number]);
  if (input.result === 'VERIFIED') {
    const missing = [
      ['identity', input.identityVerified],
      ['contact', input.contactVerified],
      ['documents', input.documentsVerified],
      ['compliance', input.complianceVerified],
      ['organisation', !organization || input.organizationVerified],
      ['registration', !organization || input.registrationVerified],
    ].filter((item) => !item[1]).map((item) => item[0]);
    if (missing.length) {
      throw errors.unprocessable('VERIFICATION_INCOMPLETE', `Complete these checks before verifying the donor: ${missing.join(', ')}.`);
    }
    if (readDocs(donor.documents).length === 0) {
      throw errors.unprocessable('DOCUMENTS_REQUIRED', 'Attach the supporting documents before confirming them.');
    }
  }
  const status = input.result === 'VERIFIED'
    ? 'VERIFIED'
    : input.result === 'REJECTED'
      ? 'REJECTED'
      : input.result === 'MORE_INFORMATION_REQUIRED'
        ? 'MORE_INFORMATION_REQUIRED'
        : 'PENDING_VERIFICATION';
  const officer = await actorLabel(trace.actorId);
  await prisma.donor.update({
    where: { id: donor.id },
    data: {
      identityVerified: input.identityVerified,
      organizationVerified: organization ? input.organizationVerified : false,
      registrationVerified: organization ? input.registrationVerified : false,
      contactVerified: input.contactVerified,
      documentsVerified: input.documentsVerified,
      complianceVerified: input.complianceVerified,
      verificationResult: input.result,
      verifiedBy: officer,
      verificationDate: new Date(),
      verificationComments: clean(input.comments),
      status,
    },
  });
  await recordAudit({
    trace,
    entityType: 'Donor',
    entityId: donor.publicId,
    action: 'Verification',
    previousStatus: donor.status,
    newStatus: status,
    reason: input.comments,
    reference: input.result,
  });
  return getDonor(donor.publicId);
}
