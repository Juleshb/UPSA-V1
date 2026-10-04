export const ACCOUNT_TYPES = ['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER'] as const

export const CHANNELS = ['BRANCH', 'ONLINE', 'MOBILE', 'AGENT', 'REFERRAL'] as const

export const LANGUAGES = ['English', 'Kinyarwanda', 'French'] as const

export const CONTACT_CHANNELS = ['EMAIL', 'SMS', 'IN_APP'] as const

export const SCHOOL_TYPES = ['NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER'] as const

export const OWNERSHIP = ['PRIVATE', 'PUBLIC', 'GOVERNMENT_AIDED', 'FAITH_BASED', 'COMMUNITY', 'OTHER'] as const

export const EMPLOYMENT = ['PERMANENT', 'CONTRACT', 'PART_TIME'] as const

export const SUPPLIER_CATEGORIES = ['BOOKS', 'FOOD', 'TRANSPORT', 'CONSTRUCTION', 'TECHNOLOGY', 'OTHER'] as const

export const STEPS: Record<string, string[]> = {
  SCHOOL: ['Applicant', 'School', 'Representative', 'Consent', 'Documents'],
  PARENT: ['Applicant', 'Parent', 'Consent', 'Documents'],
  STUDENT: ['Applicant', 'Enrollment', 'Guardian', 'Consent', 'Documents'],
  TEACHER: ['Applicant', 'Professional', 'Consent', 'Documents'],
  SUPPLIER: ['Applicant', 'Business', 'Consent', 'Documents'],
}

export const DOCUMENTS: Record<string, string[]> = {
  SCHOOL: ['REGISTRATION_CERTIFICATE', 'LICENSE', 'TAX_CERTIFICATE', 'REPRESENTATIVE_ID', 'BANK_LETTER', 'OTHER'],
  PARENT: ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'STUDENT_LINK', 'OTHER'],
  STUDENT: ['BIRTH_CERTIFICATE', 'NATIONAL_ID', 'ADMISSION_LETTER', 'PHOTO', 'OTHER'],
  TEACHER: ['NATIONAL_ID', 'QUALIFICATION', 'EMPLOYMENT_LETTER', 'OTHER'],
  SUPPLIER: ['REGISTRATION_CERTIFICATE', 'TAX_CERTIFICATE', 'BANK_LETTER', 'OTHER'],
}

export const KYC_CHECKS: Record<string, { key: string; label: string }[]> = {
  SCHOOL: [
    { key: 'registrationCertificate', label: 'Registration certificate matches the school' },
    { key: 'taxCertificate', label: 'Tax certificate is current' },
    { key: 'addressProof', label: 'Address matches the school file' },
    { key: 'representativeId', label: 'Representative identity is confirmed' },
  ],
  SUPPLIER: [
    { key: 'registrationCertificate', label: 'Business registration matches the supplier' },
    { key: 'taxCertificate', label: 'Tax certificate is current' },
    { key: 'addressProof', label: 'Business address is confirmed' },
    { key: 'representativeId', label: 'Authorized person identity is confirmed' },
  ],
  PARENT: [
    { key: 'identityDocument', label: 'Identity document matches the parent' },
    { key: 'photo', label: 'Photo matches the identity document' },
    { key: 'addressProof', label: 'Address is confirmed' },
  ],
  STUDENT: [
    { key: 'identityDocument', label: 'Identity or birth record matches the student' },
    { key: 'photo', label: 'Photo matches the student' },
    { key: 'addressProof', label: 'Address is confirmed' },
  ],
  TEACHER: [
    { key: 'identityDocument', label: 'Identity document matches the teacher' },
    { key: 'photo', label: 'Photo matches the identity document' },
    { key: 'addressProof', label: 'Address is confirmed' },
  ],
}

export const PROFILE_KEYS = [
  'schoolName', 'registrationNumber', 'schoolType', 'ownershipType', 'representativeName', 'representativeTitle',
  'representativePhone', 'representativeId', 'bankName', 'branch', 'accountName', 'accountNumber', 'relationship',
  'occupation', 'studentPublicId', 'financialResponsibility', 'paymentAuthorization', 'schoolPublicId', 'firstName',
  'middleName', 'lastName', 'dateOfBirth', 'gender', 'academicYear', 'classLevel', 'stream', 'studentNumber',
  'guardianName', 'guardianPhone', 'qualification', 'subject', 'employmentType', 'startDate', 'businessName',
  'tin', 'category',
] as const

export function label(value: string) {
  return value.replaceAll('_', ' ')
}
