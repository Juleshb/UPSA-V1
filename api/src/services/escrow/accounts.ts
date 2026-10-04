import { errors } from '../../utils/errors';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import {
  actorLabel,
  assertAmount,
  assertDual,
  assertSplit,
  clean,
  dateOnly,
  day,
  dayRequired,
  figures,
  findAccount,
  findGroup,
  freshExternal,
  id,
  notify,
  optionalInstitution,
  optionalSchool,
  recordAudit,
  roundMoney,
  splitAmount,
  type Trace,
} from './shared';

function accountView(row: Awaited<ReturnType<typeof findAccount>>, extras: Record<string, unknown> = {}) {
  const position = figures(row);
  return {
    accountId: row.publicId,
    accountNumber: row.accountNumber,
    name: row.name,
    accountType: row.accountType,
    product: row.product,
    currency: row.currency,
    purpose: row.purpose,
    description: row.description,
    openingDate: dateOnly(row.openingDate),
    expectedClosingDate: dateOnly(row.expectedClosingDate),
    status: row.status,
    memberPercent: Number(row.memberPercent),
    financePercent: Number(row.financePercent),
    requiredContribution: money(row.requiredContribution),
    requiredFinancing: money(row.requiredFinancing),
    minimumBalance: money(row.minimumBalance),
    maximumBalance: money(row.maximumBalance),
    contributionFrequency: row.contributionFrequency,
    allocationRule: row.allocationRule,
    releaseRule: row.releaseRule,
    withdrawalRestricted: row.withdrawalRestricted,
    approvalRequired: row.approvalRequired,
    dualAuthorization: row.dualAuthorization,
    freezeAllowed: row.freezeAllowed,
    partialReleaseAllowed: row.partialReleaseAllowed,
    setOffAllowed: row.setOffAllowed,
    bankName: row.bankName,
    branch: row.branch,
    bankAccountNumber: row.bankAccountNumber,
    bankAccountName: row.bankAccountName,
    settlementAccount: row.settlementAccount,
    paymentReference: row.paymentReference,
    representative: row.representative,
    signatory: row.signatory,
    contact: row.contact,
    approvedBy: row.approvedBy,
    lastReconciledAt: row.lastReconciledAt?.toISOString() ?? null,
    ...position,
    ...extras,
  };
}

async function expireFreezes(accountId: string) {
  const today = new Date();
  const due = await prisma.escrowFreeze.findMany({
    where: { accountId, status: 'ACTIVE', endDate: { lt: today } },
  });
  if (!due.length) return;
  const amount = due.reduce((sum, row) => sum + money(row.amount), 0);
  await prisma.$transaction([
    prisma.escrowFreeze.updateMany({ where: { id: { in: due.map((row) => row.id) } }, data: { status: 'EXPIRED' } }),
    prisma.escrowAccount.update({ where: { id: accountId }, data: { frozenAmount: { decrement: decimal(amount) } } }),
  ]);
}

export async function listAccounts() {
  const rows = await prisma.escrowAccount.findMany({ include: { group: true, school: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    ...accountView(row),
    groupId: row.group?.publicId ?? null,
    groupName: row.group?.name ?? null,
    schoolName: row.school?.schoolName ?? null,
  }));
}

export async function openAccount(input: {
  name: string;
  accountType: string;
  product: string;
  currency?: string;
  purpose: string;
  description?: string;
  openingDate: string;
  expectedClosingDate?: string;
  groupId?: string;
  schoolId?: string;
  institutionId?: string;
  representative?: string;
  signatory?: string;
  contact?: string;
  bankName?: string;
  branch?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  settlementAccount?: string;
  paymentReference?: string;
  memberPercent?: number;
  financePercent?: number;
  requiredContribution?: number;
  requiredFinancing?: number;
  minimumBalance?: number;
  maximumBalance?: number;
  contributionFrequency?: string;
  allocationRule?: string;
  releaseRule?: string;
  withdrawalRestricted?: boolean;
  approvalRequired?: boolean;
  dualAuthorization?: boolean;
  freezeAllowed?: boolean;
  partialReleaseAllowed?: boolean;
  setOffAllowed?: boolean;
  mode?: 'draft' | 'submit';
}, trace: Trace) {
  const split = assertSplit(input.memberPercent ?? 40, input.financePercent ?? 60);
  const group = input.groupId ? await findGroup(input.groupId) : null;
  const school = await optionalSchool(input.schoolId);
  const institution = await optionalInstitution(input.institutionId);
  const publicId = await id('ESC');
  const row = await prisma.escrowAccount.create({
    data: {
      publicId,
      accountNumber: publicId,
      name: input.name.trim(),
      accountType: input.accountType,
      product: input.product.trim(),
      currency: (input.currency ?? 'RWF').toUpperCase(),
      purpose: input.purpose.trim(),
      description: clean(input.description),
      openingDate: dayRequired(input.openingDate, 'Opening date'),
      expectedClosingDate: day(input.expectedClosingDate),
      status: input.mode === 'draft' ? 'DRAFT' : 'PENDING_APPROVAL',
      groupId: group?.id,
      schoolId: school?.id ?? group?.schoolId ?? null,
      institutionId: institution?.id,
      representative: clean(input.representative),
      signatory: clean(input.signatory),
      contact: clean(input.contact),
      bankName: clean(input.bankName) ?? institution?.name ?? null,
      branch: clean(input.branch),
      bankAccountNumber: clean(input.bankAccountNumber),
      bankAccountName: clean(input.bankAccountName),
      settlementAccount: clean(input.settlementAccount),
      paymentReference: clean(input.paymentReference),
      memberPercent: decimal(split.memberPercent),
      financePercent: decimal(split.financePercent),
      requiredContribution: decimal(input.requiredContribution ?? 0),
      requiredFinancing: decimal(input.requiredFinancing ?? 0),
      minimumBalance: decimal(input.minimumBalance ?? 0),
      maximumBalance: decimal(input.maximumBalance ?? 0),
      contributionFrequency: clean(input.contributionFrequency),
      allocationRule: clean(input.allocationRule) ?? `${split.memberPercent}/${split.financePercent}`,
      releaseRule: clean(input.releaseRule),
      withdrawalRestricted: input.withdrawalRestricted ?? true,
      approvalRequired: input.approvalRequired ?? true,
      dualAuthorization: input.dualAuthorization ?? false,
      freezeAllowed: input.freezeAllowed ?? true,
      partialReleaseAllowed: input.partialReleaseAllowed ?? true,
      setOffAllowed: input.setOffAllowed ?? false,
      requestedById: trace.actorId,
    },
  });
  await recordAudit({ trace, entityType: 'EscrowAccount', entityId: row.publicId, action: 'escrow.open', newStatus: row.status });
  await notify('Escrow account opened', `Escrow ${row.publicId} opened`, `${row.name} is ${row.status}. The ${split.memberPercent}% member contribution and the ${split.financePercent}% financing component stay separate.`, trace.actorId);
  return accountFile(row.publicId);
}

