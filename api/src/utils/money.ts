import { Prisma } from '@prisma/client';

export function money(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(new Prisma.Decimal(value).toFixed(2));
}

export function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function add(a: Prisma.Decimal | number, b: Prisma.Decimal | number): Prisma.Decimal {
  return new Prisma.Decimal(a).plus(b);
}

export function sub(a: Prisma.Decimal | number, b: Prisma.Decimal | number): Prisma.Decimal {
  return new Prisma.Decimal(a).minus(b);
}
