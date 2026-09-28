-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'UNVERIFIED',
ALTER COLUMN "status" SET DEFAULT 'APPLICATION';
