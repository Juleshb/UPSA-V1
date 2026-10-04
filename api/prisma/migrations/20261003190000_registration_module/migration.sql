-- CreateEnum
CREATE TYPE "RegistrationKind" AS ENUM ('PARENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'MORE_INFORMATION_REQUIRED', 'RESUBMITTED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "kind" "RegistrationKind" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "displayName" TEXT NOT NULL,
    "referenceCode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "province" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "cell" TEXT,
    "village" TEXT,
    "physicalAddress" TEXT,
    "postalAddress" TEXT,
    "website" TEXT,
    "profile" JSONB NOT NULL,
    "schoolId" TEXT,
    "guardianId" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "contactVerified" BOOLEAN NOT NULL DEFAULT false,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "financialVerified" BOOLEAN NOT NULL DEFAULT false,
    "consentCaptured" BOOLEAN NOT NULL DEFAULT false,
    "duplicateChecked" BOOLEAN NOT NULL DEFAULT false,
    "decision" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "conditions" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationDocument" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "issuingAuthority" TEXT,
    "fileRef" TEXT NOT NULL,
    "storedName" TEXT,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "comments" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvent" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" "RegistrationStatus",
    "newStatus" "RegistrationStatus",
    "reason" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_publicId_key" ON "Registration"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_guardianId_key" ON "Registration"("guardianId");

-- CreateIndex
CREATE INDEX "Registration_kind_status_idx" ON "Registration"("kind", "status");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "Registration"("email");

-- CreateIndex
CREATE INDEX "RegistrationDocument_registrationId_idx" ON "RegistrationDocument"("registrationId");

-- CreateIndex
CREATE INDEX "RegistrationEvent_registrationId_idx" ON "RegistrationEvent"("registrationId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationDocument" ADD CONSTRAINT "RegistrationDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvent" ADD CONSTRAINT "RegistrationEvent_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
