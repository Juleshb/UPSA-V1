-- CreateTable
CREATE TABLE "EscrowGroup" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "formationDate" TIMESTAMP(3),
    "purpose" TEXT NOT NULL,
    "address" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "contact" TEXT,
    "chairperson" TEXT,
    "secretary" TEXT,
    "treasurer" TEXT,
    "representatives" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "membershipStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowGroupMember" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "schoolId" TEXT,
    "memberType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolName" TEXT,
    "membershipNumber" TEXT,
    "contributionPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "contributionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "votingRights" BOOLEAN NOT NULL DEFAULT true,
    "guaranteeParticipation" BOOLEAN NOT NULL DEFAULT true,
    "collateralParticipation" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowAccount" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "purpose" TEXT NOT NULL,
    "description" TEXT,
    "openingDate" TIMESTAMP(3) NOT NULL,
    "expectedClosingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "groupId" TEXT,
    "schoolId" TEXT,
    "institutionId" TEXT,
    "representative" TEXT,
    "signatory" TEXT,
    "contact" TEXT,
    "bankName" TEXT,
    "branch" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "settlementAccount" TEXT,
    "paymentReference" TEXT,
    "memberPercent" DECIMAL(6,2) NOT NULL DEFAULT 40,
    "financePercent" DECIMAL(6,2) NOT NULL DEFAULT 60,
    "requiredContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "requiredFinancing" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maximumBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "contributionFrequency" TEXT,
    "allocationRule" TEXT,
    "releaseRule" TEXT,
    "withdrawalRestricted" BOOLEAN NOT NULL DEFAULT true,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "dualAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "freezeAllowed" BOOLEAN NOT NULL DEFAULT true,
    "partialReleaseAllowed" BOOLEAN NOT NULL DEFAULT true,
    "setOffAllowed" BOOLEAN NOT NULL DEFAULT false,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "contributions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transfersIn" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transfersOut" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "releases" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "frozenAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "restrictedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memberComponent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financeComponent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lastReconciledAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowAgreement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "parties" TEXT NOT NULL,
    "agent" TEXT,
    "institutionName" TEXT,
    "purpose" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "rule" TEXT NOT NULL,
    "contributionRequirements" TEXT,
    "releaseConditions" TEXT,
    "withdrawalConditions" TEXT,
    "defaultConditions" TEXT,
    "terminationConditions" TEXT,
    "disputeResolution" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "signatures" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowContribution" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "contributionType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "contributionDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "memberAllocation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financeAllocation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceOfFunds" TEXT,
    "document" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "railCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowGroupContribution" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "accountId" TEXT,
    "requiredContribution" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "contributors" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "paymentReference" TEXT,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approval" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowGroupContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowAllocation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "memberAmount" DECIMAL(18,2) NOT NULL,
    "financeAmount" DECIMAL(18,2) NOT NULL,
    "memberPercent" DECIMAL(6,2) NOT NULL,
    "financePercent" DECIMAL(6,2) NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "rule" TEXT NOT NULL,
    "sourceTransaction" TEXT,
    "destinationAccount" TEXT,
    "purpose" TEXT,
    "officer" TEXT,
    "approvalReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowMovement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "debitAccount" TEXT,
    "creditAccount" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "purpose" TEXT,
    "initiatedBy" TEXT,
    "approvedBy" TEXT,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "document" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowFreeze" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authority" TEXT,
    "document" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "legalReference" TEXT,
    "requestedBy" TEXT,
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowFreeze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowRelease" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "fromRestricted" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "documents" JSONB,
    "requestedBy" TEXT,
    "requestedById" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "releaseDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "railCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowWithdrawal" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "minimumAfter" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approval" TEXT,
    "requestedById" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "railCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowRefund" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "originalTransaction" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "destinationAccount" TEXT,
    "approval" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "railCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowClosure" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "reason" TEXT NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "obligations" TEXT,
    "restrictedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pendingClaims" INTEGER NOT NULL DEFAULT 0,
    "pendingReleases" INTEGER NOT NULL DEFAULT 0,
    "settlementAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "destinationAccount" TEXT,
    "approvedBy" TEXT,
    "closureDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralPool" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "haircutPercent" DECIMAL(6,2) NOT NULL DEFAULT 80,
    "encumbrance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollateralPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralAsset" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "poolId" TEXT,
    "accountId" TEXT,
    "schoolId" TEXT,
    "collateralType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "coOwners" TEXT,
    "ownershipPercent" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "location" TEXT,
    "registrationNumber" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(18,2),
    "marketValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "forcedSaleValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valuationDate" TIMESTAMP(3),
    "valuer" TEXT,
    "haircutPercent" DECIMAL(6,2) NOT NULL DEFAULT 80,
    "ownershipDocument" TEXT,
    "insurance" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "encumbrance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lienStatus" TEXT NOT NULL DEFAULT 'NONE',
    "securityRegistration" TEXT,
    "countsAsCollateral" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollateralAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralValuation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "marketValue" DECIMAL(18,2) NOT NULL,
    "forcedSaleValue" DECIMAL(18,2) NOT NULL,
    "replacementValue" DECIMAL(18,2),
    "method" TEXT NOT NULL,
    "valuer" TEXT NOT NULL,
    "valuerRegistration" TEXT,
    "valuationDate" TIMESTAMP(3) NOT NULL,
    "report" TEXT,
    "reviewDate" TIMESTAMP(3),
    "approvedValue" DECIMAL(18,2) NOT NULL,
    "reviewer" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralVerification" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ownershipVerified" BOOLEAN NOT NULL DEFAULT false,
    "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
    "physicalVerification" BOOLEAN NOT NULL DEFAULT false,
    "lienCheck" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "valuationVerified" BOOLEAN NOT NULL DEFAULT false,
    "legalVerified" BOOLEAN NOT NULL DEFAULT false,
    "officer" TEXT,
    "verificationDate" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralLien" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "loanId" TEXT,
    "guaranteeId" TEXT,
    "institutionName" TEXT,
    "securedAmount" DECIMAL(18,2) NOT NULL,
    "registrationNumber" TEXT,
    "registrationDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "expiryDate" TIMESTAMP(3),
    "releaseConditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralLien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralRelease" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "loanId" TEXT,
    "groupId" TEXT,
    "exposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "approval" TEXT,
    "requestedById" TEXT,
    "releaseDate" TIMESTAMP(3),
    "registryReference" TEXT,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralSubstitution" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "existingId" TEXT NOT NULL,
    "replacementId" TEXT NOT NULL,
    "existingValue" DECIMAL(18,2) NOT NULL,
    "replacementValue" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "loanExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coverageBefore" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "coverageAfter" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "approval" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralWatch" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "previousValue" DECIMAL(18,2) NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL,
    "insuranceStatus" TEXT NOT NULL,
    "physicalCondition" TEXT,
    "ownershipStatus" TEXT,
    "encumbrance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coverageRatio" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextReviewDate" TIMESTAMP(3),
    "officer" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralRealization" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "loanId" TEXT,
    "groupId" TEXT,
    "defaultCaseId" TEXT,
    "approvedValue" DECIMAL(18,2) NOT NULL,
    "realizedValue" DECIMAL(18,2) NOT NULL,
    "costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netRecovery" DECIMAL(18,2) NOT NULL,
    "saleDate" TIMESTAMP(3),
    "buyer" TEXT,
    "saleReference" TEXT,
    "approval" TEXT,
    "allocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralRealization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralEnforcement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "poolId" TEXT,
    "groupId" TEXT,
    "loanId" TEXT,
    "defaultCaseId" TEXT,
    "reason" TEXT NOT NULL,
    "legalReference" TEXT,
    "assetName" TEXT,
    "value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "enforcementDate" TIMESTAMP(3) NOT NULL,
    "officer" TEXT,
    "legalRepresentative" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "recoveryAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralEnforcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFacility" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "facilityNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionId" TEXT,
    "groupId" TEXT,
    "facilityType" TEXT NOT NULL,
    "approvedLimit" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "guaranteePercent" DECIMAL(6,2) NOT NULL,
    "maximumAmount" DECIMAL(18,2) NOT NULL,
    "feeRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "terms" TEXT,
    "dualAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityApplication" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicant" TEXT NOT NULL,
    "groupId" TEXT,
    "schoolId" TEXT,
    "loanApplicationId" TEXT,
    "product" TEXT,
    "requestedLoan" DECIMAL(18,2) NOT NULL,
    "requestedGuarantee" DECIMAL(18,2) NOT NULL,
    "guaranteePercent" DECIMAL(6,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "facilityId" TEXT,
    "assetId" TEXT,
    "accountId" TEXT,
    "contribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "riskInformation" TEXT,
    "documents" JSONB,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEligibility" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicantEligibility" BOOLEAN NOT NULL,
    "membershipStatus" TEXT NOT NULL,
    "contributionStatus" TEXT NOT NULL,
    "escrowRequirementMet" BOOLEAN NOT NULL,
    "loanEligibility" BOOLEAN NOT NULL,
    "collateralRequirement" BOOLEAN NOT NULL,
    "financialCriteria" BOOLEAN NOT NULL,
    "existingGuarantee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "existingLoan" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "groupExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "concentrationLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "result" TEXT NOT NULL,
    "reviewer" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SecurityEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAssessment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "loanAmount" DECIMAL(18,2) NOT NULL,
    "requestedGuarantee" DECIMAL(18,2) NOT NULL,
    "existingExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "escrowBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collateralValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "repaymentCapacity" TEXT,
    "riskFactors" TEXT,
    "mitigation" TEXT,
    "recommended" DECIMAL(18,2) NOT NULL,
    "conditions" TEXT,
    "result" TEXT NOT NULL,
    "assessor" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDecision" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "facilityId" TEXT,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "approvedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "guaranteePercent" DECIMAL(6,2) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "conditions" TEXT,
    "decision" TEXT NOT NULL,
    "decisionMaker" TEXT,
    "decisionMakerId" TEXT,
    "institutionName" TEXT,
    "decisionDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "SecurityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityGuarantee" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "facilityId" TEXT,
    "applicationId" TEXT,
    "applicant" TEXT NOT NULL,
    "groupId" TEXT,
    "schoolId" TEXT,
    "institutionId" TEXT,
    "loanApplicationId" TEXT,
    "loanPublicId" TEXT,
    "guaranteedPrincipal" DECIMAL(18,2) NOT NULL,
    "guaranteePercent" DECIMAL(6,2) NOT NULL,
    "maximumLiability" DECIMAL(18,2) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "conditions" TEXT,
    "assetId" TEXT,
    "accountId" TEXT,
    "claimsPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recoveries" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "legacyGuaranteeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityGuarantee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityCertificate" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "loanPublicId" TEXT,
    "applicant" TEXT NOT NULL,
    "groupName" TEXT,
    "lender" TEXT,
    "guaranteedAmount" DECIMAL(18,2) NOT NULL,
    "guaranteePercent" DECIMAL(6,2) NOT NULL,
    "originalLoanAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "conditions" TEXT,
    "claimConditions" TEXT,
    "signatory" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFee" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "baseAmount" DECIMAL(18,2) NOT NULL,
    "calculatedFee" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'DUE',
    "paymentReference" TEXT,
    "waiver" BOOLEAN NOT NULL DEFAULT false,
    "approval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRenewal" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "currentExpiry" TIMESTAMP(3),
    "requestedExpiry" TIMESTAMP(3) NOT NULL,
    "currentExposure" DECIMAL(18,2) NOT NULL,
    "updatedExposure" DECIMAL(18,2) NOT NULL,
    "updatedCollateral" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updatedEscrow" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "renewalFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "approval" TEXT,
    "requestedById" TEXT,
    "newCertificate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAmendment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "originalTerms" TEXT,
    "requestedChange" TEXT NOT NULL,
    "newAmount" DECIMAL(18,2),
    "newExpiry" TIMESTAMP(3),
    "newPercent" DECIMAL(6,2),
    "reason" TEXT NOT NULL,
    "documents" JSONB,
    "approval" TEXT,
    "requestedById" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityClaim" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "loanId" TEXT,
    "borrower" TEXT NOT NULL,
    "groupId" TEXT,
    "lender" TEXT,
    "defaultDate" TIMESTAMP(3),
    "outstandingPrincipal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingInterest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "guaranteedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountClaimed" DECIMAL(18,2) NOT NULL,
    "eligibleAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rejectedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "recoveryActions" TEXT,
    "documents" JSONB,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "guaranteeValid" BOOLEAN NOT NULL DEFAULT false,
    "certificateValid" BOOLEAN NOT NULL DEFAULT false,
    "loanValid" BOOLEAN NOT NULL DEFAULT false,
    "defaultVerified" BOOLEAN NOT NULL DEFAULT false,
    "assessmentResult" TEXT,
    "assessor" TEXT,
    "assessedAt" TIMESTAMP(3),
    "approver" TEXT,
    "approverId" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalReason" TEXT,
    "conditions" TEXT,
    "paymentReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityClaimPayment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "bankAccount" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "railCode" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityClaimPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRecovery" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "loanId" TEXT,
    "groupId" TEXT,
    "borrower" TEXT NOT NULL,
    "claimPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL,
    "source" TEXT NOT NULL,
    "recoveryDate" TIMESTAMP(3) NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "officer" TEXT,
    "action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "externalTransactionId" TEXT,
    "railCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRecoverySplit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "amountRecovered" DECIMAL(18,2) NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingClaim" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "splitDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRecoverySplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityCancellation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guaranteeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "currentExposure" DECIMAL(18,2) NOT NULL,
    "unusedGuarantee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "claims" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "document" TEXT,
    "requestedBy" TEXT,
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "cancellationDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityLink" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT,
    "accountId" TEXT,
    "poolId" TEXT,
    "facilityId" TEXT,
    "loanApplicationId" TEXT,
    "loanId" TEXT,
    "memberContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financeComponent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collateralValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "guaranteedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDefault" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "groupId" TEXT,
    "loanId" TEXT,
    "loanIds" TEXT,
    "borrower" TEXT NOT NULL,
    "defaultDate" TIMESTAMP(3) NOT NULL,
    "dpd" INTEGER NOT NULL DEFAULT 0,
    "principal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "guaranteeExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collateralValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "escrowAvailable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "strategy" TEXT,
    "officer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowSetOff" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "loanId" TEXT,
    "defaultCaseId" TEXT,
    "availableEscrow" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "restrictedEscrow" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "approvedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "approval" TEXT,
    "requestedById" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowSetOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityReconciliation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "internalId" TEXT,
    "externalId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentReference" TEXT,
    "bankName" TEXT,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "actualAmount" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL,
    "matchStatus" TEXT NOT NULL,
    "exceptionReason" TEXT,
    "reviewedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDocument" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileName" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityApproval" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "approver" TEXT,
    "approverId" TEXT,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signature" TEXT,
    "auditReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "institution" TEXT,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amount" DECIMAL(18,2),
    "reason" TEXT,
    "approvalReference" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityNotice" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowGroup_publicId_key" ON "EscrowGroup"("publicId");

-- CreateIndex
CREATE INDEX "EscrowGroup_schoolId_idx" ON "EscrowGroup"("schoolId");

-- CreateIndex
CREATE INDEX "EscrowGroup_status_idx" ON "EscrowGroup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowGroupMember_publicId_key" ON "EscrowGroupMember"("publicId");

-- CreateIndex
CREATE INDEX "EscrowGroupMember_groupId_idx" ON "EscrowGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "EscrowGroupMember_schoolId_idx" ON "EscrowGroupMember"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAccount_publicId_key" ON "EscrowAccount"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAccount_accountNumber_key" ON "EscrowAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "EscrowAccount_groupId_idx" ON "EscrowAccount"("groupId");

-- CreateIndex
CREATE INDEX "EscrowAccount_schoolId_idx" ON "EscrowAccount"("schoolId");

-- CreateIndex
CREATE INDEX "EscrowAccount_status_idx" ON "EscrowAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAgreement_publicId_key" ON "EscrowAgreement"("publicId");

-- CreateIndex
CREATE INDEX "EscrowAgreement_accountId_idx" ON "EscrowAgreement"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowContribution_publicId_key" ON "EscrowContribution"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowContribution_externalTransactionId_key" ON "EscrowContribution"("externalTransactionId");

-- CreateIndex
CREATE INDEX "EscrowContribution_accountId_idx" ON "EscrowContribution"("accountId");

-- CreateIndex
CREATE INDEX "EscrowContribution_status_idx" ON "EscrowContribution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowGroupContribution_publicId_key" ON "EscrowGroupContribution"("publicId");

-- CreateIndex
CREATE INDEX "EscrowGroupContribution_groupId_idx" ON "EscrowGroupContribution"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAllocation_publicId_key" ON "EscrowAllocation"("publicId");

-- CreateIndex
CREATE INDEX "EscrowAllocation_accountId_idx" ON "EscrowAllocation"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowMovement_publicId_key" ON "EscrowMovement"("publicId");

-- CreateIndex
CREATE INDEX "EscrowMovement_accountId_idx" ON "EscrowMovement"("accountId");

-- CreateIndex
CREATE INDEX "EscrowMovement_type_idx" ON "EscrowMovement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowFreeze_publicId_key" ON "EscrowFreeze"("publicId");

-- CreateIndex
CREATE INDEX "EscrowFreeze_accountId_idx" ON "EscrowFreeze"("accountId");

-- CreateIndex
CREATE INDEX "EscrowFreeze_status_idx" ON "EscrowFreeze"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowRelease_publicId_key" ON "EscrowRelease"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowRelease_externalTransactionId_key" ON "EscrowRelease"("externalTransactionId");

-- CreateIndex
CREATE INDEX "EscrowRelease_accountId_idx" ON "EscrowRelease"("accountId");

-- CreateIndex
CREATE INDEX "EscrowRelease_status_idx" ON "EscrowRelease"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowWithdrawal_publicId_key" ON "EscrowWithdrawal"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowWithdrawal_externalTransactionId_key" ON "EscrowWithdrawal"("externalTransactionId");

-- CreateIndex
CREATE INDEX "EscrowWithdrawal_accountId_idx" ON "EscrowWithdrawal"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowRefund_publicId_key" ON "EscrowRefund"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowRefund_externalTransactionId_key" ON "EscrowRefund"("externalTransactionId");

-- CreateIndex
CREATE INDEX "EscrowRefund_accountId_idx" ON "EscrowRefund"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowClosure_publicId_key" ON "EscrowClosure"("publicId");

-- CreateIndex
CREATE INDEX "EscrowClosure_accountId_idx" ON "EscrowClosure"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralPool_publicId_key" ON "CollateralPool"("publicId");

-- CreateIndex
CREATE INDEX "CollateralPool_groupId_idx" ON "CollateralPool"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralAsset_publicId_key" ON "CollateralAsset"("publicId");

-- CreateIndex
CREATE INDEX "CollateralAsset_groupId_idx" ON "CollateralAsset"("groupId");

-- CreateIndex
CREATE INDEX "CollateralAsset_poolId_idx" ON "CollateralAsset"("poolId");

-- CreateIndex
CREATE INDEX "CollateralAsset_status_idx" ON "CollateralAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralValuation_publicId_key" ON "CollateralValuation"("publicId");

-- CreateIndex
CREATE INDEX "CollateralValuation_assetId_idx" ON "CollateralValuation"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralVerification_publicId_key" ON "CollateralVerification"("publicId");

-- CreateIndex
CREATE INDEX "CollateralVerification_assetId_idx" ON "CollateralVerification"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralLien_publicId_key" ON "CollateralLien"("publicId");

-- CreateIndex
CREATE INDEX "CollateralLien_assetId_idx" ON "CollateralLien"("assetId");

-- CreateIndex
CREATE INDEX "CollateralLien_loanId_idx" ON "CollateralLien"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralRelease_publicId_key" ON "CollateralRelease"("publicId");

-- CreateIndex
CREATE INDEX "CollateralRelease_assetId_idx" ON "CollateralRelease"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralSubstitution_publicId_key" ON "CollateralSubstitution"("publicId");

-- CreateIndex
CREATE INDEX "CollateralSubstitution_existingId_idx" ON "CollateralSubstitution"("existingId");

-- CreateIndex
CREATE INDEX "CollateralSubstitution_replacementId_idx" ON "CollateralSubstitution"("replacementId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralWatch_publicId_key" ON "CollateralWatch"("publicId");

-- CreateIndex
CREATE INDEX "CollateralWatch_assetId_idx" ON "CollateralWatch"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralRealization_publicId_key" ON "CollateralRealization"("publicId");

-- CreateIndex
CREATE INDEX "CollateralRealization_assetId_idx" ON "CollateralRealization"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralEnforcement_publicId_key" ON "CollateralEnforcement"("publicId");

-- CreateIndex
CREATE INDEX "CollateralEnforcement_poolId_idx" ON "CollateralEnforcement"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityFacility_publicId_key" ON "SecurityFacility"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityFacility_facilityNumber_key" ON "SecurityFacility"("facilityNumber");

-- CreateIndex
CREATE INDEX "SecurityFacility_groupId_idx" ON "SecurityFacility"("groupId");

-- CreateIndex
CREATE INDEX "SecurityFacility_status_idx" ON "SecurityFacility"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityApplication_publicId_key" ON "SecurityApplication"("publicId");

-- CreateIndex
CREATE INDEX "SecurityApplication_groupId_idx" ON "SecurityApplication"("groupId");

-- CreateIndex
CREATE INDEX "SecurityApplication_facilityId_idx" ON "SecurityApplication"("facilityId");

-- CreateIndex
CREATE INDEX "SecurityApplication_status_idx" ON "SecurityApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityEligibility_publicId_key" ON "SecurityEligibility"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityEligibility_applicationId_key" ON "SecurityEligibility"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAssessment_publicId_key" ON "SecurityAssessment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAssessment_applicationId_key" ON "SecurityAssessment"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDecision_publicId_key" ON "SecurityDecision"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDecision_applicationId_key" ON "SecurityDecision"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityGuarantee_publicId_key" ON "SecurityGuarantee"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityGuarantee_certificateNumber_key" ON "SecurityGuarantee"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityGuarantee_applicationId_key" ON "SecurityGuarantee"("applicationId");

-- CreateIndex
CREATE INDEX "SecurityGuarantee_facilityId_idx" ON "SecurityGuarantee"("facilityId");

-- CreateIndex
CREATE INDEX "SecurityGuarantee_groupId_idx" ON "SecurityGuarantee"("groupId");

-- CreateIndex
CREATE INDEX "SecurityGuarantee_status_idx" ON "SecurityGuarantee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityCertificate_publicId_key" ON "SecurityCertificate"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityCertificate_certificateNumber_key" ON "SecurityCertificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityCertificate_guaranteeId_key" ON "SecurityCertificate"("guaranteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityFee_publicId_key" ON "SecurityFee"("publicId");

-- CreateIndex
CREATE INDEX "SecurityFee_guaranteeId_idx" ON "SecurityFee"("guaranteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRenewal_publicId_key" ON "SecurityRenewal"("publicId");

-- CreateIndex
CREATE INDEX "SecurityRenewal_guaranteeId_idx" ON "SecurityRenewal"("guaranteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAmendment_publicId_key" ON "SecurityAmendment"("publicId");

-- CreateIndex
CREATE INDEX "SecurityAmendment_guaranteeId_idx" ON "SecurityAmendment"("guaranteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityClaim_publicId_key" ON "SecurityClaim"("publicId");

-- CreateIndex
CREATE INDEX "SecurityClaim_guaranteeId_idx" ON "SecurityClaim"("guaranteeId");

-- CreateIndex
CREATE INDEX "SecurityClaim_status_idx" ON "SecurityClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityClaimPayment_publicId_key" ON "SecurityClaimPayment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityClaimPayment_externalTransactionId_key" ON "SecurityClaimPayment"("externalTransactionId");

-- CreateIndex
CREATE INDEX "SecurityClaimPayment_claimId_idx" ON "SecurityClaimPayment"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRecovery_publicId_key" ON "SecurityRecovery"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRecovery_externalTransactionId_key" ON "SecurityRecovery"("externalTransactionId");

-- CreateIndex
CREATE INDEX "SecurityRecovery_claimId_idx" ON "SecurityRecovery"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRecoverySplit_publicId_key" ON "SecurityRecoverySplit"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRecoverySplit_recoveryId_key" ON "SecurityRecoverySplit"("recoveryId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityCancellation_publicId_key" ON "SecurityCancellation"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityCancellation_guaranteeId_key" ON "SecurityCancellation"("guaranteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityLink_publicId_key" ON "SecurityLink"("publicId");

-- CreateIndex
CREATE INDEX "SecurityLink_groupId_idx" ON "SecurityLink"("groupId");

-- CreateIndex
CREATE INDEX "SecurityLink_accountId_idx" ON "SecurityLink"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDefault_publicId_key" ON "SecurityDefault"("publicId");

-- CreateIndex
CREATE INDEX "SecurityDefault_groupId_idx" ON "SecurityDefault"("groupId");

-- CreateIndex
CREATE INDEX "SecurityDefault_status_idx" ON "SecurityDefault"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowSetOff_publicId_key" ON "EscrowSetOff"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowSetOff_externalTransactionId_key" ON "EscrowSetOff"("externalTransactionId");

-- CreateIndex
CREATE INDEX "EscrowSetOff_accountId_idx" ON "EscrowSetOff"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReconciliation_publicId_key" ON "SecurityReconciliation"("publicId");

-- CreateIndex
CREATE INDEX "SecurityReconciliation_accountId_idx" ON "SecurityReconciliation"("accountId");

-- CreateIndex
CREATE INDEX "SecurityReconciliation_matchStatus_idx" ON "SecurityReconciliation"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDocument_publicId_key" ON "SecurityDocument"("publicId");

-- CreateIndex
CREATE INDEX "SecurityDocument_entityType_entityId_idx" ON "SecurityDocument"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityApproval_publicId_key" ON "SecurityApproval"("publicId");

-- CreateIndex
CREATE INDEX "SecurityApproval_entityType_entityId_idx" ON "SecurityApproval"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAudit_publicId_key" ON "SecurityAudit"("publicId");

-- CreateIndex
CREATE INDEX "SecurityAudit_entityType_entityId_idx" ON "SecurityAudit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SecurityAudit_createdAt_idx" ON "SecurityAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityNotice_publicId_key" ON "SecurityNotice"("publicId");

-- CreateIndex
CREATE INDEX "SecurityNotice_createdAt_idx" ON "SecurityNotice"("createdAt");

-- AddForeignKey
ALTER TABLE "EscrowGroup" ADD CONSTRAINT "EscrowGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowGroupMember" ADD CONSTRAINT "EscrowGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowGroupMember" ADD CONSTRAINT "EscrowGroupMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAccount" ADD CONSTRAINT "EscrowAccount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAccount" ADD CONSTRAINT "EscrowAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAccount" ADD CONSTRAINT "EscrowAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAgreement" ADD CONSTRAINT "EscrowAgreement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowContribution" ADD CONSTRAINT "EscrowContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowContribution" ADD CONSTRAINT "EscrowContribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "EscrowGroupMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowGroupContribution" ADD CONSTRAINT "EscrowGroupContribution_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowGroupContribution" ADD CONSTRAINT "EscrowGroupContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAllocation" ADD CONSTRAINT "EscrowAllocation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowMovement" ADD CONSTRAINT "EscrowMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowFreeze" ADD CONSTRAINT "EscrowFreeze_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowRelease" ADD CONSTRAINT "EscrowRelease_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowWithdrawal" ADD CONSTRAINT "EscrowWithdrawal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowRefund" ADD CONSTRAINT "EscrowRefund_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowClosure" ADD CONSTRAINT "EscrowClosure_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralPool" ADD CONSTRAINT "CollateralPool_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralAsset" ADD CONSTRAINT "CollateralAsset_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralAsset" ADD CONSTRAINT "CollateralAsset_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CollateralPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralAsset" ADD CONSTRAINT "CollateralAsset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralAsset" ADD CONSTRAINT "CollateralAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralValuation" ADD CONSTRAINT "CollateralValuation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralVerification" ADD CONSTRAINT "CollateralVerification_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralLien" ADD CONSTRAINT "CollateralLien_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralLien" ADD CONSTRAINT "CollateralLien_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralRelease" ADD CONSTRAINT "CollateralRelease_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralRelease" ADD CONSTRAINT "CollateralRelease_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralSubstitution" ADD CONSTRAINT "CollateralSubstitution_existingId_fkey" FOREIGN KEY ("existingId") REFERENCES "CollateralAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralSubstitution" ADD CONSTRAINT "CollateralSubstitution_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "CollateralAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralWatch" ADD CONSTRAINT "CollateralWatch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralRealization" ADD CONSTRAINT "CollateralRealization_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralRealization" ADD CONSTRAINT "CollateralRealization_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralEnforcement" ADD CONSTRAINT "CollateralEnforcement_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CollateralPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralEnforcement" ADD CONSTRAINT "CollateralEnforcement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFacility" ADD CONSTRAINT "SecurityFacility_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFacility" ADD CONSTRAINT "SecurityFacility_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "SecurityFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityApplication" ADD CONSTRAINT "SecurityApplication_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEligibility" ADD CONSTRAINT "SecurityEligibility_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SecurityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAssessment" ADD CONSTRAINT "SecurityAssessment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SecurityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityDecision" ADD CONSTRAINT "SecurityDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SecurityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "SecurityFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SecurityApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CollateralAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGuarantee" ADD CONSTRAINT "SecurityGuarantee_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityCertificate" ADD CONSTRAINT "SecurityCertificate_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFee" ADD CONSTRAINT "SecurityFee_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityRenewal" ADD CONSTRAINT "SecurityRenewal_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAmendment" ADD CONSTRAINT "SecurityAmendment_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityClaim" ADD CONSTRAINT "SecurityClaim_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityClaim" ADD CONSTRAINT "SecurityClaim_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityClaimPayment" ADD CONSTRAINT "SecurityClaimPayment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "SecurityClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityRecovery" ADD CONSTRAINT "SecurityRecovery_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "SecurityClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityRecovery" ADD CONSTRAINT "SecurityRecovery_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityRecoverySplit" ADD CONSTRAINT "SecurityRecoverySplit_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "SecurityRecovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityCancellation" ADD CONSTRAINT "SecurityCancellation_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "SecurityGuarantee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CollateralPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "SecurityFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLink" ADD CONSTRAINT "SecurityLink_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityDefault" ADD CONSTRAINT "SecurityDefault_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EscrowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityDefault" ADD CONSTRAINT "SecurityDefault_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowSetOff" ADD CONSTRAINT "EscrowSetOff_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowSetOff" ADD CONSTRAINT "EscrowSetOff_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReconciliation" ADD CONSTRAINT "SecurityReconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EscrowAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

