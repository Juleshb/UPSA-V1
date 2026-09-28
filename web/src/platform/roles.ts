import type { GraphicName } from '../components/Graphics'
import type { Role } from './api'

export const ROLE_LABEL: Record<Role, string> = {
  SYSTEM_ADMINISTRATOR: 'Platform administrator',
  RUPSA_USER: 'UPSA officer',
  SCHOOL_USER: 'School finance officer',
  PARENT: 'Parent / guardian',
  BANK_USER: 'Bank credit officer',
  MFI_USER: 'MFI credit officer',
  PSP_USER: 'Payment operator',
  AUDITOR: 'Auditor',
}

export const ROLE_SHORT: Record<Role, string> = {
  SYSTEM_ADMINISTRATOR: 'Admin',
  RUPSA_USER: 'Officer',
  SCHOOL_USER: 'School',
  PARENT: 'Parent',
  BANK_USER: 'Bank',
  MFI_USER: 'MFI',
  PSP_USER: 'Payments',
  AUDITOR: 'Audit',
}

export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@rupsanext.rw', password: 'ChangeMe123!', role: 'SYSTEM_ADMINISTRATOR' as const, hint: 'Schools, credit book and guarantee facility' },
  { label: 'School', email: 'finance@example.rw', password: 'ChangeMe123!', role: 'SCHOOL_USER' as const, hint: 'Invoices, students and collections' },
  { label: 'Bank', email: 'credit@bank.rw', password: 'ChangeMe123!', role: 'BANK_USER' as const, hint: 'Loan pipeline and school profiles' },
  { label: 'Parent', email: 'parent@example.rw', password: 'ChangeMe123!', role: 'PARENT' as const, hint: 'Balances, receipts and payments' },
]

export type NavLink = {
  to: string
  label: string
  icon: GraphicName
  permission?: string
}

export const APP_NAV: NavLink[] = [
  { to: '/app', label: 'Home', icon: 'dash' },
  { to: '/app/schools', label: 'Schools', icon: 'school', permission: 'school.read' },
  { to: '/app/membership', label: 'Membership', icon: 'shield', permission: 'school.read' },
  { to: '/app/students', label: 'Students', icon: 'family', permission: 'student.read' },
  { to: '/app/invoices', label: 'Invoices', icon: 'ledger', permission: 'invoice.read' },
  { to: '/app/payments', label: 'Payments', icon: 'pay', permission: 'payment.read' },
  { to: '/app/loans', label: 'Financing', icon: 'loan', permission: 'loan.read' },
  { to: '/app/guarantees', label: 'Guarantees', icon: 'shield', permission: 'guarantee.read' },
  { to: '/app/reports', label: 'Reports', icon: 'report', permission: 'report.read' },
]

export function roleHome(role: Role) {
  switch (role) {
    case 'SCHOOL_USER':
      return {
        kicker: 'School workspace',
        title: 'Collections and the school ledger.',
        lead: 'Invoice families, watch outstanding balances and reconcile what has been received.',
      }
    case 'PARENT':
      return {
        kicker: 'Family workspace',
        title: 'Balances, plans and receipts.',
        lead: 'See what is owed and pay on an approved rail. The school ledger stays the record of truth.',
      }
    case 'BANK_USER':
    case 'MFI_USER':
      return {
        kicker: 'Institution workspace',
        title: 'Credit workflow and school signal.',
        lead: 'Review applications and guarantee cover. The licensed institution keeps the credit decision.',
      }
    case 'PSP_USER':
      return {
        kicker: 'Payments workspace',
        title: 'Rails, intents and reconciliation.',
        lead: 'Track payment orchestration without taking custody of school funds.',
      }
    case 'AUDITOR':
      return {
        kicker: 'Audit workspace',
        title: 'Read-only control view.',
        lead: 'Inspect collections, credit and guarantee exposure without changing records.',
      }
    default:
      return {
        kicker: 'UPSA workspace',
        title: 'The operating picture for member schools.',
        lead: 'Collections, financing and guarantee exposure across the UPSA Next Payment platform.',
      }
  }
}
