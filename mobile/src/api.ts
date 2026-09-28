import Constants from 'expo-constants'
import { Platform } from 'react-native'

export type Role = 'PARENT' | 'SCHOOL_USER' | 'RUPSA_USER' | 'BANK_USER' | 'MFI_USER' | 'PSP_USER' | 'AUDITOR' | 'SYSTEM_ADMINISTRATOR'

export type SessionUser = {
  userId: string
  email: string
  fullName: string
  role: Role
  permissions: string[]
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: SessionUser
}

export type FamilyInvoice = {
  invoiceId: string
  description: string
  amount: number
  amountPaid: number
  balance: number
  currency: string
  status: string
  dueDate: string
}

export type FamilyStudent = {
  studentId: string
  studentName: string
  classLevel: string
  academicYear: string
  feeCategory: string | null
  status: string
  schoolId: string
  schoolName: string
  currency: string
  totalBilled: number
  totalPaid: number
  outstanding: number
  invoices: FamilyInvoice[]
}

export type PaymentChannel = 'BANK' | 'PSP' | 'MOBILE_PAYMENT' | 'CARD'

export type FamilyPayment = {
  paymentId: string
  invoiceId: string
  studentId: string
  studentName: string
  schoolName: string
  description: string
  amount: number
  currency: string
  paymentChannel: PaymentChannel | 'OTHER'
  status: string
  flowCode: string | null
  railName: string | null
  railInfrastructure: string | null
  corridorLabel: string | null
  settlementReference: string | null
  createdAt: string
}

export type FamilyReceipt = {
  receiptId: string
  invoiceId: string
  paymentId: string | null
  studentId: string
  studentName: string
  schoolName: string
  description: string
  amount: number
  currency: string
  issuedAt: string
}

export type FamilyAuthorization = {
  consentId: string
  purpose: string
  scope: string[]
  status: string
  expiresAt: string
}

export type FamilyNotice = {
  notificationId: string
  channel: string
  subject: string
  body: string
  createdAt: string
  read: boolean
}

export type NoticeEvent =
  | { type: 'ready' }
  | { type: 'notice'; notice: FamilyNotice }
  | { type: 'read'; notificationIds: string[] }

export type StudentPreview = FamilyStudent & {
  studentReference: string
  schoolCode: string
  district: string
}

export type FamilySchool = {
  schoolId: string
  schoolName: string
  schoolCode?: string
  district: string
}

export type FamilyHome = {
  guardian: {
    guardianId: string
    fullName: string
    phone: string | null
    email: string | null
  } | null
  identity: {
    status: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | string
    nationalIdMask: string | null
    updatedAt: string | null
  }
  authorization: FamilyAuthorization | null
  preferences: {
    paymentChannel: PaymentChannel | null
    originCountry: string
    notifyChannel: string
  }
  schools: FamilySchool[]
  notifications: FamilyNotice[]
  childRecords: 'AVAILABLE' | 'WITHHELD'
  currency: string
  totalBilled: number
  totalPaid: number
  outstanding: number
  students: FamilyStudent[]
  payments: FamilyPayment[]
  receipts: FamilyReceipt[]
}

export type PaymentFlowStep = {
  code: string
  label: string
  status: string
  detail: string | null
  createdAt: string
}

export type PaymentResult = {
  paymentId: string
  status: string
  amount: number
  currency: string
  paymentChannel?: PaymentChannel
  settlementReference: string | null
  flowCode?: string
  instructionRef?: string | null
  lastError?: string | null
  rail?: {
    code: string
    name: string
    kind: string
    country: string
    infrastructure: string
    institutionName: string
    status: string
  } | null
  corridor?: {
    code: string
    originLabel: string
    destinationLabel: string
    status: string
  } | null
  flow?: PaymentFlowStep[]
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

let accessToken = ''
let refreshToken = ''
let onSession: ((session: AuthSession) => Promise<void> | void) | null = null

export function bindSession(handler: ((session: AuthSession) => Promise<void> | void) | null) {
  onSession = handler
}

export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshToken = refresh
}

export function clearTokens() {
  accessToken = ''
  refreshToken = ''
}

export function apiBase() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
  if (configured) return configured
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:4000`
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000'
  return 'http://localhost:4000'
}

function uuid() {
  const cryptoRef = globalThis.crypto
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

let refreshInFlight: Promise<boolean> | null = null

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Client-ID', 'rupsa-parent')
  headers.set('X-Request-ID', uuid())
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.method && init.method !== 'GET' && /payments|webhooks/.test(path)) {
    headers.set('Idempotency-Key', uuid())
  }

  let response: Response
  try {
    response = await fetch(`${apiBase()}/api/v1${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'NETWORK', 'The UPSA Next Payment API is not reachable. Start it with npm run dev:api.')
  }

  const payload = await response.json().catch(() => ({}))
  if (response.status === 401 && retry && refreshToken && path !== '/auth/refresh') {
    const refreshed = await refreshSession()
    if (refreshed) return request<T>(path, init, false)
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } }).error
    throw new ApiError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? 'The request failed.')
  }
  return payload as T
}