export async function decideAccount(accountId: string, input: { decision: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }, trace: Trace) {
  const account = await findAccount(accountId);
  assertDual(account.dualAuthorization, account.requestedById, trace.actorId);
  const next = input.decision === 'REJECTED' ? 'CLOSED' : input.decision;
  if (input.decision === 'ACTIVE' && !['DRAFT', 'PENDING_APPROVAL', 'SUSPENDED', 'FROZEN'].includes(account.status)) {
    throw errors.unprocessable('ACCOUNT_STATUS', 'This account cannot be activated from its current status.');
  }
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.escrowAccount.update({
    where: { id: account.id },
    data: { status: next, approvedBy: officer, approvedAt: new Date() },
  });
  await recordAudit({ trace, entityType: 'EscrowAccount', entityId: row.publicId, action: 'escrow.decision', previousStatus: account.status, newStatus: next });
  return accountFile(row.publicId);
}

async function assertOpen(account: Awaited<ReturnType<typeof findAccount>>) {
  await expireFreezes(account.id);
  const fresh = await findAccount(account.publicId);
  if (fresh.status !== 'ACTIVE' && fresh.status !== 'FROZEN') {
    throw errors.unprocessable('ACCOUNT_NOT_ACTIVE', 'Money can move only on an active escrow account.');
  }
  return fresh;
}

function guardRoom(account: Awaited<ReturnType<typeof findAccount>>, amount: number) {
  const position = figures(account);
  const maximum = money(account.maximumBalance);
  if (maximum > 0 && roundMoney(position.closing + amount) > maximum) {
    throw errors.unprocessable('MAXIMUM_BALANCE', 'The contribution would take the escrow above its maximum balance.');
  }
}

