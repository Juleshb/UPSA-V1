-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('NURSERY', 'PRIMARY', 'SECONDARY', 'TVET', 'SPECIAL_EDUCATION', 'COMBINED', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('PRIVATE', 'PUBLIC', 'GOVERNMENT_AIDED', 'FAITH_BASED', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "OperatingStatus" AS ENUM ('OPERATING', 'TEMPORARILY_CLOSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('REGISTERED', 'PROVISIONALLY_REGISTERED', 'LICENSED', 'SUSPENDED', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "schoolType" "SchoolType",
ADD COLUMN "ownershipType" "OwnershipType",
ADD COLUMN "dateEstablished" TIMESTAMP(3),
ADD COLUMN "operatingStatus" "OperatingStatus",
ADD COLUMN "studentCount" INTEGER,
ADD COLUMN "teacherCount" INTEGER,
ADD COLUMN "staffCount" INTEGER,
ADD COLUMN "registrationCertificateNumber" TEXT,
ADD COLUMN "registrationDate" TIMESTAMP(3),
ADD COLUMN "registrationAuthority" TEXT,
ADD COLUMN "licenseNumber" TEXT,
ADD COLUMN "licenseExpiryDate" TIMESTAMP(3),
ADD COLUMN "legalStatus" "LegalStatus",
ADD COLUMN "alternativePhone" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "emergencyContact" TEXT,
ADD COLUMN "cell" TEXT,
ADD COLUMN "village" TEXT,
ADD COLUMN "physicalAddress" TEXT,
ADD COLUMN "gpsCoordinates" TEXT,
ADD COLUMN "postalAddress" TEXT,
ADD COLUMN "reviewStatus" "RegistrationReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "legalDocumentsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "representativeVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "addressVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bankAccountVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "documentsComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SchoolRepresentative" ADD COLUMN "publicId" TEXT,
ADD COLUMN "nationalId" TEXT,
ADD COLUMN "appointmentDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolRepresentative_publicId_key" ON "SchoolRepresentative"("publicId");

-- AlterTable
ALTER TABLE "SchoolBankAccount" ADD COLUMN "branch" TEXT,
ADD COLUMN "swiftCode" TEXT,
ADD COLUMN "accountVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verifiedBy" TEXT,
ADD COLUMN "verificationDate" TIMESTAMP(3);
