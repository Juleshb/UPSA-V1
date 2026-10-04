-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customerType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "interestRate" DECIMAL(8,3) NOT NULL,
    "interestMethod" TEXT NOT NULL DEFAULT 'DECLINING',
    "processingFeeRate" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "insuranceFeeRate" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "guaranteeFeeRate" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "lateFeeRate" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumAmount" DECIMAL(18,2) NOT NULL,
    "maximumAmount" DECIMAL(18,2) NOT NULL,
    "minimumTenor" INTEGER NOT NULL,
    "maximumTenor" INTEGER NOT NULL,
    "graceMonths" INTEGER NOT NULL DEFAULT 0,
    "repaymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "eligibility" TEXT,
    "maximumExposure" DECIMAL(18,2),
    "debtServiceRule" TEXT,
    "guaranteeRequired" BOOLEAN NOT NULL DEFAULT false,
    "collateralRequired" BOOLEAN NOT NULL DEFAULT false,
    "allocationOrder" TEXT NOT NULL DEFAULT 'FEES,INTEREST,PENALTY,PRINCIPAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingCase" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "representative" TEXT,
    "memberPublicId" TEXT,
    "monthlyRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyExpenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "existingDebt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "existingRepayments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "applicantContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedCashFlow" TEXT,
    "graceMonths" INTEGER NOT NULL DEFAULT 0,
    "repaymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "collateralAvailable" BOOLEAN NOT NULL DEFAULT false,
    "collateralType" TEXT,
    "collateralValue" DECIMAL(18,2),
    "collateralOwner" TEXT,
    "details" JSONB,

    CONSTRAINT "LendingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingDocument" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingKyc" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fullName" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "organizationName" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "directors" TEXT,
    "owners" TEXT,
    "representative" TEXT,
    "beneficialOwners" TEXT,
    "result" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingKyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingConsent" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingAssessment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revenue" DECIMAL(18,2) NOT NULL,
    "collections" DECIMAL(18,2) NOT NULL,
    "collectionRate" DECIMAL(8,3) NOT NULL,
    "expenses" DECIMAL(18,2) NOT NULL,
    "exposure" DECIMAL(18,2) NOT NULL,
    "debtService" DECIMAL(18,2) NOT NULL,
    "freeCashFlow" DECIMAL(18,2) NOT NULL,
    "repaymentCapacity" TEXT NOT NULL,
    "cashFlowStability" TEXT NOT NULL,
    "paymentHistory" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "risks" TEXT,
    "mitigation" TEXT,
    "result" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanOffer" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interestRate" DECIMAL(8,3) NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "graceMonths" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "conditions" TEXT,
    "expiresOn" TIMESTAMP(3) NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanContract" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "loanId" TEXT,
    "principal" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "security" TEXT,
    "guarantee" TEXT,
    "defaultTerms" TEXT,
    "otherTerms" TEXT,
    "borrowerSigned" BOOLEAN NOT NULL DEFAULT false,
    "institutionSigned" BOOLEAN NOT NULL DEFAULT false,
    "representative" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingCollateral" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "collateralType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "documentName" TEXT,
    "estimatedValue" DECIMAL(18,2) NOT NULL,
    "valuationDate" TIMESTAMP(3),
    "valuer" TEXT,
    "location" TEXT,
    "registrationNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',

    CONSTRAINT "LendingCollateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingGuaranteeRequest" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "requestedLoan" DECIMAL(18,2) NOT NULL,
    "requestedGuarantee" DECIMAL(18,2) NOT NULL,
    "percentage" DECIMAL(8,3) NOT NULL,
    "facility" TEXT,
    "purpose" TEXT NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "LendingGuaranteeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingPosition" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "penaltyOutstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nextDueDate" TIMESTAMP(3),
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,

    CONSTRAINT "LendingPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingInstallment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DECIMAL(18,2) NOT NULL,
    "interestDue" DECIMAL(18,2) NOT NULL,
    "feesDue" DECIMAL(18,2) NOT NULL,
    "totalDue" DECIMAL(18,2) NOT NULL,
    "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DUE',

    CONSTRAINT "LendingInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingCollection" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "contactDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "promiseAmount" DECIMAL(18,2),
    "promiseDate" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "LendingCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingPromise" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "promised" DECIMAL(18,2) NOT NULL,
    "promiseDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "officer" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "LendingPromise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingRecovery" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "daysPastDue" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "officer" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextActionDate" TIMESTAMP(3),

    CONSTRAINT "LendingRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingWriteOff" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "history" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',

    CONSTRAINT "LendingWriteOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingRestructure" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL,
    "overdue" DECIMAL(18,2) NOT NULL,
    "currentTenor" INTEGER NOT NULL,
    "newTenor" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "graceMonths" INTEGER NOT NULL DEFAULT 0,
    "installment" DECIMAL(18,2) NOT NULL,
    "interestTerms" TEXT,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maturity" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',

    CONSTRAINT "LendingRestructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingHoliday" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LendingHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingTopUp" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "requested" DECIMAL(18,2) NOT NULL,
    "exposure" DECIMAL(18,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "repayment" TEXT,
    "eligibility" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "decision" TEXT NOT NULL,

    CONSTRAINT "LendingTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingRefinance" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "currentRate" DECIMAL(8,3) NOT NULL,
    "remainingTenor" INTEGER NOT NULL,
    "newAmount" DECIMAL(18,2) NOT NULL,
    "newRate" DECIMAL(8,3) NOT NULL,
    "newTenor" INTEGER NOT NULL,
    "settlement" DECIMAL(18,2) NOT NULL,
    "additional" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "LendingRefinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingTransfer" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "fromInstitution" TEXT NOT NULL,
    "toInstitution" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LendingTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingAdjustment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "original" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingRefund" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "originalTransaction" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "reference" TEXT,
    "externalTransactionId" TEXT,
    "railCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',

    CONSTRAINT "LendingRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingSettlement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "principalPaid" DECIMAL(18,2) NOT NULL,
    "interestPaid" DECIMAL(18,2) NOT NULL,
    "feesPaid" DECIMAL(18,2) NOT NULL,
    "penaltiesPaid" DECIMAL(18,2) NOT NULL,
    "finalPayment" DECIMAL(18,2) NOT NULL,
    "principalSettled" BOOLEAN NOT NULL,
    "interestSettled" BOOLEAN NOT NULL,
    "feesSettled" BOOLEAN NOT NULL,
    "clear" BOOLEAN NOT NULL,
    "settlementDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LendingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingNotice" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "reference" TEXT,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LendingAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "reference" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amount" DECIMAL(18,2),
    "userId" TEXT,
    "reason" TEXT,
    "institution" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LendingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_publicId_key" ON "LoanProduct"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_code_key" ON "LoanProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LendingCase_publicId_key" ON "LendingCase"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingCase_applicationId_key" ON "LendingCase"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingDocument_publicId_key" ON "LendingDocument"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingKyc_publicId_key" ON "LendingKyc"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingConsent_publicId_key" ON "LendingConsent"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingAssessment_publicId_key" ON "LendingAssessment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanOffer_publicId_key" ON "LoanOffer"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanContract_publicId_key" ON "LoanContract"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanContract_contractNumber_key" ON "LoanContract"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LendingCollateral_publicId_key" ON "LendingCollateral"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingGuaranteeRequest_publicId_key" ON "LendingGuaranteeRequest"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingPosition_loanId_key" ON "LendingPosition"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingInstallment_publicId_key" ON "LendingInstallment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingInstallment_loanId_number_key" ON "LendingInstallment"("loanId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LendingCollection_publicId_key" ON "LendingCollection"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingPromise_publicId_key" ON "LendingPromise"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingRecovery_publicId_key" ON "LendingRecovery"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingWriteOff_publicId_key" ON "LendingWriteOff"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingRestructure_publicId_key" ON "LendingRestructure"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingHoliday_publicId_key" ON "LendingHoliday"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingTopUp_publicId_key" ON "LendingTopUp"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingRefinance_publicId_key" ON "LendingRefinance"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingTransfer_publicId_key" ON "LendingTransfer"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingAdjustment_publicId_key" ON "LendingAdjustment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingRefund_publicId_key" ON "LendingRefund"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingRefund_externalTransactionId_key" ON "LendingRefund"("externalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingSettlement_publicId_key" ON "LendingSettlement"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingSettlement_loanId_key" ON "LendingSettlement"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingNotice_publicId_key" ON "LendingNotice"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LendingAudit_publicId_key" ON "LendingAudit"("publicId");

-- CreateIndex
CREATE INDEX "LendingAudit_reference_idx" ON "LendingAudit"("reference");

-- CreateIndex
CREATE INDEX "LendingAudit_createdAt_idx" ON "LendingAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "LendingCase" ADD CONSTRAINT "LendingCase_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingDocument" ADD CONSTRAINT "LendingDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingKyc" ADD CONSTRAINT "LendingKyc_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingConsent" ADD CONSTRAINT "LendingConsent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingAssessment" ADD CONSTRAINT "LendingAssessment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanOffer" ADD CONSTRAINT "LoanOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanContract" ADD CONSTRAINT "LoanContract_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingCollateral" ADD CONSTRAINT "LendingCollateral_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingGuaranteeRequest" ADD CONSTRAINT "LendingGuaranteeRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingPosition" ADD CONSTRAINT "LendingPosition_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingInstallment" ADD CONSTRAINT "LendingInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingCollection" ADD CONSTRAINT "LendingCollection_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingPromise" ADD CONSTRAINT "LendingPromise_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingRecovery" ADD CONSTRAINT "LendingRecovery_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingWriteOff" ADD CONSTRAINT "LendingWriteOff_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingRestructure" ADD CONSTRAINT "LendingRestructure_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingHoliday" ADD CONSTRAINT "LendingHoliday_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingTopUp" ADD CONSTRAINT "LendingTopUp_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingRefinance" ADD CONSTRAINT "LendingRefinance_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingTransfer" ADD CONSTRAINT "LendingTransfer_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingAdjustment" ADD CONSTRAINT "LendingAdjustment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingRefund" ADD CONSTRAINT "LendingRefund_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LendingSettlement" ADD CONSTRAINT "LendingSettlement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

