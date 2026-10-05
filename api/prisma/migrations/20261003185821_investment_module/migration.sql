-- CreateTable
CREATE TABLE "InvestmentOpportunity" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "investmentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "minimumAmount" DECIMAL(18,2) NOT NULL,
    "maximumAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "expectedReturnRate" DECIMAL(8,4) NOT NULL,
    "returnFrequency" TEXT NOT NULL,
    "investmentPeriod" TEXT NOT NULL,
    "expectedProfit" DECIMAL(18,2),
    "riskDisclosure" TEXT NOT NULL,
    "managementFeeRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earlyRedemptionRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "documents" JSONB,
    "feeLines" JSONB,
    "amountRaised" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentApplication" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "schoolId" TEXT,
    "registrationId" TEXT,
    "opportunityId" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "investmentPeriod" TEXT NOT NULL,
    "purpose" TEXT,
    "fundingSource" TEXT NOT NULL,
    "confirmInformation" BOOLEAN NOT NULL DEFAULT false,
    "reviewedTerms" BOOLEAN NOT NULL DEFAULT false,
    "understandRisks" BOOLEAN NOT NULL DEFAULT false,
    "agreeAgreement" BOOLEAN NOT NULL DEFAULT false,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "eligibility" JSONB,
    "eligibilityResult" TEXT,
    "eligibilityDecision" TEXT,
    "eligibilityComments" TEXT,
    "diligence" JSONB,
    "diligenceResult" TEXT,
    "risk" JSONB,
    "riskLevel" TEXT,
    "riskScore" DECIMAL(8,2),
    "mitigationPlan" TEXT,
    "assessor" TEXT,
    "assessmentDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "decision" TEXT,
    "approvedAmount" DECIMAL(18,2),
    "approvedPeriod" TEXT,
    "returnRate" DECIMAL(8,4),
    "returnFrequency" TEXT,
    "fees" DECIMAL(18,2),
    "conditions" TEXT,
    "startDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentPosition" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "registrationId" TEXT,
    "opportunityId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "returnRate" DECIMAL(8,4) NOT NULL,
    "returnFrequency" TEXT NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "conditions" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "agreementAccepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "agreementVersion" TEXT NOT NULL DEFAULT '1',
    "maturityInstruction" TEXT,
    "reinvestAmount" DECIMAL(18,2),
    "statementGenerated" BOOLEAN NOT NULL DEFAULT false,
    "obligationsSettled" BOOLEAN NOT NULL DEFAULT false,
    "closureReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentContribution" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "contributionDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "bank" TEXT,
    "accountReference" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "receivedAmount" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "railCode" TEXT,
    "railName" TEXT,
    "allocatedUnits" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,4),
    "allocationPercent" DECIMAL(8,4),
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentPayout" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "grossReturn" DECIMAL(18,2) NOT NULL,
    "managementFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netReturn" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "calculatedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "holdingPercent" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentExit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "redemptionType" TEXT,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "bankAccount" TEXT,
    "destination" TEXT NOT NULL,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "decision" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "originalReference" TEXT,
    "paymentReference" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentExit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransfer" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fromPositionId" TEXT NOT NULL,
    "toPositionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentLedgerEntry" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "positionId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amount" DECIMAL(18,2),
    "reason" TEXT,
    "reference" TEXT,
    "ip" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentMessage" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "positionId" TEXT,
    "memberName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOpportunity_publicId_key" ON "InvestmentOpportunity"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOpportunity_code_key" ON "InvestmentOpportunity"("code");

-- CreateIndex
CREATE INDEX "InvestmentOpportunity_status_idx" ON "InvestmentOpportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentApplication_publicId_key" ON "InvestmentApplication"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentApplication_status_idx" ON "InvestmentApplication"("status");

-- CreateIndex
CREATE INDEX "InvestmentApplication_schoolId_idx" ON "InvestmentApplication"("schoolId");

-- CreateIndex
CREATE INDEX "InvestmentApplication_registrationId_idx" ON "InvestmentApplication"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPosition_publicId_key" ON "InvestmentPosition"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPosition_applicationId_key" ON "InvestmentPosition"("applicationId");

-- CreateIndex
CREATE INDEX "InvestmentPosition_status_idx" ON "InvestmentPosition"("status");

-- CreateIndex
CREATE INDEX "InvestmentPosition_schoolId_idx" ON "InvestmentPosition"("schoolId");

-- CreateIndex
CREATE INDEX "InvestmentPosition_maturityDate_idx" ON "InvestmentPosition"("maturityDate");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContribution_publicId_key" ON "InvestmentContribution"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentContribution_positionId_idx" ON "InvestmentContribution"("positionId");

-- CreateIndex
CREATE INDEX "InvestmentContribution_status_idx" ON "InvestmentContribution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPayout_publicId_key" ON "InvestmentPayout"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentPayout_positionId_idx" ON "InvestmentPayout"("positionId");

-- CreateIndex
CREATE INDEX "InvestmentPayout_opportunityId_idx" ON "InvestmentPayout"("opportunityId");

-- CreateIndex
CREATE INDEX "InvestmentPayout_status_idx" ON "InvestmentPayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentExit_publicId_key" ON "InvestmentExit"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentExit_positionId_idx" ON "InvestmentExit"("positionId");

-- CreateIndex
CREATE INDEX "InvestmentExit_kind_status_idx" ON "InvestmentExit"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentTransfer_publicId_key" ON "InvestmentTransfer"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentTransfer_fromPositionId_idx" ON "InvestmentTransfer"("fromPositionId");

-- CreateIndex
CREATE INDEX "InvestmentTransfer_toPositionId_idx" ON "InvestmentTransfer"("toPositionId");

-- CreateIndex
CREATE INDEX "InvestmentLedgerEntry_positionId_createdAt_idx" ON "InvestmentLedgerEntry"("positionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAudit_publicId_key" ON "InvestmentAudit"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentAudit_positionId_idx" ON "InvestmentAudit"("positionId");

-- CreateIndex
CREATE INDEX "InvestmentAudit_createdAt_idx" ON "InvestmentAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentMessage_publicId_key" ON "InvestmentMessage"("publicId");

-- CreateIndex
CREATE INDEX "InvestmentMessage_sentAt_idx" ON "InvestmentMessage"("sentAt");

-- AddForeignKey
ALTER TABLE "InvestmentApplication" ADD CONSTRAINT "InvestmentApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentApplication" ADD CONSTRAINT "InvestmentApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InvestmentApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContribution" ADD CONSTRAINT "InvestmentContribution_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPayout" ADD CONSTRAINT "InvestmentPayout_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentExit" ADD CONSTRAINT "InvestmentExit_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransfer" ADD CONSTRAINT "InvestmentTransfer_fromPositionId_fkey" FOREIGN KEY ("fromPositionId") REFERENCES "InvestmentPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransfer" ADD CONSTRAINT "InvestmentTransfer_toPositionId_fkey" FOREIGN KEY ("toPositionId") REFERENCES "InvestmentPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentLedgerEntry" ADD CONSTRAINT "InvestmentLedgerEntry_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentAudit" ADD CONSTRAINT "InvestmentAudit_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMessage" ADD CONSTRAINT "InvestmentMessage_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
