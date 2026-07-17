/*
  Warnings:

  - Made the column `ownerMembershipId` on table `Company` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_ownerMembershipId_fkey";

-- Existing local companies predate ownership. Assign each one to the active
-- organization admin before making the relationship mandatory.
UPDATE "Company" AS company
SET "ownerMembershipId" = admin_membership."id"
FROM (
  SELECT DISTINCT ON ("organizationId") "id", "organizationId"
  FROM "Membership"
  WHERE "role" = 'ADMIN' AND "archivedAt" IS NULL
  ORDER BY "organizationId", "createdAt" ASC
) AS admin_membership
WHERE company."ownerMembershipId" IS NULL
  AND company."organizationId" = admin_membership."organizationId";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "ownerMembershipId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
