import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { toApiRole } from "../lib/auth-context.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditEvent } from "../lib/audit-log.js";
import { requireAuth, requireLeadershipRole, requireOrganizationAccess } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

router.use("/api/organizations/:organizationSlug", requireAuth, requireOrganizationAccess);

const companyStatusSchema = z.enum(["lead", "active_client", "inactive"]);
const listQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), status: companyStatusSchema.optional() });
const contactListQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), companyId: z.string().trim().min(1).optional() });
const membershipIdSchema = z.string().min(1);

const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  status: companyStatusSchema,
  website: z.url().optional(),
  industry: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  ownerMembershipId: membershipIdSchema.optional(),
});

const createContactSchema = z.object({
  companyId: z.string().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.email().optional(),
  phone: z.string().trim().min(1).optional(),
  jobTitle: z.string().trim().min(1).optional(),
  isPrimary: z.boolean().default(false),
});

const updateCompanySchema = createCompanySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one company field must be provided" },
);

const updateContactSchema = createContactSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one contact field must be provided" },
);

const ownerSelect = {
  id: true,
  role: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

type OwnerMembership = {
  id: string;
  role: "ADMIN" | "MANAGER" | "SALES_REP";
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type CompanyWithOwner = {
  id: string;
  organizationId: string;
  ownerMembershipId: string;
  name: string;
  status: "LEAD" | "ACTIVE_CLIENT" | "INACTIVE";
  website: string | null;
  industry: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerMembership: OwnerMembership;
};

function toPrismaCompanyStatus(status: z.infer<typeof companyStatusSchema>) {
  switch (status) {
    case "lead":
      return "LEAD";
    case "active_client":
      return "ACTIVE_CLIENT";
    case "inactive":
      return "INACTIVE";
  }
}

function toApiCompanyStatus(status: "LEAD" | "ACTIVE_CLIENT" | "INACTIVE") {
  switch (status) {
    case "LEAD":
      return "lead";
    case "ACTIVE_CLIENT":
      return "active_client";
    case "INACTIVE":
      return "inactive";
  }
}

function toOwnerResponse(owner: OwnerMembership) {
  return {
    id: owner.id,
    role: toApiRole(owner.role),
    user: owner.user,
  };
}

function toCompanyResponse(company: CompanyWithOwner, extras?: Record<string, unknown>) {
  return {
    id: company.id,
    organizationId: company.organizationId,
    ownerMembershipId: company.ownerMembershipId,
    name: company.name,
    status: toApiCompanyStatus(company.status),
    website: company.website,
    industry: company.industry,
    phone: company.phone,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    owner: toOwnerResponse(company.ownerMembership),
    ...extras,
  };
}

function toContactResponse(
  contact: {
    id: string;
    organizationId: string;
    companyId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  extras?: Record<string, unknown>,
) {
  return {
    id: contact.id,
    organizationId: contact.organizationId,
    companyId: contact.companyId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    isPrimary: contact.isPrimary,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    ...extras,
  };
}

function isLeadershipRole(role: "admin" | "manager" | "sales_rep") {
  return role !== "sales_rep";
}

function companyOwnershipScope(membershipId: string, role: "admin" | "manager" | "sales_rep") {
  return isLeadershipRole(role) ? {} : { ownerMembershipId: membershipId };
}

type CompanyOwnerResolution =
  | { ownerMembershipId: string }
  | { error: string; status: number };

async function findActiveMembership(organizationId: string, membershipId: string) {
  return prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
      archivedAt: null,
      user: {
        isActive: true,
        archivedAt: null,
      },
    },
    select: ownerSelect,
  });
}

async function resolveCompanyOwner(
  organizationId: string,
  currentMembership: { id: string; role: "admin" | "manager" | "sales_rep" },
  requestedOwnerMembershipId: string | undefined,
): Promise<CompanyOwnerResolution> {
  if (!isLeadershipRole(currentMembership.role)) {
    if (requestedOwnerMembershipId && requestedOwnerMembershipId !== currentMembership.id) {
      return { error: "Sales reps cannot assign a company to another owner", status: 403 } as const;
    }

    return { ownerMembershipId: currentMembership.id } as const;
  }

  const ownerMembershipId = requestedOwnerMembershipId ?? currentMembership.id;
  const ownerMembership = await findActiveMembership(organizationId, ownerMembershipId);

  if (!ownerMembership) {
    return { error: "Company owner must be an active member of this organization", status: 400 } as const;
  }

  return { ownerMembershipId: ownerMembership.id } as const;
}

router.get(
  "/api/organizations/:organizationSlug/memberships",
  requireLeadershipRole,
  async (request, response) => {
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: request.auth!.organization.id,
        archivedAt: null,
        user: {
          isActive: true,
          archivedAt: null,
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: ownerSelect,
    });

    return response.json({
      data: memberships.map(toOwnerResponse),
    });
  },
);

