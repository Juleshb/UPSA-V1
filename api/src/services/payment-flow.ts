import { PaymentChannel, PaymentInfrastructure, type EacCorridor, type PaymentRail, type Prisma } from '@prisma/client';
import { errors } from '../utils/errors';
import { prisma } from '../utils/prisma';

export const MAX_PAYMENT_RETRIES = 3;

export const FLOW = {
  PAY_01: { code: 'PAY-01', label: 'Payment Request' },
  PAY_02: { code: 'PAY-02', label: 'Instruction' },
  PAY_03: { code: 'PAY-03', label: 'Confirmation' },
  PAY_04: { code: 'PAY-04', label: 'Receipt' },
  PAY_05: { code: 'PAY-05', label: 'Reconciliation' },
  PAY_06: { code: 'PAY-06', label: 'Refund' },
  PAY_07: { code: 'PAY-07', label: 'Reversal' },
  PAY_08: { code: 'PAY-08', label: 'Settlement' },
  PAY_16: { code: 'PAY-16', label: 'EAC Payment' },
} as const;

export type FlowStep = (typeof FLOW)[keyof typeof FLOW];

export const BUS_EVENTS = [
  'PAYMENT.INITIATED',
  'PAYMENT.SUCCESS',
  'PAYMENT.FAILED',
  'PAYMENT.REFUNDED',
  'SETTLEMENT.COMPLETED',
] as const;

export const paymentGraph = {
  rail: true,
  corridor: true,
  flowSteps: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

const KIND_BY_CHANNEL: Partial<Record<PaymentChannel, PaymentRail['kind']>> = {
  BANK: 'BANK',
  PSP: 'PSP',
  MOBILE_PAYMENT: 'MOBILE_MONEY',
  CARD: 'CARD',
};

export function kindForChannel(channel: PaymentChannel): PaymentRail['kind'] {
  const kind = KIND_BY_CHANNEL[channel];
  if (!kind) {
    throw errors.unprocessable(
      'CHANNEL_NOT_APPROVED',
      'Choose an approved rail: bank, PSP, mobile money, or card.',
    );
  }
  return kind;
}

export async function routeInstruction(input: {
  channel: PaymentChannel;
  originCountry: string;
  destinationCountry: string;
  excludeRailIds?: string[];
}) {
  const origin = input.originCountry.toUpperCase();
  const destination = input.destinationCountry.toUpperCase();
  const kind = kindForChannel(input.channel);
  const corridor = origin === destination ? null : await findCorridor(origin, destination);

  const rails = await prisma.paymentRail.findMany({
    where: {
      country: origin,
      kind,
      status: 'APPROVED',
      ...(input.excludeRailIds?.length ? { id: { notIn: input.excludeRailIds } } : {}),
    },
    orderBy: [{ priority: 'asc' }, { code: 'asc' }],
  });

  const rail = rails[0];
  if (!rail) {
    const label = kind.toLowerCase().replace('_', ' ');
    throw errors.unprocessable(
      input.excludeRailIds?.length ? 'NO_ALTERNATE_RAIL' : 'NO_APPROVED_RAIL',
      input.excludeRailIds?.length
        ? `No alternate ${label} rail is available in ${origin}.`
        : `No approved ${label} rail is available in ${origin}.`,
    );
  }

  return { rail, corridor, switched: Boolean(input.excludeRailIds?.length) };
}

async function findCorridor(origin: string, destination: string) {
  const corridor = await prisma.eacCorridor.findFirst({
    where: {
      OR: [
        { originCountry: origin, destinationCountry: destination },
        { originCountry: destination, destinationCountry: origin },
      ],
    },
  });
  if (!corridor) {
    throw errors.unprocessable('CORRIDOR_UNAVAILABLE', 'No EAC payment corridor connects these countries.');
  }
  if (corridor.status === 'PLANNED') {
    throw errors.unprocessable(
      'CORRIDOR_NOT_LIVE',
      `${corridor.originLabel} ↔ ${corridor.destinationLabel} is planned and is not yet open for payment.`,
    );
  }
  return corridor;
}

export async function recordFlow(
  tx: Prisma.TransactionClient,
  paymentId: string,
  step: FlowStep,
  detail?: string,
) {
  await tx.paymentFlowStep.create({
    data: {
      paymentId,
      code: step.code,
      label: step.label,
      status: 'RECORDED',
      detail,
    },
  });
  await tx.payment.update({
    where: { id: paymentId },
    data: { flowCode: step.code },
  });
}

export function serializeRail(rail: PaymentRail | null) {
  if (!rail) return null;
  return {
    code: rail.code,
    name: rail.name,
    kind: rail.kind,
    country: rail.country,
    infrastructure: rail.infrastructure,
    institutionName: rail.institutionName,
    status: rail.status,
  };
}

export function serializeCorridor(corridor: EacCorridor | null) {
  if (!corridor) return null;
  return {
    code: corridor.code,
    originCountry: corridor.originCountry,
    destinationCountry: corridor.destinationCountry,
    originInfrastructure: corridor.originInfrastructure,
    destinationInfrastructure: corridor.destinationInfrastructure,
    originLabel: corridor.originLabel,
    destinationLabel: corridor.destinationLabel,
    status: corridor.status,
  };
}

export function infrastructureLabel(value: PaymentInfrastructure) {
  if (value === 'RSWITCH') return 'RSwitch';
  if (value === 'TIPS') return 'TIPS';
  return 'National';
}
