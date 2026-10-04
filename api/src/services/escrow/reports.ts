import { errors } from '../../utils/errors';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import {
  actorLabel,
  figures,
  assertAmount,
  clean,
  coverageOf,
  dateOnly,
  dayRequired,
  findAccount,
  findGroup,
  freshExternal,
  id,
  notify,
  recordAudit,
  roundMoney,
  type Trace,
} from './shared';
import { exposureOf } from './guarantees';

export async function dashboard() {
  const [accounts, assets, guarantees, claims, recoveries, loans] = await Promise.all([
    prisma.escrowAccount.findMany(),
    prisma.collateralAsset.findMany(),
    prisma.securityGuarantee.findMany(),
    prisma.securityClaim.findMany(),
    prisma.securityRecovery.findMany(),
    prisma.loan.findMany({ where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RECOVERY', 'CONTRACTED', 'DISBURSING'] } } }),
  ]);
  const open = accounts.filter((row) => row.status !== 'CLOSED');
  const position = open.map(figures);
  const sum = (pick: (row: ReturnType<typeof figures>) => number) => roundMoney(position.reduce((total, row) => total + pick(row), 0));
  const collateral = roundMoney(assets.filter((row) => row.countsAsCollateral && row.status !== 'RELEASED').reduce((total, row) => total + Math.max(0, money(row.marketValue) * Number(row.haircutPercent) / 100 - money(row.encumbrance)), 0));
  let guaranteeExposure = 0;
  for (const row of guarantees) {
    if (['CLOSED', 'CANCELLED'].includes(row.status)) continue;
    guaranteeExposure += exposureOf(row, null).remaining;
  }
  const pendingRelease = await prisma.escrowRelease.aggregate({
    where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } },
    _sum: { requestedAmount: true },
  });
  return {
    accounts: {
      total: accounts.length,
      active: accounts.filter((row) => row.status === 'ACTIVE').length,
      pending: accounts.filter((row) => row.status === 'PENDING_APPROVAL' || row.status === 'DRAFT').length,
      suspended: accounts.filter((row) => row.status === 'SUSPENDED').length,
      frozen: accounts.filter((row) => row.status === 'FROZEN').length,
      closed: accounts.filter((row) => row.status === 'CLOSED').length,
    },
    balances: {
      total: sum((row) => row.closing),
      available: sum((row) => row.available),
      restricted: sum((row) => row.restricted),
      frozen: sum((row) => row.frozen),
      pendingRelease: money(pendingRelease._sum.requestedAmount),
      member: sum((row) => row.member),
      finance: sum((row) => row.finance),
    },
    exposure: {
      collateral,
      guarantee: roundMoney(guaranteeExposure),
      loans: roundMoney(loans.reduce((total, row) => total + money(row.principalOutstanding), 0)),
      claims: roundMoney(claims.filter((row) => row.status !== 'REJECTED').reduce((total, row) => total + money(row.amountClaimed), 0)),
      recoveries: roundMoney(recoveries.reduce((total, row) => total + money(row.amount), 0)),
      escrowBacked: roundMoney(guarantees.filter((row) => row.accountId && !['CLOSED', 'CANCELLED'].includes(row.status)).reduce((total, row) => total + exposureOf(row, null).remaining, 0)),
    },
    scope: 'This module keeps the 40/60 escrow, group collateral and guarantee as separate control records. Cash moves through the payment service. A school, a loan application and a loan are linked from the registers that already exist.',
    assumptions: [
      'Each escrow account sets its own member percentage and financing percentage. They must add up to 100. The default is 40 and 60.',
      'The member component is available, subject to the minimum balance, a freeze and the release rule. It is not automatically the lender’s collateral.',
      'The financing component stays restricted. It is not automatically a loan.',
      'A deposit that is already in escrow is not counted again as collateral.',
      'Combined coverage adds escrow, eligible collateral and the remaining guarantee once each.',
      'Set-off runs only when the account policy allows it.',
      'Dual authorization, when switched on, requires a different officer to approve a release, a guarantee decision or a claim payment.',
    ],
    roles: [
      { role: 'Platform administrator and UPSA officer', boundary: 'Open escrow, record contributions, pledge collateral, issue guarantees, pay claims and reconcile.' },
      { role: 'School finance officer', boundary: 'Read the group, escrow, collateral and guarantee position. Cannot approve a release, a guarantee or a claim payment.' },
      { role: 'Bank and MFI', boundary: 'Read exposure and collateral linked to lending. The credit decision stays with the licensed institution.' },
      { role: 'Auditor', boundary: 'Read every record, report and audit log. Cannot post a financial action.' },
    ],
  };
}

