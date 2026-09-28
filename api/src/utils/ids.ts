import { prisma } from './prisma';

const PREFIXES = {
  USR: 'RUPSA-USR',
  SCH: 'RUPSA-SCH',
  STD: 'RUPSA-STD',
  GRD: 'RUPSA-GRD',
  INV: 'RUPSA-INV',
  PAY: 'RUPSA-PAY',
  RCT: 'RUPSA-RCT',
  SET: 'RUPSA-SET',
  REC: 'RUPSA-REC',
  LA: 'RUPSA-LA',
  LOAN: 'RUPSA-LOAN',
  REP: 'RUPSA-REP',
  DISB: 'RUPSA-DISB',
  ASSESS: 'ASSESS',
  GUA: 'RUPSA-GUA',
  CLM: 'RUPSA-CLM',
  CON: 'RUPSA-CON',
  KYC: 'RUPSA-KYC',
  NTF: 'RUPSA-NTF',
  MBA: 'RUPSA-MBA',
  FI: 'FI',
  REQ: 'REQ',
} as const;

export type IdKind = keyof typeof PREFIXES;

export async function nextPublicId(kind: IdKind): Promise<string> {
  const prefix = PREFIXES[kind];
  const row = await prisma.idSequence.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(row.value).padStart(6, '0')}`;
}

export function newRequestId(): string {
  return `REQ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}
