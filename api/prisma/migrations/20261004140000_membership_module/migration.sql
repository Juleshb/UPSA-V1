-- CreateTable
CREATE TABLE "MembershipCategory" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eligibility" TEXT,
    "membershipFee" DECIMAL(18,2) NOT NULL,
    "renewalFee" DECIMAL(18,2) NOT NULL,
    "periodMonths" INTEGER NOT NULL DEFAULT 12,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRequirement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "verificationRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MembershipRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "membershipNumber" TEXT,
    "schoolId" TEXT,
    "categoryId" TEXT,
    "membershipType" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "institutionType" TEXT NOT NULL,
    "dateEstablished" TIMESTAMP(3),
    "studentCount" INTEGER,
    "staffCount" INTEGER,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "cell" TEXT NOT NULL,
    "village" TEXT,
    "physicalAddress" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "postalAddress" TEXT,
    "alternativePhone" TEXT,
    "registrationCertificateNumber" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3),
    "taxIdentificationNumber" TEXT,
    "issuingAuthority" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranch" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "representativeName" TEXT NOT NULL,
    "representativePosition" TEXT NOT NULL,
    "representativeNationalId" TEXT,
    "representativePhone" TEXT NOT NULL,
    "representativeEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberApplication" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "requestedType" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "referredBy" TEXT,
    "accurate" BOOLEAN NOT NULL,
    "termsAccepted" BOOLEAN NOT NULL,
    "verifyAuthorized" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDocument" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "issuingAuthority" TEXT,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberVerification" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
    "nameVerified" BOOLEAN NOT NULL DEFAULT false,
    "numberVerified" BOOLEAN NOT NULL DEFAULT false,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "legalVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "authorityVerified" BOOLEAN NOT NULL DEFAULT false,
    "contactVerified" BOOLEAN NOT NULL DEFAULT false,
    "bankVerified" BOOLEAN NOT NULL DEFAULT false,
    "bankBelongsToInstitution" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT NOT NULL,
    "officerId" TEXT,
    "officerName" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "comments" TEXT,

    CONSTRAINT "MemberVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDecision" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "conditions" TEXT,
    "officerId" TEXT,
    "officerName" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipFee" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipFeePayment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "feeId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "paymentMethod" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerPhone" TEXT,
    "paymentReference" TEXT,
    "externalTransactionId" TEXT,
    "railCode" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipCertificate" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "membershipNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "signatory" TEXT NOT NULL,

    CONSTRAINT "MembershipCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRenewal" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "currentExpiry" TIMESTAMP(3),
    "newExpiry" TIMESTAMP(3),
    "renewalFee" DECIMAL(18,2) NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(18,2) NOT NULL,
    "informationConfirmed" BOOLEAN NOT NULL,
    "documentsValid" BOOLEAN NOT NULL,
    "requirementsMet" BOOLEAN NOT NULL,
    "feePaid" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberChange" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "previousValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipSuspension" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "evidence" TEXT,
    "comments" TEXT,
    "officerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipReactivation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "outstandingFees" DECIMAL(18,2) NOT NULL,
    "requirements" TEXT,
    "documentsVerified" BOOLEAN NOT NULL,
    "reactivationDate" TIMESTAMP(3) NOT NULL,
    "officerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipReactivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipTermination" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "outstanding" DECIMAL(18,2) NOT NULL,
    "refundDue" DECIMAL(18,2) NOT NULL,
    "evidence" TEXT,
    "confirmed" BOOLEAN NOT NULL,
    "officerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTermination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipNotice" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "memberId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "userId" TEXT,
    "reason" TEXT,
    "reference" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCategory_publicId_key" ON "MembershipCategory"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCategory_code_key" ON "MembershipCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRequirement_publicId_key" ON "MembershipRequirement"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRequirement_categoryId_documentType_key" ON "MembershipRequirement"("categoryId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "Member_publicId_key" ON "Member"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_membershipNumber_key" ON "Member"("membershipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_schoolId_key" ON "Member"("schoolId");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE INDEX "Member_registrationNumber_idx" ON "Member"("registrationNumber");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MemberApplication_publicId_key" ON "MemberApplication"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberDocument_publicId_key" ON "MemberDocument"("publicId");

-- CreateIndex
CREATE INDEX "MemberDocument_memberId_idx" ON "MemberDocument"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberVerification_publicId_key" ON "MemberVerification"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberDecision_publicId_key" ON "MemberDecision"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipFee_publicId_key" ON "MembershipFee"("publicId");

-- CreateIndex
CREATE INDEX "MembershipFee_memberId_idx" ON "MembershipFee"("memberId");

-- CreateIndex
CREATE INDEX "MembershipFee_status_idx" ON "MembershipFee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipFeePayment_publicId_key" ON "MembershipFeePayment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipFeePayment_externalTransactionId_key" ON "MembershipFeePayment"("externalTransactionId");

-- CreateIndex
CREATE INDEX "MembershipFeePayment_memberId_idx" ON "MembershipFeePayment"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCertificate_publicId_key" ON "MembershipCertificate"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCertificate_certificateNumber_key" ON "MembershipCertificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRenewal_publicId_key" ON "MembershipRenewal"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberChange_publicId_key" ON "MemberChange"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipSuspension_publicId_key" ON "MembershipSuspension"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipReactivation_publicId_key" ON "MembershipReactivation"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTermination_publicId_key" ON "MembershipTermination"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipNotice_publicId_key" ON "MembershipNotice"("publicId");

-- CreateIndex
CREATE INDEX "MembershipNotice_createdAt_idx" ON "MembershipNotice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipAudit_publicId_key" ON "MembershipAudit"("publicId");

-- CreateIndex
CREATE INDEX "MembershipAudit_memberId_idx" ON "MembershipAudit"("memberId");

-- CreateIndex
CREATE INDEX "MembershipAudit_createdAt_idx" ON "MembershipAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "MembershipRequirement" ADD CONSTRAINT "MembershipRequirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberApplication" ADD CONSTRAINT "MemberApplication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDocument" ADD CONSTRAINT "MemberDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberVerification" ADD CONSTRAINT "MemberVerification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDecision" ADD CONSTRAINT "MemberDecision_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipFee" ADD CONSTRAINT "MembershipFee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipFeePayment" ADD CONSTRAINT "MembershipFeePayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipFeePayment" ADD CONSTRAINT "MembershipFeePayment_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "MembershipFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCertificate" ADD CONSTRAINT "MembershipCertificate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRenewal" ADD CONSTRAINT "MembershipRenewal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChange" ADD CONSTRAINT "MemberChange_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipSuspension" ADD CONSTRAINT "MembershipSuspension_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReactivation" ADD CONSTRAINT "MembershipReactivation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTermination" ADD CONSTRAINT "MembershipTermination_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