export async function contribute(accountId: string, input: {
  memberId?: string;
  memberName: string;
  contributionType: string;
  amount: number;
  currency?: string;
  contributionDate: string;
  paymentMethod: string;
  paymentReference?: string;
  externalTransactionId?: string;
  sourceOfFunds?: string;
  document?: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  const amount = assertAmount(input.amount, 'Contribution');
  guardRoom(account, amount);
  const external = await freshExternal(input.externalTransactionId, input.paymentMethod);
  const member = input.memberId
    ? await prisma.escrowGroupMember.findUnique({ where: { publicId: input.memberId } })
    : null;
  const split = splitAmount(amount, Number(account.memberPercent));
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.$transaction(async (tx) => {
    const contribution = await tx.escrowContribution.create({
      data: {
        publicId: await id('ECN'),
        accountId: account.id,
        memberId: member?.id,
        memberName: input.memberName.trim(),
        contributionType: input.contributionType,
        amount: decimal(amount),
        currency: input.currency ?? account.currency,
        contributionDate: dayRequired(input.contributionDate, 'Contribution date'),
        paymentMethod: input.paymentMethod,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        memberAllocation: decimal(split.member),
        financeAllocation: decimal(split.finance),
        sourceOfFunds: clean(input.sourceOfFunds),
        document: clean(input.document),
        status: 'VERIFIED',
        railCode: external.railCode,
      },
    });
    await tx.escrowAllocation.create({
      data: {
        publicId: await id('EAL'),
        accountId: account.id,
        groupId: account.groupId,
        totalAmount: decimal(amount),
        memberAmount: decimal(split.member),
        financeAmount: decimal(split.finance),
        memberPercent: account.memberPercent,
        financePercent: account.financePercent,
        allocationDate: contribution.contributionDate,
        rule: account.allocationRule ?? `${Number(account.memberPercent)}/${Number(account.financePercent)}`,
        sourceTransaction: contribution.publicId,
        purpose: 'Contribution split. The financing component stays restricted and is not a loan.',
        officer,
        status: 'POSTED',
      },
    });
    await tx.escrowMovement.create({
      data: {
        publicId: await id('ETX'),
        accountId: account.id,
        type: 'CONTRIBUTION',
        transactionDate: contribution.contributionDate,
        amount: decimal(amount),
        currency: account.currency,
        creditAccount: account.accountNumber,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        purpose: input.contributionType,
        initiatedBy: officer,
        approvedBy: officer,
        reconciliationStatus: 'PENDING',
        document: clean(input.document),
        remarks: `${split.member} member contribution and ${split.finance} restricted financing component.`,
      },
    });
    await tx.escrowAccount.update({
      where: { id: account.id },
      data: {
        contributions: { increment: decimal(amount) },
        memberComponent: { increment: decimal(split.member) },
        financeComponent: { increment: decimal(split.finance) },
        restrictedAmount: { increment: decimal(split.finance) },
      },
    });
    return contribution;
  });
  await recordAudit({ trace, entityType: 'EscrowContribution', entityId: row.publicId, action: 'escrow.contribution', amount, newStatus: 'VERIFIED' });
  await notify('Contribution received', `Contribution ${row.publicId}`, `${amount} ${account.currency} was received on ${account.publicId}. ${split.member} is the member component and ${split.finance} stays restricted.`, trace.actorId);
  return accountFile(account.publicId);
}

export async function allocate(accountId: string, input: { totalAmount: number; purpose?: string; destinationAccount?: string; approvalReference?: string }, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  const total = assertAmount(input.totalAmount, 'Allocation');
  const position = figures(account);
  if (total > position.unallocated + 0.001) {
    throw errors.unprocessable('NOTHING_TO_ALLOCATE', 'That amount is larger than the unallocated escrow balance.');
  }
  const split = splitAmount(total, Number(account.memberPercent));
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.$transaction(async (tx) => {
    const allocation = await tx.escrowAllocation.create({
      data: {
        publicId: await id('EAL'),
        accountId: account.id,
        groupId: account.groupId,
        totalAmount: decimal(total),
        memberAmount: decimal(split.member),
        financeAmount: decimal(split.finance),
        memberPercent: account.memberPercent,
        financePercent: account.financePercent,
        allocationDate: new Date(),
        rule: account.allocationRule ?? `${Number(account.memberPercent)}/${Number(account.financePercent)}`,
        destinationAccount: clean(input.destinationAccount),
        purpose: clean(input.purpose) ?? 'Manual 40/60 classification of funds already in escrow.',
        officer,
        approvalReference: clean(input.approvalReference),
        status: 'POSTED',
      },
    });
    await tx.escrowAccount.update({
      where: { id: account.id },
      data: {
        memberComponent: { increment: decimal(split.member) },
        financeComponent: { increment: decimal(split.finance) },
        restrictedAmount: { increment: decimal(split.finance) },
      },
    });
    return allocation;
  });
  await recordAudit({ trace, entityType: 'EscrowAllocation', entityId: row.publicId, action: 'escrow.allocate', amount: total });
  await notify('40/60 allocation completed', `Allocation ${row.publicId}`, `${split.member} is the member component and ${split.finance} is the restricted financing component.`, trace.actorId);
  return accountFile(account.publicId);
}

export async function postMovement(accountId: string, input: {
  type: 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'FEE' | 'INTEREST' | 'REVERSAL' | 'OTHER';
  amount: number;
  transactionDate: string;
  debitAccount?: string;
  creditAccount?: string;
  paymentReference?: string;
  externalTransactionId?: string;
  purpose?: string;
  document?: string;
  remarks?: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  const amount = assertAmount(input.amount);
  const position = figures(account);
  if (['TRANSFER_OUT', 'FEE', 'REVERSAL'].includes(input.type) && amount > position.available + 0.001) {
    throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The available escrow balance does not cover that amount. Restricted and frozen funds stay put.');
  }
  const officer = await actorLabel(trace.actorId);
  const data: Record<string, { increment: ReturnType<typeof decimal> } | { decrement: ReturnType<typeof decimal> }> = {};
  if (input.type === 'TRANSFER_IN') data.transfersIn = { increment: decimal(amount) };
  if (input.type === 'TRANSFER_OUT') data.transfersOut = { increment: decimal(amount) };
  if (input.type === 'FEE') data.fees = { increment: decimal(amount) };
  if (input.type === 'INTEREST') data.interest = { increment: decimal(amount) };
  if (input.type === 'ADJUSTMENT') data.adjustments = { increment: decimal(amount) };
  if (input.type === 'REVERSAL') data.adjustments = { decrement: decimal(amount) };
  const row = await prisma.$transaction(async (tx) => {
    const movement = await tx.escrowMovement.create({
      data: {
        publicId: await id('ETX'),
        accountId: account.id,
        type: input.type,
        transactionDate: dayRequired(input.transactionDate, 'Transaction date'),
        amount: decimal(amount),
        currency: account.currency,
        debitAccount: clean(input.debitAccount),
        creditAccount: clean(input.creditAccount),
        paymentReference: clean(input.paymentReference),
        externalTransactionId: clean(input.externalTransactionId),
        purpose: clean(input.purpose),
        initiatedBy: officer,
        approvedBy: officer,
        document: clean(input.document),
        remarks: clean(input.remarks),
      },
    });
    if (Object.keys(data).length) await tx.escrowAccount.update({ where: { id: account.id }, data });
    return movement;
  });
  await recordAudit({ trace, entityType: 'EscrowMovement', entityId: row.publicId, action: 'escrow.movement', amount, newStatus: input.type });
  return accountFile(account.publicId);
}

export async function requestFreeze(accountId: string, input: {
  amount: number;
  reason: string;
  authority?: string;
  document?: string;
  startDate: string;
  endDate?: string;
  legalReference?: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  if (!account.freezeAllowed) throw errors.unprocessable('FREEZE_NOT_ALLOWED', 'This escrow account does not allow a freeze.');
  const amount = assertAmount(input.amount, 'Freeze');
  const position = figures(account);
  if (amount > position.available + 0.001) throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The freeze cannot exceed the available balance.');
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.escrowFreeze.create({
    data: {
      publicId: await id('EFZ'),
      accountId: account.id,
      groupId: account.groupId,
      amount: decimal(amount),
      reason: input.reason.trim(),
      authority: clean(input.authority),
      document: clean(input.document),
      startDate: dayRequired(input.startDate, 'Start date'),
      endDate: day(input.endDate),
      legalReference: clean(input.legalReference),
      requestedBy: officer,
      requestedById: trace.actorId,
      status: 'REQUESTED',
    },
  });
  await recordAudit({ trace, entityType: 'EscrowFreeze', entityId: row.publicId, action: 'escrow.freeze.request', amount, newStatus: 'REQUESTED' });
  return accountFile(account.publicId);
}

export async function decideFreeze(accountId: string, freezeId: string, input: { decision: 'ACTIVE' | 'REJECTED' | 'RELEASED' }, trace: Trace) {
  const account = await findAccount(accountId);
  const freeze = await prisma.escrowFreeze.findUnique({ where: { publicId: freezeId } });
  if (!freeze || freeze.accountId !== account.id) throw errors.notFound('FREEZE_NOT_FOUND', 'The freeze could not be found.');
  assertDual(account.dualAuthorization, freeze.requestedById, trace.actorId);
  const officer = await actorLabel(trace.actorId);
  if (input.decision === 'ACTIVE' && freeze.status === 'REQUESTED') {
    const fresh = await assertOpen(account);
    const position = figures(fresh);
    const amount = money(freeze.amount);
    if (amount > position.available + 0.001) throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The available balance no longer covers this freeze.');
    await prisma.$transaction([
      prisma.escrowFreeze.update({ where: { id: freeze.id }, data: { status: 'ACTIVE', approvedBy: officer } }),
      prisma.escrowAccount.update({
        where: { id: account.id },
        data: {
          frozenAmount: { increment: freeze.amount },
          status: roundMoney(position.available - amount) <= 0 ? 'FROZEN' : account.status,
        },
      }),
    ]);
    await notify('Escrow frozen', `Freeze ${freeze.publicId}`, `${amount} on ${account.publicId} is frozen.`, trace.actorId);
  } else if (input.decision === 'RELEASED' && freeze.status === 'ACTIVE') {
    await prisma.$transaction(async (tx) => {
      await tx.escrowFreeze.update({ where: { id: freeze.id }, data: { status: 'RELEASED', approvedBy: officer } });
      const updated = await tx.escrowAccount.update({ where: { id: account.id }, data: { frozenAmount: { decrement: freeze.amount } } });
      if (updated.status === 'FROZEN' && money(updated.frozenAmount) <= 0) {
        await tx.escrowAccount.update({ where: { id: account.id }, data: { status: 'ACTIVE' } });
      }
    });
  } else if (input.decision === 'REJECTED' && freeze.status === 'REQUESTED') {
    await prisma.escrowFreeze.update({ where: { id: freeze.id }, data: { status: 'REJECTED', approvedBy: officer } });
  } else {
    throw errors.unprocessable('FREEZE_STATUS', 'That freeze decision does not match the current status.');
  }
  await recordAudit({ trace, entityType: 'EscrowFreeze', entityId: freeze.publicId, action: 'escrow.freeze.decision', previousStatus: freeze.status, newStatus: input.decision, amount: money(freeze.amount) });
  return accountFile(account.publicId);
}

export async function requestRelease(accountId: string, input: {
  amount: number;
  fromRestricted?: boolean;
  purpose: string;
  beneficiary: string;
  destinationAccount: string;
  paymentReference?: string;
  externalTransactionId?: string;
  paymentMethod?: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  const amount = assertAmount(input.amount, 'Release');
  const position = figures(account);
  const fromRestricted = Boolean(input.fromRestricted);
  if (fromRestricted) {
    if (amount > position.restricted + 0.001) throw errors.unprocessable('INSUFFICIENT_RESTRICTED', 'The restricted financing component does not cover that release.');
  } else if (amount > position.available + 0.001) {
    throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The release cannot exceed the available balance. Restricted funds are not included.');
  }
  if (!fromRestricted && !account.partialReleaseAllowed && roundMoney(position.available - amount) > 0) {
    throw errors.unprocessable('PARTIAL_RELEASE_BLOCKED', 'This account allows only a full release of the available balance.');
  }
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.escrowRelease.create({
    data: {
      publicId: await id('ERL'),
      accountId: account.id,
      groupId: account.groupId,
      requestedAmount: decimal(amount),
      fromRestricted,
      purpose: input.purpose.trim(),
      beneficiary: input.beneficiary.trim(),
      destinationAccount: input.destinationAccount.trim(),
      requestedBy: officer,
      requestedById: trace.actorId,
      requestedDate: new Date(),
      approvalRequired: account.approvalRequired,
      status: 'REQUESTED',
      paymentReference: clean(input.paymentReference),
    },
  });
  await recordAudit({ trace, entityType: 'EscrowRelease', entityId: row.publicId, action: 'escrow.release.request', amount, newStatus: 'REQUESTED' });
  await notify('Release requested', `Release ${row.publicId}`, `${amount} was requested from ${account.publicId}.`, trace.actorId);
  return accountFile(account.publicId);
}

export async function decideRelease(accountId: string, releaseId: string, input: { decision: 'RELEASED' | 'REJECTED'; paymentMethod?: string; externalTransactionId?: string; paymentReference?: string }, trace: Trace) {
  const account = await findAccount(accountId);
  const release = await prisma.escrowRelease.findUnique({ where: { publicId: releaseId } });
  if (!release || release.accountId !== account.id) throw errors.notFound('RELEASE_NOT_FOUND', 'The release could not be found.');
  if (release.status !== 'REQUESTED' && release.status !== 'UNDER_REVIEW' && release.status !== 'APPROVED') {
    throw errors.unprocessable('RELEASE_STATUS', 'This release is no longer waiting for a decision.');
  }
  assertDual(account.dualAuthorization, release.requestedById, trace.actorId);
  const officer = await actorLabel(trace.actorId);
  if (input.decision === 'REJECTED') {
    await prisma.escrowRelease.update({ where: { id: release.id }, data: { status: 'REJECTED', approvedBy: officer } });
    await notify('Release rejected', `Release ${release.publicId}`, `The release on ${account.publicId} was rejected.`, trace.actorId);
  } else {
    const fresh = await assertOpen(account);
    const position = figures(fresh);
    const amount = money(release.requestedAmount);
    if (release.fromRestricted) {
      if (amount > position.restricted + 0.001) throw errors.unprocessable('INSUFFICIENT_RESTRICTED', 'The restricted balance changed and no longer covers this release.');
    } else if (amount > position.available + 0.001) {
      throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The available balance changed and no longer covers this release.');
    }
    const method = input.paymentMethod ?? 'BANK_TRANSFER';
    const external = await freshExternal(input.externalTransactionId ?? release.externalTransactionId, method);
    await prisma.$transaction(async (tx) => {
      await tx.escrowRelease.update({
        where: { id: release.id },
        data: {
          status: 'RELEASED',
          approvedBy: officer,
          releaseDate: new Date(),
          paymentReference: clean(input.paymentReference) ?? release.paymentReference,
          externalTransactionId: external.value,
          railCode: external.railCode,
        },
      });
      await tx.escrowMovement.create({
        data: {
          publicId: await id('ETX'),
          accountId: account.id,
          type: 'RELEASE',
          transactionDate: new Date(),
          amount: release.requestedAmount,
          currency: account.currency,
          debitAccount: account.accountNumber,
          creditAccount: release.destinationAccount,
          paymentReference: clean(input.paymentReference) ?? release.paymentReference,
          externalTransactionId: external.value,
          purpose: release.purpose,
          initiatedBy: release.requestedBy,
          approvedBy: officer,
        },
      });
      await tx.escrowAccount.update({
        where: { id: account.id },
        data: release.fromRestricted
          ? { releases: { increment: release.requestedAmount }, restrictedAmount: { decrement: release.requestedAmount }, financeComponent: { decrement: release.requestedAmount } }
          : { releases: { increment: release.requestedAmount } },
      });
    });
    await notify('Release approved', `Release ${release.publicId}`, `${amount} left ${account.publicId} through the payment service.`, trace.actorId);
  }
  await recordAudit({ trace, entityType: 'EscrowRelease', entityId: release.publicId, action: 'escrow.release.decision', previousStatus: release.status, newStatus: input.decision, amount: money(release.requestedAmount) });
  return accountFile(account.publicId);
}

export async function withdraw(accountId: string, input: {
  amount: number;
  reason: string;
  beneficiary: string;
  destinationAccount: string;
  approval?: string;
  paymentMethod?: string;
  paymentReference?: string;
  externalTransactionId?: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  if (account.withdrawalRestricted && !clean(input.approval)) {
    throw errors.unprocessable('WITHDRAWAL_RESTRICTED', 'A withdrawal on this account needs an approval reference.');
  }
  const amount = assertAmount(input.amount, 'Withdrawal');
  const position = figures(account);
  if (amount > position.available + 0.001) throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'The withdrawal cannot use restricted or frozen funds.');
  const after = roundMoney(position.available - amount);
  if (after < money(account.minimumBalance)) {
    throw errors.unprocessable('MINIMUM_BALANCE', 'The withdrawal would leave the available balance under the minimum.');
  }
  const external = await freshExternal(input.externalTransactionId, input.paymentMethod ?? 'BANK_TRANSFER');
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.escrowWithdrawal.create({
      data: {
        publicId: await id('EWD'),
        accountId: account.id,
        groupId: account.groupId,
        amount: decimal(amount),
        reason: input.reason.trim(),
        beneficiary: input.beneficiary.trim(),
        destinationAccount: input.destinationAccount.trim(),
        minimumAfter: decimal(money(account.minimumBalance)),
        approval: clean(input.approval),
        requestedById: trace.actorId,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        status: 'POSTED',
        railCode: external.railCode,
      },
    });
    await tx.escrowMovement.create({
      data: {
        publicId: await id('ETX'),
        accountId: account.id,
        type: 'TRANSFER_OUT',
        transactionDate: new Date(),
        amount: decimal(amount),
        currency: account.currency,
        debitAccount: account.accountNumber,
        creditAccount: input.destinationAccount.trim(),
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        purpose: input.reason.trim(),
        initiatedBy: officer,
        approvedBy: clean(input.approval) ?? officer,
      },
    });
    await tx.escrowAccount.update({ where: { id: account.id }, data: { transfersOut: { increment: decimal(amount) } } });
    return withdrawal;
  });
  await recordAudit({ trace, entityType: 'EscrowWithdrawal', entityId: row.publicId, action: 'escrow.withdrawal', amount, newStatus: 'POSTED' });
  return accountFile(account.publicId);
}

export async function refund(accountId: string, input: {
  amount: number;
  reason: string;
  beneficiary: string;
  originalTransaction?: string;
  destinationAccount?: string;
  approval?: string;
  paymentMethod?: string;
  paymentReference?: string;
  externalTransactionId?: string;
  refundDate: string;
}, trace: Trace) {
  const account = await assertOpen(await findAccount(accountId));
  const amount = assertAmount(input.amount, 'Refund');
  const external = await freshExternal(input.externalTransactionId, input.paymentMethod);
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.escrowRefund.create({
      data: {
        publicId: await id('ERF'),
        accountId: account.id,
        originalTransaction: clean(input.originalTransaction),
        amount: decimal(amount),
        reason: input.reason.trim(),
        beneficiary: input.beneficiary.trim(),
        destinationAccount: clean(input.destinationAccount),
        approval: clean(input.approval),
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        refundDate: dayRequired(input.refundDate, 'Refund date'),
        status: 'POSTED',
        railCode: external.railCode,
      },
    });
    await tx.escrowMovement.create({
      data: {
        publicId: await id('ETX'),
        accountId: account.id,
        type: 'REFUND',
        transactionDate: created.refundDate,
        amount: decimal(amount),
        currency: account.currency,
        creditAccount: account.accountNumber,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        purpose: input.reason.trim(),
        initiatedBy: officer,
        approvedBy: clean(input.approval) ?? officer,
      },
    });
    await tx.escrowAccount.update({ where: { id: account.id }, data: { refunds: { increment: decimal(amount) } } });
    return created;
  });
  await recordAudit({ trace, entityType: 'EscrowRefund', entityId: row.publicId, action: 'escrow.refund', amount, newStatus: 'POSTED' });
  return accountFile(account.publicId);
}

