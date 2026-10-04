import type { AccountFile, AccountRow, AccountStatement } from './account'
import type { AccountRow as EscrowAccountRow, ApplicationRow as EscrowApplicationRow, CollateralRow, EscrowSummary, FacilityRow as EscrowFacilityRow, GroupRow, GuaranteeListRow } from './escrow'
import type { CourseRow, LearnerFile, LearnerRow, LiteracySummary, ProgrammeRow, PublicCourse, PublicTraining, StudyDesk } from './literacy'
import type { LendingApplicationRow, LendingFile, LendingLoanFile, LendingLoanRow, LendingSummary, LoanProductRow } from './lending'
import type { MemberFile, MemberRow, MembershipAudit, MembershipCategory, MembershipNotice, MembershipSummary } from './membership'
import type {
  AllocationRow,
  BeneficiaryFile,
  CampaignFile,
  CampaignRow,
  DonationSummary,
  DonorFile,
  DonorRow,
  GiftFile,
  GiftRow,
  PledgeRow,
  Statement,
} from './donation'

export type Role =
  | 'PARENT'
  | 'SCHOOL_USER'
  | 'RUPSA_USER'
  | 'BANK_USER'
  | 'MFI_USER'
  | 'PSP_USER'
  | 'AUDITOR'
  | 'SYSTEM_ADMINISTRATOR'

