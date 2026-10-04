export const REGISTRATION_KINDS = [
  { id: 'PARENT', label: 'Parent / guardian', detail: 'Identity, address, KYC and consent.', href: '/app/registration/new/PARENT' },
  { id: 'TEACHER', label: 'Teacher / staff', detail: 'Employment, qualification and school.', href: '/app/registration/new/TEACHER' },
  { id: 'SUPPLIER', label: 'Supplier', detail: 'Business, contact and bank account.', href: '/app/registration/new/SUPPLIER' },
  { id: 'INVESTOR', label: 'Investor', detail: 'KYC or KYB, profile and consent.', href: '/app/registration/new/INVESTOR' },
  { id: 'DONOR', label: 'Donor', detail: 'Organisation, contact and preferences.', href: '/app/registration/new/DONOR' },
] as const

export type PartyKind = (typeof REGISTRATION_KINDS)[number]['id']

export type FieldInput = 'text' | 'email' | 'tel' | 'date' | 'select' | 'checkbox' | 'school' | 'automatic'

export type CatalogField = {
  key: string
  label: string
  section: string
  input: FieldInput
  required?: boolean
  options?: Array<[string, string]>
  hint?: string
}

const GENDER: Array<[string, string]> = [['FEMALE', 'Female'], ['MALE', 'Male']]
const MARITAL: Array<[string, string]> = [['SINGLE', 'Single'], ['MARRIED', 'Married'], ['DIVORCED', 'Divorced'], ['WIDOWED', 'Widowed'], ['OTHER', 'Other']]
const ID_TYPES: Array<[string, string]> = [['NATIONAL_ID', 'National ID'], ['PASSPORT', 'Passport']]
const EMPLOYMENT: Array<[string, string]> = [
  ['PERMANENT', 'Permanent'],
  ['CONTRACT', 'Contract'],
  ['TEMPORARY', 'Temporary'],
  ['PART_TIME', 'Part-time'],
  ['CONSULTANT', 'Consultant'],
  ['VOLUNTEER', 'Volunteer'],
]
const STAFF: Array<[string, string]> = [['APPLICANT', 'Applicant'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended'], ['INACTIVE', 'Inactive']]
const SUPPLIER: Array<[string, string]> = [
  ['GOODS', 'Goods supplier'],
  ['SERVICE', 'Service provider'],
  ['CONTRACTOR', 'Contractor'],
  ['TECHNOLOGY', 'Technology provider'],
  ['TRANSPORT', 'Transport provider'],
  ['CONSULTANT', 'Consultant'],
  ['OTHER', 'Other'],
]
const INVESTOR: Array<[string, string]> = [
  ['INDIVIDUAL', 'Individual'],
  ['COMPANY', 'Company'],
  ['INSTITUTION', 'Institution'],
  ['FUND', 'Investment fund'],
  ['ORGANIZATION', 'Organization'],
  ['OTHER', 'Other approved investor'],
]
const DONOR: Array<[string, string]> = [
  ['INDIVIDUAL', 'Individual'],
  ['COMPANY', 'Company'],
  ['FOUNDATION', 'Foundation'],
  ['ORGANIZATION', 'Organization'],
  ['INSTITUTION', 'Institution'],
  ['PARTNER', 'Partner'],
  ['ANONYMOUS', 'Anonymous'],
]
const CHANNEL: Array<[string, string]> = [['SMS', 'SMS'], ['EMAIL', 'Email'], ['IN_APP', 'In-app'], ['PHONE', 'Phone']]
const PARENT_RELATIONSHIP: Array<[string, string]> = [
  ['Father', 'Father'],
  ['Mother', 'Mother'],
  ['Guardian', 'Guardian'],
  ['Sponsor', 'Sponsor'],
  ['Other authorized relationship', 'Other authorized relationship'],
]

export const PARTY_FIELDS: Record<PartyKind, CatalogField[]> = {
  PARENT: [
    { key: 'parentId', label: 'Parent ID', section: 'Personal information', input: 'automatic', hint: 'Assigned when the parent is saved.' },
    { key: 'membershipUserId', label: 'Membership / user ID', section: 'Personal information', input: 'text' },
    { key: 'firstName', label: 'First name', section: 'Personal information', input: 'text', required: true },
    { key: 'middleName', label: 'Middle name', section: 'Personal information', input: 'text' },
    { key: 'lastName', label: 'Last name', section: 'Personal information', input: 'text', required: true },
    { key: 'dateOfBirth', label: 'Date of birth', section: 'Personal information', input: 'date' },
    { key: 'gender', label: 'Gender', section: 'Personal information', input: 'select', options: GENDER },
    { key: 'nationality', label: 'Nationality', section: 'Personal information', input: 'text' },
    { key: 'nationalId', label: 'National ID / passport', section: 'Personal information', input: 'text' },
    { key: 'maritalStatus', label: 'Marital status', section: 'Personal information', input: 'select', options: MARITAL },
    { key: 'phone', label: 'Telephone', section: 'Contact', input: 'tel', required: true },
    { key: 'alternativePhone', label: 'Alternative telephone', section: 'Contact', input: 'tel' },
    { key: 'email', label: 'Email', section: 'Contact', input: 'email', required: true },
    { key: 'province', label: 'Province', section: 'Contact', input: 'text', required: true },
    { key: 'district', label: 'District', section: 'Contact', input: 'text', required: true },
    { key: 'sector', label: 'Sector', section: 'Contact', input: 'text' },
    { key: 'cell', label: 'Cell', section: 'Contact', input: 'text' },
    { key: 'village', label: 'Village', section: 'Contact', input: 'text' },
    { key: 'physicalAddress', label: 'Physical address', section: 'Contact', input: 'text' },
    { key: 'idType', label: 'ID type', section: 'KYC', input: 'select', options: ID_TYPES },
    { key: 'idNumber', label: 'ID number', section: 'KYC', input: 'text' },
    { key: 'issuingCountry', label: 'Issuing country', section: 'KYC', input: 'text' },
    { key: 'issueDate', label: 'Issue date', section: 'KYC', input: 'date' },
    { key: 'expiryDate', label: 'Expiry date', section: 'KYC', input: 'date' },
    { key: 'consentIdentity', label: 'I authorize UPSA Next to verify my information.', section: 'Consent', input: 'checkbox', required: true },
    { key: 'consentTerms', label: 'I agree to the applicable terms and conditions.', section: 'Consent', input: 'checkbox', required: true },
    { key: 'consentId', label: 'Consent ID', section: 'Consent', input: 'automatic' },
    { key: 'consentPurpose', label: 'Purpose', section: 'Consent', input: 'automatic' },
    { key: 'consentScope', label: 'Scope', section: 'Consent', input: 'automatic' },
    { key: 'consentDate', label: 'Consent date', section: 'Consent', input: 'automatic' },
    { key: 'consentVersion', label: 'Version', section: 'Consent', input: 'automatic' },
    { key: 'consentAcceptedBy', label: 'Accepted by', section: 'Consent', input: 'automatic' },
    { key: 'consentExpiry', label: 'Expiry', section: 'Consent', input: 'automatic' },
    { key: 'studentId', label: 'Student ID', section: 'Student relationship', input: 'text', hint: 'Existing student ID, for example RUPSA-STD-000123.' },
    { key: 'relationship', label: 'Relationship', section: 'Student relationship', input: 'select', options: PARENT_RELATIONSHIP },
    { key: 'primaryGuardian', label: 'Primary guardian', section: 'Student relationship', input: 'checkbox' },
    { key: 'financiallyResponsible', label: 'Financially responsible', section: 'Student relationship', input: 'checkbox' },
    { key: 'schoolCommunication', label: 'Authorized for school communication', section: 'Student relationship', input: 'checkbox' },
    { key: 'paymentAuthorization', label: 'Authorized for payment', section: 'Student relationship', input: 'checkbox' },
  ],
  TEACHER: [
    { key: 'teacherId', label: 'Teacher ID', section: 'Personal information', input: 'automatic', hint: 'Assigned when the teacher is saved.' },
    { key: 'firstName', label: 'First name', section: 'Personal information', input: 'text', required: true },
    { key: 'middleName', label: 'Middle name', section: 'Personal information', input: 'text' },
    { key: 'lastName', label: 'Last name', section: 'Personal information', input: 'text', required: true },
    { key: 'dateOfBirth', label: 'Date of birth', section: 'Personal information', input: 'date' },
    { key: 'gender', label: 'Gender', section: 'Personal information', input: 'select', options: GENDER },
    { key: 'nationality', label: 'Nationality', section: 'Personal information', input: 'text' },
    { key: 'nationalId', label: 'National ID / passport', section: 'Personal information', input: 'text' },
    { key: 'employeeNumber', label: 'Employee number', section: 'Employment', input: 'text' },
    { key: 'schoolId', label: 'School', section: 'Employment', input: 'school', required: true },
    { key: 'department', label: 'Department', section: 'Employment', input: 'text', required: true },
    { key: 'position', label: 'Position', section: 'Employment', input: 'text', required: true },
    { key: 'employmentType', label: 'Employment type', section: 'Employment', input: 'select', options: EMPLOYMENT, required: true },
    { key: 'dateJoined', label: 'Date joined', section: 'Employment', input: 'date' },
    { key: 'contractStart', label: 'Contract start', section: 'Employment', input: 'date' },
    { key: 'contractEnd', label: 'Contract end', section: 'Employment', input: 'date' },
    { key: 'staffStatus', label: 'Staff status', section: 'Employment', input: 'select', options: STAFF },
    { key: 'qualification', label: 'Qualification', section: 'Professional information', input: 'text' },
    { key: 'institution', label: 'Institution', section: 'Professional information', input: 'text' },
    { key: 'fieldOfStudy', label: 'Field of study', section: 'Professional information', input: 'text' },
    { key: 'graduationYear', label: 'Graduation year', section: 'Professional information', input: 'text' },
    { key: 'teachingSubject', label: 'Teaching subject', section: 'Professional information', input: 'text' },
    { key: 'professionalCertificate', label: 'Professional certificate', section: 'Professional information', input: 'text' },
    { key: 'licenseNumber', label: 'License number', section: 'Professional information', input: 'text' },
    { key: 'licenseExpiry', label: 'License expiry', section: 'Professional information', input: 'date' },
    { key: 'yearsExperience', label: 'Years of experience', section: 'Professional information', input: 'text' },
    { key: 'phone', label: 'Telephone', section: 'Contact', input: 'tel', required: true },
    { key: 'email', label: 'Email', section: 'Contact', input: 'email', required: true },
    { key: 'province', label: 'Province', section: 'Contact', input: 'text' },
    { key: 'district', label: 'District', section: 'Contact', input: 'text' },
    { key: 'sector', label: 'Sector', section: 'Contact', input: 'text' },
    { key: 'cell', label: 'Cell', section: 'Contact', input: 'text' },
    { key: 'village', label: 'Village', section: 'Contact', input: 'text' },
    { key: 'physicalAddress', label: 'Physical address', section: 'Contact', input: 'text' },
    { key: 'emergencyContact', label: 'Emergency contact', section: 'Contact', input: 'text' },
  ],
  SUPPLIER: [
    { key: 'supplierId', label: 'Supplier ID', section: 'Business information', input: 'automatic', hint: 'Assigned when the supplier is saved.' },
    { key: 'supplierCode', label: 'Supplier code', section: 'Business information', input: 'text' },
    { key: 'businessName', label: 'Business name', section: 'Business information', input: 'text', required: true },
    { key: 'tradingName', label: 'Trading name', section: 'Business information', input: 'text' },
    { key: 'registrationNumber', label: 'Business registration number', section: 'Business information', input: 'text' },
    { key: 'taxId', label: 'Tax identification number', section: 'Business information', input: 'text' },
    { key: 'businessType', label: 'Business type', section: 'Business information', input: 'select', options: SUPPLIER, required: true },
    { key: 'businessSector', label: 'Business sector', section: 'Business information', input: 'text' },
    { key: 'dateEstablished', label: 'Date established', section: 'Business information', input: 'date' },
    { key: 'contactPerson', label: 'Contact person', section: 'Contact', input: 'text', required: true },
    { key: 'position', label: 'Position', section: 'Contact', input: 'text' },
    { key: 'phone', label: 'Telephone', section: 'Contact', input: 'tel', required: true },
    { key: 'email', label: 'Email', section: 'Contact', input: 'email', required: true },
    { key: 'website', label: 'Website', section: 'Contact', input: 'text' },
    { key: 'province', label: 'Province', section: 'Contact', input: 'text' },
    { key: 'district', label: 'District', section: 'Contact', input: 'text' },
    { key: 'sector', label: 'Sector', section: 'Contact', input: 'text' },
    { key: 'physicalAddress', label: 'Physical address', section: 'Contact', input: 'text' },
    { key: 'postalAddress', label: 'Postal address', section: 'Contact', input: 'text' },
    { key: 'bankName', label: 'Bank name', section: 'Bank account', input: 'text' },
    { key: 'branch', label: 'Branch', section: 'Bank account', input: 'text' },
    { key: 'accountName', label: 'Account name', section: 'Bank account', input: 'text' },
    { key: 'accountNumber', label: 'Account number', section: 'Bank account', input: 'text' },
    { key: 'currency', label: 'Currency', section: 'Bank account', input: 'text' },
    { key: 'swiftCode', label: 'SWIFT code', section: 'Bank account', input: 'text' },
    { key: 'businessVerification', label: 'Business verification', section: 'Due diligence', input: 'checkbox' },
    { key: 'ownershipVerification', label: 'Ownership verification', section: 'Due diligence', input: 'checkbox' },
    { key: 'taxVerification', label: 'Tax verification', section: 'Due diligence', input: 'checkbox' },
    { key: 'bankVerification', label: 'Bank verification', section: 'Due diligence', input: 'checkbox' },
    { key: 'complianceVerification', label: 'Compliance verification', section: 'Due diligence', input: 'checkbox' },
    { key: 'conflictOfInterest', label: 'Conflict-of-interest declaration', section: 'Due diligence', input: 'checkbox' },
    { key: 'requiredDocumentsDeclared', label: 'Required documents declared', section: 'Due diligence', input: 'checkbox' },
  ],
  INVESTOR: [
    { key: 'investorId', label: 'Investor ID', section: 'Investor', input: 'automatic', hint: 'Assigned when the investor is saved.' },
    { key: 'investorType', label: 'Investor type', section: 'Investor', input: 'select', options: INVESTOR, required: true },
    { key: 'investorName', label: 'Investor name', section: 'Investor', input: 'text', required: true },
    { key: 'registrationNumber', label: 'Registration number', section: 'Investor', input: 'text' },
    { key: 'taxId', label: 'Tax ID', section: 'Investor', input: 'text' },
    { key: 'nationalId', label: 'National ID / passport', section: 'Investor', input: 'text' },
    { key: 'dateOfBirth', label: 'Date of birth', section: 'Investor', input: 'date', hint: 'For an individual investor.' },
    { key: 'country', label: 'Country', section: 'Investor', input: 'text', required: true },
    { key: 'address', label: 'Address', section: 'Investor', input: 'text' },
    { key: 'phone', label: 'Telephone', section: 'Investor', input: 'tel', required: true },
    { key: 'email', label: 'Email', section: 'Investor', input: 'email', required: true },
    { key: 'investmentCategory', label: 'Investment category', section: 'Financial profile', input: 'text' },
    { key: 'investmentObjective', label: 'Investment objective', section: 'Financial profile', input: 'text' },
    { key: 'expectedAmount', label: 'Expected amount', section: 'Financial profile', input: 'text' },
    { key: 'preferredType', label: 'Preferred investment type', section: 'Financial profile', input: 'text' },
    { key: 'investmentPeriod', label: 'Investment period', section: 'Financial profile', input: 'text' },
    { key: 'currency', label: 'Currency', section: 'Financial profile', input: 'text' },
    { key: 'existingExposure', label: 'Existing exposure', section: 'Financial profile', input: 'text' },
    { key: 'riskInformation', label: 'Risk information', section: 'Financial profile', input: 'text' },
    { key: 'sourceOfFunds', label: 'Source of funds', section: 'KYC / KYB', input: 'text' },
    { key: 'ownershipInformation', label: 'Ownership information', section: 'KYC / KYB', input: 'text' },
    { key: 'directors', label: 'Directors', section: 'KYC / KYB', input: 'text' },
    { key: 'authorizedRepresentative', label: 'Authorized representative', section: 'KYC / KYB', input: 'text' },
    { key: 'beneficialOwnership', label: 'Beneficial ownership', section: 'KYC / KYB', input: 'text' },
    { key: 'bankName', label: 'Bank', section: 'Bank account', input: 'text' },
    { key: 'accountName', label: 'Account name', section: 'Bank account', input: 'text' },
    { key: 'accountNumber', label: 'Account number', section: 'Bank account', input: 'text' },
    { key: 'bankCurrency', label: 'Currency', section: 'Bank account', input: 'text' },
    { key: 'consentIdentity', label: 'Consent to identity verification.', section: 'Consent', input: 'checkbox', required: true },
    { key: 'consentFinancial', label: 'Consent to financial assessment where applicable.', section: 'Consent', input: 'checkbox' },
    { key: 'consentProcessing', label: 'Consent to processing of personal information.', section: 'Consent', input: 'checkbox', required: true },
    { key: 'consentCommunications', label: 'Consent to investment-related communications.', section: 'Consent', input: 'checkbox' },
    { key: 'consentTerms', label: 'Acceptance of investment terms.', section: 'Consent', input: 'checkbox', required: true },
    { key: 'consentId', label: 'Consent ID', section: 'Consent', input: 'automatic' },
    { key: 'consentPurpose', label: 'Purpose', section: 'Consent', input: 'automatic' },
    { key: 'consentScope', label: 'Scope', section: 'Consent', input: 'automatic' },
    { key: 'consentDate', label: 'Consent date', section: 'Consent', input: 'automatic' },
    { key: 'consentVersion', label: 'Version', section: 'Consent', input: 'automatic' },
    { key: 'consentAcceptedBy', label: 'Accepted by', section: 'Consent', input: 'automatic' },
    { key: 'consentExpiry', label: 'Expiry', section: 'Consent', input: 'automatic' },
  ],
  DONOR: [
    { key: 'donorId', label: 'Donor ID', section: 'Donor', input: 'automatic', hint: 'Assigned when the donor is saved.' },
    { key: 'donorType', label: 'Donor type', section: 'Donor', input: 'select', options: DONOR, required: true },
    { key: 'donorName', label: 'Donor name', section: 'Donor', input: 'text' },
    { key: 'organizationName', label: 'Organization name', section: 'Donor', input: 'text' },
    { key: 'registrationNumber', label: 'Registration number', section: 'Donor', input: 'text' },
    { key: 'taxId', label: 'Tax ID', section: 'Donor', input: 'text' },
    { key: 'country', label: 'Country', section: 'Donor', input: 'text' },
    { key: 'address', label: 'Address', section: 'Donor', input: 'text' },
    { key: 'phone', label: 'Telephone', section: 'Donor', input: 'tel' },
    { key: 'email', label: 'Email', section: 'Donor', input: 'email' },
    { key: 'website', label: 'Website', section: 'Donor', input: 'text' },
    { key: 'contactPerson', label: 'Contact person', section: 'Contact', input: 'text' },
    { key: 'position', label: 'Position', section: 'Contact', input: 'text' },
    { key: 'contactPhone', label: 'Contact telephone', section: 'Contact', input: 'tel' },
    { key: 'contactEmail', label: 'Contact email', section: 'Contact', input: 'email' },
    { key: 'contactAddress', label: 'Contact address', section: 'Contact', input: 'text' },
    { key: 'preferredChannel', label: 'Preferred channel', section: 'Contact', input: 'select', options: CHANNEL },
    { key: 'donationType', label: 'Preferred donation type', section: 'Donation preferences', input: 'text' },
    { key: 'campaign', label: 'Preferred campaign', section: 'Donation preferences', input: 'text' },
    { key: 'cause', label: 'Preferred cause', section: 'Donation preferences', input: 'text' },
    { key: 'oneTime', label: 'One-time donation', section: 'Donation preferences', input: 'checkbox' },
    { key: 'recurring', label: 'Recurring donation', section: 'Donation preferences', input: 'checkbox' },
    { key: 'anonymousPreference', label: 'Anonymous donation preference', section: 'Donation preferences', input: 'checkbox' },
    { key: 'totalDonations', label: 'Total donations', section: 'Donation history', input: 'automatic', hint: 'Updated when donations are recorded.' },
    { key: 'donationCount', label: 'Donation count', section: 'Donation history', input: 'automatic' },
    { key: 'activePledges', label: 'Active pledges', section: 'Donation history', input: 'automatic' },
    { key: 'lastDonation', label: 'Last donation', section: 'Donation history', input: 'automatic' },
    { key: 'currentCampaigns', label: 'Current campaigns', section: 'Donation history', input: 'automatic' },
  ],
}

export const DOCUMENT_TYPES: Record<PartyKind, Array<[string, string]>> = {
  PARENT: [['ID_DOCUMENT', 'ID document'], ['PROFILE_PHOTO', 'Profile photo'], ['ADDRESS_PROOF', 'Address verification'], ['CUSTODY', 'Custody or authorization document'], ['OTHER', 'Other']],
  TEACHER: [
    ['PHOTO', 'Photo'],
    ['ACADEMIC_CERTIFICATE', 'Academic certificate'],
    ['PROFESSIONAL_CERTIFICATE', 'Professional certificate'],
    ['ID', 'ID'],
    ['EMPLOYMENT_CONTRACT', 'Employment contract'],
    ['LICENSE', 'License'],
    ['OTHER', 'Other'],
  ],
  SUPPLIER: [
    ['REGISTRATION_CERTIFICATE', 'Business registration certificate'],
    ['TAX_CERTIFICATE', 'Tax certificate'],
    ['TRADING_LICENSE', 'Trading license'],
    ['OWNERSHIP', 'Ownership documents'],
    ['COMPANY_PROFILE', 'Company profile'],
    ['COMPLIANCE', 'Compliance certificate'],
    ['BANK_LETTER', 'Bank confirmation letter'],
    ['OTHER', 'Other'],
  ],
  INVESTOR: [
    ['IDENTIFICATION', 'Identification document'],
    ['ADDRESS_PROOF', 'Address verification'],
    ['INCORPORATION', 'Certificate of incorporation'],
    ['TAX_CERTIFICATE', 'Tax certificate'],
    ['BANK_LETTER', 'Bank confirmation'],
    ['SOURCE_OF_FUNDS', 'Source of funds'],
    ['OWNERSHIP', 'Ownership documents'],
    ['BENEFICIAL_OWNERSHIP', 'Beneficial ownership'],
    ['OTHER', 'Other'],
  ],
  DONOR: [['IDENTIFICATION', 'Identity document'], ['REGISTRATION', 'Registration document'], ['OTHER', 'Other']],
}

export function sectionsFor(kind: PartyKind) {
  const sections: string[] = []
  for (const field of PARTY_FIELDS[kind]) {
    if (!sections.includes(field.section)) sections.push(field.section)
  }
  return sections
}

export function optionLabel(field: CatalogField, value: string) {
  return field.options?.find(([code]) => code === value)?.[1] ?? value.replaceAll('_', ' ')
}

export function isPartyKind(value: string): value is PartyKind {
  return REGISTRATION_KINDS.some((kind) => kind.id === value)
}