export async function saveAgreement(accountId: string, input: {
  parties: string;
  agent?: string;
  institutionName?: string;
  purpose: string;
  amount: number;
  currency?: string;
  rule: string;
  contributionRequirements?: string;
  releaseConditions?: string;
  withdrawalConditions?: string;
  defaultConditions?: string;
  terminationConditions?: string;
  disputeResolution?: string;
  effectiveDate: string;
  expiryDate?: string;
  signatures?: { role: string; name: string; signedAt?: string }[];
}, trace: Trace) {
  const account = await findAccount(accountId);
  const row = await prisma.escrowAgreement.create({
    data: {
      publicId: await id('EAG'),
      accountId: account.id,
      groupId: account.groupId,
      parties: input.parties.trim(),
      agent: clean(input.agent),
      institutionName: clean(input.institutionName) ?? account.bankName,
      purpose: input.purpose.trim(),
      amount: decimal(assertAmount(input.amount, 'Agreement amount')),
      currency: input.currency ?? account.currency,
      rule: input.rule.trim(),
      contributionRequirements: clean(input.contributionRequirements),
      releaseConditions: clean(input.releaseConditions),
      withdrawalConditions: clean(input.withdrawalConditions),
      defaultConditions: clean(input.defaultConditions),
      terminationConditions: clean(input.terminationConditions),
      disputeResolution: clean(input.disputeResolution),
      effectiveDate: dayRequired(input.effectiveDate, 'Effective date'),
      expiryDate: day(input.expiryDate),
      signatures: input.signatures?.length ? input.signatures : undefined,
      status: 'ACTIVE',
    },
  });
  await recordAudit({ trace, entityType: 'EscrowAgreement', entityId: row.publicId, action: 'escrow.agreement', amount: Number(row.amount), newStatus: 'ACTIVE' });
  return accountFile(account.publicId);
}

