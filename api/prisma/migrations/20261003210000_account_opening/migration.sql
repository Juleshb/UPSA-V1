-- CreateTable
CREATE TABLE "OpenedAccount" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL,
    "referral" TEXT,
    "purpose" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "communicationPreference" TEXT NOT NULL,
    "digitalAccess" BOOLEAN NOT NULL DEFAULT false,
    "mobileAccess" BOOLEAN NOT NULL DEFAULT false,
    "webAccess" BOOLEAN NOT NULL DEFAULT false,
    "applicantName" TEXT NOT NULL,
    "identityNumber" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT NOT NULL DEFAULT 'RW',
    "province" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "cell" TEXT,
    "village" TEXT,
    "address" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "privacyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dataConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "consentDate" TIMESTAMP(3),
    "documents" JSONB,
    "profile" JSONB,
    "devices" JSONB,
    "limits" JSONB,
    "changes" JSONB,
    "schoolId" TEXT,
    "guardianId" TEXT,
    "studentId" TEXT,
    "registrationId" TEXT,
    "userId" TEXT,
    "identityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "phoneStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "emailStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "addressStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "documentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kycResult" TEXT NOT NULL DEFAULT 'PENDING',
    "kycNotes" TEXT,
    "duplicateResult" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
    "duplicateMatches" JSONB,
    "duplicateNote" TEXT,
    "riskLevel" TEXT,
    "riskNotes" TEXT,
    "complianceResult" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "conditions" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "username" TEXT,
    "roleName" TEXT,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT true,
    "mfaMethod" TEXT,
    "accessIssued" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "reference" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMessage" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accountId" TEXT,
    "accountName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenedAccount_publicId_key" ON "OpenedAccount"("publicId");

-- CreateIndex
CREATE INDEX "OpenedAccount_accountType_status_idx" ON "OpenedAccount"("accountType", "status");

-- CreateIndex
CREATE INDEX "OpenedAccount_identityNumber_idx" ON "OpenedAccount"("identityNumber");

-- CreateIndex
CREATE INDEX "OpenedAccount_phone_idx" ON "OpenedAccount"("phone");

-- CreateIndex
CREATE INDEX "OpenedAccount_email_idx" ON "OpenedAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAudit_publicId_key" ON "AccountAudit"("publicId");

-- CreateIndex
CREATE INDEX "AccountAudit_accountId_idx" ON "AccountAudit"("accountId");

-- CreateIndex
CREATE INDEX "AccountAudit_createdAt_idx" ON "AccountAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMessage_publicId_key" ON "AccountMessage"("publicId");

-- CreateIndex
CREATE INDEX "AccountMessage_sentAt_idx" ON "AccountMessage"("sentAt");

-- AddForeignKey
ALTER TABLE "OpenedAccount" ADD CONSTRAINT "OpenedAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenedAccount" ADD CONSTRAINT "OpenedAccount_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenedAccount" ADD CONSTRAINT "OpenedAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenedAccount" ADD CONSTRAINT "OpenedAccount_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenedAccount" ADD CONSTRAINT "OpenedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAudit" ADD CONSTRAINT "AccountAudit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "OpenedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMessage" ADD CONSTRAINT "AccountMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "OpenedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
