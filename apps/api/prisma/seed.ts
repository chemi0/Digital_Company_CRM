import "dotenv/config";
import bcrypt from "bcrypt";
import { createPrismaClient } from "../src/lib/prisma.js";

const prisma = createPrismaClient();
const demoAdminPassword = "AtlasAdmin123!";

async function main() {
  const passwordHash = await bcrypt.hash(demoAdminPassword, 10);

  const organization = await prisma.organization.upsert({
    where: { slug: "atlas-digital" },
    update: {
      name: "Atlas Digital",
      archivedAt: null,
    },
    create: {
      name: "Atlas Digital",
      slug: "atlas-digital",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "owner@atlas-digital.test" },
    update: {
      passwordHash,
      firstName: "Milan",
      lastName: "Owner",
      isActive: true,
      archivedAt: null,
    },
    create: {
      email: "owner@atlas-digital.test",
      passwordHash,
      firstName: "Milan",
      lastName: "Owner",
      isActive: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: adminUser.id,
      },
    },
    update: {
      role: "ADMIN",
      archivedAt: null,
    },
    create: {
      organizationId: organization.id,
      userId: adminUser.id,
      role: "ADMIN",
    },
  });

  const company = await prisma.company.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Acme Studio",
      },
    },
    update: {
      status: "ACTIVE_CLIENT",
      archivedAt: null,
      website: "https://acme-studio.example",
      industry: "Design",
      phone: "+38160111222",
    },
    create: {
      organizationId: organization.id,
      name: "Acme Studio",
      status: "ACTIVE_CLIENT",
      website: "https://acme-studio.example",
      industry: "Design",
      phone: "+38160111222",
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-acme-primary" },
    update: {
      organizationId: organization.id,
      companyId: company.id,
      firstName: "Ana",
      lastName: "Markovic",
      email: "ana@acme-studio.example",
      phone: "+38160123456",
      jobTitle: "Creative Director",
      isPrimary: true,
      archivedAt: null,
    },
    create: {
      id: "seed-contact-acme-primary",
      organizationId: organization.id,
      companyId: company.id,
      firstName: "Ana",
      lastName: "Markovic",
      email: "ana@acme-studio.example",
      phone: "+38160123456",
      jobTitle: "Creative Director",
      isPrimary: true,
    },
  });

  await prisma.invitation.upsert({
    where: { tokenHash: "seed-invite-token-hash" },
    update: {
      organizationId: organization.id,
      email: "manager@atlas-digital.test",
      role: "MANAGER",
      invitedByUserId: adminUser.id,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      acceptedAt: null,
    },
    create: {
      organizationId: organization.id,
      email: "manager@atlas-digital.test",
      role: "MANAGER",
      tokenHash: "seed-invite-token-hash",
      invitedByUserId: adminUser.id,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  });

  const [organizations, users, memberships, invitations, companies, contacts] =
    await prisma.$transaction([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.membership.count(),
      prisma.invitation.count(),
      prisma.company.count(),
      prisma.contact.count(),
    ]);

  console.log({
    seeded: true,
    demoCredentials: {
      email: "owner@atlas-digital.test",
      password: demoAdminPassword,
    },
    counts: {
      organizations,
      users,
      memberships,
      invitations,
      companies,
      contacts,
    },
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
