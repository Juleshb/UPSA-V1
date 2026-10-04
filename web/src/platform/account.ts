export type AccountDoc = { documentType: string; fileName: string; notes?: string }

export type AccountParty = { id: string; name: string; source: string } | null

export type AccountRow = {
  id: string
  accountType: string
  applicantName: string
  phone: string
  email: string | null
  party: string | null
  partyId: string | null
  status: string
  kycResult: string
  duplicateResult: string
  createdAt: string
}

export type AccountFile = {
  id: string
  accountType: string
  status: string
  nextStep: string
  channel: string
  referral: string | null
  purpose: string
  language: string
  communicationPreference: string
  digitalAccess: boolean
  mobileAccess: boolean
  webAccess: boolean
  applicantName: string
  identityNumber: string | null
  phone: string
  email: string | null
  country: string
  province: string | null
  district: string | null
  sector: string | null
  cell: string | null
  village: string | null
  address: string | null
  termsAccepted: boolean
  privacyAccepted: boolean
  dataConsent: boolean
  consentVersion: string | null
  documents: AccountDoc[]
  profile: Record<string, string>
  devices: { name: string; registeredAt: string }[]
  limits: { daily: number; transaction: number; currency: string }
  changes: Record<string, string>[]
  party: AccountParty
  linkedUser: { id: string; name: string; email: string } | null
  identityStatus: string
  phoneStatus: string
  emailStatus: string
  addressStatus: string
  documentStatus: string
  kycResult: string
  kycNotes: string | null
  duplicateResult: string
  duplicateMatches: { source: string; id: string; name: string; reason: string }[]
  duplicateNote: string | null
  riskLevel: string | null
  riskNotes: string | null
  complianceResult: string
  decision: string | null
  conditions: string | null
  approvedBy: string | null
  approvalDate: string | null
  rejectionReason: string | null
  username: string | null
  roleName: string | null
  mfaRequired: boolean
  mfaMethod: string | null
  accessIssued: boolean
  activatedAt: string | null
  activatedBy: string | null
  legalHold: boolean
  legalHoldReason: string | null
  suspensionReason: string | null
  closureReason: string | null
  closureBlockers: string[]
  audits: { id: string; action: string; previousStatus: string | null; newStatus: string | null; reason: string | null; actor: string | null; at: string }[]
}

export type AccountStatement = {
  accountId: string
  party: AccountParty
  currency: string
  billed: number
  paid: number
  outstanding: number
  blockers: string[]
  invoices: { id: string; description: string; amount: number; paid: number; balance: number; currency: string; status: string; dueDate: string }[]
}
