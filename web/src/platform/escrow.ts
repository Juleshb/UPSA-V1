export type EscrowSummary = {
  accounts: { total: number; active: number; pending: number; suspended: number; frozen: number; closed: number }
  balances: { total: number; available: number; restricted: number; frozen: number; pendingRelease: number; member: number; finance: number }
  exposure: { collateral: number; guarantee: number; loans: number; claims: number; recoveries: number; escrowBacked: number }
  scope: string
  assumptions: string[]
  roles: { role: string; boundary: string }[]
}

export type GroupRow = {
  groupId: string
  name: string
  groupType: string
  schoolName: string | null
  district: string | null
  members: number
  accounts: number
  membershipStatus: string
  status: string
}

export type AccountRow = {
  accountId: string
  accountNumber: string
  name: string
  status: string
  groupId: string | null
  groupName: string | null
  currency: string
  memberPercent: number
  financePercent: number
  closing: number
  available: number
  restricted: number
  frozen: number
  member: number
  finance: number
  dualAuthorization: boolean
  setOffAllowed: boolean
}

export type CollateralRow = {
  collateralId: string
  groupName: string
  collateralType: string
  description: string
  owner: string
  marketValue: number
  eligibleValue: number
  status: string
  countsAsCollateral: boolean
}

export type FacilityRow = {
  facilityId: string
  name: string
  approvedLimit: number
  utilized: number
  available: number
  guaranteePercent: number
  status: string
  currency: string
}

export type ApplicationRow = {
  applicationId: string
  applicant: string
  groupName: string | null
  requestedLoan: number
  requestedGuarantee: number
  status: string
  decision: string | null
}

export type GuaranteeListRow = {
  guaranteeId: string
  certificateNumber: string | null
  applicant: string
  groupName: string | null
  currentExposure: number
  status: string
  expiryDate: string | null
}
