-- Parent payment preferences. Identity and consent use the existing KYC and consent records.
ALTER TABLE "Guardian" ADD COLUMN "preferredChannel" "PaymentChannel",
ADD COLUMN "preferredCountry" TEXT NOT NULL DEFAULT 'RW',
ADD COLUMN "notifyChannel" TEXT NOT NULL DEFAULT 'IN_APP';