export async function createLink(input: {
  groupId?: string;
  accountId?: string;
  poolId?: string;
  facilityId?: string;
  loanApplicationId?: string;
  loanId?: string;
}, trace: Trace) {
  const group = input.groupId ? await findGroup(input.groupId) : null;
  const account = input.accountId ? await findAccount(input.accountId) : null;
  const pool = input.poolId ? await prisma.collateralPool.findUnique({ where: { publicId: input.poolId }, include: { assets: true } }) : null;
  const facility = input.facilityId ? await prisma.securityFacility.findUnique({ where: { publicId: input.facilityId } }) : null;
  const loanApplication = input.loanApplicationId ? await prisma.loanApplication.findUnique({ where: { publicId: input.loanApplicationId } }) : null;
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const position = account ? figures(account) : null;
  const collateral = pool ? pool.assets.filter((row) => row.countsAsCollateral && row.status !== 'RELEASED').reduce((sum, row) => sum + Math.max(0, money(row.marketValue) * Number(row.haircutPercent) / 100 - money(row.encumbrance)), 0) : 0;
  const row = await prisma.securityLink.create({
    data: {
      publicId: await id('SLK'),
      groupId: group?.id ?? account?.groupId ?? null,
      accountId: account?.id,
      poolId: pool?.id,
      facilityId: facility?.id,
      loanApplicationId: loanApplication?.id,
      loanId: loan?.id,
      memberContribution: decimal(position?.member ?? 0),
      financeComponent: decimal(position?.finance ?? 0),
      collateralValue: decimal(roundMoney(collateral)),
      guaranteedAmount: decimal(0),
      exposure: decimal(loan ? money(loan.principalOutstanding) : 0),
      status: 'ACTIVE',
    },
  });
  await recordAudit({ trace, entityType: 'SecurityLink', entityId: row.publicId, action: 'security.link', newStatus: 'ACTIVE' });
  return listLinks();
}

