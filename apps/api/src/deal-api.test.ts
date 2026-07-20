import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "deal-test-org";
const adminEmail = "deal-admin@example.com";
const managerEmail = "deal-manager@example.com";
const salesEmail = "deal-sales@example.com";
const password = "Deals123!";

type DealFixtures = {
  organizationId: string;
  managerMembershipId: string;
  salesMembershipId: string;
  managerCompanyId: string;
  salesCompanyId: string;
  managerContactId: string;
  salesContactId: string;
  managerDealId: string;
  salesDealId: string;
};

async function ensureUser(email: string, firstName: string, lastName: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      isActive: true,
      archivedAt: null,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      isActive: true,
    },
  });
}

async function ensureFixtures(): Promise<DealFixtures> {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: "Deal Test Org", archivedAt: null },
    create: { name: "Deal Test Org", slug: organizationSlug },
  });

  const admin = await ensureUser(adminEmail, "Deal", "Admin");
  const manager = await ensureUser(managerEmail, "Deal", "Manager");
  const salesRep = await ensureUser(salesEmail, "Deal", "Sales");

  const adminMembership = await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } },
      update: { role: "ADMIN", archivedAt: null },
      create: { organizationId: organization.id, userId: admin.id, role: "ADMIN" },
    });
  const managerMembership = await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: manager.id } },
      update: { role: "MANAGER", archivedAt: null },
      create: { organizationId: organization.id, userId: manager.id, role: "MANAGER" },
    });
  const salesMembership = await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: salesRep.id } },
      update: { role: "SALES_REP", archivedAt: null },
      create: { organizationId: organization.id, userId: salesRep.id, role: "SALES_REP" },
    });

  const managerCompany = await prisma.company.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Deal Manager Client" } },
      update: { ownerMembershipId: managerMembership.id, archivedAt: null, status: "LEAD" },
      create: {
        organizationId: organization.id,
        ownerMembershipId: managerMembership.id,
        name: "Deal Manager Client",
        status: "LEAD",
      },
    });
  const salesCompany = await prisma.company.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Deal Sales Client" } },
      update: { ownerMembershipId: salesMembership.id, archivedAt: null, status: "LEAD" },
      create: {
        organizationId: organization.id,
        ownerMembershipId: salesMembership.id,
        name: "Deal Sales Client",
        status: "LEAD",
      },
    });

  const managerContact = await prisma.contact.upsert({
      where: { id: "deal-manager-contact" },
      update: {
        organizationId: organization.id,
        companyId: managerCompany.id,
        firstName: "Manager",
        lastName: "Buyer",
        archivedAt: null,
      },
      create: {
        id: "deal-manager-contact",
        organizationId: organization.id,
        companyId: managerCompany.id,
        firstName: "Manager",
        lastName: "Buyer",
      },
    });
  const salesContact = await prisma.contact.upsert({
      where: { id: "deal-sales-contact" },
      update: {
        organizationId: organization.id,
        companyId: salesCompany.id,
        firstName: "Sales",
        lastName: "Buyer",
        archivedAt: null,
      },
      create: {
        id: "deal-sales-contact",
        organizationId: organization.id,
        companyId: salesCompany.id,
        firstName: "Sales",
        lastName: "Buyer",
      },
    });

  const managerDeal = await prisma.deal.upsert({
      where: { id: "deal-manager-record" },
      update: {
        organizationId: organization.id,
        companyId: managerCompany.id,
        primaryContactId: managerContact.id,
        ownerMembershipId: managerMembership.id,
        title: "Manager Expansion",
        stage: "QUALIFIED",
        amountCents: 750000,
        currency: "EUR",
        archivedAt: null,
      },
      create: {
        id: "deal-manager-record",
        organizationId: organization.id,
        companyId: managerCompany.id,
        primaryContactId: managerContact.id,
        ownerMembershipId: managerMembership.id,
        title: "Manager Expansion",
        stage: "QUALIFIED",
        amountCents: 750000,
        currency: "EUR",
      },
    });
  const salesDeal = await prisma.deal.upsert({
      where: { id: "deal-sales-record" },
      update: {
        organizationId: organization.id,
        companyId: salesCompany.id,
        primaryContactId: salesContact.id,
        ownerMembershipId: salesMembership.id,
        title: "Sales Website Retainer",
        stage: "CONTACTED",
        amountCents: 250000,
        currency: "EUR",
        archivedAt: null,
      },
      create: {
        id: "deal-sales-record",
        organizationId: organization.id,
        companyId: salesCompany.id,
        primaryContactId: salesContact.id,
        ownerMembershipId: salesMembership.id,
        title: "Sales Website Retainer",
        stage: "CONTACTED",
        amountCents: 250000,
        currency: "EUR",
      },
    });

  return {
    organizationId: organization.id,
    managerMembershipId: managerMembership.id,
    salesMembershipId: salesMembership.id,
    managerCompanyId: managerCompany.id,
    salesCompanyId: salesCompany.id,
    managerContactId: managerContact.id,
    salesContactId: salesContact.id,
    managerDealId: managerDeal.id,
    salesDealId: salesDeal.id,
  };
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });

  expect(response.status).toBe(200);
  return agent;
}

