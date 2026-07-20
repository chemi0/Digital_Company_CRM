import bcrypt from "bcrypt";
import { createHash } from "crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const organizationSlug = "team-test-org";
const password = "Team123!";
const adminEmail = "team-admin@example.com";
const managerEmail = "team-manager@example.com";
const salesEmail = "team-sales@example.com";

type Fixtures = {
  organizationId: string;
  adminMembershipId: string;
  managerMembershipId: string;
  salesMembershipId: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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
    update: { name: "Team Test Organization", archivedAt: null },
    create: { name: "Team Test Organization", slug: organizationSlug },
  });
  const admin = await ensureUser(adminEmail, "Team", "Admin");
  const manager = await ensureUser(managerEmail, "Team", "Manager");
  const salesRep = await ensureUser(salesEmail, "Team", "Sales");
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
  await prisma.invitation.deleteMany({ where: { organizationId: organization.id } });
  return { organizationId: organization.id, adminMembershipId: adminMembership.id, managerMembershipId: managerMembership.id, salesMembershipId: salesMembership.id };
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
  await prisma.invitation.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.authSession.deleteMany({ where: { user: { email: { in: [adminEmail, managerEmail, salesEmail, "new-member@example.com"] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, managerEmail, salesEmail, "new-member@example.com"] } } });
});

describe("team and invitation API", () => {
  test("allows leadership to create an invite and blocks sales reps", async () => {
    const manager = await login(managerEmail);
    const salesRep = await login(salesEmail);
    const inviteResponse = await manager.post(`/api/organizations/${organizationSlug}/invitations`).send({ email: "new-member@example.com", role: "sales_rep" });
    const blockedResponse = await salesRep.post(`/api/organizations/${organizationSlug}/invitations`).send({ email: "blocked@example.com", role: "sales_rep" });

    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.data).toEqual(expect.objectContaining({ email: "new-member@example.com", role: "sales_rep", status: "pending" }));
    expect(blockedResponse.status).toBe(403);
  });

  test("restricts managers to sales-rep invitations", async () => {
    const manager = await login(managerEmail);
    const response = await manager.post(`/api/organizations/${organizationSlug}/invitations`).send({ email: "manager-invite@example.com", role: "manager" });

    expect(response.status).toBe(403);
  });

  test("restricts the audit trail to organization admins", async () => {
    const salesRep = await login(salesEmail);

    const response = await salesRep.get(`/api/organizations/${organizationSlug}/audit-log`);

    expect(response.status).toBe(403);
  });

  test("accepts a valid invitation once and creates a membership", async () => {
    const rawToken = "accepted-invite-token-that-is-long-enough-for-validation";
    await prisma.invitation.create({
      data: { organizationId: fixtures.organizationId, email: "new-member@example.com", role: "SALES_REP", tokenHash: hashToken(rawToken), invitedByUserId: fixtures.adminMembershipId ? (await prisma.membership.findUnique({ where: { id: fixtures.adminMembershipId } }))!.userId : "", expiresAt: new Date("2030-01-01T00:00:00.000Z") },
    });

    const response = await request(app).post("/api/auth/accept-invitation").send({ token: rawToken, firstName: "New", lastName: "Member", password: "NewMember123!" });
    const repeatResponse = await request(app).post("/api/auth/accept-invitation").send({ token: rawToken, firstName: "New", lastName: "Member", password: "NewMember123!" });

    expect(response.status).toBe(201);
    expect(response.body.data.membership.role).toBe("sales_rep");
    expect(repeatResponse.status).toBe(400);
  });

  test("lets an admin change a role and deactivate a membership", async () => {
    const admin = await login(adminEmail);
    const roleResponse = await admin.patch(`/api/organizations/${organizationSlug}/team/${fixtures.salesMembershipId}`).send({ role: "manager" });
    const deactivateResponse = await admin.delete(`/api/organizations/${organizationSlug}/team/${fixtures.salesMembershipId}`);

    expect(roleResponse.status).toBe(200);
    expect(roleResponse.body.data.role).toBe("manager");
    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.data.deactivated).toBe(true);
  });

  test("lets an admin reactivate a recently deactivated member without another invitation", async () => {
    const admin = await login(adminEmail);
    await admin.delete(`/api/organizations/${organizationSlug}/team/${fixtures.salesMembershipId}`);

    const inactiveResponse = await admin.get(`/api/organizations/${organizationSlug}/team/inactive`);
    const reactivateResponse = await admin.patch(`/api/organizations/${organizationSlug}/team/${fixtures.salesMembershipId}/reactivate`);

    expect(inactiveResponse.status).toBe(200);
    expect(inactiveResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixtures.salesMembershipId, requiresReactivationInvitation: false }),
    ]));
    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.data).toEqual(expect.objectContaining({ id: fixtures.salesMembershipId, reactivated: true }));
  });

  test("requires an email-confirmed reactivation after the configured window", async () => {
    const rawToken = "reactivation-token-that-is-long-enough-for-validation";
    const archivedAt = new Date("2000-01-01T00:00:00.000Z");
    const salesMembership = await prisma.membership.update({ where: { id: fixtures.salesMembershipId }, data: { archivedAt } });
    const admin = await login(adminEmail);
    const inviter = await prisma.membership.findUniqueOrThrow({ where: { id: fixtures.adminMembershipId } });

    await prisma.invitation.create({
      data: {
        organizationId: fixtures.organizationId,
        email: salesEmail,
        role: salesMembership.role,
        tokenHash: hashToken(rawToken),
        invitedByUserId: inviter.userId,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const inactiveResponse = await admin.get(`/api/organizations/${organizationSlug}/team/inactive`);
    const immediateResponse = await admin.patch(`/api/organizations/${organizationSlug}/team/${fixtures.salesMembershipId}/reactivate`);
    const previewResponse = await request(app).get(`/api/auth/invitation-preview?token=${rawToken}`);
    const acceptanceResponse = await request(app).post("/api/auth/accept-invitation").send({ token: rawToken });

    expect(inactiveResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixtures.salesMembershipId, requiresReactivationInvitation: true }),
    ]));
    expect(immediateResponse.status).toBe(409);
    expect(previewResponse.body.data).toEqual(expect.objectContaining({ mode: "reactivation" }));
    expect(acceptanceResponse.status).toBe(200);
    expect(acceptanceResponse.body.data.membership).toEqual(expect.objectContaining({ id: fixtures.salesMembershipId, reactivated: true }));
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: fixtures.salesMembershipId } })).archivedAt).toBeNull();
  });
});