export async function listLinks() {
  const rows = await prisma.securityLink.findMany({ include: { group: true, account: true, pool: true, facility: true, loan: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row) => {
    const position = row.account ? figures(row.account) : null;
    const exposure = row.loan ? money(row.loan.principalOutstanding) : money(row.exposure);
    const cover = coverageOf({
      exposure,
      escrowAvailable: position?.available ?? 0,
      eligibleCollateral: money(row.collateralValue),
      guaranteeCoverage: money(row.guaranteedAmount),
    });
    return {
      linkId: row.publicId,
      groupId: row.group?.publicId ?? null,
      groupName: row.group?.name ?? null,
      accountId: row.account?.publicId ?? null,
      poolId: row.pool?.publicId ?? null,
      facilityId: row.facility?.publicId ?? null,
      loanId: row.loan?.publicId ?? null,
      memberContribution: position?.member ?? money(row.memberContribution),
      financeComponent: position?.finance ?? money(row.financeComponent),
      collateralValue: money(row.collateralValue),
      guaranteedAmount: money(row.guaranteedAmount),
      status: row.status,
      ...cover,
    };
  });
}

export async function createDefault(input: {
  groupId?: string;
  loanId?: string;
  loanIds?: string;
  borrower: string;
  defaultDate: string;
  dpd?: number;
  principal?: number;
  interest?: number;
  fees?: number;
  strategy?: string;
}, trace: Trace) {
  const group = input.groupId ? await findGroup(input.groupId) : null;
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const guarantees = group ? await prisma.securityGuarantee.findMany({ where: { groupId: group.id, status: { notIn: ['CLOSED', 'CANCELLED'] } } }) : [];
  const assets = group ? await prisma.collateralAsset.findMany({ where: { groupId: group.id, countsAsCollateral: true, status: { not: 'RELEASED' } } }) : [];
  const accounts = group ? await prisma.escrowAccount.findMany({ where: { groupId: group.id, status: { not: 'CLOSED' } } }) : [];
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.securityDefault.create({
    data: {
      publicId: await id('SDF'),
      groupId: group?.id,
      loanId: loan?.id,
      loanIds: clean(input.loanIds) ?? loan?.publicId ?? null,
      borrower: input.borrower.trim(),
      defaultDate: dayRequired(input.defaultDate, 'Default date'),
      dpd: input.dpd ?? 0,
      principal: decimal(input.principal ?? (loan ? money(loan.principalOutstanding) : 0)),
      interest: decimal(input.interest ?? (loan ? money(loan.interestOutstanding) : 0)),
      fees: decimal(input.fees ?? (loan ? money(loan.feesOutstanding) : 0)),
      guaranteeExposure: decimal(roundMoney(guarantees.reduce((sum, item) => sum + exposureOf(item, null).remaining, 0))),
      collateralValue: decimal(roundMoney(assets.reduce((sum, item) => sum + Math.max(0, money(item.marketValue) * Number(item.haircutPercent) / 100 - money(item.encumbrance)), 0))),
      escrowAvailable: decimal(roundMoney(accounts.reduce((sum, item) => sum + figures(item).available, 0))),
      strategy: clean(input.strategy),
      officer,
      status: 'OPEN',
    },
  });
  await recordAudit({ trace, entityType: 'SecurityDefault', entityId: row.publicId, action: 'default.open', newStatus: 'OPEN' });
  return { defaultId: row.publicId, status: row.status };
}

export async function setOff(input: {
  accountId: string;
  loanId?: string;
  defaultCaseId?: string;
  amount: number;
  reason: string;
  authority: string;
  paymentReference?: string;
  externalTransactionId?: string;
}, trace: Trace) {
  const account = await findAccount(input.accountId);
  if (!account.setOffAllowed) {
    throw errors.unprocessable('SET_OFF_BLOCKED', 'The escrow agreement does not allow set-off. Switch the policy on before using escrow against a default.');
  }
  if (account.status !== 'ACTIVE') throw errors.unprocessable('ACCOUNT_NOT_ACTIVE', 'Set-off runs only on an active escrow account.');
  const amount = assertAmount(input.amount, 'Set-off');
  const position = figures(account);
  if (amount > position.available + 0.001) throw errors.unprocessable('INSUFFICIENT_AVAILABLE', 'Set-off can use only the available balance. Restricted funds stay restricted.');
  const external = await freshExternal(input.externalTransactionId, input.externalTransactionId ? 'BANK_TRANSFER' : undefined);
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.escrowSetOff.create({
      data: {
        publicId: await id('ESO'),
        accountId: account.id,
        groupId: account.groupId,
        loanId: loan?.id,
        defaultCaseId: clean(input.defaultCaseId),
        availableEscrow: decimal(position.available),
        restrictedEscrow: decimal(position.restricted),
        requestedAmount: decimal(amount),
        approvedAmount: decimal(amount),
        reason: input.reason.trim(),
        authority: input.authority.trim(),
        approval: officer,
        requestedById: trace.actorId,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        status: 'POSTED',
      },
    });
    await tx.escrowAccount.update({ where: { id: account.id }, data: { releases: { increment: decimal(amount) } } });
    await tx.escrowMovement.create({
      data: {
        publicId: await id('ETX'),
        accountId: account.id,
        type: 'RELEASE',
        transactionDate: new Date(),
        amount: decimal(amount),
        currency: account.currency,
        debitAccount: account.accountNumber,
        purpose: `Set-off: ${input.reason.trim()}`,
        paymentReference: clean(input.paymentReference),
        externalTransactionId: external.value,
        initiatedBy: officer,
        approvedBy: officer,
      },
    });
    return created;
  });
  await recordAudit({ trace, entityType: 'EscrowSetOff', entityId: row.publicId, action: 'escrow.setoff', amount, newStatus: 'POSTED', reason: input.reason });
  return { setOffId: row.publicId, status: row.status, remainingAvailable: roundMoney(position.available - amount) };
}