export type SessionUser = {
  userId: string
  email: string
  fullName: string
  role: Role
  permissions: string[]
  status?: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: SessionUser
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const ACCESS = 'rupsa.app.access'
const REFRESH = 'rupsa.app.refresh'
const USER = 'rupsa.app.user'

export function storedAccess() {
  return localStorage.getItem(ACCESS) ?? ''
}

export function storedRefresh() {
  return localStorage.getItem(REFRESH) ?? ''
}

export function storedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function persistSession(session: AuthSession) {
  localStorage.setItem(ACCESS, session.accessToken)
  localStorage.setItem(REFRESH, session.refreshToken)
  localStorage.setItem(USER, JSON.stringify(session.user))
}

export function clearSession() {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
  localStorage.removeItem(USER)
}

type Query = Record<string, string | undefined>

let refreshInFlight: Promise<boolean> | null = null

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Client-ID', 'rupsa-web')
  headers.set('X-Request-ID', crypto.randomUUID())
  const token = storedAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.method && init.method !== 'GET' && /payments|disbursement|repayments|guarantees|webhooks|escrow/.test(path)) {
    headers.set('Idempotency-Key', crypto.randomUUID())
  }

  const response = await fetch(`/api/v1${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({}))

  if (response.status === 401 && retry && storedRefresh()) {
    const refreshed = await refreshSession()
    if (refreshed) return request<T>(path, init, false)
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } }).error
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? (response.status >= 500
        ? 'The API is not reachable. Start it with npm run dev:api.'
        : 'The request failed.'),
    )
  }
  return payload as T
}

function get<T>(path: string, query?: Query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value)
  }
  const suffix = params.size ? `?${params}` : ''
  return request<T>(`${path}${suffix}`)
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

function postForm<T>(path: string, body: FormData) {
  return request<T>(path, { method: 'POST', body })
}

async function authorizedBlob(path: string) {
  const headers = new Headers()
  headers.set('Accept', '*/*')
  headers.set('X-Client-ID', 'rupsa-web')
  const token = storedAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`/api/v1${path}`, { headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } }
    throw new ApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'This file could not be opened.')
  }
  return response.blob()
}

export async function openProtectedFile(path: string) {
  const blob = await authorizedBlob(path)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function protectedObjectUrl(path: string) {
  const blob = await authorizedBlob(path)
  return URL.createObjectURL(blob)
}

export async function openSchoolDocument(schoolId: string, documentId: string) {
  await openProtectedFile(`/schools/${encodeURIComponent(schoolId)}/documents/${encodeURIComponent(documentId)}/file`)
}

function patch<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const refreshToken = storedRefresh()
    if (!refreshToken) return false
    try {
      const session = await request<AuthSession>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false)
      persistSession(session)
      return true
    } catch {
      clearSession()
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export const api = {
  login(email: string, password: string) {
    return post<AuthSession>('/auth/login', { email, password })
  },
  me() {
    return get<SessionUser>('/auth/me')
  },
  overview() {
    return get<{
      schools: number
      students: number
      invoices: number
      payments: number
      collections: {
        billed: number
        collected: number
        outstanding: number
        collectionRate: number
        currency: string
        series?: { month: string; billed: number; collected: number }[]
      }
      invoicesByStatus?: { status: string; count: number; amount: number }[]
      paymentChannels?: { channel: string; amount: number }[]
      credit: { activeLoans: number; principalOutstanding: number; currency: string }
      guarantee: {
        facilityName?: string
        maximumExposure: number
        availableCapacity: number
        outstandingGuarantees: number
        claims: number
        currency: string
      }
    }>('/reports/overview')
  },
  schoolApplications: {
    upload: (body: FormData) => postForm<{ uploadId: string; fileName: string }>('/school-applications/uploads', body),
    submit: (body: {
      schoolName: string
      registrationNumber: string
      schoolType: string
      ownershipType: string
      dateEstablished: string
      operatingStatus: string
      studentCount: number
      teacherCount: number
      staffCount?: number
      phone: string
      alternativePhone?: string
      email: string
      website?: string
      emergencyContact?: string
      address: {
        province: string
        district: string
        sector: string
        cell: string
        village: string
        physicalAddress: string
        gpsCoordinates?: string
        postalAddress?: string
      }
      rupsaMemberId?: string
      taxIdentificationNumber: string
      registrationCertificateNumber: string
      registrationDate: string
      registrationAuthority: string
      licenseNumber: string
      licenseExpiryDate: string
      legalStatus: string
      representative: {
        fullName: string
        position: string
        nationalId: string
        phone: string
        email: string
        appointmentDate: string
      }
      bankAccount: {
        bankName: string
        branch: string
        accountName: string
        accountNumber: string
        currency: string
        swiftCode?: string
      }
      documents: { documentType: string; fileName: string; uploadId?: string }[]
    }) => post<{
      schoolId: string
      schoolName: string
      status: string
      email: string
      emailSent: boolean
      membershipStatus: string
      membershipReference: string | null
    }>('/school-applications', body),
    status: (schoolId: string, email: string) =>
      get<SchoolApplicationStatus>(
        `/school-applications/${encodeURIComponent(schoolId)}/status`,
        { email },
      ),
    linkMembership: (schoolId: string, body: { email: string; membershipReference: string }) =>
      post<SchoolApplicationStatus>(`/school-applications/${encodeURIComponent(schoolId)}/membership`, body),
  },
  membershipApplications: {
    categories: () => get<{ items: { code: string; name: string; eligibility: string | null; membershipFee: number; currency: string; requirements: { documentType: string; mandatory: boolean }[] }[] }>('/membership-applications/categories'),
    upload: (body: FormData) => postForm<{ uploadId: string; fileName: string }>('/membership-applications/uploads', body),
    submit: (body: {
      schoolName: string
      registrationNumber: string
      categoryCode: string
      institutionType: string
      dateEstablished?: string
      studentCount?: number
      staffCount?: number
      contactName: string
      title: string
      phone: string
      email: string
      website?: string
      postalAddress?: string
      alternativePhone?: string
      registrationCertificateNumber: string
      registrationDate?: string
      taxIdentificationNumber?: string
      issuingAuthority?: string
      bankName?: string
      bankAccountName?: string
      bankAccountNumber?: string
      bankBranch?: string
      currency?: string
      representativeNationalId?: string
      representativePhone: string
      representativeEmail: string
      address: { province: string; district: string; sector: string; cell: string; village?: string; physicalAddress: string }
      documents: { documentType: string; fileName: string; uploadId: string }[]
      message?: string
      payment?: { paymentMethod: string; payerName: string; payerPhone?: string; paymentReference?: string; externalTransactionId?: string }
    }) => post<{ applicationId: string; memberId: string; schoolName: string; email: string; status: string; emailSent: boolean; feeAmount: number; currency: string; paymentStatus: string | null }>('/membership-applications', body),
    status: (applicationId: string, email: string) =>
      get<MembershipStatus>(
        `/membership-applications/${encodeURIComponent(applicationId)}/status`,
        { email },
      ),
    verify: (code: string) =>
      get<MembershipVerification>(`/membership-applications/verify/${encodeURIComponent(code)}`),
    list: () => get<{ items: MembershipApplicationRow[] }>('/membership-applications'),
    decide: (applicationId: string, body: { decision: 'CONFIRMED' | 'REJECTED'; note?: string }) =>
      post<MembershipApplicationRow>(`/membership-applications/${encodeURIComponent(applicationId)}/decision`, body),
  },
  membershipDesk: {
    upload: (body: FormData) => postForm<{ uploadId: string; fileName: string }>('/membership/uploads', body),
    summary: () => get<MembershipSummary>('/membership/summary'),
    categories: () => get<{ items: MembershipCategory[] }>('/membership/categories'),
    saveCategory: (body: Record<string, unknown>) => post<{ categoryId: string }>('/membership/categories', body),
    saveRequirement: (id: string, body: Record<string, unknown>) => post<{ requirementId: string }>(`/membership/categories/${id}/requirements`, body),
    members: (query?: { status?: string; q?: string }) => get<{ items: MemberRow[] }>('/membership/members', query),
    member: (id: string) => get<MemberFile>(`/membership/members/${encodeURIComponent(id)}`),
    registerMember: (body: Record<string, unknown>) => post<{ memberId: string }>('/membership/members', body),
    apply: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/application`, body),
    addDocument: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/documents`, body),
    reviewDocument: (id: string, documentId: string, body: { status: string; comment?: string }) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`, body),
    verify: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/verification`, body),
    decide: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/decision`, body),
    pay: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/payments`, body),
    renew: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/renewals`, body),
    change: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/changes`, body),
    suspend: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/suspension`, body),
    reactivate: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/reactivation`, body),
    terminate: (id: string, body: Record<string, unknown>) => post<MemberFile>(`/membership/members/${encodeURIComponent(id)}/termination`, body),
    report: (type: string) => get<{ items: Record<string, string | number>[] }>(`/membership/reports/${encodeURIComponent(type)}`),
    notices: () => get<{ items: MembershipNotice[] }>('/membership/notices'),
    sendNotice: (body: Record<string, unknown>) => post<{ noticeId: string }>('/membership/notices', body),
    audit: () => get<{ items: MembershipAudit[] }>('/membership/audit'),
  },
  messages: {
    submit: (body: {
      name: string
      organisation: string
      role: string
      interest: string
      email: string
      message: string
    }) => post<{ status: string; email: string; emailSent: boolean }>('/messages', body),
  },
  schools: {
    list: () => get<{ items: SchoolRow[] }>('/schools'),
    get: (id: string) => get<SchoolRow>(`/schools/${id}`),
    profile: (id: string) => get<FinancialProfile>(`/schools/${id}/financial-profile`),
    registration: (id: string) => get<SchoolRegistration>(`/schools/${id}/registration`),
    create: (body: {
      schoolName: string
      registrationNumber: string
      phone: string
      email: string
      address: { province: string; district: string; sector?: string }
      rupsaMemberId?: string
      taxIdentificationNumber?: string
    }) => post<{ schoolId: string; status: string }>('/schools', body),
    update: (id: string, body: Partial<{
      schoolName: string
      phone: string
      email: string
      province: string
      district: string
      sector: string
      rupsaMemberId: string
      taxIdentificationNumber: string
    }>) => patch<SchoolRow>(`/schools/${id}`, body),
    transition: (id: string, status: string) => post<SchoolRow>(`/schools/${id}/transition`, { status }),
    membership: (id: string, body: { decision: 'PENDING' | 'VERIFIED' | 'REJECTED'; rupsaMemberId?: string }) =>
      post<SchoolRow>(`/schools/${id}/membership`, body),
    kyc: (id: string, body: { kind: 'KYC' | 'KYB'; status: 'PENDING' | 'VERIFIED' | 'REJECTED'; notes?: string }) =>
      post<SchoolKyc>(`/schools/${id}/kyc`, body),
    addOwnership: (id: string, body: { ownerName: string; ownershipPct: number; nationalId?: string }) =>
      post<SchoolOwner>(`/schools/${id}/ownership`, body),
    removeOwnership: (id: string, ownershipId: string) => del(`/schools/${id}/ownership/${ownershipId}`),
    addPerson: (id: string, body: { fullName: string; title: string; phone?: string; email?: string; role: 'MANAGEMENT' | 'SIGNATORY' }) =>
      post<SchoolPerson>(`/schools/${id}/people`, body),
    removePerson: (id: string, personId: string) => del(`/schools/${id}/people/${personId}`),
    addBank: (id: string, body: { bankName: string; accountName: string; accountNumber: string; currency?: string; isPrimary?: boolean }) =>
      post<SchoolBank>(`/schools/${id}/bank-accounts`, body),
    removeBank: (id: string, accountId: string) => del(`/schools/${id}/bank-accounts/${accountId}`),
    uploads: () => get<{ items: UploadedDocument[] }>('/schools/uploads'),
    addDocument: (id: string, body: FormData) =>
      postForm<SchoolDocument>(`/schools/${id}/documents`, body),
    reviewDocument: (id: string, documentId: string, status: 'ACCEPTED' | 'REJECTED') =>
      post<SchoolDocument>(`/schools/${id}/documents/${documentId}/review`, { status }),
    verification: (id: string, body: {
      status: 'PENDING' | 'VERIFIED' | 'MORE_INFORMATION_REQUIRED' | 'REJECTED'
      registrationVerified: boolean
      legalDocumentsVerified: boolean
      representativeVerified: boolean
      addressVerified: boolean
      bankAccountVerified: boolean
      documentsComplete: boolean
    }) => post<SchoolRegistration>(`/schools/${id}/verification`, body),
  },
  students: {
    list: (schoolId?: string) => get<{ items: StudentRow[] }>('/students', { schoolId }),
    summary: (id: string) => get<FinancialSummary>(`/students/${id}/financial-summary`),
    file: (id: string) => get<StudentFile>(`/students/${id}/registration`),
    upload: (body: FormData) => postForm<{ uploadId: string; fileName: string }>('/students/uploads', body),
    create: (body: StudentRegistrationInput) => post<StudentFile>('/students', body),
    update: (id: string, body: Partial<{
      studentName: string
      studentExternalId: string
      academicYear: string
      classLevel: string
      feeCategory: string
      status: string
    }>) => patch<StudentRow>(`/students/${id}`, body),
    remove: (id: string) => del<StudentRow>(`/students/${id}`),
    addGuardian: (id: string, body: StudentGuardianInput) => post<StudentFile>(`/students/${id}/guardians`, body),
    addDocument: (id: string, body: StudentDocumentInput) => post<StudentFile>(`/students/${id}/documents`, body),
    reviewDocument: (id: string, documentId: string, verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED') =>
      post<StudentFile>(`/students/${id}/documents/${documentId}/review`, { verificationStatus }),
  },
  invoices: {
    list: (query?: { schoolId?: string; studentId?: string; status?: string }) =>
      get<{ items: InvoiceRow[] }>('/invoices', query),
    create: (body: {
      schoolId: string
      studentId: string
      amount: number
      description: string
      dueDate: string
      currency?: string
    }) => post<InvoiceRow>('/invoices', body),
    update: (id: string, body: Partial<{ amount: number; description: string; dueDate: string }>) =>
      patch<InvoiceRow>(`/invoices/${id}`, body),
    cancel: (id: string) => del<InvoiceRow>(`/invoices/${id}`),
  },
  payments: {
    list: (invoiceId?: string) => get<{ items: PaymentRow[] }>('/payments', { invoiceId }),
    rails: () => get<{ items: PaymentRailRow[] }>('/payments/rails'),
    corridors: () => get<{ items: CorridorRow[] }>('/payments/corridors'),
    events: () => get<{ contract: string[]; items: BusEvent[] }>('/payments/events'),
    initiate: (body: {
      invoiceId: string
      amount: number
      paymentChannel: 'BANK' | 'PSP' | 'MOBILE_PAYMENT' | 'CARD' | 'OTHER'
      payerReference?: string
      currency?: string
      originCountry?: string
      destinationCountry?: string
    }) => post<PaymentRow>('/payments', body),
    retry: (paymentId: string) => post<PaymentRow>(`/payments/${paymentId}/retry`),
    refund: (paymentId: string) => post<PaymentRow>(`/payments/${paymentId}/refund`),
    confirm: (body: {
      paymentId: string
      invoiceId?: string
      amount: number
      transactionReference: string
    }) => post<PaymentRow>('/webhooks/payment', {
      event: 'PAYMENT.SUCCESS',
      eventId: `EVT-${crypto.randomUUID()}`,
      paymentId: body.paymentId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      currency: 'RWF',
      transactionReference: body.transactionReference,
      timestamp: new Date().toISOString(),
    }),
  },
  loans: {
    applications: (schoolId?: string) => get<{ items: LoanApplicationRow[] }>('/loan-applications', { schoolId }),
    apply: (body: {
      schoolId: string
      financialInstitutionId: string
      productCode: string
      requestedAmount: number
      tenorMonths: number
      purpose: string
      currency?: string
      guaranteeRequested?: boolean
      guaranteeAmountRequested?: number
    }) => post<{ applicationId: string; status: string }>('/loan-applications', body),
    decide: (id: string, body: { decision: 'APPROVED' | 'DECLINED'; approvedAmount?: number; tenorMonths?: number; interestRate?: number }) =>
      post<LoanApplicationRow>(`/loan-applications/${id}/decision`, body),
    get: (id: string) => get<LoanRow>(`/loans/${id}`),
    balance: (id: string) => get<LoanBalance>(`/loans/${id}/balance`),
  },
  lending: {
    summary: () => get<LendingSummary>('/lending/summary'),
    products: () => get<{ items: LoanProductRow[] }>('/lending/products'),
    saveProduct: (body: Record<string, unknown>) => post<{ productId: string }>('/lending/products', body),
    applications: (query?: { status?: string; q?: string }) => get<{ items: LendingApplicationRow[] }>('/lending/applications', query),
    application: (id: string) => get<LendingFile>(`/lending/applications/${encodeURIComponent(id)}`),
    apply: (body: Record<string, unknown>) => post<LendingFile>('/lending/applications', body),
    addDocument: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/documents`, body),
    reviewDocument: (id: string, documentId: string, body: { status: string; comment?: string }) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`, body),
    kyc: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/kyc`, body),
    consent: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/consent`, body),
    assess: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/assessment`, body),
    decide: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/decision`, body),
    offer: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/offer`, body),
    contract: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/contract`, body),
    collateral: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/collateral`, body),
    guarantee: (id: string, body: Record<string, unknown>) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/guarantee`, body),
    decideGuarantee: (id: string, requestId: string, decision: string) => post<LendingFile>(`/lending/applications/${encodeURIComponent(id)}/guarantee/${encodeURIComponent(requestId)}`, { decision }),
    loans: (query?: { status?: string; q?: string }) => get<{ items: LendingLoanRow[] }>('/lending/loans', query),
    loan: (id: string) => get<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}`),
    statement: (id: string) => get<Record<string, unknown>>(`/lending/loans/${encodeURIComponent(id)}/statement`),
    disburse: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/disbursements`, body),
    repay: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/repayments`, body),
    restructure: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/restructure`, body),
    holiday: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/holiday`, body),
    topUp: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/top-up`, body),
    refinance: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/refinance`, body),
    transfer: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/transfer`, body),
    adjust: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/adjustments`, body),
    refund: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/refunds`, body),
    collect: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/collections`, body),
    promise: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/promises`, body),
    recovery: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/recovery`, body),
    writeOff: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/write-off`, body),
    settle: (id: string, body: Record<string, unknown>) => post<LendingLoanFile>(`/lending/loans/${encodeURIComponent(id)}/settlement`, body),
    report: (type: string) => get<{ items: Record<string, string | number>[] }>(`/lending/reports/${encodeURIComponent(type)}`),
    notices: () => get<{ items: { noticeId: string; event: string; subject: string; status: string; createdAt: string }[] }>('/lending/notices'),
    sendNotice: (body: Record<string, unknown>) => post<{ noticeId: string }>('/lending/notices', body),
    audit: () => get<{ items: { auditId: string; reference: string | null; action: string; previousStatus: string | null; newStatus: string | null; userId: string | null; createdAt: string }[] }>('/lending/audit'),
  },
  guarantees: {
    list: () => get<{ items: GuaranteeRow[]; facility: FacilityRow }>('/guarantees'),
    request: (body: {
      loanApplicationId: string
      schoolId: string
      financialInstitutionId: string
      loanAmount: number
      guaranteeAmount: number
    }) => post<{ guaranteeId: string; status: string }>('/guarantees', body),
    decide: (id: string, body: { decision: 'APPROVED' | 'DECLINED'; guaranteedAmount?: number; expiryDate?: string }) =>
      post<GuaranteeRow>(`/guarantees/${id}/decision`, body),
  },
  escrow: {
    summary: () => get<EscrowSummary>('/escrow/summary'),
    groups: () => get<{ items: GroupRow[] }>('/escrow/groups'),
    group: (id: string) => get<Record<string, unknown>>(`/escrow/groups/${id}`),
    exposure: (id: string) => get<Record<string, unknown>>(`/escrow/groups/${id}/exposure`),
    createGroup: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/groups', body),
    addMember: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/groups/${id}/members`, body),
    groupContribution: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/groups/${id}/contributions`, body),
    accounts: () => get<{ items: EscrowAccountRow[] }>('/escrow/accounts'),
    account: (id: string) => get<Record<string, unknown>>(`/escrow/accounts/${id}`),
    statement: (id: string) => get<Record<string, unknown>>(`/escrow/accounts/${id}/statement`),
    openAccount: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/accounts', body),
    decideAccount: (id: string, decision: string) => post<Record<string, unknown>>(`/escrow/accounts/${id}/decision`, { decision }),
    contribute: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/contributions`, body),
    allocate: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/allocations`, body),
    movement: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/movements`, body),
    freeze: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/freezes`, body),
    decideFreeze: (id: string, freezeId: string, decision: string) => post<Record<string, unknown>>(`/escrow/accounts/${id}/freezes/${freezeId}`, { decision }),
    release: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/releases`, body),
    decideRelease: (id: string, releaseId: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/releases/${releaseId}`, body),
    withdraw: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/withdrawals`, body),
    refund: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/refunds`, body),
    agreement: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/agreements`, body),
    closeAccount: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/accounts/${id}/close`, body),
    collateral: () => get<{ items: CollateralRow[]; pools: Record<string, unknown>[] }>('/escrow/collateral'),
    asset: (id: string) => get<Record<string, unknown>>(`/escrow/collateral/${id}`),
    createPool: (body: Record<string, unknown>) => post<{ items: Record<string, unknown>[] }>('/escrow/pools', body),
    registerAsset: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/collateral', body),
    verifyAsset: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/verification`, body),
    valueAsset: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/valuation`, body),
    markAsset: (id: string, status: string) => post<Record<string, unknown>>(`/escrow/collateral/${id}/status`, { status }),
    lien: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/liens`, body),
    releaseAsset: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/release`, body),
    watchAsset: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/monitoring`, body),
    realizeAsset: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/collateral/${id}/realization`, body),
    facilities: () => get<{ items: EscrowFacilityRow[] }>('/escrow/facilities'),
    createFacility: (body: Record<string, unknown>) => post<{ items: EscrowFacilityRow[] }>('/escrow/facilities', body),
    applications: () => get<{ items: EscrowApplicationRow[] }>('/escrow/applications'),
    application: (id: string) => get<Record<string, unknown>>(`/escrow/applications/${id}`),
    createApplication: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/applications', body),
    eligibility: (id: string) => post<Record<string, unknown>>(`/escrow/applications/${id}/eligibility`, {}),
    assessment: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/applications/${id}/assessment`, body),
    decision: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/applications/${id}/decision`, body),
    issue: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/applications/${id}/issue`, body),
    guarantees: () => get<{ items: GuaranteeListRow[] }>('/escrow/guarantees'),
    guarantee: (id: string) => get<Record<string, unknown>>(`/escrow/guarantees/${id}`),
    fee: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/guarantees/${id}/fees`, body),
    renew: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/guarantees/${id}/renewals`, body),
    amend: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/guarantees/${id}/amendments`, body),
    cancelGuarantee: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/guarantees/${id}/cancel`, body),
    claim: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/guarantees/${id}/claims`, body),
    claimFile: (id: string) => get<Record<string, unknown>>(`/escrow/claims/${id}`),
    assessClaim: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/claims/${id}/assessment`, body),
    approveClaim: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/claims/${id}/approval`, body),
    payClaim: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/claims/${id}/payments`, body),
    recover: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/escrow/claims/${id}/recoveries`, body),
    links: () => get<{ items: Record<string, unknown>[] }>('/escrow/links'),
    createLink: (body: Record<string, unknown>) => post<{ items: Record<string, unknown>[] }>('/escrow/links', body),
    setOff: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/set-offs', body),
    reconciliation: () => get<{ items: Record<string, unknown>[] }>('/escrow/reconciliation'),
    reconcile: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/reconciliation', body),
    documents: () => get<{ items: Record<string, unknown>[] }>('/escrow/documents'),
    addDocument: (body: Record<string, unknown>) => post<{ items: Record<string, unknown>[] }>('/escrow/documents', body),
    audit: () => get<{ items: Record<string, unknown>[] }>('/escrow/audit'),
    notices: () => get<{ items: Record<string, unknown>[] }>('/escrow/notices'),
    report: (type: string) => get<{ items: Record<string, unknown>[] }>(`/escrow/reports/${type}`),
    openDefault: (body: Record<string, unknown>) => post<Record<string, unknown>>('/escrow/defaults', body),
  },
  institutions: {
    list: () => get<{ items: InstitutionRow[] }>('/institutions'),
  },
  registrations: {
    summary: () => get<RegistrationSummary>('/registrations/summary'),
    list: (query?: { q?: string; kind?: string; status?: string }) =>
      get<{ items: RegistryRow[] }>('/registrations', query),
    get: (id: string) => get<RegistrationFile>(`/registrations/${encodeURIComponent(id)}`),
    upload: (body: FormData) => postForm<{ uploadId: string; fileName: string }>('/registrations/uploads', body),
    create: (body: {
      kind: string
      profile: Record<string, string | boolean>
      documents?: RegistrationDocumentInput[]
    }) => post<RegistrationFile>('/registrations', body),
    verify: (id: string, body: RegistrationChecklist & { result: string; comments?: string }) =>
      post<RegistrationFile>(`/registrations/${encodeURIComponent(id)}/verification`, body),
    approve: (id: string, body: { decision: string; conditions?: string; comments?: string }) =>
      post<RegistrationFile>(`/registrations/${encodeURIComponent(id)}/approval`, body),
    addDocument: (id: string, body: RegistrationDocumentInput) =>
      post<RegistrationFile>(`/registrations/${encodeURIComponent(id)}/documents`, body),
    reviewDocument: (id: string, documentId: string, verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED') =>
      post<RegistrationFile>(`/registrations/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/review`, { verificationStatus }),
  },
  donations: {
    summary: () => get<DonationSummary>('/donations/summary'),
    statement: (query?: { donorId?: string; campaignId?: string; from?: string; to?: string; donationType?: string; status?: string; currency?: string }) =>
      get<Statement>('/donations/statement', query),
    report: (type: string) => get<{ items: Record<string, string | number | null>[] }>(`/donations/reports/${encodeURIComponent(type)}`),
    audit: (donationId?: string) => get<{ items: GiftFile['audits'] }>('/donations/audit', { donationId }),
    payments: (status?: string) => get<{ items: { id: string; donationId: string; donor: string; amount: number; currency: string; paymentMethod: string; status: string; reconciliationStatus: string; transactionReference: string | null; externalTransactionId: string | null; railName: string | null }[] }>('/donations/payments', { status }),
    receipts: () => get<{ items: { id: string; donationId: string; donorName: string; campaign: string | null; amount: number; currency: string; paymentMethod: string | null; transactionReference: string | null; signatory: string }[] }>('/donations/receipts'),
    messages: () => get<{ items: { id: string; donor: string; type: string; channel: string; subject: string; message: string; sentBy: string; sentAt: string; status: string }[] }>('/donations/messages'),
    sendMessage: (body: { donorId: string; donationId?: string; campaignId?: string; communicationType: string; channel: string; subject: string; message: string }) =>
      post<{ status: string }>('/donations/messages', body),
    agreements: () => get<{ items: { id: string; donor: string; campaign: string; amount: number; currency: string; purpose: string; status: string; startDate: string | null; endDate: string | null }[] }>('/donations/agreements'),
    saveAgreement: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/donations/agreements', body),
    impacts: () => get<{ items: { id: string; donationId: string | null; campaign: string; beneficiary: string; reportingPeriod: string; amountUsed: number; currency: string; beneficiaryCount: number; outputs: string; outcomes: string }[] }>('/donations/impacts'),
    saveImpact: (body: Record<string, unknown>) => post<{ id: string }>('/donations/impacts', body),
    donors: (query?: { q?: string; status?: string; donorType?: string }) => get<{ items: DonorRow[] }>('/donations/donors', query),
    donor: (id: string) => get<DonorFile>(`/donations/donors/${encodeURIComponent(id)}`),
    saveDonor: (body: Record<string, unknown>) => post<DonorFile>('/donations/donors', body),
    updateDonor: (id: string, body: Record<string, unknown>) => patch<DonorFile>(`/donations/donors/${encodeURIComponent(id)}`, body),
    verifyDonor: (id: string, body: Record<string, unknown>) => post<DonorFile>(`/donations/donors/${encodeURIComponent(id)}/verification`, body),
    campaigns: (query?: { q?: string; status?: string }) => get<{ items: CampaignRow[] }>('/donations/campaigns', query),
    campaign: (id: string) => get<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}`),
    saveCampaign: (body: Record<string, unknown>) => post<CampaignFile>('/donations/campaigns', body),
    updateCampaign: (id: string, body: Record<string, unknown>) => patch<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}`, body),
    decideCampaign: (id: string, body: { decision: string; comments?: string }) => post<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}/approval`, body),
    campaignStatus: (id: string, status: string) => post<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}/status`, { status }),
    saveBudget: (id: string, body: Record<string, unknown>) => post<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}/budget`, body),
    saveMonitoring: (id: string, body: Record<string, unknown>) => post<CampaignFile>(`/donations/campaigns/${encodeURIComponent(id)}/monitoring`, body),
    pledges: (query?: { q?: string; status?: string }) => get<{ items: PledgeRow[] }>('/donations/pledges', query),
    savePledge: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/donations/pledges', body),
    pledgeStatus: (id: string, status: string) => post<{ id: string; status: string }>(`/donations/pledges/${encodeURIComponent(id)}/status`, { status }),
    beneficiaries: (query?: { q?: string; status?: string; beneficiaryType?: string }) => get<{ items: BeneficiaryFile[] }>('/donations/beneficiaries', query),
    beneficiary: (id: string) => get<BeneficiaryFile>(`/donations/beneficiaries/${encodeURIComponent(id)}`),
    saveBeneficiary: (body: Record<string, unknown>) => post<BeneficiaryFile>('/donations/beneficiaries', body),
    updateBeneficiary: (id: string, body: Record<string, unknown>) => patch<BeneficiaryFile>(`/donations/beneficiaries/${encodeURIComponent(id)}`, body),
    verifyBeneficiary: (id: string, body: Record<string, unknown>) => post<BeneficiaryFile>(`/donations/beneficiaries/${encodeURIComponent(id)}/verification`, body),
    allocations: (query?: { q?: string; status?: string }) => get<{ items: AllocationRow[] }>('/donations/allocations', query),
    saveAllocation: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/donations/allocations', body),
    decideAllocation: (id: string, body: { decision: string; comments?: string }) => post<{ id: string; status: string }>(`/donations/allocations/${encodeURIComponent(id)}/approval`, body),
    disburse: (id: string, body: Record<string, unknown>) => post<{ id: string; status: string; reference: string | null }>(`/donations/allocations/${encodeURIComponent(id)}/disbursement`, body),
    distribute: (id: string, body: Record<string, unknown>) => post<{ id: string; status: string }>(`/donations/allocations/${encodeURIComponent(id)}/distribution`, body),
    distributions: () => get<{ items: { id: string; allocationId: string; donationId: string; beneficiary: string; amount: number | null; method: string; date: string | null; officer: string; confirmed: boolean; status: string }[] }>('/donations/distributions'),
    gifts: (query?: { q?: string; status?: string; donationType?: string; queue?: string }) => get<{ items: GiftRow[] }>('/donations', query),
    gift: (id: string) => get<GiftFile>(`/donations/${encodeURIComponent(id)}`),
    saveGift: (body: Record<string, unknown>) => post<GiftFile>('/donations', body),
    verifyGift: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/verification`, body),
    saveValuation: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/valuation`, body),
    receiveGift: (id: string) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/receive`),
    payGift: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/payments`, body),
    confirmGift: (id: string, paymentId: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/confirmation`, body),
    decideGift: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/approval`, body),
    releaseGift: (id: string) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/release`),
    cancelGift: (id: string, reason?: string) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/cancel`, { reason }),
    closeGift: (id: string) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/close`),
    sendReceipt: (id: string, channel: 'EMAIL' | 'SMS') => post<GiftFile>(`/donations/${encodeURIComponent(id)}/receipt/send`, { channel }),
    refund: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/refunds`, body),
    advanceRefund: (id: string, refundId: string, action: string) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/refunds/${encodeURIComponent(refundId)}`, { action }),
    adjust: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/adjustments`, body),
    compliance: (id: string, body: Record<string, unknown>) => post<GiftFile>(`/donations/${encodeURIComponent(id)}/compliance`, body),
  },
  investments: {
    summary: () => get<Record<string, number>>('/investments/summary'),
    members: () => get<{ items: { id: string; source: string; name: string; number: string; telephone: string; email: string | null }[] }>('/investments/members'),
    opportunities: (query?: { status?: string; q?: string }) => get<{ items: Record<string, string | number | null>[] }>('/investments/opportunities', query),
    opportunity: (id: string) => get<Record<string, unknown>>(`/investments/opportunities/${encodeURIComponent(id)}`),
    saveOpportunity: (body: Record<string, unknown>) => post<Record<string, unknown>>('/investments/opportunities', body),
    opportunityStatus: (id: string, status: string) => post<Record<string, unknown>>(`/investments/opportunities/${encodeURIComponent(id)}/status`, { status }),
    saveFee: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/opportunities/${encodeURIComponent(id)}/fees`, body),
    dividend: (id: string, body: Record<string, unknown>) => post<{ holders: number; total: number }>(`/investments/opportunities/${encodeURIComponent(id)}/dividends`, body),
    applications: (query?: { status?: string }) => get<{ items: Record<string, string | number | null>[] }>('/investments/applications', query),
    application: (id: string) => get<Record<string, unknown>>(`/investments/applications/${encodeURIComponent(id)}`),
    saveApplication: (body: Record<string, unknown>) => post<Record<string, unknown>>('/investments/applications', body),
    eligibility: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/applications/${encodeURIComponent(id)}/eligibility`, body),
    diligence: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/applications/${encodeURIComponent(id)}/diligence`, body),
    risk: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/applications/${encodeURIComponent(id)}/risk`, body),
    approveApplication: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/applications/${encodeURIComponent(id)}/approval`, body),
    positions: (query?: { status?: string; q?: string }) => get<{ items: Record<string, string | number | null>[] }>('/investments/positions', query),
    position: (id: string) => get<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}`),
    portfolio: (memberId: string, memberSource?: string) => get<Record<string, unknown>>('/investments/portfolio', { memberId, memberSource }),
    acceptAgreement: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/agreement`, body),
    contribute: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/payments`, body),
    confirmContribution: (id: string, paymentId: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/confirmation`, body),
    recordReturn: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/returns`, body),
    approveReturn: (id: string, payoutId: string) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/returns/${encodeURIComponent(payoutId)}/approval`, {}),
    requestExit: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/exits`, body),
    decideExit: (id: string, exitId: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/exits/${encodeURIComponent(exitId)}/decision`, body),
    payExit: (id: string, exitId: string) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/exits/${encodeURIComponent(exitId)}/payment`, {}),
    transfer: (id: string, body: Record<string, unknown>) => post<{ id: string; status: string }>(`/investments/positions/${encodeURIComponent(id)}/transfers`, body),
    decideTransfer: (id: string, body: Record<string, unknown>) => post<{ id: string; status: string }>(`/investments/transfers/${encodeURIComponent(id)}/decision`, body),
    maturity: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/maturity`, body),
    adjust: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/adjustments`, body),
    close: (id: string, body: Record<string, unknown>) => post<Record<string, unknown>>(`/investments/positions/${encodeURIComponent(id)}/close`, body),
    payouts: () => get<{ items: Record<string, string | number>[] }>('/investments/payouts'),
    exits: () => get<{ items: Record<string, string | number>[] }>('/investments/exits'),
    transfers: () => get<{ items: Record<string, string | number>[] }>('/investments/transfers'),
    statement: (query?: { memberId?: string; positionId?: string; from?: string; to?: string; entryType?: string }) => get<Record<string, unknown>>('/investments/statement', query),
    report: (type: string) => get<{ items: Record<string, string | number | null>[] }>(`/investments/reports/${encodeURIComponent(type)}`),
    messages: () => get<{ items: Record<string, string>[] }>('/investments/messages'),
    sendMessage: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/investments/messages', body),
    audit: () => get<{ items: Record<string, string | number | null>[] }>('/investments/audit'),
  },
  accounts: {
    summary: () => get<Record<string, number>>('/accounts/summary'),
    parties: (type: string) => get<{
      parties: { id: string; name: string; phone: string | null; email: string | null; number: string | null; detail: string | null }[]
      schools: { id: string; name: string; number: string }[]
      students: { id: string; name: string; number: string | null }[]
    }>('/accounts/parties', { type }),
    list: (query?: { status?: string; accountType?: string; q?: string; queue?: string }) => get<{ items: AccountRow[] }>('/accounts', query),
    account: (id: string) => get<AccountFile>(`/accounts/${encodeURIComponent(id)}`),
    save: (body: Record<string, unknown>) => post<AccountFile>('/accounts', body),
    update: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}`, body),
    documents: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/documents`, body),
    kyc: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/kyc`, body),
    contacts: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/contacts`, body),
    duplicates: (id: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/duplicates`),
    clearDuplicate: (id: string, note: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/duplicates/clear`, { note }),
    linkParty: (id: string, partyId: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/party`, { partyId }),
    risk: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/risk`, body),
    decision: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/decision`, body),
    activate: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/activation`, body),
    suspend: (id: string, reason: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/suspension`, { reason }),
    reactivate: (id: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/reactivation`),
    dormant: (id: string, reason?: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/dormancy`, { reason }),
    hold: (id: string, body: { active: boolean; reason?: string }) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/hold`, body),
    close: (id: string, reason: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/closure`, { reason }),
    change: (id: string, body: { field: string; value: string; reason: string }) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/changes`, body),
    device: (id: string, name: string) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/devices`, { name }),
    linkStudent: (id: string, body: Record<string, unknown>) => post<AccountFile>(`/accounts/${encodeURIComponent(id)}/students`, body),
    statement: (id: string) => get<AccountStatement>(`/accounts/${encodeURIComponent(id)}/statement`),
    report: (type: string) => get<{ items: AccountRow[] }>(`/accounts/reports/${encodeURIComponent(type)}`),
    messages: () => get<{ items: Record<string, string>[] }>('/accounts/messages'),
    sendMessage: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/accounts/messages', body),
    audit: () => get<{ items: Record<string, string | null>[] }>('/accounts/audit'),
  },
  literacy: {
    summary: () => get<LiteracySummary>('/literacy/summary'),
    parties: (type: string) => get<{ parties: { id: string; name: string; phone: string | null; email: string | null; detail: string | null }[] }>('/literacy/parties', { type }),
    curriculum: () => post<ProgrammeRow>('/literacy/curriculum'),
    programmes: () => get<{ items: ProgrammeRow[] }>('/literacy/programmes'),
    saveProgramme: (body: Record<string, unknown>) => post<ProgrammeRow>('/literacy/programmes', body),
    programmeStatus: (id: string, status: string) => post<ProgrammeRow>(`/literacy/programmes/${encodeURIComponent(id)}/status`, { status }),
    courses: () => get<{ items: CourseRow[] }>('/literacy/courses'),
    course: (id: string) => get<CourseRow>(`/literacy/courses/${encodeURIComponent(id)}`),
    saveCourse: (body: Record<string, unknown>) => post<CourseRow>('/literacy/courses', body),
    courseStatus: (id: string, status: string) => post<CourseRow>(`/literacy/courses/${encodeURIComponent(id)}/status`, { status }),
    publishCourse: (id: string) => post<CourseRow>(`/literacy/courses/${encodeURIComponent(id)}/publish`, {}),
    study: (learnerId?: string) => get<StudyDesk>('/literacy/study', learnerId ? { learnerId } : undefined),
    enterStudy: (partyId?: string) => post<StudyDesk>('/literacy/study/enter', partyId ? { partyId } : {}),
    studyEnrol: (body: { learnerId: string; courseId: string }) => post<StudyDesk>('/literacy/study/enrol', body),
    completeModule: (enrollmentId: string, moduleIndex: number) => post<StudyDesk>(`/literacy/study/enrollments/${encodeURIComponent(enrollmentId)}/modules`, { moduleIndex }),
    publicCourses: () => get<{ courses: PublicCourse[] }>('/literacy/public/courses'),
    publicJoin: (body: { name: string; phone: string; email?: string; language: string }) => post<PublicTraining>('/literacy/public/join', body),
    publicContinue: (phone: string) => post<PublicTraining>('/literacy/public/continue', { phone }),
    publicEnrol: (body: { learnerId: string; phone: string; courseId: string }) => post<PublicTraining>('/literacy/public/enrol', body),
    publicComplete: (body: { learnerId: string; phone: string; enrollmentId: string; moduleIndex: number }) => post<PublicTraining>('/literacy/public/modules', body),
    publicQuiz: (body: { learnerId: string; phone: string; enrollmentId: string; answers: { id: string; choice?: string; value?: boolean; matches?: string[] }[] }) => post<PublicTraining>('/literacy/public/quiz', body),
    studyQuiz: (enrollmentId: string, answers: { id: string; choice?: string; value?: boolean; matches?: string[] }[]) => post<StudyDesk>(`/literacy/study/enrollments/${encodeURIComponent(enrollmentId)}/quiz`, { answers }),
    learners: (query?: { learnerType?: string; status?: string; q?: string }) => get<{ items: LearnerRow[] }>('/literacy/learners', query),
    learner: (id: string) => get<LearnerFile>(`/literacy/learners/${encodeURIComponent(id)}`),
    saveLearner: (body: Record<string, unknown>) => post<LearnerFile>('/literacy/learners', body),
    enrol: (body: Record<string, unknown>) => post<LearnerFile>('/literacy/enrollments', body),
    assess: (id: string, body: Record<string, unknown>) => post<{ id: string; result: string; percentage: number; learnerId: string }>(`/literacy/enrollments/${encodeURIComponent(id)}/assessments`, body),
    exercise: (id: string, body: Record<string, unknown>) => post<Record<string, string | number>>(`/literacy/enrollments/${encodeURIComponent(id)}/exercises`, body),
    certificate: (id: string, body?: Record<string, unknown>) => post<LearnerFile>(`/literacy/enrollments/${encodeURIComponent(id)}/certificate`, body ?? {}),
    certificates: () => get<{ items: Record<string, string | number | null>[] }>('/literacy/certificates'),
    trainers: () => get<{ items: { id: string; name: string; organization: string; status: string }[] }>('/literacy/trainers'),
    saveTrainer: (body: Record<string, unknown>) => post<{ id: string }>('/literacy/trainers', body),
    approveTrainer: (id: string) => post<{ id: string }>(`/literacy/trainers/${encodeURIComponent(id)}/approval`),
    sessions: () => get<{ items: { id: string; courseName: string; moduleTitle: string; sessionDate: string | null; status: string; attendance: number }[] }>('/literacy/sessions'),
    saveSession: (body: Record<string, unknown>) => post<{ id: string }>('/literacy/sessions', body),
    attendance: (id: string, body: Record<string, unknown>) => post<{ id: string }>(`/literacy/sessions/${encodeURIComponent(id)}/attendance`, body),
    simulate: (kind: string, input: Record<string, number>) => post<Record<string, string | number>>('/literacy/simulate', { kind, input }),
    evidence: (body: Record<string, unknown>) => post<{ id: string; confirmed: boolean }>('/literacy/evidence', body),
    goal: (body: Record<string, unknown>) => post<{ id: string }>('/literacy/goals', body),
    health: (body: Record<string, unknown>) => post<{ id: string; recommendation: string; budgetStatus: string; resilience: string }>('/literacy/health', body),
    fraud: (body: Record<string, unknown>) => post<{ id: string; status: string }>('/literacy/fraud', body),
    retraining: () => get<{ items: { id: string; learnerName: string; previousCourse: string; modules: string; status: string; reason: string }[] }>('/literacy/retraining'),
    assignRetraining: (id: string, body: Record<string, unknown>) => post<{ id: string }>(`/literacy/retraining/${encodeURIComponent(id)}`, body),
    report: (type: string) => get<{ items: Record<string, unknown>[] }>(`/literacy/reports/${encodeURIComponent(type)}`),
    messages: () => get<{ items: Record<string, string | null>[] }>('/literacy/messages'),
    sendMessage: (body: Record<string, unknown>) => post<{ id: string }>('/literacy/messages', body),
    audit: () => get<{ items: Record<string, string | null>[] }>('/literacy/audit'),
  },
}

export type SchoolApplicationStatus = {
  schoolId: string
  schoolName: string
  email: string
  status: string
  reviewStatus: string
  membershipStatus: string
  membershipReference: string | null
  kybStatus: string
}

export type MembershipVerification = {
  verified: boolean
  applicationId?: string
  schoolName?: string
  location?: string
  reviewedAt?: string | null
  reviewerName?: string
  reviewerTitle?: string
  membershipNumber?: string | null
  status?: string
}

export type MembershipStatus = {
  applicationId: string
  schoolName: string
  email: string
  status: string
  contactName: string
  title: string
  location: string
  reviewedAt: string | null
  reviewerName: string | null
  reviewerTitle: string | null
  verifyUrl: string | null
}

export type MembershipApplicationRow = {
  applicationId: string
  memberId?: string | null
  schoolName: string
  registrationNumber: string | null
  categoryCode?: string | null
  institutionType?: string | null
  contactName: string
  title: string
  phone: string
  email: string
  website?: string | null
  registrationCertificateNumber?: string | null
  taxIdentificationNumber?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  representativePhone?: string | null
  representativeEmail?: string | null
  address: { province: string; district: string; sector?: string | null; cell?: string | null; physicalAddress?: string | null }
  message: string | null
  documents?: { documentId: string; documentType: string; fileName: string; hasFile: boolean }[]
  payment?: { amount: number; currency: string; method: string | null; reference: string | null; externalTransactionId: string | null; status: string } | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  reviewerName: string | null
  reviewerTitle: string | null
  verifyUrl: string | null
  createdAt: string
}

export type SchoolChecklist = {
  registrationVerified: boolean
  legalDocumentsVerified: boolean
  representativeVerified: boolean
  addressVerified: boolean
  bankAccountVerified: boolean
  documentsComplete: boolean
}

export type SchoolRow = {
  schoolId: string
  schoolName: string
  rupsaMemberId: string | null
  registrationNumber?: string
  schoolType?: string | null
  ownershipType?: string | null
  dateEstablished?: string | null
  operatingStatus?: string | null
  studentCount?: number | null
  teacherCount?: number | null
  staffCount?: number | null
  taxIdentificationNumber?: string | null
  registrationCertificateNumber?: string | null
  registrationDate?: string | null
  registrationAuthority?: string | null
  licenseNumber?: string | null
  licenseExpiryDate?: string | null
  legalStatus?: string | null
  phone?: string
  alternativePhone?: string | null
  website?: string | null
  emergencyContact?: string | null
  status: string
  kybStatus: string
  membershipStatus?: string
  reviewStatus?: string
  checklist?: SchoolChecklist
  email: string
  address: {
    province: string
    district: string
    sector?: string | null
    cell?: string | null
    village?: string | null
    physicalAddress?: string | null
    gpsCoordinates?: string | null
    postalAddress?: string | null
  }
}

export type SchoolOwner = {
  id: string
  ownerName: string
  ownershipPct: number
  nationalId: string | null
}

export type SchoolPerson = {
  id: string
  representativeId?: string | null
  fullName: string
  title: string
  nationalId?: string | null
  phone: string | null
  email: string | null
  appointmentDate?: string | null
  role: string
}

export type SchoolBank = {
  id: string
  bankName: string
  branch?: string | null
  accountName: string
  accountNumber: string
  currency: string
  swiftCode?: string | null
  isPrimary: boolean
  accountVerified?: boolean
  verifiedBy?: string | null
  verificationDate?: string | null
}

export type SchoolDocument = {
  id: string
  documentType: string
  fileName: string
  status: string
  uploadedAt?: string
  viewable?: boolean
}

export type UploadedDocument = {
  id: string
  schoolId: string
  schoolName: string
  documentType: string
  fileName: string
  status: string
  uploadedAt: string
  viewable: boolean
}

export type SchoolKyc = {
  id: string
  kind: string
  status: string
  notes: string | null
  createdAt: string
}

export type SchoolRegistration = {
  school: SchoolRow
  workflow: { current: string; next: string[] }
  ownership: SchoolOwner[]
  management: SchoolPerson[]
  signatories: SchoolPerson[]
  bankAccounts: SchoolBank[]
  documents: SchoolDocument[]
  kyc: SchoolKyc[]
}

export type StudentRow = {
  studentId: string
  schoolId: string
  studentName: string
  studentExternalId: string
  classLevel: string
  academicYear: string
  feeCategory?: string | null
  status: string
}

export type StudentGuardianInput = {
  fullName?: string
  phone?: string
  email?: string
  nationalId?: string
  relationship: string
  primary?: boolean
  emergencyContact?: boolean
  financialResponsibility?: boolean
  communicationAuthorization?: boolean
  paymentAuthorization?: boolean
}

export type StudentDocumentInput = {
  documentType: string
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  fileName: string
  uploadId?: string
}

export type StudentRegistrationInput = {
  schoolId: string
  studentExternalId: string
  studentName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  dateOfBirth?: string
  gender?: 'FEMALE' | 'MALE'
  nationality?: string
  photoUploadId?: string
  previousSchool?: string
  admissionDate?: string
  academicYear: string
  classLevel: string
  stream?: string
  grade?: string
  status?: string
  feeCategory?: string
  address?: {
    province?: string
    district?: string
    sector?: string
    cell?: string
    village?: string
    physicalAddress?: string
    telephone?: string
    emergencyContact?: string
  }
  guardians?: StudentGuardianInput[]
  documents?: Array<{
    documentType: string
    documentNumber?: string
    issueDate?: string
    expiryDate?: string
    fileName: string
    uploadId?: string
  }>
  financial?: {
    feeStructure?: string
    scholarship?: string
    discount?: number
    paymentPlan?: string
  }
}

export type StudentFile = StudentRow & {
  schoolName: string
  firstName: string | null
  middleName: string | null
  lastName: string | null
  dateOfBirth: string | null
  gender: string | null
  nationality: string | null
  hasPhoto: boolean
  previousSchool: string | null
  admissionDate: string | null
  stream: string | null
  grade: string | null
  address: {
    province: string | null
    district: string | null
    sector: string | null
    cell: string | null
    village: string | null
    physicalAddress: string | null
    telephone: string | null
    emergencyContact: string | null
  }
  guardians: Array<StudentGuardianInput & { guardianId: string; fullName: string }>
  documents: Array<{
    documentId: string
    documentType: string
    documentNumber: string | null
    issueDate: string | null
    expiryDate: string | null
    fileName: string
    verificationStatus: string
  }>
  financial: {
    invoiceAccount: string
    currency: string
    feeCategory: string | null
    academicYear: string
    feeStructure: string | null
    scholarship: string | null
    discount: number | null
    paymentPlan: string | null
    outstandingBalance: number
    ledger: string
  }
}

export type InvoiceRow = {
  invoiceId: string
  studentId: string
  amount: number
  amountPaid: number
  balance: number
  currency: string
  status: string
  description: string
  dueDate: string
}

export type PaymentRailRow = {
  code: string
  name: string
  kind: string
  country: string
  infrastructure: string
  institutionName: string
  status: string
}

export type CorridorRow = {
  code: string
  originCountry: string
  destinationCountry: string
  originInfrastructure: string
  destinationInfrastructure: string
  originLabel: string
  destinationLabel: string
  status: string
}

export type PaymentFlowStep = {
  code: string
  label: string
  status: string
  detail: string | null
  createdAt: string
}

export type BusEvent = {
  event: string
  aggregateId: string
  createdAt: string
}

export type PaymentRow = {
  paymentId: string
  status: string
  amount: number
  currency: string
  paymentChannel?: string
  settlementReference: string | null
  transactionReference?: string | null
  originCountry?: string
  destinationCountry?: string
  flowCode?: string
  instructionRef?: string | null
  retryCount?: number
  lastError?: string | null
  rail?: PaymentRailRow | null
  corridor?: CorridorRow | null
  flow?: PaymentFlowStep[]
}

export type FinancialSummary = {
  studentId: string
  totalBilled: number
  totalPaid: number
  outstanding: number
  currency: string
}

export type FinancialProfile = {
  schoolId: string
  profileStatus: string
  studentCount: number
  averageMonthlyCollections: number
  collectionRate: number
  existingLoanExposure: number
  dataAsOf: string
}

export type LoanApplicationRow = {
  applicationId: string
  schoolId: string
  financialInstitutionId: string
  productCode: string
  requestedAmount: number
  currency: string
  tenorMonths: number
  status: string
  decision: string | null
  loanId: string | null
  createdAt: string
}

export type LoanRow = {
  loanId: string
  status: string
  principal: number
  principalOutstanding: number
  currency: string
}

export type LoanBalance = {
  loanId: string
  principalOutstanding: number
  interestOutstanding: number
  feesOutstanding: number
  totalOutstanding: number
  currency: string
}

export type GuaranteeRow = {
  guaranteeId: string
  schoolId: string
  financialInstitutionId: string
  loanAmount: number
  guaranteeAmount: number
  guaranteedAmount: number | null
  currency: string
  status: string
  expiryDate: string | null
}

export type FacilityRow = {
  facilityName?: string
  maximumExposure: number
  availableCapacity: number
  outstandingGuarantees: number
  claims: number
  currency: string
}

export type InstitutionRow = {
  financialInstitutionId: string
  name: string
  type: string
  status: string
}

export type RegistrationSummary = {
  users: number
  schools: number
  parents: number
  students: number
  teachers: number
  suppliers: number
  investors: number
  donors: number
  pending: number
  pendingVerification: number
  approved: number
  rejected: number
  suspended: number
}

export type RegistryRow = {
  id: string
  kind: string
  name: string
  reference: string | null
  phone: string | null
  email: string | null
  status: string
  createdAt: string
  href: string | null
}

export type RegistrationChecklist = {
  identityVerified: boolean
  documentsVerified: boolean
  contactVerified: boolean
  addressVerified: boolean
  financialVerified: boolean
  consentCaptured: boolean
  duplicateChecked: boolean
}

export type RegistrationDocumentInput = {
  documentType: string
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  issuingAuthority?: string
  fileName: string
  uploadId?: string
  comments?: string
}

export type RegistrationFile = {
  registrationId: string
  kind: string
  status: string
  displayName: string
  referenceCode: string | null
  email: string | null
  phone: string | null
  alternativePhone: string | null
  website: string | null
  address: {
    province: string | null
    district: string | null
    sector: string | null
    cell: string | null
    village: string | null
    physicalAddress: string | null
    postalAddress: string | null
  }
  schoolId: string | null
  schoolName: string | null
  guardianId: string | null
  profile: Record<string, string | boolean | null>
  checklist: RegistrationChecklist
  decision: string | null
  approvedBy: string | null
  approvalDate: string | null
  conditions: string | null
  comments: string | null
  documents: Array<{
    id: string
    documentType: string
    documentNumber: string | null
    issueDate: string | null
    expiryDate: string | null
    issuingAuthority: string | null
    fileName: string
    hasFile: boolean
    verificationStatus: string
    comments: string | null
    uploadedAt: string
  }>
  events: Array<{
    id: string
    action: string
    previousStatus: string | null
    newStatus: string | null
    reason: string | null
    requestId: string | null
    createdAt: string
  }>
  createdAt: string
  updatedAt: string
}
