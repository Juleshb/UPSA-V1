export type DonationDoc = { documentType: string; fileName: string; notes?: string }

export type DonationSummary = {
  totalDonations: number
  donationsThisMonth: number
  donationsThisYear: number
  totalDonors: number
  activeCampaigns: number
  pendingPledges: number
  donationsReceived: number
  donationsPending: number
  donationsAllocated: number
  donationsDistributed: number
  allocatedAmount: number
  distributedAmount: number
  unallocatedDonations: number
  refunds: number
  currency: string
}

export type DonorRow = {
  id: string
  donorType: string
  status: string
  name: string
  organizationName: string | null
  country: string
  telephone: string
  email: string | null
  createdAt: string
}

export type DonorFile = DonorRow & {
  registrationNumber: string | null
  taxId: string | null
  district: string | null
  address: string
  website: string | null
  contactName: string | null
  contactPosition: string | null
  contactTelephone: string | null
  contactEmail: string | null
  contactIdentification: string | null
  authorizationLetter: string | null
  identityVerified: boolean
  organizationVerified: boolean
  registrationVerified: boolean
  contactVerified: boolean
  documentsVerified: boolean
  complianceVerified: boolean
  verificationResult: string | null
  verifiedBy: string | null
  verificationDate: string | null
  verificationComments: string | null
  documents: DonationDoc[]
  pledges: { id: string; campaign: string; amount: number; currency: string; status: string; pledgeDate: string | null }[]
  donations: { id: string; campaign: string; amount: number; currency: string; type: string; status: string; date: string | null }[]
  messages: { id: string; type: string; channel: string; subject: string; sentAt: string; status: string }[]
  history: { id: string; action: string; previousStatus: string | null; newStatus: string | null; userId: string | null; reason: string | null; createdAt: string }[]
}

export type CampaignRow = {
  id: string
  code: string
  name: string
  campaignType: string
  status: string
  approvalStatus: string
  targetAmount: number
  amountRaised: number
  amountRemaining: number
  currency: string
  completionPercent: number
  donorCount: number
}

export type CampaignFile = CampaignRow & {
  description: string | null
  purpose: string
  targetBeneficiary: string | null
  manager: string | null
  startDate: string | null
  endDate: string | null
  minimumDonation: number | null
  maximumDonation: number | null
  targetDonors: number | null
  amountAllocated: number
  amountDistributed: number
  donationCount: number
  approvedBy: string | null
  approvalDate: string | null
  approvalComments: string | null
  documents: DonationDoc[]
  budgets: { id: string; category: string; approvedBudget: number; currency: string; amountUsed: number; amountRemaining: number; department: string | null; approvalDate: string | null }[]
  monitoring: { id: string; reportingPeriod: string; activitiesCompleted: string; beneficiariesReached: number; issues: string | null; correctiveActions: string | null; officer: string; createdAt: string }[]
  pledges: { id: string; donor: string; amount: number; fulfilled: number; currency: string; frequency: string; status: string }[]
  donations: { id: string; donor: string; amount: number; currency: string; type: string; status: string }[]
}

export type GiftRow = {
  id: string
  reference: string
  donor: string
  campaign: string
  donationType: string
  amount: number
  currency: string
  status: string
  date: string | null
}

export type GiftFile = {
  id: string
  reference: string
  donorId: string
  donorName: string
  donorStatus: string
  campaignId: string | null
  campaignName: string | null
  pledgeId: string | null
  beneficiaryId: string | null
  beneficiaryName: string | null
  donationType: string
  status: string
  heldFromStatus: string | null
  donationDate: string | null
  amount: number
  currency: string
  purpose: string | null
  availableBalance: number
  donorVerified: boolean
  amountVerified: boolean
  paymentVerified: boolean
  campaignVerified: boolean
  purposeVerified: boolean
  documentsVerified: boolean
  beneficiaryVerified: boolean
  verificationResult: string | null
  verificationComment: string | null
  verifiedBy: string | null
  verificationDate: string | null
  approvalDecision: string | null
  approvedAmount: number | null
  conditions: string | null
  approvedBy: string | null
  approvalDate: string | null
  approvalComments: string | null
  documents: DonationDoc[]
  inKind: null | {
    id: string
    category: string
    description: string
    quantity: number
    unit: string
    estimatedValue: number
    currency: string
    condition: string | null
    dateReceived: string | null
    storageLocation: string | null
    intendedBeneficiary: string | null
    valuationMethod: string | null
    valuer: string | null
    valuationDate: string | null
    unitValue: number | null
    totalValue: number | null
    evidence: string | null
    valuedBy: string | null
    reviewedBy: string | null
    approvedBy: string | null
  }
  payments: {
    id: string
    amount: number
    currency: string
    paymentMethod: string
    payerName: string | null
    status: string
    reconciliationStatus: string
    transactionReference: string | null
    externalTransactionId: string | null
    railName: string | null
  }[]
  allocations: { id: string; beneficiary: string; amount: number; currency: string; purpose: string; category: string; status: string; date: string | null }[]
  refunds: { id: string; amount: number; currency: string; reason: string; destination: string; status: string; requestedBy: string; reviewedBy: string | null; approvedBy: string | null }[]
  adjustments: { id: string; amount: number; adjustmentType: string; reason: string; requestedBy: string; approvedBy: string; date: string }[]
  receipt: null | { id: string; amount: number; currency: string; paymentMethod: string | null; transactionReference: string | null; signatory: string; purpose: string | null }
  reconciliations: { id: string; expectedAmount: number; receivedAmount: number; difference: number; status: string; externalTransactionId: string | null }[]
  compliance: { id: string; result: string; officerName: string; comments: string | null; reviewedAt: string }[]
  audits: { id: string; donationId?: string | null; userId: string | null; action: string; previousStatus: string | null; newStatus: string | null; amount: number | null; reason: string | null; reference: string | null; ip: string | null; sessionId: string | null; createdAt: string }[]
}

export type BeneficiaryFile = {
  id: string
  beneficiaryType: string
  status: string
  name: string
  registrationNumber: string | null
  contactPerson: string | null
  telephone: string
  email: string | null
  province: string | null
  district: string | null
  sector: string | null
  physicalAddress: string
  bankName: string | null
  bankAccount: string | null
  mobileMoneyNumber: string | null
  identityVerified: boolean
  registrationVerified: boolean
  locationVerified: boolean
  eligibilityVerified: boolean
  documentsVerified: boolean
  paymentInfoVerified: boolean
  verificationDecision: string | null
  verifiedBy: string | null
  verificationDate: string | null
  verificationComments: string | null
  documents: DonationDoc[]
  allocations: { id: string; donationId: string; amount: number; currency: string; purpose: string; category: string; status: string; date: string | null }[]
  history: { id: string; action: string; previousStatus: string | null; newStatus: string | null; userId: string | null; reason: string | null; createdAt: string }[]
}

export type PledgeRow = {
  id: string
  donorId: string
  donor: string
  campaignId: string
  campaign: string
  amount: number
  fulfilled: number
  currency: string
  frequency: string
  status: string
  pledgeDate: string | null
  expectedPaymentDate: string | null
  purpose: string | null
}

export type AllocationRow = {
  id: string
  donationId: string
  campaign: string
  donor: string
  beneficiary: string
  availableBalance: number
  amount: number
  currency: string
  purpose: string
  category: string
  status: string
  date: string | null
}

export type Statement = {
  openingBalance: number
  donationsReceived: number
  adjustments: number
  refunds: number
  netDonations: number
  lines: { date: string; donationId: string; description: string; amount: number; currency: string; paymentReference: string | null; status: string }[]
}
