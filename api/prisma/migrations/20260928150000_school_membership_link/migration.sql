-- AlterTable
ALTER TABLE "School" ADD COLUMN "membershipApplicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_membershipApplicationId_key" ON "School"("membershipApplicationId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_membershipApplicationId_fkey" FOREIGN KEY ("membershipApplicationId") REFERENCES "MembershipApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
