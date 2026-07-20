import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "work-test-org";
const password = "Work123!";
const adminEmail = "work-admin@example.com";
const managerEmail = "work-manager@example.com";
const salesEmail = "work-sales@example.com";

type Fixtures = {
  organizationId: string;
  adminMembershipId: string;
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
    update: { passwordHash, firstName, lastName, isActive: true, archivedAt: null },
    create: { email, passwordHash, firstName, lastName, isActive: true },
  });
}

async function ensureFixtures(): Promise<Fixtures> {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: "Work Test Organization", archivedAt: null },
    create: { name: "Work Test Organization", slug: organizationSlug },
  });
  const admin = await ensureUser(adminEmail, "Work", "Admin");
  const manager = await ensureUser(managerEmail, "Work", "Manager");
  const salesRep = await ensureUser(salesEmail, "Work", "Sales");

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
    where: { organizationId_name: { organizationId: organization.id, name: "Work Manager Client" } },
    update: { ownerMembershipId: managerMembership.id, archivedAt: null, status: "LEAD" },
    create: { organizationId: organization.id, ownerMembershipId: managerMembership.id, name: "Work Manager Client", status: "LEAD" },
  });
  const salesCompany = await prisma.company.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Work Sales Client" } },
    update: { ownerMembershipId: salesMembership.id, archivedAt: null, status: "LEAD" },
    create: { organizationId: organization.id, ownerMembershipId: salesMembership.id, name: "Work Sales Client", status: "LEAD" },
  });
  const managerContact = await prisma.contact.upsert({
    where: { id: "work-manager-contact" },
    update: { organizationId: organization.id, companyId: managerCompany.id, firstName: "Manager", lastName: "Buyer", archivedAt: null },
    create: { id: "work-manager-contact", organizationId: organization.id, companyId: managerCompany.id, firstName: "Manager", lastName: "Buyer" },
  });
  const salesContact = await prisma.contact.upsert({
    where: { id: "work-sales-contact" },
    update: { organizationId: organization.id, companyId: salesCompany.id, firstName: "Sales", lastName: "Buyer", archivedAt: null },
    create: { id: "work-sales-contact", organizationId: organization.id, companyId: salesCompany.id, firstName: "Sales", lastName: "Buyer" },
  });
  const managerDeal = await prisma.deal.upsert({
    where: { id: "work-manager-deal" },
    update: { organizationId: organization.id, companyId: managerCompany.id, ownerMembershipId: managerMembership.id, title: "Manager Work Deal", stage: "QUALIFIED", amountCents: 200000, currency: "EUR", archivedAt: null },
    create: { id: "work-manager-deal", organizationId: organization.id, companyId: managerCompany.id, ownerMembershipId: managerMembership.id, title: "Manager Work Deal", stage: "QUALIFIED", amountCents: 200000, currency: "EUR" },
  });
  const salesDeal = await prisma.deal.upsert({
    where: { id: "work-sales-deal" },
    update: { organizationId: organization.id, companyId: salesCompany.id, ownerMembershipId: salesMembership.id, title: "Sales Work Deal", stage: "CONTACTED", amountCents: 100000, currency: "EUR", archivedAt: null },
    create: { id: "work-sales-deal", organizationId: organization.id, companyId: salesCompany.id, ownerMembershipId: salesMembership.id, title: "Sales Work Deal", stage: "CONTACTED", amountCents: 100000, currency: "EUR" },
  });

  await prisma.task.deleteMany({ where: { organizationId: organization.id } });
  await prisma.activity.deleteMany({ where: { organizationId: organization.id } });
  await prisma.task.createMany({
    data: [
      { organizationId: organization.id, companyId: managerCompany.id, contactId: managerContact.id, dealId: managerDeal.id, assigneeMembershipId: managerMembership.id, createdByMembershipId: adminMembership.id, title: "Manager follow-up", priority: "HIGH" },
      { organizationId: organization.id, companyId: salesCompany.id, contactId: salesContact.id, dealId: salesDeal.id, assigneeMembershipId: salesMembership.id, createdByMembershipId: adminMembership.id, title: "Sales follow-up", priority: "MEDIUM" },
    ],
  });

  return {
    organizationId: organization.id,
    adminMembershipId: adminMembership.id,
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

let fixtures: Fixtures;

beforeEach(async () => {
  fixtures = await ensureFixtures();
});

afterAll(async () => {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!organization) return;
  await prisma.task.deleteMany({ where: { organizationId: organization.id } });
  await prisma.activity.deleteMany({ where: { organizationId: organization.id } });
  await prisma.deal.deleteMany({ where: { organizationId: organization.id } });
  await prisma.contact.deleteMany({ where: { organizationId: organization.id } });
  await prisma.company.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.authSession.deleteMany({ where: { user: { email: { in: [adminEmail, managerEmail, salesEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, managerEmail, salesEmail] } } });
});

describe("work API", () => {
  test("limits sales reps to tasks linked to their owned companies", async () => {
    const agent = await login(salesEmail);
    const response = await agent.get(`/api/organizations/${organizationSlug}/tasks?scope=all&status=open`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([expect.objectContaining({ title: "Sales follow-up" })]);
  });

  test("lets a sales rep create a self-assigned task and activity on their company", async () => {
    const agent = await login(salesEmail);
    const taskResponse = await agent.post(`/api/organizations/${organizationSlug}/tasks`).send({
      companyId: fixtures.salesCompanyId,
      contactId: fixtures.salesContactId,
      dealId: fixtures.salesDealId,
      title: "Send proposal recap",
      priority: "high",
      dueAt: "2026-08-01",
    });
    const activityResponse = await agent.post(`/api/organizations/${organizationSlug}/activities`).send({
      companyId: fixtures.salesCompanyId,
      contactId: fixtures.salesContactId,
      dealId: fixtures.salesDealId,
      type: "call",
      subject: "Discovery call completed",
      body: "Discussed the implementation timeline.",
      occurredAt: "2026-07-17T10:00:00.000Z",
    });

    expect(taskResponse.status).toBe(201);
    expect(taskResponse.body.data.assignee.id).toBe(fixtures.salesMembershipId);
    expect(activityResponse.status).toBe(201);
    expect(activityResponse.body.data.author.id).toBe(fixtures.salesMembershipId);
  });

  test("rejects cross-company contact links and sales reassignment", async () => {
    const agent = await login(salesEmail);
    const linkResponse = await agent.post(`/api/organizations/${organizationSlug}/tasks`).send({
      companyId: fixtures.salesCompanyId,
      contactId: fixtures.managerContactId,
      title: "Invalid linked task",
      priority: "medium",
    });
    const assignmentResponse = await agent.post(`/api/organizations/${organizationSlug}/tasks`).send({
      companyId: fixtures.salesCompanyId,
      title: "Invalid assignment",
      priority: "medium",
      assigneeMembershipId: fixtures.managerMembershipId,
    });

    expect(linkResponse.status).toBe(400);
    expect(assignmentResponse.status).toBe(403);
  });

  test("lets leadership complete and reassign a task", async () => {
    const agent = await login(managerEmail);
    const taskList = await agent.get(`/api/organizations/${organizationSlug}/tasks?scope=all&status=open`);
    const taskId = taskList.body.data.find((task: { title: string }) => task.title === "Manager follow-up").id;
    const response = await agent.patch(`/api/organizations/${organizationSlug}/tasks/${taskId}`).send({
      assigneeMembershipId: fixtures.salesMembershipId,
      completed: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.assignee.id).toBe(fixtures.salesMembershipId);
    expect(response.body.data.completedAt).toEqual(expect.any(String));
  });

  test("filters activity history by company and archives a task", async () => {
    const agent = await login(managerEmail);
    const activityResponse = await agent.post(`/api/organizations/${organizationSlug}/activities`).send({
      companyId: fixtures.managerCompanyId,
      type: "note",
      subject: "Internal account review",
    });
    const activities = await agent.get(`/api/organizations/${organizationSlug}/activities?companyId=${fixtures.managerCompanyId}`);
    const tasks = await agent.get(`/api/organizations/${organizationSlug}/tasks?scope=all&status=open`);
    const taskId = tasks.body.data.find((task: { title: string }) => task.title === "Manager follow-up").id;
    const archiveResponse = await agent.delete(`/api/organizations/${organizationSlug}/tasks/${taskId}`);

    expect(activityResponse.status).toBe(201);
    expect(activities.body.data).toEqual([expect.objectContaining({ subject: "Internal account review" })]);
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.data.archived).toBe(true);
  });
});