export async function reconcile(input: {
  accountId?: string;
  transactionDate: string;
  internalId?: string;
  externalId?: string;
  amount: number;
  paymentReference?: string;
  bankName?: string;
  expectedAmount: number;
  actualAmount: number;
  exceptionReason?: string;
  resolution?: string;
}, trace: Trace) {
  const account = input.accountId ? await findAccount(input.accountId) : null;
  const difference = roundMoney(input.actualAmount - input.expectedAmount);
  const external = clean(input.externalId);
  const matches = external ? await prisma.escrowMovement.count({ where: { externalTransactionId: external } }) : 0;
  let matchStatus = 'UNMATCHED';
  if (matches > 1) matchStatus = 'DUPLICATE';
  else if (matches === 1 && Math.abs(difference) < 0.01) matchStatus = 'MATCHED';
  else if (matches === 1) matchStatus = 'PARTIALLY_MATCHED';
  else if (Math.abs(difference) >= 0.01) matchStatus = 'UNMATCHED';
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.securityReconciliation.create({
    data: {
      publicId: await id('SRE'),
      accountId: account?.id,
      transactionDate: dayRequired(input.transactionDate, 'Transaction date'),
      internalId: clean(input.internalId),
      externalId: external,
      amount: decimal(input.amount),
      paymentReference: clean(input.paymentReference),
      bankName: clean(input.bankName),
      expectedAmount: decimal(input.expectedAmount),
      actualAmount: decimal(input.actualAmount),
      difference: decimal(difference),
      matchStatus,
      exceptionReason: clean(input.exceptionReason),
      reviewedBy: officer,
      resolution: clean(input.resolution),
    },
  });
  if (account && matchStatus === 'MATCHED') {
    await prisma.escrowAccount.update({ where: { id: account.id }, data: { lastReconciledAt: new Date() } });
    if (external) await prisma.escrowMovement.updateMany({ where: { accountId: account.id, externalTransactionId: external }, data: { reconciliationStatus: 'MATCHED' } });
  }
  await recordAudit({ trace, entityType: 'SecurityReconciliation', entityId: row.publicId, action: 'escrow.reconcile', newStatus: matchStatus, amount: input.amount });
  return { reconciliationId: row.publicId, matchStatus, difference };
}

export async function listReconciliations() {
  const rows = await prisma.securityReconciliation.findMany({ include: { account: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    reconciliationId: row.publicId,
    accountId: row.account?.publicId ?? null,
    transactionDate: dateOnly(row.transactionDate),
    internalId: row.internalId,
    externalId: row.externalId,
    expectedAmount: money(row.expectedAmount),
    actualAmount: money(row.actualAmount),
    difference: money(row.difference),
    matchStatus: row.matchStatus,
    exceptionReason: row.exceptionReason,
    resolution: row.resolution,
    reviewedBy: row.reviewedBy,
  }));
}

export async function addDocument(input: {
  entityType: string;
  entityId: string;
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName: string;
  comments?: string;
}, trace: Trace) {
  const row = await prisma.securityDocument.create({
    data: {
      publicId: await id('SDO'),
      entityType: input.entityType,
      entityId: input.entityId.trim(),
      documentType: input.documentType,
      documentNumber: clean(input.documentNumber),
      issueDate: input.issueDate ? dayRequired(input.issueDate, 'Issue date') : null,
      expiryDate: input.expiryDate ? dayRequired(input.expiryDate, 'Expiry date') : null,
      fileName: input.fileName.trim(),
      comments: clean(input.comments),
      verificationStatus: 'PENDING',
    },
  });
  await recordAudit({ trace, entityType: 'SecurityDocument', entityId: row.publicId, action: 'document.add', newStatus: 'PENDING' });
  return listDocuments();
}

export async function verifyDocument(documentId: string, input: { status: 'VERIFIED' | 'REJECTED'; comments?: string }, trace: Trace) {
  const row = await prisma.securityDocument.findUnique({ where: { publicId: documentId } });
  if (!row) throw errors.notFound('DOCUMENT_NOT_FOUND', 'The document could not be found.');
  const officer = await actorLabel(trace.actorId);
  await prisma.securityDocument.update({
    where: { id: row.id },
    data: { verificationStatus: input.status, verifiedBy: officer, verificationDate: new Date(), comments: clean(input.comments) ?? row.comments },
  });
  return listDocuments();
}

export async function listDocuments() {
  const rows = await prisma.securityDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    documentId: row.publicId,
    entityType: row.entityType,
    entityId: row.entityId,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    issueDate: dateOnly(row.issueDate),
    expiryDate: dateOnly(row.expiryDate),
    fileName: row.fileName,
    verificationStatus: row.verificationStatus,
    verifiedBy: row.verifiedBy,
    comments: row.comments,
  }));
}

export async function addApproval(input: {
  entityType: string;
  entityId: string;
  stage: string;
  requestedAction: string;
  level: string;
  decision: string;
  comments?: string;
  signature?: string;
}, trace: Trace) {
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.securityApproval.create({
    data: {
      publicId: await id('SAW'),
      entityType: input.entityType,
      entityId: input.entityId.trim(),
      stage: input.stage,
      requestedAction: input.requestedAction.trim(),
      level: input.level,
      approver: officer,
      approverId: trace.actorId,
      decision: input.decision,
      comments: clean(input.comments),
      signedAt: new Date(),
      signature: clean(input.signature),
      auditReference: trace.requestId,
    },
  });
  await recordAudit({ trace, entityType: 'SecurityApproval', entityId: row.publicId, action: 'approval.record', newStatus: input.decision, approvalReference: row.publicId });
  return { approvalId: row.publicId, decision: row.decision };
}

