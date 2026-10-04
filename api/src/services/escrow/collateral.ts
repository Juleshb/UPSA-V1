import { errors } from '../../utils/errors';
import { decimal, money } from '../../utils/money';
import { prisma } from '../../utils/prisma';
import {
  actorLabel,
  assertAmount,
  clean,
  coverageOf,
  dateOnly,
  day,
  dayRequired,
  eligibleValue,
  figures,
  findAccount,
  findAsset,
  findGroup,
  id,
  notify,
  optionalSchool,
  recordAudit,
  roundMoney,
  type Trace,
} from './shared';

function assetEligible(row: { marketValue: { toString(): string } | number; haircutPercent: { toString(): string } | number; encumbrance: { toString(): string } | number; countsAsCollateral: boolean }) {
  return eligibleValue(money(row.marketValue as never), money(row.haircutPercent as never), money(row.encumbrance as never), row.countsAsCollateral);
}

export async function listAssets() {
  const rows = await prisma.collateralAsset.findMany({ include: { group: true, pool: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    collateralId: row.publicId,
    groupId: row.group.publicId,
    groupName: row.group.name,
    poolId: row.pool?.publicId ?? null,
    collateralType: row.collateralType,
    description: row.description,
    owner: row.owner,
    marketValue: money(row.marketValue),
    eligibleValue: assetEligible(row),
    status: row.status,
    countsAsCollateral: row.countsAsCollateral,
  }));
}

