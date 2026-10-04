export const DONOR_TYPES = [
  ['INDIVIDUAL', 'Individual'],
  ['COMPANY', 'Company'],
  ['ORGANIZATION', 'Organization'],
  ['FOUNDATION', 'Foundation'],
  ['INSTITUTION', 'Institution'],
  ['PARTNER', 'Partner'],
  ['ANONYMOUS', 'Anonymous donor'],
] as const

export const ORG_DONOR_TYPES = ['COMPANY', 'ORGANIZATION', 'FOUNDATION', 'INSTITUTION', 'PARTNER']

export const COUNTRIES = ['Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'Belgium', 'France', 'Germany', 'Netherlands', 'Switzerland', 'United Kingdom', 'United States', 'Canada', 'South Africa']

export const CAMPAIGN_TYPES = ['Education support', 'School infrastructure', 'Student sponsorship', 'Emergency relief', 'Community program', 'General fund', 'Other approved campaign']

export const CAMPAIGN_DOCS = ['PROPOSAL', 'BUDGET', 'APPROVAL', 'BENEFICIARY', 'OTHER']

export const BUDGET_CATEGORIES = ['PROGRAM_ACTIVITIES', 'SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'LOGISTICS', 'ADMINISTRATION', 'COMMUNICATION', 'OTHER']

export const FREQUENCIES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'OTHER']

export const DONATION_TYPES = [
  ['CASH', 'Cash'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['MOBILE_PAYMENT', 'Mobile payment'],
  ['CARD', 'Card'],
  ['IN_KIND', 'In-kind'],
  ['OTHER', 'Other approved method'],
] as const

export const IN_KIND_CATEGORIES = ['Computers', 'School equipment', 'Books', 'Furniture', 'Food', 'Construction materials', 'Vehicles', 'Professional services', 'Other']

export const CONDITIONS = ['New', 'Good', 'Fair', 'Needs repair']

export const VALUATION_METHODS = ['Market price', 'Invoice', 'Independent appraisal', 'Donor declaration', 'Other approved method']

export const BENEFICIARY_TYPES = ['SCHOOL', 'STUDENT', 'FAMILY', 'COMMUNITY', 'INSTITUTION', 'PROJECT', 'PROGRAM', 'OTHER']

export const ALLOCATION_CATEGORIES = ['SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'INFRASTRUCTURE', 'EDUCATION_MATERIALS', 'EMERGENCY_SUPPORT', 'COMMUNITY_SUPPORT', 'PROGRAM_SUPPORT', 'OTHER']

export const DISTRIBUTION_METHODS = ['BANK_TRANSFER', 'MOBILE_PAYMENT', 'DIRECT_DELIVERY', 'IN_KIND_DELIVERY', 'OTHER']

export const MESSAGE_TYPES = ['THANK_YOU', 'DONATION_CONFIRMATION', 'RECEIPT', 'CAMPAIGN_UPDATE', 'IMPACT_REPORT', 'PAYMENT_REMINDER', 'OTHER']

export const CHANNELS = ['SMS', 'EMAIL', 'IN_APP', 'PUSH']

export const REPORTS = [
  ['donor-register', 'Donor register'],
  ['donations-by-donor', 'Donations by donor'],
  ['donor-history', 'Donor contribution history'],
  ['anonymous', 'Anonymous donations'],
  ['campaign-performance', 'Campaign performance'],
  ['campaign-target', 'Campaign target vs actual'],
  ['donations-by-campaign', 'Donations by campaign'],
  ['campaign-balance', 'Campaign balance'],
  ['received', 'Donations received'],
  ['allocated', 'Donations allocated'],
  ['distributed', 'Donations distributed'],
  ['unallocated', 'Unallocated donations'],
  ['refunds', 'Refunds'],
  ['reconciliation', 'Reconciliation'],
  ['ledger', 'Donation ledger'],
  ['beneficiaries', 'Beneficiaries supported'],
  ['amount-per-beneficiary', 'Amount per beneficiary'],
  ['distribution-history', 'Distribution history'],
  ['impact', 'Impact report'],
  ['verification', 'Donation verification'],
  ['pending-compliance', 'Pending compliance'],
  ['exceptions', 'Exceptions'],
  ['audit', 'Audit report'],
] as const

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase())
}
