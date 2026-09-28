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
  if (init.method && init.method !== 'GET' && /payments|disbursement|repayments|guarantees|webhooks/.test(path)) {
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

export async function openSchoolDocument(schoolId: string, documentId: string) {
  const headers = new Headers()
  headers.set('Accept', '*/*')
  headers.set('X-Client-ID', 'rupsa-web')
  const token = storedAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(
    `/api/v1/schools/${encodeURIComponent(schoolId)}/documents/${encodeURIComponent(documentId)}/file`,
    { headers },
  )
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } }
    throw new ApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'This file could not be opened.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
      phone: string
      email: string
      address: { province: string; district: string; sector?: string }
      rupsaMemberId?: string
      taxIdentificationNumber?: string
      owners: { ownerName: string; ownershipPct: number; nationalId?: string }[]
      management: { fullName: string; title: string; phone?: string; email?: string }[]
      signatories: { fullName: string; title: string; phone?: string; email?: string }[]
      bankAccount: { bankName: string; accountName: string; accountNumber: string; currency?: string }
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
    submit: (body: {
      schoolName: string
      registrationNumber?: string
      contactName: string
      title: string
      phone: string
      email: string
      address: { province: string; district: string; sector?: string }
      message?: string
    }) => post<{ applicationId: string; schoolName: string; email: string; status: string; emailSent: boolean }>('/membership-applications', body),
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
  },
  students: {
    list: (schoolId?: string) => get<{ items: StudentRow[] }>('/students', { schoolId }),
    summary: (id: string) => get<FinancialSummary>(`/students/${id}/financial-summary`),
    create: (body: {
      schoolId: string
      studentExternalId: string
      studentName: string
      academicYear: string
      classLevel: string
      feeCategory?: string
    }) => post<StudentRow>('/students', body),
    update: (id: string, body: Partial<{
      studentName: string
      studentExternalId: string
      academicYear: string
      classLevel: string
      feeCategory: string
      status: string
    }>) => patch<StudentRow>(`/students/${id}`, body),
    remove: (id: string) => del<StudentRow>(`/students/${id}`),
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
  institutions: {
    list: () => get<{ items: InstitutionRow[] }>('/institutions'),
  },
}

export type SchoolApplicationStatus = {
  schoolId: string
  schoolName: string
  email: string
  status: string
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
  schoolName: string
  registrationNumber: string | null
  contactName: string
  title: string
  phone: string
  email: string
  address: { province: string; district: string; sector?: string | null }
  message: string | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  reviewerName: string | null
  reviewerTitle: string | null
  verifyUrl: string | null
  createdAt: string
}

export type SchoolRow = {
  schoolId: string
  schoolName: string
  rupsaMemberId: string | null
  registrationNumber?: string
  taxIdentificationNumber?: string | null
  phone?: string
  status: string
  kybStatus: string
  membershipStatus?: string
  email: string
  address: { province: string; district: string; sector?: string | null }
}

export type SchoolOwner = {
  id: string
  ownerName: string
  ownershipPct: number
  nationalId: string | null
}

export type SchoolPerson = {
  id: string
  fullName: string
  title: string
  phone: string | null
  email: string | null
  role: string
}

export type SchoolBank = {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  currency: string
  isPrimary: boolean
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
