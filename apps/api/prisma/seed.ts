import "dotenv/config";
import bcrypt from "bcrypt";
import { createPrismaClient } from "../src/lib/prisma.js";

const prisma = createPrismaClient();
const demoAdminPassword = "AtlasAdmin123!";
const demoManagerPassword = "AtlasManager123!";
const demoSalesRepPassword = "AtlasSales123!";

async function main() {
  const passwordHash = await bcrypt.hash(demoAdminPassword, 10);
  const managerPasswordHash = await bcrypt.hash(demoManagerPassword, 10);
  const salesRepPasswordHash = await bcrypt.hash(demoSalesRepPassword, 10);

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

  const adminMembership = await prisma.membership.upsert({
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

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@atlas-digital.test" },
    update: {
      passwordHash: managerPasswordHash,
      firstName: "Maya",
      lastName: "Manager",
      isActive: true,
      archivedAt: null,
    },
    create: {
      email: "manager@atlas-digital.test",
      passwordHash: managerPasswordHash,
      firstName: "Maya",
      lastName: "Manager",
      isActive: true,
    },
  });

  const managerMembership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: managerUser.id,
      },
    },
    update: {
      role: "MANAGER",
      archivedAt: null,
    },
    create: {
      organizationId: organization.id,
      userId: managerUser.id,
      role: "MANAGER",
    },
  });

  const salesRepUser = await prisma.user.upsert({
    where: { email: "sales@atlas-digital.test" },
    update: {
      passwordHash: salesRepPasswordHash,
      firstName: "Sam",
      lastName: "Sales",
      isActive: true,
      archivedAt: null,
    },
    create: {
      email: "sales@atlas-digital.test",
      passwordHash: salesRepPasswordHash,
      firstName: "Sam",
      lastName: "Sales",
      isActive: true,
    },
  });

  const salesRepMembership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: salesRepUser.id,
      },
    },
    update: {
      role: "SALES_REP",
      archivedAt: null,
    },
    create: {
      organizationId: organization.id,
      userId: salesRepUser.id,
      role: "SALES_REP",
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
      ownerMembershipId: salesRepMembership.id,
      archivedAt: null,
      website: "https://acme-studio.example",
      industry: "Design",
      phone: "+38160111222",
    },
    create: {
      organizationId: organization.id,
      ownerMembershipId: salesRepMembership.id,
      name: "Acme Studio",
      status: "ACTIVE_CLIENT",
      website: "https://acme-studio.example",
      industry: "Design",
      phone: "+38160111222",
    },
  });

  const borealCompany = await prisma.company.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Boreal Growth",
      },
    },
    update: {
      status: "LEAD",
      ownerMembershipId: managerMembership.id,
      archivedAt: null,
      website: "https://boreal-growth.example",
      industry: "Marketing",
      phone: "+38160111223",
    },
    create: {
      organizationId: organization.id,
      ownerMembershipId: managerMembership.id,
      name: "Boreal Growth",
      status: "LEAD",
      website: "https://boreal-growth.example",
      industry: "Marketing",
      phone: "+38160111223",
    },
  });

  const acmeContact = await prisma.contact.upsert({
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

  const borealContact = await prisma.contact.upsert({
    where: { id: "seed-contact-boreal-primary" },
    update: {
      organizationId: organization.id,
      companyId: borealCompany.id,
      firstName: "Luka",
      lastName: "Petrovic",
      email: "luka@boreal-growth.example",
      phone: "+38160123457",
      jobTitle: "Growth Lead",
      isPrimary: true,
      archivedAt: null,
    },
    create: {
      id: "seed-contact-boreal-primary",
      organizationId: organization.id,
      companyId: borealCompany.id,
      firstName: "Luka",
      lastName: "Petrovic",
      email: "luka@boreal-growth.example",
      phone: "+38160123457",
      jobTitle: "Growth Lead",
      isPrimary: true,
    },
  });

  await prisma.deal.upsert({
    where: { id: "seed-deal-acme-retainer" },
    update: {
      organizationId: organization.id,
      companyId: company.id,
      primaryContactId: acmeContact.id,
      ownerMembershipId: salesRepMembership.id,
      title: "Website support retainer",
      stage: "PROPOSAL_SENT",
      amountCents: 180000,
      currency: "EUR",
      source: "Referral",
      expectedCloseDate: new Date("2026-08-15T00:00:00.000Z"),
      description: "Monthly website strategy, design support, and delivery retainership.",
      archivedAt: null,
    },
    create: {
      id: "seed-deal-acme-retainer",
      organizationId: organization.id,
      companyId: company.id,
      primaryContactId: acmeContact.id,
      ownerMembershipId: salesRepMembership.id,
      title: "Website support retainer",
      stage: "PROPOSAL_SENT",
      amountCents: 180000,
      currency: "EUR",
      source: "Referral",
      expectedCloseDate: new Date("2026-08-15T00:00:00.000Z"),
      description: "Monthly website strategy, design support, and delivery retainership.",
    },
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-acme-discovery" },
    update: {
      organizationId: organization.id,
      companyId: company.id,
      contactId: acmeContact.id,
      dealId: "seed-deal-acme-retainer",
      authorMembershipId: salesRepMembership.id,
      type: "CALL",
      subject: "Retainer discovery call",
      body: "Confirmed the support scope and next review date with the creative team.",
      occurredAt: new Date("2026-07-14T10:30:00.000Z"),
      archivedAt: null,
    },
    create: {
      id: "seed-activity-acme-discovery",
      organizationId: organization.id,
      companyId: company.id,
      contactId: acmeContact.id,
      dealId: "seed-deal-acme-retainer",
      authorMembershipId: salesRepMembership.id,
      type: "CALL",
      subject: "Retainer discovery call",
      body: "Confirmed the support scope and next review date with the creative team.",
      occurredAt: new Date("2026-07-14T10:30:00.000Z"),
    },
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-boreal-review" },
    update: {
      organizationId: organization.id,
      companyId: borealCompany.id,
      contactId: borealContact.id,
      dealId: "seed-deal-boreal-growth",
      authorMembershipId: managerMembership.id,
      type: "MEETING",
      subject: "Campaign planning review",
      body: "Aligned on the launch sequence, reporting cadence, and stakeholder approvals.",
      occurredAt: new Date("2026-07-15T13:00:00.000Z"),
      archivedAt: null,
    },
    create: {
      id: "seed-activity-boreal-review",
      organizationId: organization.id,
      companyId: borealCompany.id,
      contactId: borealContact.id,
      dealId: "seed-deal-boreal-growth",
      authorMembershipId: managerMembership.id,
      type: "MEETING",
      subject: "Campaign planning review",
      body: "Aligned on the launch sequence, reporting cadence, and stakeholder approvals.",
      occurredAt: new Date("2026-07-15T13:00:00.000Z"),
    },
  });

  await prisma.task.upsert({
    where: { id: "seed-task-acme-proposal" },
    update: {
      organizationId: organization.id,
      companyId: company.id,
      contactId: acmeContact.id,
      dealId: "seed-deal-acme-retainer",
      assigneeMembershipId: salesRepMembership.id,
      createdByMembershipId: managerMembership.id,
      title: "Send the retainer proposal",
      description: "Include the agreed support scope and monthly delivery cadence.",
      priority: "HIGH",
      dueAt: new Date("2026-07-22T00:00:00.000Z"),
      completedAt: null,
      archivedAt: null,
    },
    create: {
      id: "seed-task-acme-proposal",
      organizationId: organization.id,
      companyId: company.id,
      contactId: acmeContact.id,
      dealId: "seed-deal-acme-retainer",
      assigneeMembershipId: salesRepMembership.id,
      createdByMembershipId: managerMembership.id,
      title: "Send the retainer proposal",
      description: "Include the agreed support scope and monthly delivery cadence.",
      priority: "HIGH",
      dueAt: new Date("2026-07-22T00:00:00.000Z"),
    },
  });

  await prisma.task.upsert({
    where: { id: "seed-task-boreal-brief" },
    update: {
      organizationId: organization.id,
      companyId: borealCompany.id,
      contactId: borealContact.id,
      dealId: "seed-deal-boreal-growth",
      assigneeMembershipId: managerMembership.id,
      createdByMembershipId: adminMembership.id,
      title: "Prepare launch brief",
      description: "Prepare the final kickoff brief for the growth campaign team.",
      priority: "MEDIUM",
      dueAt: new Date("2026-07-25T00:00:00.000Z"),
      completedAt: null,
      archivedAt: null,
    },
    create: {
      id: "seed-task-boreal-brief",
      organizationId: organization.id,
      companyId: borealCompany.id,
      contactId: borealContact.id,
      dealId: "seed-deal-boreal-growth",
      assigneeMembershipId: managerMembership.id,
      createdByMembershipId: adminMembership.id,
      title: "Prepare launch brief",
      description: "Prepare the final kickoff brief for the growth campaign team.",
      priority: "MEDIUM",
      dueAt: new Date("2026-07-25T00:00:00.000Z"),
    },
  });

  await prisma.deal.upsert({
    where: { id: "seed-deal-boreal-growth" },
    update: {
      organizationId: organization.id,
      companyId: borealCompany.id,
      primaryContactId: borealContact.id,
      ownerMembershipId: managerMembership.id,
      title: "Growth campaign launch",
      stage: "QUALIFIED",
      amountCents: 950000,
      currency: "EUR",
      source: "Inbound",
      expectedCloseDate: new Date("2026-09-30T00:00:00.000Z"),
      description: "Cross-channel launch campaign for the next growth cycle.",
      archivedAt: null,
    },
    create: {
      id: "seed-deal-boreal-growth",
      organizationId: organization.id,
      companyId: borealCompany.id,
      primaryContactId: borealContact.id,
      ownerMembershipId: managerMembership.id,
      title: "Growth campaign launch",
      stage: "QUALIFIED",
      amountCents: 950000,
      currency: "EUR",
      source: "Inbound",
      expectedCloseDate: new Date("2026-09-30T00:00:00.000Z"),
      description: "Cross-channel launch campaign for the next growth cycle.",
    },
  });

  await prisma.invitation.upsert({
    where: { tokenHash: "seed-invite-token-hash" },
    update: {
      organizationId: organization.id,
      email: "future-manager@atlas-digital.test",
      role: "MANAGER",
      invitedByUserId: adminUser.id,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      acceptedAt: null,
    },
    create: {
      organizationId: organization.id,
      email: "future-manager@atlas-digital.test",
      role: "MANAGER",
      tokenHash: "seed-invite-token-hash",
      invitedByUserId: adminUser.id,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  });

  const [organizations, users, memberships, invitations, companies, contacts, deals, activities, tasks] =
    await prisma.$transaction([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.membership.count(),
      prisma.invitation.count(),
      prisma.company.count(),
      prisma.contact.count(),
      prisma.deal.count(),
      prisma.activity.count(),
      prisma.task.count(),
    ]);

  console.log({
    seeded: true,
      demoCredentials: [
        { role: "admin", email: "owner@atlas-digital.test", password: demoAdminPassword },
        { role: "manager", email: "manager@atlas-digital.test", password: demoManagerPassword },
        { role: "sales_rep", email: "sales@atlas-digital.test", password: demoSalesRepPassword },
      ],
    counts: {
      organizations,
      users,
      memberships,
      invitations,
      companies,
      contacts,
      deals,
      activities,
      tasks,
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
