-- CreateEnum
CREATE TYPE "StudentGender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('APPLICANT', 'ACTIVE', 'TRANSFERRED', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "firstName" TEXT,
ADD COLUMN "middleName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "gender" "StudentGender",
ADD COLUMN "nationality" TEXT,
ADD COLUMN "photoStoredName" TEXT,
ADD COLUMN "previousSchool" TEXT,
ADD COLUMN "admissionDate" TIMESTAMP(3),
ADD COLUMN "stream" TEXT,
ADD COLUMN "grade" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "sector" TEXT,
ADD COLUMN "cell" TEXT,
ADD COLUMN "village" TEXT,
ADD COLUMN "physicalAddress" TEXT,
ADD COLUMN "telephone" TEXT,
ADD COLUMN "emergencyContact" TEXT;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "status" TYPE "StudentStatus" USING (
  CASE
    WHEN "status" IN ('APPLICANT', 'ACTIVE', 'TRANSFERRED', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN', 'INACTIVE')
      THEN "status"::"StudentStatus"
    ELSE 'ACTIVE'::"StudentStatus"
  END
);
ALTER TABLE "Student" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "StudentGuardian" ADD COLUMN "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "financialResponsibility" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "communicationAuthorization" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentFinancialAccount" ADD COLUMN "feeStructureLabel" TEXT,
ADD COLUMN "scholarship" TEXT,
ADD COLUMN "discountAmount" DECIMAL(18,2),
ADD COLUMN "paymentPlan" TEXT;

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileRef" TEXT NOT NULL,
    "storedName" TEXT,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_idx" ON "StudentDocument"("studentId");

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
