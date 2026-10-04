-- AlterTable
ALTER TABLE "MemberDocument" ADD COLUMN     "storedName" TEXT;

-- AlterTable
ALTER TABLE "MembershipApplication" ADD COLUMN     "alternativePhone" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "categoryCode" TEXT,
ADD COLUMN     "cell" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "dateEstablished" TIMESTAMP(3),
ADD COLUMN     "institutionType" TEXT,
ADD COLUMN     "issuingAuthority" TEXT,
ADD COLUMN     "memberPublicId" TEXT,
ADD COLUMN     "physicalAddress" TEXT,
ADD COLUMN     "postalAddress" TEXT,
ADD COLUMN     "registrationCertificateNumber" TEXT,
ADD COLUMN     "registrationDate" TIMESTAMP(3),
ADD COLUMN     "representativeEmail" TEXT,
ADD COLUMN     "representativeNationalId" TEXT,
ADD COLUMN     "representativePhone" TEXT,
ADD COLUMN     "staffCount" INTEGER,
ADD COLUMN     "studentCount" INTEGER,
ADD COLUMN     "taxIdentificationNumber" TEXT,
ADD COLUMN     "village" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "MembershipApplicationDocument" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplicationDocument_publicId_key" ON "MembershipApplicationDocument"("publicId");

-- CreateIndex
CREATE INDEX "MembershipApplicationDocument_applicationId_idx" ON "MembershipApplicationDocument"("applicationId");

-- AddForeignKey
ALTER TABLE "MembershipApplicationDocument" ADD CONSTRAINT "MembershipApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
