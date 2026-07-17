-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "ownerMembershipId" TEXT;

-- CreateIndex
CREATE INDEX "Company_ownerMembershipId_idx" ON "Company"("ownerMembershipId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
