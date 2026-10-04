export const INVESTMENT_TYPES = ['EQUITY', 'DEBT', 'PROJECT', 'MONEY_MARKET', 'REAL_ESTATE', 'OTHER'] as const
export const SECTORS = ['EDUCATION', 'AGRICULTURE', 'ENERGY', 'HEALTH', 'TECHNOLOGY', 'INFRASTRUCTURE', 'OTHER'] as const
export const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'AT_MATURITY'] as const
export const FUNDING = ['MEMBER_CONTRIBUTION', 'RETAINED_EARNINGS', 'LOAN_FINANCING', 'OTHER'] as const
export const OPPORTUNITY_DOCS = ['BUSINESS_PLAN', 'PROPOSAL', 'FINANCIAL_STATEMENTS', 'VALUATION', 'LEGAL', 'RISK_ASSESSMENT', 'OTHER'] as const
export const FEE_TYPES = ['MANAGEMENT', 'ADMINISTRATION', 'EARLY_REDEMPTION', 'TRANSFER', 'OTHER'] as const
export const RISKS = ['market', 'credit', 'liquidity', 'operational', 'legal', 'concentration', 'project'] as const
export const DILIGENCE = [
  ['businessModel', 'Business model reviewed'],
  ['viability', 'Project viability reviewed'],
  ['performance', 'Financial performance reviewed'],
  ['cashFlows', 'Cash flows reviewed'],
  ['ownership', 'Ownership reviewed'],
  ['regulatory', 'Regulatory status reviewed'],
  ['risks', 'Risks reviewed'],
] as const

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function text(value: unknown) {
  return value == null ? '' : String(value)
}

export function amount(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function rows(value: unknown) {
  return Array.isArray(value) ? value as Record<string, unknown>[] : []
}
