import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "dashboard-test-org";
const password = "Dashboard123!";
const adminEmail = "dashboard-admin@example.com";
const salesEmail = "dashboard-sales@example.com";

async function ensureFixtures() {
  const passwordHash = await bcrypt.hash(password, 10);
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { archivedAt: null },
    create: { name: "Dashboard Test Organization", slug: organizationSlug },
  });
  const admin = await prisma.user.upsert({ where: { email: adminEmail }, update: { passwordHash, isActive: true, archivedAt: null }, create: { email: adminEmail, passwordHash, firstName: "Dashboard", lastName: "Admin" } });
  const sales = await prisma.user.upsert({ where: { email: salesEmail }, update: { passwordHash, isActive: true, archivedAt: null }, create: { email: salesEmail, passwordHash, firstName: "Dashboard", lastName: "Sales" } });
  const adminMembership = await prisma.membership.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } }, update: { role: "ADMIN", archivedAt: null }, create: { organizationId: organization.id, userId: admin.id, role: "ADMIN" } });
  const salesMembership = await prisma.membership.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: sales.id } }, update: { role: "SALES_REP", archivedAt: null }, create: { organizationId: organization.id, userId: sales.id, role: "SALES_REP" } });

  await prisma.activity.deleteMany({ where: { organizationId: organization.id } });
  await prisma.task.deleteMany({ where: { organizationId: organization.id } });
  await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
  await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });

  const adminCompany = await prisma.company.create({ data: { organizationId: organization.id, ownerMembershipId: adminMembership.id, name: "Admin Account", status: "ACTIVE_CLIENT" } });
  const salesCompany = await prisma.company.create({ data: { organizationId: organization.id, ownerMembershipId: salesMembership.id, name: "Sales Account", status: "LEAD" } });
  await prisma.deal.createMany({ data: [
    { organizationId: organization.id, companyId: adminCompany.id, ownerMembershipId: adminMembership.id, title: "Admin opportunity", stage: "NEW_LEAD", amountCents: 100_000, currency: "EUR" },
    { organizationId: organization.id, companyId: salesCompany.id, ownerMembershipId: salesMembership.id, title: "Sales opportunity", stage: "QUALIFIED", amountCents: 200_000, currency: "EUR" },
  ] });
  await prisma.task.createMany({ data: [
    { organizationId: organization.id, companyId: adminCompany.id, assigneeMembershipId: adminMembership.id, createdByMembershipId: adminMembership.id, title: "Admin follow-up", priority: "MEDIUM", dueAt: new Date("2099-01-05T00:00:00.000Z") },
    { organizationId: organization.id, companyId: salesCompany.id, assigneeMembershipId: salesMembership.id, createdByMembershipId: salesMembership.id, title: "Sales follow-up", priority: "HIGH", dueAt: new Date("2000-01-01T00:00:00.000Z") },
  ] });
  await prisma.activity.create({ data: { organizationId: organization.id, companyId: salesCompany.id, authorMembershipId: salesMembership.id, type: "CALL", subject: "Sales discovery call" } });
}

async function login(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password });
  return agent;
}

beforeEach(ensureFixtures);

afterAll(async () => {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!organization) return;
  await prisma.activity.deleteMany({ where: { organizationId: organization.id } });
  await prisma.task.deleteMany({ where: { organizationId: organization.id } });
  await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.authSession.deleteMany({ where: { user: { email: { in: [adminEmail, salesEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, salesEmail] } } });
});

describe("dashboard API", () => {
  test("returns organization-wide performance data to an admin", async () => {
    const agent = await login(adminEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/dashboard`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      scope: "organization",
      metrics: expect.objectContaining({ pipelineValueCents: 300_000, activeClients: 1, leads: 1, overdueTasks: 1 }),
    }));
    expect(response.body.data.upcomingTasks).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Admin follow-up" }), expect.objectContaining({ title: "Sales follow-up" })]));
  });

  test("limits a sales rep dashboard to their owned work", async () => {
    const agent = await login(salesEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/dashboard`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      scope: "personal",
      metrics: expect.objectContaining({ pipelineValueCents: 200_000, activeClients: 0, leads: 1, overdueTasks: 1 }),
    }));
    expect(response.body.data.upcomingTasks).toEqual([expect.objectContaining({ title: "Sales follow-up" })]);
    expect(response.body.data.recentActivities).toEqual([expect.objectContaining({ subject: "Sales discovery call" })]);
  });
});