export async function listApprovals() {
  const rows = await prisma.securityApproval.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    approvalId: row.publicId,
    entityType: row.entityType,
    entityId: row.entityId,
    stage: row.stage,
    requestedAction: row.requestedAction,
    level: row.level,
    approver: row.approver,
    decision: row.decision,
    comments: row.comments,
    signedAt: row.signedAt.toISOString(),
  }));
}

export async function listAudit() {
  const rows = await prisma.securityAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 150 });
  return rows.map((row) => ({
    auditId: row.publicId,
    entityType: row.entityType,
    entityId: row.entityId,
    userId: row.userId,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    amount: row.amount == null ? null : money(row.amount),
    reason: row.reason,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listNotices() {
  const rows = await prisma.securityNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((row) => ({
    noticeId: row.publicId,
    event: row.event,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function report(type: string) {
  if (type === 'escrow-portfolio' || type === 'escrow-balance') {
    const rows = await prisma.escrowAccount.findMany({ include: { group: true } });
    return rows.map((row) => ({ id: row.publicId, name: row.name, group: row.group?.name ?? '', status: row.status, ...figures(row) }));
  }
  if (type === 'contributions' || type === 'allocation') {
    const rows = await prisma.escrowContribution.findMany({ include: { account: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.publicId, account: row.account.publicId, member: row.memberName, amount: money(row.amount), memberAllocation: money(row.memberAllocation), financeAllocation: money(row.financeAllocation), status: row.status }));
  }
  if (type === 'releases' || type === 'frozen') {
    const releases = await prisma.escrowRelease.findMany({ include: { account: true } });
    const freezes = await prisma.escrowFreeze.findMany({ include: { account: true } });
    return type === 'releases'
      ? releases.map((row) => ({ id: row.publicId, account: row.account.publicId, amount: money(row.requestedAmount), status: row.status }))
      : freezes.map((row) => ({ id: row.publicId, account: row.account.publicId, amount: money(row.amount), status: row.status }));
  }
  if (type === 'collateral' || type === 'collateral-value' || type === 'liens') {
    const rows = await prisma.collateralAsset.findMany({ include: { group: true, liens: true } });
    return rows.map((row) => ({
      id: row.publicId,
      group: row.group.name,
      type: row.collateralType,
      market: money(row.marketValue),
      eligible: row.countsAsCollateral ? Math.max(0, money(row.marketValue) * Number(row.haircutPercent) / 100 - money(row.encumbrance)) : 0,
      status: row.status,
      liens: row.liens.filter((item) => item.status === 'ACTIVE').length,
    }));
  }
  if (type === 'guarantees' || type === 'exposure' || type === 'claims' || type === 'recoveries' || type === 'fees') {
    if (type === 'claims') {
      const rows = await prisma.securityClaim.findMany({ include: { guarantee: true } });
      return rows.map((row) => ({ id: row.publicId, guarantee: row.guarantee.publicId, claimed: money(row.amountClaimed), approved: money(row.approvedAmount), status: row.status }));
    }
    if (type === 'recoveries') {
      const rows = await prisma.securityRecovery.findMany();
      return rows.map((row) => ({ id: row.publicId, amount: money(row.amount), source: row.source, outstanding: money(row.outstanding), status: row.status }));
    }
    if (type === 'fees') {
      const rows = await prisma.securityFee.findMany({ include: { guarantee: true } });
      return rows.map((row) => ({ id: row.publicId, guarantee: row.guarantee.publicId, fee: money(row.calculatedFee), status: row.paymentStatus }));
    }
    const rows = await prisma.securityGuarantee.findMany({ include: { group: true } });
    return rows.map((row) => ({ id: row.publicId, applicant: row.applicant, group: row.group?.name ?? '', exposure: exposureOf(row, null).remaining, status: row.status, expiry: dateOnly(row.expiryDate) }));
  }
  if (type === 'group-exposure' || type === 'coverage' || type === 'defaults') {
    const groups = await prisma.escrowGroup.findMany();
    return Promise.all(groups.map(async (group) => {
      const { groupExposure } = await import('./groups');
      const exposure = await groupExposure(group.publicId);
      return { id: group.publicId, name: group.name, ...exposure };
    }));
  }
  throw errors.notFound('REPORT_NOT_FOUND', 'That report is not in the escrow register.');
}

export async function notifyManual(input: { event: string; subject: string; body: string }, trace: Trace) {
  await notify(input.event, input.subject, input.body, trace.actorId);
  return listNotices();
}
