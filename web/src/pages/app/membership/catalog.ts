export const INSTITUTION_TYPES = ['NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER']
export const DOCUMENT_TYPES = ['REGISTRATION_CERTIFICATE', 'TAX_CERTIFICATE', 'IDENTIFICATION', 'PROOF_OF_ADDRESS', 'BANK_CONFIRMATION', 'AUTHORIZATION_LETTER', 'INSTITUTION_PROFILE', 'OTHER']

export const DOCUMENT_LABELS: Record<string, string> = {
  REGISTRATION_CERTIFICATE: 'Registration certificate',
  TAX_CERTIFICATE: 'Tax certificate',
  IDENTIFICATION: 'Representative identification',
  PROOF_OF_ADDRESS: 'Proof of address',
  BANK_CONFIRMATION: 'Bank confirmation',
  AUTHORIZATION_LETTER: 'Authorization letter',
  INSTITUTION_PROFILE: 'Institution profile',
  OTHER: 'Other document',
}

export const INSTITUTION_LABELS: Record<string, string> = {
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  TVET: 'TVET',
  SPECIAL_EDUCATION: 'Special education',
  COMBINED: 'Combined',
  OTHER: 'Other',
}

export function documentLabel(value: string) {
  return DOCUMENT_LABELS[value] ?? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'MOBILE_PAYMENT', 'PSP', 'CARD', 'CASH', 'OTHER']

export const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MOBILE_PAYMENT: 'Mobile money',
  PSP: 'Payment service',
  CARD: 'Card',
  CASH: 'Cash',
  OTHER: 'Other',
}

export const ELECTRONIC_PAYMENTS = new Set(['BANK_TRANSFER', 'MOBILE_PAYMENT', 'PSP', 'CARD'])
export const CHANNELS = ['IN_APP', 'EMAIL', 'SMS']
export const REPORTS = [
  ['register', 'Member register'],
  ['new', 'New members'],
  ['active', 'Active members'],
  ['pending', 'Pending applications'],
  ['rejected', 'Rejected applications'],
  ['expired', 'Expired memberships'],
  ['renewed', 'Renewed memberships'],
  ['suspended', 'Suspended members'],
  ['fees', 'Membership fees'],
  ['outstanding', 'Outstanding fees'],
  ['payments', 'Payments and reconciliation'],
  ['growth', 'Membership growth'],
] as const

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function num(form: FormData, name: string) {
  const value = form.get(name)
  return value == null || value === '' ? 0 : Number(value)
}

export function str(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

export const VERIFICATION_CHECKS = [
  ['registrationVerified', 'Registration certificate checked'],
  ['nameVerified', 'Institution name matches the register'],
  ['numberVerified', 'Registration number matches'],
  ['addressVerified', 'Address checked'],
  ['legalVerified', 'Legal documents checked'],
  ['identityVerified', 'Representative identity checked'],
  ['authorityVerified', 'Authority to represent the school checked'],
  ['contactVerified', 'Telephone and email checked'],
  ['bankVerified', 'Bank account checked'],
  ['bankBelongsToInstitution', 'Bank account belongs to the institution'],
] as const

export function checked(form: FormData, name: string) {
  return form.get(name) === 'on'
}