router.get("/api/organizations/:organizationSlug/companies/export", async (request, response) => {
  const { organization, membership } = request.auth!;
  const companies = await prisma.company.findMany({ where: { organizationId: organization.id, archivedAt: null, ...companyOwnershipScope(membership.id, membership.role) }, orderBy: { name: "asc" }, select: { name: true, status: true, website: true, industry: true, phone: true } });
  const escape = (value: string | null) => `"${(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["Name,Status,Website,Industry,Phone", ...companies.map((company) => [company.name, company.status, company.website, company.industry, company.phone].map(escape).join(","))].join("\n");
  response.attachment("companies.csv");
  return response.type("text/csv").send(csv);
});

router.get("/api/organizations/:organizationSlug/companies", async (request, response) => {
  const { organization, membership } = request.auth!;
  const parsedQuery = listQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) return response.status(400).json({ error: "Invalid company list query" });
  const { page, pageSize, search, status } = parsedQuery.data;
  const where: Prisma.CompanyWhereInput = { organizationId: organization.id, archivedAt: null, ...companyOwnershipScope(membership.id, membership.role), ...(status ? { status: toPrismaCompanyStatus(status) } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { industry: { contains: search, mode: "insensitive" } }] } : {}) };
  const companies = await prisma.company.findMany({
    where,
    ...(request.query.page ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    orderBy: { createdAt: "asc" },
    include: {
      ownerMembership: { select: ownerSelect },
      _count: {
        select: {
          contacts: {
            where: { archivedAt: null },
          },
        },
      },
    },
  });

  const totalItems = request.query.page ? await prisma.company.count({ where }) : undefined;
  return response.json({
    data: companies.map((company) =>
      toCompanyResponse(company, {
        contactCount: company._count.contacts,
      }),
    ), ...(totalItems === undefined ? {} : { pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) } }),
  });
});

router.get("/api/organizations/:organizationSlug/companies/:companyId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const company = await prisma.company.findFirst({
    where: {
      id: request.params.companyId,
      organizationId: organization.id,
      archivedAt: null,
      ...companyOwnershipScope(membership.id, membership.role),
    },
    include: {
      ownerMembership: { select: ownerSelect },
      contacts: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          organizationId: true,
          companyId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!company) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  return response.json({
    data: toCompanyResponse(company, {
      contacts: company.contacts.map((contact) => toContactResponse(contact)),
    }),
  });
});

router.get("/api/organizations/:organizationSlug/contacts/export", async (request, response) => {
  const { organization, membership } = request.auth!;
  const contacts = await prisma.contact.findMany({ where: { organizationId: organization.id, archivedAt: null, ...(isLeadershipRole(membership.role) ? {} : { company: { ownerMembershipId: membership.id } }) }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], include: { company: { select: { name: true } } } });
  const escape = (value: string | null) => `"${(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["First name,Last name,Email,Phone,Job title,Company", ...contacts.map((contact) => [contact.firstName, contact.lastName, contact.email, contact.phone, contact.jobTitle, contact.company.name].map(escape).join(","))].join("\n");
  response.attachment("contacts.csv");
  return response.type("text/csv").send(csv);
});

router.get("/api/organizations/:organizationSlug/contacts", async (request, response) => {
  const { organization, membership } = request.auth!;
  const parsedQuery = contactListQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) return response.status(400).json({ error: "Invalid contact list query" });
  const { page, pageSize, search, companyId } = parsedQuery.data;
  const where: Prisma.ContactWhereInput = { organizationId: organization.id, archivedAt: null, ...(companyId ? { companyId } : {}), ...(isLeadershipRole(membership.role) ? {} : { company: { ownerMembershipId: membership.id } }), ...(search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { jobTitle: { contains: search, mode: "insensitive" } }] } : {}) };
  const contacts = await prisma.contact.findMany({
    where,
    ...(request.query.page ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    orderBy: { createdAt: "asc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const totalItems = request.query.page ? await prisma.contact.count({ where }) : undefined;
  return response.json({
    data: contacts.map((contact) =>
      toContactResponse(contact, {
        company: contact.company,
      }),
    ), ...(totalItems === undefined ? {} : { pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) } }),
  });
});

router.get("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const contact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
      ...(isLeadershipRole(membership.role)
        ? {}
        : {
            company: {
              ownerMembershipId: membership.id,
            },
          }),
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!contact) {
    return response.status(404).json({ error: "Contact not found in this organization" });
  }

  return response.json({
    data: toContactResponse(contact, {
      company: contact.company,
    }),
  });
});

router.post("/api/organizations/:organizationSlug/companies", async (request, response) => {
  const parseResult = createCompanySchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid company payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;
  const ownerResult = await resolveCompanyOwner(organization.id, membership, parseResult.data.ownerMembershipId);

  if ("status" in ownerResult) {
    return response.status(ownerResult.status).json({ error: ownerResult.error });
  }

  try {
    const company = await prisma.company.create({
      data: {
        organizationId: organization.id,
        ownerMembershipId: ownerResult.ownerMembershipId,
        name: parseResult.data.name,
        status: toPrismaCompanyStatus(parseResult.data.status),
        website: parseResult.data.website,
        industry: parseResult.data.industry,
        phone: parseResult.data.phone,
      },
      include: {
        ownerMembership: { select: ownerSelect },
      },
    });

    await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "company.created", subjectType: "company", subjectId: company.id, metadata: { name: company.name } });

    return response.status(201).json({ data: toCompanyResponse(company) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({ error: "Company name already exists in this organization" });
    }

    throw error;
  }
});