export async function listPools() {
  const rows = await prisma.collateralPool.findMany({ include: { group: true, assets: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row) => poolView(row));
}

function poolView(row: { publicId: string; name: string; purpose: string; haircutPercent: { toString(): string }; encumbrance: { toString(): string }; status: string; reviewDate: Date | null; assets: { marketValue: { toString(): string }; haircutPercent: { toString(): string }; encumbrance: { toString(): string }; countsAsCollateral: boolean; forcedSaleValue: { toString(): string }; status: string }[]; group: { publicId: string; name: string } }) {
  const active = row.assets.filter((item) => item.status !== 'RELEASED');
  const market = roundMoney(active.reduce((sum, item) => sum + money(item.marketValue as never), 0));
  const forced = roundMoney(active.reduce((sum, item) => sum + money(item.forcedSaleValue as never), 0));
  const eligible = roundMoney(active.reduce((sum, item) => sum + assetEligible(item), 0));
  const encumbrance = money(row.encumbrance as never);
  const net = roundMoney(Math.max(0, eligible - encumbrance));
  return {
    poolId: row.publicId,
    groupId: row.group.publicId,
    groupName: row.group.name,
    name: row.name,
    purpose: row.purpose,
    assets: row.assets.length,
    marketValue: market,
    forcedSaleValue: forced,
    haircutPercent: Number(row.haircutPercent),
    eligibleValue: eligible,
    encumbrance,
    netCollateralValue: net,
    availableCollateralValue: net,
    status: row.status,
    reviewDate: dateOnly(row.reviewDate),
  };
}

export async function createPool(input: { groupId: string; name: string; purpose: string; haircutPercent?: number; encumbrance?: number; reviewDate?: string }, trace: Trace) {
  const group = await findGroup(input.groupId);
  const row = await prisma.collateralPool.create({
    data: {
      publicId: await id('CPL'),
      groupId: group.id,
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      haircutPercent: decimal(input.haircutPercent ?? 80),
      encumbrance: decimal(input.encumbrance ?? 0),
      reviewDate: day(input.reviewDate),
      status: 'ACTIVE',
    },
  });
  await recordAudit({ trace, entityType: 'CollateralPool', entityId: row.publicId, action: 'collateral.pool', newStatus: 'ACTIVE' });
  return listPools();
}

export async function registerAsset(input: {
  groupId: string;
  poolId?: string;
  accountId?: string;
  schoolId?: string;
  collateralType: string;
  description: string;
  owner: string;
  coOwners?: string;
  ownershipPercent?: number;
  location?: string;
  registrationNumber?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  marketValue: number;
  forcedSaleValue: number;
  valuer?: string;
  haircutPercent?: number;
  ownershipDocument?: string;
  insurance?: string;
  insuranceExpiry?: string;
  encumbrance?: number;
  securityRegistration?: string;
}, trace: Trace) {
  const group = await findGroup(input.groupId);
  const pool = input.poolId ? await prisma.collateralPool.findUnique({ where: { publicId: input.poolId } }) : null;
  const account = input.accountId ? await findAccount(input.accountId) : null;
  const school = await optionalSchool(input.schoolId);
  const depositInEscrow = input.collateralType === 'DEPOSIT' && Boolean(account);
  const row = await prisma.collateralAsset.create({
    data: {
      publicId: await id('COL'),
      groupId: group.id,
      poolId: pool?.id,
      accountId: account?.id,
      schoolId: school?.id ?? group.schoolId,
      collateralType: input.collateralType,
      description: input.description.trim(),
      owner: input.owner.trim(),
      coOwners: clean(input.coOwners),
      ownershipPercent: decimal(input.ownershipPercent ?? 100),
      location: clean(input.location),
      registrationNumber: clean(input.registrationNumber),
      acquisitionDate: day(input.acquisitionDate),
      acquisitionCost: input.acquisitionCost == null ? null : decimal(input.acquisitionCost),
      marketValue: decimal(input.marketValue),
      forcedSaleValue: decimal(input.forcedSaleValue),
      valuer: clean(input.valuer),
      haircutPercent: decimal(input.haircutPercent ?? (pool ? Number(pool.haircutPercent) : 80)),
      ownershipDocument: clean(input.ownershipDocument),
      insurance: clean(input.insurance),
      insuranceExpiry: day(input.insuranceExpiry),
      encumbrance: decimal(input.encumbrance ?? 0),
      securityRegistration: clean(input.securityRegistration),
      countsAsCollateral: !depositInEscrow,
      status: 'PROPOSED',
    },
  });
  await recordAudit({ trace, entityType: 'Collateral', entityId: row.publicId, action: 'collateral.register', newStatus: 'PROPOSED', amount: input.marketValue });
  await notify('Collateral registered', `Collateral ${row.publicId}`, depositInEscrow
    ? 'This deposit is already in escrow, so it is not counted again as collateral.'
    : `${row.description} is proposed for the group pool.`, trace.actorId);
  return assetFile(row.publicId);
}

export async function verifyAsset(assetId: string, input: {
  ownershipVerified: boolean;
  registrationVerified: boolean;
  physicalVerification: boolean;
  lienCheck: boolean;
  insuranceVerified: boolean;
  valuationVerified: boolean;
  legalVerified: boolean;
  result: string;
  comments?: string;
  verificationDate: string;
}, trace: Trace) {
  const asset = await findAsset(assetId);
  const officer = await actorLabel(trace.actorId);
  const status = input.result === 'VERIFIED' ? 'VERIFIED' : input.result === 'FAILED' ? 'PROPOSED' : 'DOCUMENT_CHECK';
  await prisma.collateralVerification.create({
    data: {
      publicId: await id('CVF'),
      assetId: asset.id,
      ownershipVerified: input.ownershipVerified,
      registrationVerified: input.registrationVerified,
      physicalVerification: input.physicalVerification,
      lienCheck: input.lienCheck,
      insuranceVerified: input.insuranceVerified,
      valuationVerified: input.valuationVerified,
      legalVerified: input.legalVerified,
      officer,
      verificationDate: dayRequired(input.verificationDate, 'Verification date'),
      result: input.result,
      comments: clean(input.comments),
    },
  });
  await prisma.collateralAsset.update({ where: { id: asset.id }, data: { status } });
  await recordAudit({ trace, entityType: 'Collateral', entityId: asset.publicId, action: 'collateral.verify', previousStatus: asset.status, newStatus: status });
  return assetFile(asset.publicId);
}

export async function valueAsset(assetId: string, input: {
  marketValue: number;
  forcedSaleValue: number;
  replacementValue?: number;
  method: string;
  valuer: string;
  valuerRegistration?: string;
  valuationDate: string;
  report?: string;
  reviewDate?: string;
  approvedValue: number;
  comments?: string;
}, trace: Trace) {
  const asset = await findAsset(assetId);
  const officer = await actorLabel(trace.actorId);
  await prisma.collateralValuation.create({
    data: {
      publicId: await id('CVL'),
      assetId: asset.id,
      assetType: asset.collateralType,
      marketValue: decimal(input.marketValue),
      forcedSaleValue: decimal(input.forcedSaleValue),
      replacementValue: input.replacementValue == null ? null : decimal(input.replacementValue),
      method: input.method,
      valuer: input.valuer.trim(),
      valuerRegistration: clean(input.valuerRegistration),
      valuationDate: dayRequired(input.valuationDate, 'Valuation date'),
      report: clean(input.report),
      reviewDate: day(input.reviewDate),
      approvedValue: decimal(input.approvedValue),
      reviewer: officer,
      comments: clean(input.comments),
    },
  });
  const next = ['PROPOSED', 'DOCUMENT_CHECK', 'VERIFIED'].includes(asset.status) ? 'VALUED' : asset.status;
  await prisma.collateralAsset.update({
    where: { id: asset.id },
    data: {
      marketValue: decimal(input.approvedValue),
      forcedSaleValue: decimal(input.forcedSaleValue),
      valuationDate: dayRequired(input.valuationDate, 'Valuation date'),
      valuer: input.valuer.trim(),
      status: next,
    },
  });
  await recordAudit({ trace, entityType: 'Collateral', entityId: asset.publicId, action: 'collateral.value', previousStatus: asset.status, newStatus: next, amount: input.approvedValue });
  return assetFile(asset.publicId);
}

export async function markAsset(assetId: string, status: 'REGISTERED' | 'ACTIVE', trace: Trace) {
  const asset = await findAsset(assetId);
  await prisma.collateralAsset.update({ where: { id: asset.id }, data: { status } });
  await recordAudit({ trace, entityType: 'Collateral', entityId: asset.publicId, action: 'collateral.status', previousStatus: asset.status, newStatus: status });
  return assetFile(asset.publicId);
}

export async function addLien(assetId: string, input: {
  loanId?: string;
  guaranteeId?: string;
  institutionName?: string;
  securedAmount: number;
  registrationNumber?: string;
  registrationDate?: string;
  priority?: number;
  expiryDate?: string;
  releaseConditions?: string;
}, trace: Trace) {
  const asset = await findAsset(assetId);
  const amount = assertAmount(input.securedAmount, 'Secured amount');
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  if (input.loanId && !loan) throw errors.notFound('LOAN_NOT_FOUND', 'The loan could not be found.');
  const row = await prisma.collateralLien.create({
    data: {
      publicId: await id('CLI'),
      assetId: asset.id,
      loanId: loan?.id,
      guaranteeId: clean(input.guaranteeId),
      institutionName: clean(input.institutionName),
      securedAmount: decimal(amount),
      registrationNumber: clean(input.registrationNumber),
      registrationDate: day(input.registrationDate),
      priority: input.priority ?? 1,
      expiryDate: day(input.expiryDate),
      releaseConditions: clean(input.releaseConditions),
      status: 'ACTIVE',
    },
  });
  await prisma.collateralAsset.update({ where: { id: asset.id }, data: { lienStatus: 'PLEDGED', status: asset.status === 'RELEASED' ? asset.status : 'PLEDGED' } });
  await recordAudit({ trace, entityType: 'CollateralLien', entityId: row.publicId, action: 'collateral.lien', amount, newStatus: 'ACTIVE' });
  return assetFile(asset.publicId);
}

export async function releaseAsset(assetId: string, input: { reason: string; loanId?: string; registryReference?: string }, trace: Trace) {
  const asset = await findAsset(assetId);
  const guarantees = await prisma.securityGuarantee.findMany({ where: { assetId: asset.id, status: { in: ['ACTIVE', 'ISSUED', 'CLAIMED', 'PARTIALLY_PAID', 'RECOVERY'] } } });
  const exposure = guarantees.reduce((sum, row) => sum + Math.max(0, money(row.maximumLiability) - money(row.claimsPaid) + money(row.recoveries)), 0);
  if (exposure > 0) throw errors.unprocessable('EXPOSURE_REMAINS', 'Collateral stays pledged while a guarantee exposure is still open.');
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const officer = await actorLabel(trace.actorId);
  await prisma.collateralRelease.create({
    data: {
      publicId: await id('CXR'),
      assetId: asset.id,
      loanId: loan?.id,
      groupId: asset.groupId,
      exposure: decimal(exposure),
      reason: input.reason.trim(),
      approval: officer,
      requestedById: trace.actorId,
      releaseDate: new Date(),
      registryReference: clean(input.registryReference),
      status: 'RELEASED',
    },
  });
  await prisma.collateralLien.updateMany({ where: { assetId: asset.id, status: 'ACTIVE' }, data: { status: 'RELEASED' } });
  await prisma.collateralAsset.update({ where: { id: asset.id }, data: { status: 'RELEASED', lienStatus: 'RELEASED' } });
  await recordAudit({ trace, entityType: 'Collateral', entityId: asset.publicId, action: 'collateral.release', previousStatus: asset.status, newStatus: 'RELEASED', reason: input.reason });
  return assetFile(asset.publicId);
}

export async function substituteAsset(input: { existingId: string; replacementId: string; reason: string; loanExposure?: number }, trace: Trace) {
  const existing = await findAsset(input.existingId);
  const replacement = await findAsset(input.replacementId);
  if (existing.id === replacement.id) throw errors.unprocessable('SAME_COLLATERAL', 'Choose a different asset as the replacement.');
  const before = assetEligible(existing);
  const after = assetEligible(replacement);
  const exposure = input.loanExposure ?? 0;
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.collateralSubstitution.create({
    data: {
      publicId: await id('CSU'),
      existingId: existing.id,
      replacementId: replacement.id,
      existingValue: decimal(before),
      replacementValue: decimal(after),
      reason: input.reason.trim(),
      loanExposure: decimal(exposure),
      coverageBefore: decimal(exposure > 0 ? roundMoney(before / exposure * 100) : 0),
      coverageAfter: decimal(exposure > 0 ? roundMoney(after / exposure * 100) : 0),
      approval: officer,
      effectiveDate: new Date(),
    },
  });
  await prisma.collateralAsset.update({ where: { id: existing.id }, data: { status: 'RELEASED' } });
  await prisma.collateralAsset.update({ where: { id: replacement.id }, data: { status: 'ACTIVE' } });
  await recordAudit({ trace, entityType: 'CollateralSubstitution', entityId: row.publicId, action: 'collateral.substitute', amount: after, reason: input.reason });
  return assetFile(replacement.publicId);
}

export async function watchAsset(assetId: string, input: {
  currentValue: number;
  insuranceStatus: string;
  physicalCondition?: string;
  ownershipStatus?: string;
  encumbrance?: number;
  reviewRequired?: boolean;
  nextReviewDate?: string;
  comments?: string;
  valuationDate: string;
}, trace: Trace) {
  const asset = await findAsset(assetId);
  const officer = await actorLabel(trace.actorId);
  const previous = money(asset.marketValue);
  const liens = await prisma.collateralLien.aggregate({ where: { assetId: asset.id, status: 'ACTIVE' }, _sum: { securedAmount: true } });
  const secured = money(liens._sum.securedAmount);
  const eligible = eligibleValue(input.currentValue, Number(asset.haircutPercent), input.encumbrance ?? money(asset.encumbrance), asset.countsAsCollateral);
  const ratio = secured > 0 ? roundMoney(eligible / secured * 100) : 0;
  await prisma.collateralWatch.create({
    data: {
      publicId: await id('CWM'),
      assetId: asset.id,
      currentValue: decimal(input.currentValue),
      previousValue: decimal(previous),
      valuationDate: dayRequired(input.valuationDate, 'Valuation date'),
      insuranceStatus: input.insuranceStatus,
      physicalCondition: clean(input.physicalCondition),
      ownershipStatus: clean(input.ownershipStatus),
      encumbrance: decimal(input.encumbrance ?? money(asset.encumbrance)),
      coverageRatio: decimal(ratio),
      reviewRequired: input.reviewRequired ?? ratio < 100,
      nextReviewDate: day(input.nextReviewDate),
      officer,
      comments: clean(input.comments),
    },
  });
  await prisma.collateralAsset.update({
    where: { id: asset.id },
    data: { marketValue: decimal(input.currentValue), encumbrance: decimal(input.encumbrance ?? money(asset.encumbrance)) },
  });
  await recordAudit({ trace, entityType: 'Collateral', entityId: asset.publicId, action: 'collateral.monitor', amount: input.currentValue });
  return assetFile(asset.publicId);
}

export async function realizeAsset(assetId: string, input: {
  loanId?: string;
  defaultCaseId?: string;
  approvedValue: number;
  realizedValue: number;
  costs?: number;
  buyer?: string;
  saleReference?: string;
  saleDate?: string;
  allocation?: string;
}, trace: Trace) {
  const asset = await findAsset(assetId);
  const costs = input.costs ?? 0;
  const net = roundMoney(input.realizedValue - costs);
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.collateralRealization.create({
    data: {
      publicId: await id('CRZ'),
      assetId: asset.id,
      loanId: loan?.id,
      groupId: asset.groupId,
      defaultCaseId: clean(input.defaultCaseId),
      approvedValue: decimal(input.approvedValue),
      realizedValue: decimal(input.realizedValue),
      costs: decimal(costs),
      netRecovery: decimal(net),
      saleDate: day(input.saleDate),
      buyer: clean(input.buyer),
      saleReference: clean(input.saleReference),
      approval: officer,
      allocation: clean(input.allocation),
    },
  });
  await prisma.collateralAsset.update({ where: { id: asset.id }, data: { status: 'RELEASED', lienStatus: 'REALIZED' } });
  await recordAudit({ trace, entityType: 'CollateralRealization', entityId: row.publicId, action: 'collateral.realize', amount: net });
  return assetFile(asset.publicId);
}

export async function enforcePool(input: {
  poolId: string;
  loanId?: string;
  defaultCaseId?: string;
  reason: string;
  legalReference?: string;
  assetName?: string;
  value?: number;
  enforcementDate: string;
  legalRepresentative?: string;
}, trace: Trace) {
  const pool = await prisma.collateralPool.findUnique({ where: { publicId: input.poolId } });
  if (!pool) throw errors.notFound('POOL_NOT_FOUND', 'The collateral pool could not be found.');
  const loan = input.loanId ? await prisma.loan.findUnique({ where: { publicId: input.loanId } }) : null;
  const officer = await actorLabel(trace.actorId);
  const row = await prisma.collateralEnforcement.create({
    data: {
      publicId: await id('CEN'),
      poolId: pool.id,
      groupId: pool.groupId,
      loanId: loan?.id,
      defaultCaseId: clean(input.defaultCaseId),
      reason: input.reason.trim(),
      legalReference: clean(input.legalReference),
      assetName: clean(input.assetName),
      value: decimal(input.value ?? 0),
      enforcementDate: dayRequired(input.enforcementDate, 'Enforcement date'),
      officer,
      legalRepresentative: clean(input.legalRepresentative),
      status: 'OPEN',
    },
  });
  await recordAudit({ trace, entityType: 'CollateralEnforcement', entityId: row.publicId, action: 'collateral.enforce', newStatus: 'OPEN', amount: input.value ?? 0 });
  return { enforcementId: row.publicId, status: row.status };
}

export async function assetFile(publicId: string) {
  const row = await prisma.collateralAsset.findUnique({
    where: { publicId },
    include: {
      group: true,
      pool: true,
      account: true,
      valuations: { orderBy: { createdAt: 'desc' } },
      verifications: { orderBy: { createdAt: 'desc' } },
      liens: { orderBy: { createdAt: 'desc' } },
      releases: { orderBy: { createdAt: 'desc' } },
      watches: { orderBy: { createdAt: 'desc' } },
      realizations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!row) throw errors.notFound('COLLATERAL_NOT_FOUND', 'The collateral could not be found.');
  const eligible = assetEligible(row);
  const escrow = row.account ? figures(row.account).available : 0;
  return {
    collateralId: row.publicId,
    groupId: row.group.publicId,
    groupName: row.group.name,
    poolId: row.pool?.publicId ?? null,
    accountId: row.account?.publicId ?? null,
    collateralType: row.collateralType,
    description: row.description,
    owner: row.owner,
    coOwners: row.coOwners,
    ownershipPercent: Number(row.ownershipPercent),
    location: row.location,
    registrationNumber: row.registrationNumber,
    acquisitionDate: dateOnly(row.acquisitionDate),
    acquisitionCost: row.acquisitionCost == null ? null : money(row.acquisitionCost),
    marketValue: money(row.marketValue),
    forcedSaleValue: money(row.forcedSaleValue),
    haircutPercent: Number(row.haircutPercent),
    eligibleValue: eligible,
    countsAsCollateral: row.countsAsCollateral,
    escrowAvailable: escrow,
    coverage: coverageOf({ exposure: 0, escrowAvailable: row.countsAsCollateral ? 0 : escrow, eligibleCollateral: eligible, guaranteeCoverage: 0 }),
    ownershipDocument: row.ownershipDocument,
    insurance: row.insurance,
    insuranceExpiry: dateOnly(row.insuranceExpiry),
    encumbrance: money(row.encumbrance),
    lienStatus: row.lienStatus,
    securityRegistration: row.securityRegistration,
    status: row.status,
    valuations: row.valuations.map((item) => ({ valuationId: item.publicId, marketValue: money(item.marketValue), forcedSaleValue: money(item.forcedSaleValue), approvedValue: money(item.approvedValue), method: item.method, valuer: item.valuer, valuationDate: dateOnly(item.valuationDate), reviewDate: dateOnly(item.reviewDate) })),
    verifications: row.verifications.map((item) => ({ verificationId: item.publicId, result: item.result, officer: item.officer, verificationDate: dateOnly(item.verificationDate), comments: item.comments })),
    liens: row.liens.map((item) => ({ lienId: item.publicId, securedAmount: money(item.securedAmount), institutionName: item.institutionName, priority: item.priority, status: item.status, registrationNumber: item.registrationNumber })),
    releases: row.releases.map((item) => ({ releaseId: item.publicId, reason: item.reason, status: item.status, releaseDate: dateOnly(item.releaseDate) })),
    watches: row.watches.map((item) => ({ watchId: item.publicId, currentValue: money(item.currentValue), previousValue: money(item.previousValue), insuranceStatus: item.insuranceStatus, coverageRatio: Number(item.coverageRatio), reviewRequired: item.reviewRequired })),
    realizations: row.realizations.map((item) => ({ realizationId: item.publicId, realizedValue: money(item.realizedValue), costs: money(item.costs), netRecovery: money(item.netRecovery), buyer: item.buyer })),
  };
}
