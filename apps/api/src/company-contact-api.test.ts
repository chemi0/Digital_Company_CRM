import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const testOrgSlug = "api-test-org";
const baseCompanyName = "API Test Company";
const testUserEmail = "api-test-admin@example.com";
const testPassword = "ApiAdmin123!";

let authenticatedAgent: ReturnType<typeof request.agent>;

async function ensureTestOrganization() {
  return prisma.organization.upsert({
    where: { slug: testOrgSlug },
    update: {
      name: "API Test Org",
      archivedAt: null,
    },
    create: {
      name: "API Test Org",
      slug: testOrgSlug,
    },
  });
}

async function ensureBaseCompany() {
  const organization = await ensureTestOrganization();

  return prisma.company.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: baseCompanyName,
      },
    },
    update: {
      status: "LEAD",
      archivedAt: null,
    },
    create: {
      organizationId: organization.id,
      name: baseCompanyName,
      status: "LEAD",
    },
  });
}

beforeAll(async () => {
  const organization = await ensureTestOrganization();
  const company = await ensureBaseCompany();
  const passwordHash = await bcrypt.hash(testPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: testUserEmail },
    update: {
      passwordHash,
      firstName: "API",
      lastName: "Admin",
      isActive: true,
      archivedAt: null,
    },
    create: {
      email: testUserEmail,
      passwordHash,
      firstName: "API",
      lastName: "Admin",
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

  await prisma.contact.deleteMany({
    where: {
      organizationId: organization.id,
      email: "api-test-contact@example.com",
    },
  });

  await prisma.contact.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      firstName: "API",
      lastName: "Contact",
      email: "api-test-contact@example.com",
      jobTitle: "QA Lead",
      isPrimary: true,
    },
  });
});

beforeEach(async () => {
  authenticatedAgent = request.agent(app);

  const loginResponse = await authenticatedAgent
    .post("/api/auth/login")
    .send({
      email: testUserEmail,
      password: testPassword,
    });

  expect(loginResponse.status).toBe(200);
});

afterAll(async () => {
  const organization = await prisma.organization.findUnique({
    where: { slug: testOrgSlug },
  });

  if (!organization) {
    return;
  }

  await prisma.contact.deleteMany({
    where: { organizationId: organization.id },
  });

  await prisma.membership.deleteMany({
    where: { organizationId: organization.id },
  });

  await prisma.company.deleteMany({
    where: { organizationId: organization.id },
  });

  await prisma.organization.deleteMany({
    where: { id: organization.id },
  });

  await prisma.authSession.deleteMany({
    where: {
      user: {
        email: testUserEmail,
      },
    },
  });

  await prisma.user.deleteMany({
    where: { email: testUserEmail },
  });
});

describe("company/contact API", () => {
  test("rejects unauthenticated company access", async () => {
    const response = await request(app).get(
      `/api/organizations/${testOrgSlug}/companies`,
    );

    expect(response.status).toBe(401);
  });

  test("lists companies for an organization", async () => {
    const response = await authenticatedAgent.get(
      `/api/organizations/${testOrgSlug}/companies`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: baseCompanyName,
        }),
      ]),
    );
  });

  test("lists contacts for an organization", async () => {
    const response = await authenticatedAgent.get(
      `/api/organizations/${testOrgSlug}/contacts`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "api-test-contact@example.com",
        }),
      ]),
    );
  });

  test("creates a company for an organization", async () => {
    const companyName = `Created Via API ${randomUUID()}`;

    const response = await authenticatedAgent
      .post(`/api/organizations/${testOrgSlug}/companies`)
      .send({
        name: companyName,
        status: "lead",
        website: "https://created-via-api.example",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        name: companyName,
        status: "lead",
      }),
    );
  });

  test("creates a contact for a company in the same organization", async () => {
    const company = await ensureBaseCompany();
    const email = `${randomUUID()}@example.com`;

    const response = await authenticatedAgent
      .post(`/api/organizations/${testOrgSlug}/contacts`)
      .send({
        companyId: company.id,
        firstName: "New",
        lastName: "Contact",
        email,
        isPrimary: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        firstName: "New",
        lastName: "Contact",
        companyId: company.id,
      }),
    );
  });

  test("gets a company detail with its contacts", async () => {
    const company = await ensureBaseCompany();

    const response = await authenticatedAgent.get(
      `/api/organizations/${testOrgSlug}/companies/${company.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: company.id,
        name: baseCompanyName,
      }),
    );
    expect(response.body.data.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "api-test-contact@example.com",
        }),
      ]),
    );
  });

  test("updates a company for an organization", async () => {
    const company = await ensureBaseCompany();

    const response = await authenticatedAgent
      .patch(`/api/organizations/${testOrgSlug}/companies/${company.id}`)
      .send({
        status: "active_client",
        industry: "Creative Services",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: company.id,
        status: "active_client",
        industry: "Creative Services",
      }),
    );
  });

  test("gets a contact detail with its company", async () => {
    const contact = await prisma.contact.findFirstOrThrow({
      where: {
        email: "api-test-contact@example.com",
      },
    });

    const response = await authenticatedAgent.get(
      `/api/organizations/${testOrgSlug}/contacts/${contact.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: contact.id,
        email: "api-test-contact@example.com",
      }),
    );
    expect(response.body.data.company).toEqual(
      expect.objectContaining({
        name: baseCompanyName,
      }),
    );
  });

  test("updates a contact for an organization", async () => {
    const contact = await prisma.contact.findFirstOrThrow({
      where: {
        email: "api-test-contact@example.com",
      },
    });

    const response = await authenticatedAgent
      .patch(`/api/organizations/${testOrgSlug}/contacts/${contact.id}`)
      .send({
        jobTitle: "Head of QA",
        isPrimary: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: contact.id,
        jobTitle: "Head of QA",
        isPrimary: false,
      }),
    );
  });

  test("archives a contact and removes it from the organization list", async () => {
    const company = await ensureBaseCompany();
    const email = `${randomUUID()}@example.com`;

    const createdContact = await prisma.contact.create({
      data: {
        organizationId: company.organizationId,
        companyId: company.id,
        firstName: "Archive",
        lastName: "Me",
        email,
      },
    });

    const archiveResponse = await authenticatedAgent.delete(
      `/api/organizations/${testOrgSlug}/contacts/${createdContact.id}`,
    );

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.data).toEqual(
      expect.objectContaining({
        id: createdContact.id,
        archived: true,
      }),
    );

    const listResponse = await authenticatedAgent.get(
      `/api/organizations/${testOrgSlug}/contacts`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdContact.id,
        }),
      ]),
    );
  });
});
