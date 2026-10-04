export type MembershipSummary = {
  total: number
  active: number
  pending: number
  verification: number
  suspended: number
  expired: number
  feesDue: number
  feesCollected: number
}

export type MembershipCategory = {
  categoryId: string
  code: string
  name: string
  description: string | null
  eligibility: string | null
  membershipFee: number
  renewalFee: number
  periodMonths: number
  currency: string
  status: string
  effectiveDate: string | null
  approvalRequired: boolean
  requirements: { requirementId: string; documentType: string; mandatory: boolean; verificationRequired: boolean }[]
}

export type MemberRow = {
  memberId: string
  membershipNumber: string | null
  institutionName: string
  registrationNumber: string
  category: string
  district: string
  status: string
  expiryDate: string | null
  payment: string
}

export type MemberFile = {
  memberId: string
  membershipNumber: string | null
  schoolId: string | null
  categoryName: string
  registrationNumber: string
  institutionName: string
  physicalAddress: string
  phone: string
  email: string
  representativeName: string
  bankName: string | null
  currency: string
  status: string
  expiryDate: string | null
  feeDue: number
  feeCollected: number
  documents: { documentId: string; documentType: string; documentNumber: string | null; fileName: string; hasFile?: boolean; status: string }[]
  verification: {
    result: string
    officerName: string | null
    comments?: string | null
    registrationVerified?: boolean
    nameVerified?: boolean
    numberVerified?: boolean
    addressVerified?: boolean
    legalVerified?: boolean
    identityVerified?: boolean
    authorityVerified?: boolean
    contactVerified?: boolean
    bankVerified?: boolean
    bankBelongsToInstitution?: boolean
  } | null
  decision: { decision: string; conditions: string | null; officerName: string | null } | null
  fees: { feeId: string; totalPayable: number; paid: number; outstanding: number; currency: string; status: string }[]
  certificate: { certificateNumber: string; membershipNumber: string; startDate: string | null; expiryDate: string | null; issuedAt?: string | null; signatory: string; location?: string | null; verifyUrl?: string | null } | null
}

export type MembershipNotice = { noticeId: string; event: string; subject: string; status: string; createdAt: string }
export type MembershipAudit = { auditId: string; memberId: string | null; action: string; previousStatus: string | null; newStatus: string | null; userId: string | null; createdAt: string }
