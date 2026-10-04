export const GROUP_TYPES = ['SCHOOL_GROUP', 'MEMBER_GROUP', 'SAVINGS_GROUP', 'COOPERATIVE', 'OTHER']
export const ACCOUNT_TYPES = ['GROUP_ESCROW', 'MEMBER_ESCROW', 'PROJECT_ESCROW', 'RESTRICTED_ESCROW']
export const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'ONE_TIME']
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'MOBILE_PAYMENT', 'PSP', 'CARD', 'CASH']
export const CONTRIBUTION_TYPES = ['MEMBER', 'GROUP', 'TOP_UP', 'OTHER']
export const MOVEMENT_TYPES = ['TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'FEE', 'INTEREST', 'REVERSAL', 'OTHER']
export const COLLATERAL_TYPES = ['PROPERTY', 'LAND', 'BUILDING', 'VEHICLE', 'EQUIPMENT', 'MACHINERY', 'DEPOSIT', 'RECEIVABLE', 'INVENTORY', 'FINANCIAL_ASSET', 'OTHER']
export const VERIFY_RESULTS = ['VERIFIED', 'PARTIALLY_VERIFIED', 'FAILED', 'MORE_INFORMATION_REQUIRED']
export const FACILITY_TYPES = ['PORTFOLIO', 'GROUP', 'INDIVIDUAL', 'PROJECT']
export const DECISIONS = ['APPROVED', 'DECLINED', 'CONDITIONAL_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'CANCELLED']
export const DOCUMENTS = ['ESCROW_AGREEMENT', 'GROUP_REGISTRATION', 'MEMBER_LIST', 'ID_DOCUMENT', 'FINANCIAL_STATEMENT', 'BANK_STATEMENT', 'OWNERSHIP', 'VALUATION', 'INSURANCE', 'LIEN', 'LOAN_AGREEMENT', 'GUARANTEE_AGREEMENT', 'GUARANTEE_CERTIFICATE', 'CLAIM', 'RECOVERY', 'LEGAL', 'RESOLUTION', 'OTHER']
export const REPORTS = [
  ['escrow-portfolio', 'Escrow portfolio'],
  ['escrow-balance', 'Escrow balance'],
  ['contributions', 'Contributions'],
  ['allocation', '40/60 allocation'],
  ['releases', 'Releases'],
  ['frozen', 'Frozen funds'],
  ['collateral', 'Collateral register'],
  ['collateral-value', 'Eligible collateral'],
  ['liens', 'Liens'],
  ['guarantees', 'Guarantee portfolio'],
  ['exposure', 'Guarantee exposure'],
  ['claims', 'Claims'],
  ['recoveries', 'Recoveries'],
  ['fees', 'Guarantee fees'],
  ['group-exposure', 'Group exposure'],
  ['coverage', 'Coverage ratio'],
  ['defaults', 'Defaults'],
] as const

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function num(form: FormData, name: string) {
  return Number(form.get(name) || 0)
}

export function str(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

export function checked(form: FormData, name: string) {
  return form.get(name) === 'on'
}