let fixtures: DealFixtures;

beforeEach(async () => {
  fixtures = await ensureFixtures();
});

afterAll(async () => {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

  if (!organization) {
    return;
  }

  await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
  await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.authSession.deleteMany({
    where: { user: { email: { in: [adminEmail, managerEmail, salesEmail] } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, managerEmail, salesEmail] } } });
});

describe("deal API", () => {
  test("limits sales reps to their own deals", async () => {
    const agent = await login(salesEmail);

    const listResponse = await agent.get(`/api/organizations/${organizationSlug}/deals`);
    const otherDealResponse = await agent.get(
      `/api/organizations/${organizationSlug}/deals/${fixtures.managerDealId}`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual([
      expect.objectContaining({ id: fixtures.salesDealId }),
    ]);
    expect(otherDealResponse.status).toBe(404);
  });

  test("assigns sales-created deals to the current sales rep and blocks another company", async () => {
    const agent = await login(salesEmail);

    const createdResponse = await agent.post(`/api/organizations/${organizationSlug}/deals`).send({
      companyId: fixtures.salesCompanyId,
      primaryContactId: fixtures.salesContactId,
      title: "Sales Created Deal",
      stage: "new_lead",
      amountCents: 120000,
      currency: "EUR",
    });
    const blockedResponse = await agent.post(`/api/organizations/${organizationSlug}/deals`).send({
      companyId: fixtures.managerCompanyId,
      title: "Blocked Deal",
      stage: "new_lead",
      amountCents: 50000,
      currency: "EUR",
    });

    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body.data.owner.id).toBe(fixtures.salesMembershipId);
    expect(blockedResponse.status).toBe(404);
  });

  test("requires a primary contact to belong to the selected company", async () => {
    const agent = await login(managerEmail);

    const response = await agent.post(`/api/organizations/${organizationSlug}/deals`).send({
      companyId: fixtures.managerCompanyId,
      primaryContactId: fixtures.salesContactId,
      title: "Invalid Contact Link",
      stage: "new_lead",
      amountCents: 50000,
      currency: "EUR",
    });

    expect(response.status).toBe(400);
  });

  test("rejects an amount outside the database-safe integer range", async () => {
    const agent = await login(managerEmail);

    const response = await agent.post(`/api/organizations/${organizationSlug}/deals`).send({
      companyId: fixtures.managerCompanyId,
      title: "Overflowing deal",
      stage: "new_lead",
      amountCents: 2_147_483_648,
      currency: "EUR",
    });

    expect(response.status).toBe(400);
  });

  test("lets managers advance and reassign deals", async () => {
    const agent = await login(managerEmail);

    const response = await agent
      .patch(`/api/organizations/${organizationSlug}/deals/${fixtures.managerDealId}`)
      .send({
        stage: "proposal_sent",
        ownerMembershipId: fixtures.salesMembershipId,
        expectedCloseDate: "2026-12-31",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        stage: "proposal_sent",
        owner: expect.objectContaining({ id: fixtures.salesMembershipId }),
        expectedCloseDate: "2026-12-31T00:00:00.000Z",
      }),
    );
  });

  test("archives a deal and excludes it from the default list", async () => {
    const agent = await login(managerEmail);

    const archiveResponse = await agent.delete(
      `/api/organizations/${organizationSlug}/deals/${fixtures.managerDealId}`,
    );
    const listResponse = await agent.get(`/api/organizations/${organizationSlug}/deals`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.data.archived).toBe(true);
    expect(listResponse.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixtures.managerDealId }),
      ]),
    );
  });
});
