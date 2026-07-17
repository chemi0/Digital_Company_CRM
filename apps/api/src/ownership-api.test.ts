import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "ownership-test-org";
const adminEmail = "ownership-admin@example.com";
const managerEmail = "ownership-manager@example.com";
const salesEmail = "ownership-sales@example.com";
const password = "Ownership123!";

type OwnershipFixtures = {
  organizationId: string;
  adminMembershipId: string;
  managerMembershipId: string;
  salesMembershipId: string;
  managerCompanyId: string;
  salesCompanyId: string;
  managerContactId: string;
  salesContactId: string;
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

async function ensureFixtures(): Promise<OwnershipFixtures> {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: "Ownership Test Org", archivedAt: null },
    create: { name: "Ownership Test Org", slug: organizationSlug },
  });

  const [admin, manager, salesRep] = await Promise.all([
    ensureUser(adminEmail, "Ownership", "Admin"),
    ensureUser(managerEmail, "Ownership", "Manager"),
    ensureUser(salesEmail, "Ownership", "Sales"),
  ]);

  const [adminMembership, managerMembership, salesMembership] = await Promise.all([
    prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } },
      update: { role: "ADMIN", archivedAt: null },
      create: { organizationId: organization.id, userId: admin.id, role: "ADMIN" },
    }),
    prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: manager.id } },
      update: { role: "MANAGER", archivedAt: null },
      create: { organizationId: organization.id, userId: manager.id, role: "MANAGER" },
    }),
    prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: salesRep.id } },
      update: { role: "SALES_REP", archivedAt: null },
      create: { organizationId: organization.id, userId: salesRep.id, role: "SALES_REP" },
    }),
  ]);

  const [managerCompany, salesCompany] = await Promise.all([
    prisma.company.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Manager Account" } },
      update: { ownerMembershipId: managerMembership.id, status: "LEAD", archivedAt: null },
      create: {
        organizationId: organization.id,
        ownerMembershipId: managerMembership.id,
        name: "Manager Account",
        status: "LEAD",
      },
    }),
    prisma.company.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Sales Account" } },
      update: { ownerMembershipId: salesMembership.id, status: "LEAD", archivedAt: null },
      create: {
        organizationId: organization.id,
        ownerMembershipId: salesMembership.id,
        name: "Sales Account",
        status: "LEAD",
      },
    }),
  ]);

  const [managerContact, salesContact] = await Promise.all([
    prisma.contact.upsert({
      where: { id: "ownership-manager-contact" },
      update: {
        organizationId: organization.id,
        companyId: managerCompany.id,
        firstName: "Manager",
        lastName: "Contact",
        archivedAt: null,
      },
      create: {
        id: "ownership-manager-contact",
        organizationId: organization.id,
        companyId: managerCompany.id,
        firstName: "Manager",
        lastName: "Contact",
      },
    }),
    prisma.contact.upsert({
      where: { id: "ownership-sales-contact" },
      update: {
        organizationId: organization.id,
        companyId: salesCompany.id,
        firstName: "Sales",
        lastName: "Contact",
        archivedAt: null,
      },
      create: {
        id: "ownership-sales-contact",
        organizationId: organization.id,
        companyId: salesCompany.id,
        firstName: "Sales",
        lastName: "Contact",
      },
    }),
  ]);

  return {
    organizationId: organization.id,
    adminMembershipId: adminMembership.id,
    managerMembershipId: managerMembership.id,
    salesMembershipId: salesMembership.id,
    managerCompanyId: managerCompany.id,
    salesCompanyId: salesCompany.id,
    managerContactId: managerContact.id,
    salesContactId: salesContact.id,
  };
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });

  expect(response.status).toBe(200);
  return agent;
}

let fixtures: OwnershipFixtures;

beforeEach(async () => {
  fixtures = await ensureFixtures();
});

afterAll(async () => {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

  if (!organization) {
    return;
  }

  await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.authSession.deleteMany({
    where: { user: { email: { in: [adminEmail, managerEmail, salesEmail] } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, managerEmail, salesEmail] } } });
});

describe("company ownership API", () => {
  test("limits a sales rep to companies and contacts they own", async () => {
    const agent = await login(salesEmail);

    const [companiesResponse, contactsResponse, otherCompanyResponse, otherContactResponse] = await Promise.all([
      agent.get(`/api/organizations/${organizationSlug}/companies`),
      agent.get(`/api/organizations/${organizationSlug}/contacts`),
      agent.get(`/api/organizations/${organizationSlug}/companies/${fixtures.managerCompanyId}`),
      agent.get(`/api/organizations/${organizationSlug}/contacts/${fixtures.managerContactId}`),
    ]);

    expect(companiesResponse.status).toBe(200);
    expect(companiesResponse.body.data).toEqual([
      expect.objectContaining({ id: fixtures.salesCompanyId }),
    ]);
    expect(contactsResponse.status).toBe(200);
    expect(contactsResponse.body.data).toEqual([
      expect.objectContaining({ id: fixtures.salesContactId }),
    ]);
    expect(otherCompanyResponse.status).toBe(404);
    expect(otherContactResponse.status).toBe(404);
  });

  test("assigns new sales-rep companies to the current sales rep and blocks ownership overrides", async () => {
    const agent = await login(salesEmail);

    const ownCompanyResponse = await agent.post(`/api/organizations/${organizationSlug}/companies`).send({
      name: "Sales Created Account",
      status: "lead",
    });
    const overrideResponse = await agent.post(`/api/organizations/${organizationSlug}/companies`).send({
      name: "Blocked Ownership Override",
      status: "lead",
      ownerMembershipId: fixtures.managerMembershipId,
    });

    expect(ownCompanyResponse.status).toBe(201);
    expect(ownCompanyResponse.body.data.owner.id).toBe(fixtures.salesMembershipId);
    expect(overrideResponse.status).toBe(403);
  });

  test("lets managers list team members and reassign a company", async () => {
    const agent = await login(managerEmail);

    const teamResponse = await agent.get(`/api/organizations/${organizationSlug}/memberships`);
    const updateResponse = await agent
      .patch(`/api/organizations/${organizationSlug}/companies/${fixtures.managerCompanyId}`)
      .send({ ownerMembershipId: fixtures.salesMembershipId });

    expect(teamResponse.status).toBe(200);
    expect(teamResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixtures.adminMembershipId, role: "admin" }),
        expect.objectContaining({ id: fixtures.managerMembershipId, role: "manager" }),
        expect.objectContaining({ id: fixtures.salesMembershipId, role: "sales_rep" }),
      ]),
    );
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.owner.id).toBe(fixtures.salesMembershipId);
  });

  test("blocks a sales rep from reassigning companies or creating contacts for another owner", async () => {
    const agent = await login(salesEmail);

    const [reassignResponse, contactResponse] = await Promise.all([
      agent.patch(`/api/organizations/${organizationSlug}/companies/${fixtures.salesCompanyId}`).send({
        ownerMembershipId: fixtures.managerMembershipId,
      }),
      agent.post(`/api/organizations/${organizationSlug}/contacts`).send({
        companyId: fixtures.managerCompanyId,
        firstName: "Blocked",
        lastName: "Contact",
        isPrimary: false,
      }),
    ]);

    expect(reassignResponse.status).toBe(403);
    expect(contactResponse.status).toBe(404);
  });

  test("blocks sales reps from viewing the team directory", async () => {
    const agent = await login(salesEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/memberships`);

    expect(response.status).toBe(403);
  });
});
