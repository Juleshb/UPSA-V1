export type LendingSummary = {
  applications: number
  pending: number
  assessment: number
  approved: number
  declined: number
  active: number
  disbursed: number
  principal: number
  interest: number
  fees: number
  outstanding: number
  overdue: number
  recovery: number
  settled: number
  defaulted: number
  guaranteed: number
}

export type LoanProductRow = {
  productId: string
  code: string
  name: string
  customerType: string
  purpose: string
  currency: string
  status: string
  interestRate: number
  interestMethod: string
  minimumAmount: number
  maximumAmount: number
  minimumTenor: number
  maximumTenor: number
  graceMonths: number
  repaymentFrequency: string
  guaranteeRequired: boolean
  collateralRequired: boolean
}

export type LendingApplicationRow = {
  applicationId: string
  applicant: string
  schoolId: string
  productCode: string
  district: string
  requestedAmount: number
  currency: string
  status: string
  decision: string | null
  loanId: string | null
}

export type LendingFile = {
  applicationId: string
  schoolName: string
  institutionName: string
  productCode: string
  applicantName: string
  requestedAmount: number
  approvedAmount: number | null
  currency: string
  tenorMonths: number
  purpose: string
  status: string
  decision: string | null
  loanId: string | null
  guaranteeRequested: boolean
  documents: { documentId: string; documentType: string; fileName: string; status: string }[]
  kyc: { result: string; officerName: string } | null
  consent: { status: string; scope: string } | null
  assessment: { result: string; freeCashFlow: number; note: string } | null
  offer: { offerId: string; amount: number; interestRate: number; tenorMonths: number; fees: number; expiresOn: string | null; response: string } | null
  contract: { contractNumber: string; principal: number } | null
  collateral: { collateralId: string; collateralType: string; estimatedValue: number; status: string }[]
  guarantee: { requestId: string; requestedGuarantee: number; decision: string } | null
}

export type LendingLoanRow = {
  loanId: string
  borrower: string
  productCode: string
  district: string
  principal: number
  outstanding: number
  currency: string
  status: string
  daysPastDue: number
}

export type LendingLoanFile = {
  loanId: string
  applicationId: string
  borrower: string
  productCode: string
  currency: string
  status: string
  principal: number
  disbursed: number
  principalOutstanding: number
  interest: number
  fees: number
  penalty: number
  total: number
  interestRate: number
  tenorMonths: number
  nextPaymentDate: string | null
  daysPastDue: number
  contractNumber: string | null
  schedule: { number: number; dueDate: string | null; principalDue: number; interestDue: number; feesDue: number; totalDue: number; status: string }[]
  disbursements: { disbursementId: string; amount: number; reference: string }[]
  repayments: { repaymentId: string; amount: number; reference: string; status: string }[]
}
