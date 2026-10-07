-- AlterTable
ALTER TABLE "School" ADD COLUMN "sdmsCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_sdmsCode_key" ON "School"("sdmsCode");
