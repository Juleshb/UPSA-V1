-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'ORGANIZATION', 'FOUNDATION', 'INSTITUTION', 'PARTNER', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('DRAFT', 'REGISTERED', 'PENDING_VERIFICATION', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'TARGET_REACHED', 'CLOSED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PledgeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('PLEDGED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'IN_KIND', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'PAYMENT_PENDING', 'RECEIVED', 'APPROVED', 'ALLOCATED', 'DISTRIBUTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED', 'REFUNDED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "DonationPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BeneficiaryType" AS ENUM ('SCHOOL', 'STUDENT', 'FAMILY', 'COMMUNITY', 'INSTITUTION', 'PROJECT', 'PROGRAM', 'OTHER');

-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('DRAFT', 'REGISTERED', 'VERIFIED', 'NOT_VERIFIED', 'MORE_INFORMATION_REQUIRED');

-- CreateEnum
CREATE TYPE "AllocationCategory" AS ENUM ('SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'INFRASTRUCTURE', 'EDUCATION_MATERIALS', 'EMERGENCY_SUPPORT', 'COMMUNITY_SUPPORT', 'PROGRAM_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ALLOCATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_PAYMENT', 'DIRECT_DELIVERY', 'IN_KIND_DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DonationRefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('AMOUNT_CORRECTION', 'CLASSIFICATION_CORRECTION', 'CAMPAIGN_CORRECTION', 'BENEFICIARY_CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('PROGRAM_ACTIVITIES', 'SCHOOL_SUPPORT', 'STUDENT_SUPPORT', 'LOGISTICS', 'ADMINISTRATION', 'COMMUNICATION', 'OTHER');

-- AlterTable
ALTER TABLE "StudentGuardian" ALTER COLUMN "relationship" SET DEFAULT 'Guardian',
ALTER COLUMN "isPrimary" SET DEFAULT false;

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donorType" "DonorType" NOT NULL,
    "status" "DonorStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "organizationName" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "country" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "contactPosition" TEXT,
    "contactTelephone" TEXT,
    "contactEmail" TEXT,
    "contactIdentification" TEXT,
    "authorizationLetter" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "organizationVerified" BOOLEAN NOT NULL DEFAULT false,
    "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
    "contactVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "complianceVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationResult" TEXT,
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "verificationComments" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "campaignType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "targetBeneficiary" TEXT,
    "manager" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalComments" TEXT,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "minimumDonation" DECIMAL(18,2),
    "maximumDonation" DECIMAL(18,2),
    "targetDonors" INTEGER,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "approvedBudget" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "amountUsed" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "department" TEXT,
    "approvalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMonitor" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "activitiesCompleted" TEXT NOT NULL,
    "beneficiariesReached" INTEGER NOT NULL,
    "issues" TEXT,
    "correctiveActions" TEXT,
    "officer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pledge" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "pledgeDate" TIMESTAMP(3) NOT NULL,
    "expectedPaymentDate" TIMESTAMP(3),
    "frequency" "PledgeFrequency" NOT NULL,
    "purpose" TEXT,
    "notes" TEXT,
    "status" "PledgeStatus" NOT NULL DEFAULT 'PLEDGED',
    "fulfilledAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "beneficiaryType" "BeneficiaryType" NOT NULL,
    "status" "BeneficiaryStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "contactPerson" TEXT,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "province" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "physicalAddress" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "mobileMoneyNumber" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentInfoVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationDecision" TEXT,
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "verificationComments" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "campaignId" TEXT,
    "pledgeId" TEXT,
    "beneficiaryId" TEXT,
    "donationType" "DonationType" NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'DRAFT',
    "heldFromStatus" TEXT,
    "donationDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "purpose" TEXT,
    "donorVerified" BOOLEAN NOT NULL DEFAULT false,
    "amountVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "campaignVerified" BOOLEAN NOT NULL DEFAULT false,
    "purposeVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "beneficiaryVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationResult" TEXT,
    "verificationComment" TEXT,
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "approvalDecision" TEXT,
    "approvedAmount" DECIMAL(18,2),
    "conditions" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalComments" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InKindDonation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedValue" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "condition" TEXT,
    "dateReceived" TIMESTAMP(3),
    "storageLocation" TEXT,
    "intendedBeneficiary" TEXT,
    "documents" JSONB,
    "valuationMethod" TEXT,
    "valuer" TEXT,
    "valuationDate" TIMESTAMP(3),
    "unitValue" DECIMAL(18,2),
    "totalValue" DECIMAL(18,2),
    "evidence" TEXT,
    "valuedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,

    CONSTRAINT "InKindDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationPayment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "paymentMethod" TEXT NOT NULL,
    "payerName" TEXT,
    "payerPhone" TEXT,
    "transactionReference" TEXT,
    "externalTransactionId" TEXT,
    "paymentDate" TIMESTAMP(3),
    "status" "DonationPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "railCode" TEXT,
    "railName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "beneficiaryId" TEXT NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "purpose" TEXT NOT NULL,
    "category" "AllocationCategory" NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "decision" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "itemDescription" TEXT,
    "distributionDate" TIMESTAMP(3) NOT NULL,
    "method" "DistributionMethod" NOT NULL,
    "location" TEXT,
    "officer" TEXT NOT NULL,
    "beneficiaryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmationNote" TEXT,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationDisbursement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "bankAccount" TEXT,
    "mobileMoneyNumber" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "status" "DisbursementStatus" NOT NULL DEFAULT 'INITIATED',
    "railCode" TEXT,
    "railName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationRefund" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "reason" TEXT NOT NULL,
    "originalTransactionReference" TEXT,
    "destination" TEXT NOT NULL,
    "documents" JSONB,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "status" "DonationRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationAdjustment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "adjustmentType" "AdjustmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "documentName" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "campaignId" TEXT,
    "beneficiaryId" TEXT,
    "donationType" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationReceipt" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "campaignName" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "donationDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "transactionReference" TEXT,
    "purpose" TEXT,
    "signatory" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactReport" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT,
    "campaignId" TEXT,
    "beneficiaryId" TEXT,
    "reportingPeriod" TEXT NOT NULL,
    "amountUsed" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "beneficiaryCount" INTEGER NOT NULL,
    "activities" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "outcomes" TEXT NOT NULL,
    "challenges" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorMessage" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "donationId" TEXT,
    "campaignId" TEXT,
    "communicationType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "DonorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationAgreement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "campaignId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "purpose" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reportingRequirements" TEXT,
    "documents" JSONB,
    "donorRepresentative" TEXT,
    "rupsaRepresentative" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationCompliance" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT,
    "campaignId" TEXT,
    "donorIdentified" BOOLEAN NOT NULL DEFAULT false,
    "donorVerified" BOOLEAN NOT NULL DEFAULT false,
    "sourceRecorded" BOOLEAN NOT NULL DEFAULT false,
    "approvalsObtained" BOOLEAN NOT NULL DEFAULT false,
    "documentationComplete" BOOLEAN NOT NULL DEFAULT false,
    "beneficiaryVerified" BOOLEAN NOT NULL DEFAULT false,
    "restrictionsRecorded" BOOLEAN NOT NULL DEFAULT false,
    "reportingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationReconciliation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "paymentId" TEXT,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "receivedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "externalTransactionId" TEXT,
    "settlementReference" TEXT,
    "settlementDate" TIMESTAMP(3),
    "difference" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationLedgerEntry" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "donationId" TEXT,
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

    CONSTRAINT "DonationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donor_publicId_key" ON "Donor"("publicId");

-- CreateIndex
CREATE INDEX "Donor_donorType_status_idx" ON "Donor"("donorType", "status");

-- CreateIndex
CREATE INDEX "Donor_email_idx" ON "Donor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_publicId_key" ON "Campaign"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_code_key" ON "Campaign"("code");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "CampaignBudget_campaignId_idx" ON "CampaignBudget"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMonitor_campaignId_idx" ON "CampaignMonitor"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Pledge_publicId_key" ON "Pledge"("publicId");

-- CreateIndex
CREATE INDEX "Pledge_donorId_idx" ON "Pledge"("donorId");

-- CreateIndex
CREATE INDEX "Pledge_campaignId_status_idx" ON "Pledge"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_publicId_key" ON "Beneficiary"("publicId");

-- CreateIndex
CREATE INDEX "Beneficiary_beneficiaryType_status_idx" ON "Beneficiary"("beneficiaryType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_publicId_key" ON "Donation"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_reference_key" ON "Donation"("reference");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_campaignId_idx" ON "Donation"("campaignId");

-- CreateIndex
CREATE INDEX "Donation_donationType_idx" ON "Donation"("donationType");

-- CreateIndex
CREATE UNIQUE INDEX "InKindDonation_publicId_key" ON "InKindDonation"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "InKindDonation_donationId_key" ON "InKindDonation"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationPayment_publicId_key" ON "DonationPayment"("publicId");

-- CreateIndex
CREATE INDEX "DonationPayment_donationId_idx" ON "DonationPayment"("donationId");

-- CreateIndex
CREATE INDEX "DonationPayment_externalTransactionId_idx" ON "DonationPayment"("externalTransactionId");

-- CreateIndex
CREATE INDEX "DonationPayment_status_idx" ON "DonationPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_publicId_key" ON "Allocation"("publicId");

-- CreateIndex
CREATE INDEX "Allocation_donationId_status_idx" ON "Allocation"("donationId", "status");

-- CreateIndex
CREATE INDEX "Allocation_beneficiaryId_idx" ON "Allocation"("beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "Distribution_publicId_key" ON "Distribution"("publicId");

-- CreateIndex
CREATE INDEX "Distribution_allocationId_idx" ON "Distribution"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationDisbursement_publicId_key" ON "DonationDisbursement"("publicId");

-- CreateIndex
CREATE INDEX "DonationDisbursement_allocationId_idx" ON "DonationDisbursement"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationRefund_publicId_key" ON "DonationRefund"("publicId");

-- CreateIndex
CREATE INDEX "DonationRefund_donationId_status_idx" ON "DonationRefund"("donationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DonationAdjustment_publicId_key" ON "DonationAdjustment"("publicId");

-- CreateIndex
CREATE INDEX "DonationAdjustment_donationId_idx" ON "DonationAdjustment"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationReceipt_publicId_key" ON "DonationReceipt"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationReceipt_donationId_key" ON "DonationReceipt"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactReport_publicId_key" ON "ImpactReport"("publicId");

-- CreateIndex
CREATE INDEX "ImpactReport_donationId_idx" ON "ImpactReport"("donationId");

-- CreateIndex
CREATE INDEX "ImpactReport_campaignId_idx" ON "ImpactReport"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "DonorMessage_publicId_key" ON "DonorMessage"("publicId");

-- CreateIndex
CREATE INDEX "DonorMessage_donorId_idx" ON "DonorMessage"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationAgreement_publicId_key" ON "DonationAgreement"("publicId");

-- CreateIndex
CREATE INDEX "DonationAgreement_donorId_idx" ON "DonationAgreement"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationCompliance_publicId_key" ON "DonationCompliance"("publicId");

-- CreateIndex
CREATE INDEX "DonationCompliance_donationId_idx" ON "DonationCompliance"("donationId");

-- CreateIndex
CREATE INDEX "DonationCompliance_result_idx" ON "DonationCompliance"("result");

-- CreateIndex
CREATE UNIQUE INDEX "DonationReconciliation_publicId_key" ON "DonationReconciliation"("publicId");

-- CreateIndex
CREATE INDEX "DonationReconciliation_donationId_idx" ON "DonationReconciliation"("donationId");

-- CreateIndex
CREATE INDEX "DonationReconciliation_status_idx" ON "DonationReconciliation"("status");

-- CreateIndex
CREATE INDEX "DonationLedgerEntry_donationId_createdAt_idx" ON "DonationLedgerEntry"("donationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonationAudit_publicId_key" ON "DonationAudit"("publicId");

-- CreateIndex
CREATE INDEX "DonationAudit_donationId_idx" ON "DonationAudit"("donationId");

-- CreateIndex
CREATE INDEX "DonationAudit_entityType_entityId_idx" ON "DonationAudit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DonationAudit_createdAt_idx" ON "DonationAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignBudget" ADD CONSTRAINT "CampaignBudget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMonitor" ADD CONSTRAINT "CampaignMonitor_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InKindDonation" ADD CONSTRAINT "InKindDonation_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationDisbursement" ADD CONSTRAINT "DonationDisbursement_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationRefund" ADD CONSTRAINT "DonationRefund_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAdjustment" ADD CONSTRAINT "DonationAdjustment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationReceipt" ADD CONSTRAINT "DonationReceipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorMessage" ADD CONSTRAINT "DonorMessage_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorMessage" ADD CONSTRAINT "DonorMessage_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAgreement" ADD CONSTRAINT "DonationAgreement_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAgreement" ADD CONSTRAINT "DonationAgreement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCompliance" ADD CONSTRAINT "DonationCompliance_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationReconciliation" ADD CONSTRAINT "DonationReconciliation_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationLedgerEntry" ADD CONSTRAINT "DonationLedgerEntry_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAudit" ADD CONSTRAINT "DonationAudit_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