async function refreshSession() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    if (!refreshToken) return false
    try {
      const session = await request<AuthSession>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false)
      setTokens(session.accessToken, session.refreshToken)
      await onSession?.(session)
      return true
    } catch {
      clearTokens()
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export const api = {
  login(email: string, password: string) {
    return post<AuthSession>('/auth/login', { email, password })
  },
  register(body: {
    email: string
    password: string
    fullName: string
    phone?: string
    nationalId?: string
    parentalConsent: boolean
  }) {
    return post<AuthSession>('/auth/register', body)
  },
  family() {
    return request<FamilyHome>('/family')
  },
  parent: {
    schools() {
      return request<{ items: FamilySchool[] }>('/family/schools')
    },
    notices() {
      return request<{ items: FamilyNotice[] }>('/family/notifications')
    },
    markNoticesRead(notificationIds: string[]) {
      return post<{ items: FamilyNotice[] }>('/family/notifications/read', { notificationIds })
    },
    async watchNotices(onEvent: (event: NoticeEvent) => void, signal: AbortSignal) {
      const open = () => fetch(`${apiBase()}/api/v1/family/notifications/stream`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${accessToken}`,
          'X-Client-ID': 'rupsa-parent',
        },
        signal,
      })
      let response = await open()
      if (response.status === 401 && refreshToken) {
        const refreshed = await refreshSession()
        if (refreshed) response = await open()
      }
      if (!response.ok || !response.body) {
        throw new ApiError(response.status, 'STREAM_FAILED', 'Notices could not be watched.')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!signal.aborted) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((item) => item.startsWith('data:'))
          if (!line) continue
          onEvent(JSON.parse(line.slice(5).trim()) as NoticeEvent)
        }
      }
    },
    updateContact(body: { phone?: string; email?: string }) {
      return request('/family/contact', { method: 'PATCH', body: JSON.stringify(body) })
    },
    submitIdentity(nationalId: string) {
      return post('/family/identity', { nationalId })
    },
    lookupStudent(schoolId: string, reference: string) {
      const params = new URLSearchParams({ schoolId, reference })
      return request<StudentPreview>(`/family/students/lookup?${params}`)
    },
    linkStudent(body: { schoolId: string; studentReference: string; studentName: string; relationship: string }) {
      return post<{ studentId: string; studentName: string; schoolName: string }>('/family/students', body)
    },
    updatePreferences(body: { paymentChannel?: string; originCountry?: string; notifyChannel?: string }) {
      return request('/family/preferences', { method: 'PATCH', body: JSON.stringify(body) })
    },
    grantAuthorization() {
      return post('/family/authorization', { accepted: true })
    },
    withdrawAuthorization() {
      return post('/family/authorization/withdraw')
    },
  },
  payments: {
    initiate(body: {
      invoiceId: string
      amount: number
      paymentChannel: PaymentChannel
      payerReference?: string
      originCountry: string
      destinationCountry: string
    }) {
      return post<PaymentResult>('/payments', { ...body, currency: 'RWF' })
    },
    retry(paymentId: string) {
      return post<PaymentResult>(`/payments/${paymentId}/retry`)
    },
    confirm(body: { paymentId: string; invoiceId: string; amount: number }) {
      return post<PaymentResult>('/webhooks/payment', {
        event: 'PAYMENT.SUCCESS',
        eventId: `EVT-${uuid()}`,
        paymentId: body.paymentId,
        invoiceId: body.invoiceId,
        amount: body.amount,
        currency: 'RWF',
        transactionReference: `SANDBOX-${body.paymentId.slice(-6)}`,
        timestamp: new Date().toISOString(),
      })
    },
    settle(body: { paymentId: string; invoiceId: string; amount: number }) {
      return post<PaymentResult>('/webhooks/payment', {
        event: 'SETTLEMENT.COMPLETED',
        eventId: `EVT-${uuid()}`,
        paymentId: body.paymentId,
        invoiceId: body.invoiceId,
        amount: body.amount,
        currency: 'RWF',
        transactionReference: `SET-${body.paymentId.slice(-6)}`,
        timestamp: new Date().toISOString(),
      })
    },
  },
}
