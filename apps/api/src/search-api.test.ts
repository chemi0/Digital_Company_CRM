import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "search-test-org";
const password = "Search123!";
const adminEmail = "search-admin@example.com";
const salesEmail = "search-sales@example.com";

async function ensureFixtures() {
  const passwordHash = await bcrypt.hash(password, 10);
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { archivedAt: null },
    create: { name: "Search Test Organization", slug: organizationSlug },
  });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, isActive: true, archivedAt: null },
    create: { email: adminEmail, passwordHash, firstName: "Search", lastName: "Admin" },
  });
  const sales = await prisma.user.upsert({
    where: { email: salesEmail },
    update: { passwordHash, isActive: true, archivedAt: null },
    create: { email: salesEmail, passwordHash, firstName: "Search", lastName: "Sales" },
  });
  const adminMembership = await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } },
    update: { role: "ADMIN", archivedAt: null },
    create: { organizationId: organization.id, userId: admin.id, role: "ADMIN" },
  });
  const salesMembership = await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: sales.id } },
    update: { role: "SALES_REP", archivedAt: null },
    create: { organizationId: organization.id, userId: sales.id, role: "SALES_REP" },
  });

  await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
  await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });

  const adminCompany = await prisma.company.create({
    data: { organizationId: organization.id, ownerMembershipId: adminMembership.id, name: "Northwind Partners", status: "ACTIVE_CLIENT" },
  });
  const salesCompany = await prisma.company.create({
    data: { organizationId: organization.id, ownerMembershipId: salesMembership.id, name: "Acme Sales Studio", status: "LEAD" },
  });
  await prisma.contact.createMany({ data: [
    { organizationId: organization.id, companyId: adminCompany.id, firstName: "Nora", lastName: "Northwind", email: "nora@northwind.example" },
    { organizationId: organization.id, companyId: salesCompany.id, firstName: "Alex", lastName: "Acme", email: "alex@acme.example" },
  ] });
  await prisma.deal.createMany({ data: [
    { organizationId: organization.id, companyId: adminCompany.id, ownerMembershipId: adminMembership.id, title: "Northwind expansion", amountCents: 100_000, currency: "EUR" },
    { organizationId: organization.id, companyId: salesCompany.id, ownerMembershipId: salesMembership.id, title: "Acme renewal", amountCents: 50_000, currency: "EUR" },
  ] });
}

async function login(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password });
  return agent;
}

beforeEach(ensureFixtures);

afterAll(async () => {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (organization) {
    await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
    await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
    await prisma.company.deleteMany({ where: { organizationId: organization.id } });
    await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
  await prisma.authSession.deleteMany({ where: { user: { email: { in: [adminEmail, salesEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, salesEmail] } } });
});

describe("global search API", () => {
  test("returns matching companies, contacts, and deals to an admin", async () => {
    const agent = await login(adminEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/search?q=Acme`);

    expect(response.status).toBe(200);
    expect(response.body.data.companies).toEqual([expect.objectContaining({ name: "Acme Sales Studio" })]);
    expect(response.body.data.contacts).toEqual([expect.objectContaining({ firstName: "Alex" })]);
    expect(response.body.data.contacts[0].company).toEqual(expect.objectContaining({ name: "Acme Sales Studio" }));
    expect(response.body.data.deals).toEqual([expect.objectContaining({ title: "Acme renewal" })]);
    expect(response.body.data.deals[0].company).toEqual(expect.objectContaining({ name: "Acme Sales Studio" }));
  });

  test("does not expose records outside a sales rep's ownership scope", async () => {
    const agent = await login(salesEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/search?q=Northwind`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ companies: [], contacts: [], deals: [] });
  });
});
