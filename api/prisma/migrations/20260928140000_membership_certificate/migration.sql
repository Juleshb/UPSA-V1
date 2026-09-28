-- AlterTable
ALTER TABLE "MembershipApplication" ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "reviewerTitle" TEXT,
ADD COLUMN "verificationCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_verificationCode_key" ON "MembershipApplication"("verificationCode");
