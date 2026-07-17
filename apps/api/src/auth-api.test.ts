import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const demoOrgSlug = "atlas-digital";
const forbiddenOrgSlug = "forbidden-org";
const demoUserEmail = "owner@atlas-digital.test";
const demoPassword = "AtlasAdmin123!";

async function ensureDemoAdmin() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const organization = await prisma.organization.upsert({
    where: { slug: demoOrgSlug },
    update: {
      name: "Atlas Digital",
      archivedAt: null,
    },
    create: {
      name: "Atlas Digital",
      slug: demoOrgSlug,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: {
      passwordHash,
      firstName: "Milan",
      lastName: "Owner",
      isActive: true,
      archivedAt: null,
    },
    create: {
      email: demoUserEmail,
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
        userId: user.id,
      },
    },
    update: {
      role: "ADMIN",
      archivedAt: null,
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "ADMIN",
    },
  });

  return { organization, user };
}

beforeAll(async () => {
  const { user: demoAdmin } = await ensureDemoAdmin();

  const forbiddenOrganization = await prisma.organization.upsert({
    where: { slug: forbiddenOrgSlug },
    update: {
      name: "Forbidden Org",
      archivedAt: null,
    },
    create: {
      name: "Forbidden Org",
      slug: forbiddenOrgSlug,
    },
  });

  const forbiddenMembership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: forbiddenOrganization.id,
        userId: demoAdmin.id,
      },
    },
    update: {
      role: "ADMIN",
      archivedAt: null,
    },
    create: {
      organizationId: forbiddenOrganization.id,
      userId: demoAdmin.id,
      role: "ADMIN",
    },
  });

  await prisma.company.upsert({
    where: {
      organizationId_name: {
        organizationId: forbiddenOrganization.id,
        name: "Forbidden Company",
      },
    },
    update: {
      status: "LEAD",
      ownerMembershipId: forbiddenMembership.id,
      archivedAt: null,
    },
    create: {
      organizationId: forbiddenOrganization.id,
      ownerMembershipId: forbiddenMembership.id,
      name: "Forbidden Company",
      status: "LEAD",
    },
  });
});

afterAll(async () => {
  const forbiddenOrganization = await prisma.organization.findUnique({
    where: { slug: forbiddenOrgSlug },
  });

  if (forbiddenOrganization) {
    await prisma.company.deleteMany({
      where: { organizationId: forbiddenOrganization.id },
    });

    await prisma.membership.deleteMany({
      where: { organizationId: forbiddenOrganization.id },
    });

    await prisma.organization.deleteMany({
      where: { id: forbiddenOrganization.id },
    });
  }
});

describe("auth API", () => {
  test("logs in with the demo admin credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: demoUserEmail,
      password: demoPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: demoUserEmail,
      }),
    );
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("agency_crm_access_token="),
        expect.stringContaining("agency_crm_refresh_token="),
      ]),
    );
  });

  test("rejects an invalid password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: demoUserEmail,
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
  });

  test("rejects an unknown user", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "missing-user@example.com",
      password: demoPassword,
    });

    expect(response.status).toBe(401);
  });

  test("returns the current user for an authenticated session", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: demoUserEmail,
      password: demoPassword,
    });

    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: demoUserEmail,
        organization: expect.objectContaining({
          slug: demoOrgSlug,
        }),
        membership: expect.objectContaining({
          role: "admin",
        }),
      }),
    );
  });

  test("rotates the refresh session and keeps the session usable", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: demoUserEmail,
      password: demoPassword,
    });

    const refreshResponse = await agent.post("/api/auth/refresh");

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("agency_crm_access_token="),
        expect.stringContaining("agency_crm_refresh_token="),
      ]),
    );

    const meResponse = await agent.get("/api/auth/me");
    expect(meResponse.status).toBe(200);
  });

  test("logs out and clears the authenticated session", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: demoUserEmail,
      password: demoPassword,
    });

    const logoutResponse = await agent.post("/api/auth/logout");
    expect(logoutResponse.status).toBe(200);

    const meResponse = await agent.get("/api/auth/me");
    expect(meResponse.status).toBe(401);
  });

  test("rejects access to a different organization slug", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: demoUserEmail,
      password: demoPassword,
    });

    const response = await agent.get(
      `/api/organizations/${forbiddenOrgSlug}/companies`,
    );

    expect(response.status).toBe(403);
  });
});
