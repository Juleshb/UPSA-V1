-- CreateEnum
CREATE TYPE "RailKind" AS ENUM ('BANK', 'PSP', 'MOBILE_MONEY', 'CARD');

-- CreateEnum
CREATE TYPE "RailStatus" AS ENUM ('APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PaymentInfrastructure" AS ENUM ('NATIONAL', 'RSWITCH', 'TIPS');

-- CreateEnum
CREATE TYPE "CorridorStatus" AS ENUM ('PILOT', 'ACTIVE', 'PLANNED');

-- AlterEnum
ALTER TYPE "PaymentChannel" ADD VALUE 'CARD';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "corridorId" TEXT,
ADD COLUMN     "destinationCountry" TEXT NOT NULL DEFAULT 'RW',
ADD COLUMN     "flowCode" TEXT NOT NULL DEFAULT 'PAY-01',
ADD COLUMN     "instructionRef" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "originCountry" TEXT NOT NULL DEFAULT 'RW',
ADD COLUMN     "railId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentRail" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RailKind" NOT NULL,
    "country" TEXT NOT NULL,
    "infrastructure" "PaymentInfrastructure" NOT NULL DEFAULT 'NATIONAL',
    "institutionName" TEXT NOT NULL,
    "status" "RailStatus" NOT NULL DEFAULT 'APPROVED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EacCorridor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "originInfrastructure" "PaymentInfrastructure" NOT NULL,
    "destinationInfrastructure" "PaymentInfrastructure" NOT NULL,
    "originLabel" TEXT NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "status" "CorridorStatus" NOT NULL,

    CONSTRAINT "EacCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFlowStep" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentFlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRail_code_key" ON "PaymentRail"("code");

-- CreateIndex
CREATE INDEX "PaymentRail_country_kind_status_idx" ON "PaymentRail"("country", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EacCorridor_code_key" ON "EacCorridor"("code");

-- CreateIndex
CREATE INDEX "EacCorridor_status_idx" ON "EacCorridor"("status");

-- CreateIndex
CREATE INDEX "PaymentFlowStep_paymentId_createdAt_idx" ON "PaymentFlowStep"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_railId_idx" ON "Payment"("railId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_railId_fkey" FOREIGN KEY ("railId") REFERENCES "PaymentRail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "EacCorridor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFlowStep" ADD CONSTRAINT "PaymentFlowStep_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