export async function closeAccount(accountId: string, input: { reason: string; destinationAccount?: string; settlementAmount?: number }, trace: Trace) {
  const account = await findAccount(accountId);
  if (account.status === 'CLOSED') throw errors.unprocessable('ACCOUNT_CLOSED', 'This escrow account is already closed.');
  await expireFreezes(account.id);
  const fresh = await findAccount(account.publicId);
  const position = figures(fresh);
  if (position.frozen > 0) throw errors.unprocessable('ACCOUNT_FROZEN', 'Release the freeze before closing the account.');
  const pendingReleases = await prisma.escrowRelease.count({ where: { accountId: fresh.id, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } } });
  if (pendingReleases) throw errors.unprocessable('RELEASE_PENDING', 'Decide the pending releases before closing the account.');
  const openGuarantees = await prisma.securityGuarantee.count({ where: { accountId: fresh.id, status: { in: ['ACTIVE', 'ISSUED', 'CLAIMED', 'PARTIALLY_PAID', 'RECOVERY'] } } });
  if (openGuarantees) throw errors.unprocessable('GUARANTEE_OPEN', 'Release or close the guarantees linked to this escrow before closing it.');
  const openClaims = await prisma.securityClaim.count({ where: { guarantee: { accountId: fresh.id }, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'] } } });
  if (openClaims) throw errors.unprocessable('CLAIM_OPEN', 'Finish the open claims before closing the escrow.');
  if (position.restricted > 0) throw errors.unprocessable('RESTRICTED_REMAINS', 'Release the restricted financing component before closing. It is not a loan and it is not collateral.');
  const settlement = input.settlementAmount == null ? position.closing : roundMoney(input.settlementAmount);
  if (Math.abs(settlement - position.closing) > 0.001) {
    throw errors.unprocessable('SETTLEMENT_MISMATCH', 'The final settlement must equal the closing balance.');
  }
  const officer = await actorLabel(trace.actorId);
  await prisma.$transaction(async (tx) => {
    if (position.closing > 0) {
      await tx.escrowAccount.update({ where: { id: fresh.id }, data: { releases: { increment: decimal(position.closing) } } });
      await tx.escrowMovement.create({
        data: {
          publicId: await id('ETX'),
          accountId: fresh.id,
          type: 'RELEASE',
          transactionDate: new Date(),
          amount: decimal(position.closing),
          currency: fresh.currency,
          debitAccount: fresh.accountNumber,
          creditAccount: clean(input.destinationAccount),
          purpose: 'Final settlement on closure',
          initiatedBy: officer,
          approvedBy: officer,
        },
      });
    }
    await tx.escrowClosure.create({
      data: {
        publicId: await id('ECL'),
        accountId: fresh.id,
        groupId: fresh.groupId,
        reason: input.reason.trim(),
        closingBalance: decimal(position.closing),
        obligations: openGuarantees ? 'Open guarantees' : 'None',
        restrictedAmount: decimal(position.restricted),
        pendingClaims: openClaims,
        pendingReleases,
        settlementAmount: decimal(settlement),
        destinationAccount: clean(input.destinationAccount),
        approvedBy: officer,
        closureDate: new Date(),
        status: 'CLOSED',
      },
    });
    await tx.escrowAccount.update({ where: { id: fresh.id }, data: { status: 'CLOSED' } });
  });
  await recordAudit({ trace, entityType: 'EscrowAccount', entityId: fresh.publicId, action: 'escrow.close', previousStatus: fresh.status, newStatus: 'CLOSED', amount: position.closing, reason: input.reason });
  return accountFile(fresh.publicId);
}

export async function accountFile(publicId: string) {
  await prisma.escrowAccount.findUnique({ where: { publicId } }).then(async (row) => {
    if (row) await expireFreezes(row.id);
  });
  const row = await prisma.escrowAccount.findUnique({
    where: { publicId },
    include: {
      group: true,
      school: true,
      institution: true,
      agreements: { orderBy: { createdAt: 'desc' } },
      contributionRows: { orderBy: { createdAt: 'desc' } },
      allocations: { orderBy: { createdAt: 'desc' } },
      movements: { orderBy: { createdAt: 'desc' } },
      freezes: { orderBy: { createdAt: 'desc' } },
      releaseRows: { orderBy: { createdAt: 'desc' } },
      withdrawals: { orderBy: { createdAt: 'desc' } },
      refundRows: { orderBy: { createdAt: 'desc' } },
      closures: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!row) throw errors.notFound('ESCROW_NOT_FOUND', 'The escrow account could not be found.');
  return {
    ...accountView(row),
    groupId: row.group?.publicId ?? null,
    groupName: row.group?.name ?? null,
    schoolId: row.school?.publicId ?? null,
    schoolName: row.school?.schoolName ?? null,
    institutionId: row.institution?.publicId ?? null,
    institutionName: row.institution?.name ?? row.bankName,
    agreements: row.agreements.map((item) => ({
      agreementId: item.publicId,
      parties: item.parties,
      agent: item.agent,
      institutionName: item.institutionName,
      purpose: item.purpose,
      amount: money(item.amount),
      currency: item.currency,
      rule: item.rule,
      contributionRequirements: item.contributionRequirements,
      releaseConditions: item.releaseConditions,
      withdrawalConditions: item.withdrawalConditions,
      defaultConditions: item.defaultConditions,
      terminationConditions: item.terminationConditions,
      disputeResolution: item.disputeResolution,
      effectiveDate: dateOnly(item.effectiveDate),
      expiryDate: dateOnly(item.expiryDate),
      signatures: item.signatures,
      status: item.status,
    })),
    contributions: row.contributionRows.map((item) => ({
      contributionId: item.publicId,
      memberName: item.memberName,
      contributionType: item.contributionType,
      amount: money(item.amount),
      memberAllocation: money(item.memberAllocation),
      financeAllocation: money(item.financeAllocation),
      paymentMethod: item.paymentMethod,
      paymentReference: item.paymentReference,
      externalTransactionId: item.externalTransactionId,
      sourceOfFunds: item.sourceOfFunds,
      status: item.status,
      railCode: item.railCode,
      contributionDate: dateOnly(item.contributionDate),
    })),
    allocations: row.allocations.map((item) => ({
      allocationId: item.publicId,
      totalAmount: money(item.totalAmount),
      memberAmount: money(item.memberAmount),
      financeAmount: money(item.financeAmount),
      memberPercent: Number(item.memberPercent),
      financePercent: Number(item.financePercent),
      rule: item.rule,
      purpose: item.purpose,
      officer: item.officer,
      status: item.status,
      allocationDate: dateOnly(item.allocationDate),
    })),
    movements: row.movements.map((item) => ({
      transactionId: item.publicId,
      type: item.type,
      amount: money(item.amount),
      transactionDate: dateOnly(item.transactionDate),
      paymentReference: item.paymentReference,
      externalTransactionId: item.externalTransactionId,
      purpose: item.purpose,
      initiatedBy: item.initiatedBy,
      approvedBy: item.approvedBy,
      reconciliationStatus: item.reconciliationStatus,
      remarks: item.remarks,
    })),
    freezes: row.freezes.map((item) => ({
      freezeId: item.publicId,
      amount: money(item.amount),
      reason: item.reason,
      authority: item.authority,
      startDate: dateOnly(item.startDate),
      endDate: dateOnly(item.endDate),
      legalReference: item.legalReference,
      requestedBy: item.requestedBy,
      approvedBy: item.approvedBy,
      status: item.status,
    })),
    releases: row.releaseRows.map((item) => ({
      releaseId: item.publicId,
      amount: money(item.requestedAmount),
      fromRestricted: item.fromRestricted,
      purpose: item.purpose,
      beneficiary: item.beneficiary,
      destinationAccount: item.destinationAccount,
      requestedBy: item.requestedBy,
      approvedBy: item.approvedBy,
      status: item.status,
      paymentReference: item.paymentReference,
      externalTransactionId: item.externalTransactionId,
      railCode: item.railCode,
    })),
    withdrawals: row.withdrawals.map((item) => ({
      withdrawalId: item.publicId,
      amount: money(item.amount),
      reason: item.reason,
      beneficiary: item.beneficiary,
      destinationAccount: item.destinationAccount,
      approval: item.approval,
      status: item.status,
      paymentReference: item.paymentReference,
    })),
    refunds: row.refundRows.map((item) => ({
      refundId: item.publicId,
      amount: money(item.amount),
      reason: item.reason,
      beneficiary: item.beneficiary,
      originalTransaction: item.originalTransaction,
      status: item.status,
      refundDate: dateOnly(item.refundDate),
    })),
    closures: row.closures.map((item) => ({
      closureId: item.publicId,
      reason: item.reason,
      closingBalance: money(item.closingBalance),
      settlementAmount: money(item.settlementAmount),
      destinationAccount: item.destinationAccount,
      approvedBy: item.approvedBy,
      status: item.status,
      closureDate: dateOnly(item.closureDate),
    })),
  };
}

export async function statement(publicId: string, query: { from?: string; to?: string; type?: string; status?: string }) {
  const file = await accountFile(publicId);
  const from = query.from ?? '0000-01-01';
  const to = query.to ?? '9999-12-31';
  const movements = file.movements.filter((item) => {
    const date = item.transactionDate ?? '';
    if (date < from || date > to) return false;
    if (query.type && item.type !== query.type) return false;
    if (query.status && item.reconciliationStatus !== query.status) return false;
    return true;
  });
  return {
    accountId: file.accountId,
    groupName: file.groupName,
    openingBalance: file.closing - movements.reduce((sum, item) => sum + signed(item.type, item.amount), 0),
    contributions: sum(movements, 'CONTRIBUTION'),
    transfersIn: sum(movements, 'TRANSFER_IN'),
    transfersOut: sum(movements, 'TRANSFER_OUT'),
    releases: sum(movements, 'RELEASE'),
    refunds: sum(movements, 'REFUND'),
    fees: sum(movements, 'FEE'),
    adjustments: sum(movements, 'ADJUSTMENT') - sum(movements, 'REVERSAL'),
    frozen: file.frozen,
    restricted: file.restricted,
    available: file.available,
    closingBalance: file.closing,
    memberComponent: file.member,
    financeComponent: file.finance,
    movements,
  };
}

function sum(rows: { type: string; amount: number }[], type: string) {
  return roundMoney(rows.filter((row) => row.type === type).reduce((total, row) => total + row.amount, 0));
}

function signed(type: string, amount: number) {
  if (['TRANSFER_OUT', 'RELEASE', 'FEE', 'REVERSAL'].includes(type)) return -amount;
  if (type === 'OTHER') return 0;
  return amount;
}