router.patch("/api/organizations/:organizationSlug/companies/:companyId", async (request, response) => {
  const parseResult = updateCompanySchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid company payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;

  if (parseResult.data.ownerMembershipId !== undefined && !isLeadershipRole(membership.role)) {
    return response.status(403).json({ error: "Sales reps cannot reassign company ownership" });
  }

  const existingCompany = await prisma.company.findFirst({
    where: {
      id: request.params.companyId,
      organizationId: organization.id,
      archivedAt: null,
      ...companyOwnershipScope(membership.id, membership.role),
    },
  });

  if (!existingCompany) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  const ownerResult = await resolveCompanyOwner(organization.id, membership, parseResult.data.ownerMembershipId);

  if ("status" in ownerResult) {
    return response.status(ownerResult.status).json({ error: ownerResult.error });
  }

  try {
    const company = await prisma.company.update({
      where: { id: existingCompany.id },
      data: {
        ownerMembershipId: parseResult.data.ownerMembershipId === undefined
          ? undefined
          : ownerResult.ownerMembershipId,
        name: parseResult.data.name,
        status: parseResult.data.status ? toPrismaCompanyStatus(parseResult.data.status) : undefined,
        website: parseResult.data.website,
        industry: parseResult.data.industry,
        phone: parseResult.data.phone,
      },
      include: {
        ownerMembership: { select: ownerSelect },
      },
    });

    await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "company.updated", subjectType: "company", subjectId: company.id, metadata: { name: company.name } });

    return response.json({ data: toCompanyResponse(company) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({ error: "Company name already exists in this organization" });
    }

    throw error;
  }
});

router.post("/api/organizations/:organizationSlug/contacts", async (request, response) => {
  const parseResult = createContactSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid contact payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;
  const company = await prisma.company.findFirst({
    where: {
      id: parseResult.data.companyId,
      organizationId: organization.id,
      archivedAt: null,
      ...companyOwnershipScope(membership.id, membership.role),
    },
  });

  if (!company) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  const contact = await prisma.contact.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      firstName: parseResult.data.firstName,
      lastName: parseResult.data.lastName,
      email: parseResult.data.email,
      phone: parseResult.data.phone,
      jobTitle: parseResult.data.jobTitle,
      isPrimary: parseResult.data.isPrimary,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "contact.created", subjectType: "contact", subjectId: contact.id, metadata: { companyId: contact.companyId } });

  return response.status(201).json({
    data: toContactResponse(contact, { company: contact.company }),
  });
});

router.patch("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const parseResult = updateContactSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid contact payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;
  const existingContact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
      ...(isLeadershipRole(membership.role)
        ? {}
        : {
            company: {
              ownerMembershipId: membership.id,
            },
          }),
    },
  });

  if (!existingContact) {
    return response.status(404).json({ error: "Contact not found in this organization" });
  }

  if (parseResult.data.companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: parseResult.data.companyId,
        organizationId: organization.id,
        archivedAt: null,
        ...companyOwnershipScope(membership.id, membership.role),
      },
      select: { id: true },
    });

    if (!company) {
      return response.status(404).json({ error: "Company not found in this organization" });
    }
  }

  const contact = await prisma.contact.update({
    where: { id: existingContact.id },
    data: {
      companyId: parseResult.data.companyId,
      firstName: parseResult.data.firstName,
      lastName: parseResult.data.lastName,
      email: parseResult.data.email,
      phone: parseResult.data.phone,
      jobTitle: parseResult.data.jobTitle,
      isPrimary: parseResult.data.isPrimary,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "contact.updated", subjectType: "contact", subjectId: contact.id, metadata: { companyId: contact.companyId } });

  return response.json({
    data: toContactResponse(contact, { company: contact.company }),
  });
});

router.delete("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const existingContact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
      ...(isLeadershipRole(membership.role)
        ? {}
        : {
            company: {
              ownerMembershipId: membership.id,
            },
          }),
    },
    select: { id: true },
  });

  if (!existingContact) {
    return response.status(404).json({ error: "Contact not found in this organization" });
  }

  const archivedContact = await prisma.contact.update({
    where: { id: existingContact.id },
    data: { archivedAt: new Date() },
    select: {
      id: true,
      archivedAt: true,
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "contact.archived", subjectType: "contact", subjectId: archivedContact.id });

  return response.json({
    data: {
      id: archivedContact.id,
      archived: archivedContact.archivedAt !== null,
      archivedAt: archivedContact.archivedAt,
    },
  });
});

export { router as companyContactRouter };
