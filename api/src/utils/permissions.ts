import type { UserRole } from '@prisma/client';

export const PERMISSIONS = [
  'school.read',
  'school.write',
  'student.read',
  'student.write',
  'invoice.read',
  'invoice.write',
  'payment.read',
  'payment.write',
  'loan.read',
  'loan.write',
  'guarantee.read',
  'guarantee.write',
  'consent.read',
  'consent.write',
  'report.read',
  'donation.read',
  'donation.write',
  'investment.read',
  'investment.write',
  'account.read',
  'account.write',
  'literacy.read',
  'literacy.write',
  'admin.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SYSTEM_ADMINISTRATOR: ALL,
  RUPSA_USER: ALL,
  SCHOOL_USER: [
    'school.read',
    'school.write',
    'student.read',
    'student.write',
    'invoice.read',
    'invoice.write',
    'payment.read',
    'payment.write',
    'report.read',
    'consent.read',
    'consent.write',
    'loan.read',
    'guarantee.read',
    'donation.read',
    'donation.write',
    'investment.read',
    'investment.write',
    'account.read',
    'account.write',
    'literacy.read',
    'literacy.write',
  ],
  PARENT: [
    'student.read',
    'invoice.read',
    'payment.read',
    'payment.write',
    'consent.read',
    'consent.write',
    'literacy.read',
  ],
  BANK_USER: [
    'school.read',
    'loan.read',
    'loan.write',
    'guarantee.read',
    'consent.read',
    'report.read',
  ],
  MFI_USER: [
    'school.read',
    'loan.read',
    'loan.write',
    'guarantee.read',
    'consent.read',
    'report.read',
  ],
  PSP_USER: ['payment.read', 'payment.write', 'invoice.read', 'donation.read', 'donation.write', 'investment.read', 'investment.write', 'account.read', 'account.write', 'literacy.read', 'literacy.write'],
  AUDITOR: [
    'school.read',
    'student.read',
    'invoice.read',
    'payment.read',
    'loan.read',
    'guarantee.read',
    'consent.read',
    'report.read',
    'donation.read',
    'investment.read',
    'account.read',
    'literacy.read',
  ],
};

export function rolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
