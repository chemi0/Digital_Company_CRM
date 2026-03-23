import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const router = Router();

const companyStatusSchema = z.enum(["lead", "active_client", "inactive"]);

const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  status: companyStatusSchema,
  website: z.url().optional(),
  industry: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
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
  {
    message: "At least one company field must be provided",
  },
);

const updateContactSchema = createContactSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one contact field must be provided",
  },
);

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

async function findOrganizationBySlug(organizationSlug: string) {
  return prisma.organization.findFirst({
    where: {
      slug: organizationSlug,
      archivedAt: null,
    },
  });
}

function toCompanyResponse(
  company: {
    id: string;
    organizationId: string;
    name: string;
    status: "LEAD" | "ACTIVE_CLIENT" | "INACTIVE";
    website: string | null;
    industry: string | null;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  extras?: Record<string, unknown>,
) {
  return {
    id: company.id,
    organizationId: company.organizationId,
    name: company.name,
    status: toApiCompanyStatus(company.status),
    website: company.website,
    industry: company.industry,
    phone: company.phone,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
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

router.get("/api/organizations/:organizationSlug/companies", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const companies = await prisma.company.findMany({
    where: {
      organizationId: organization.id,
      archivedAt: null,
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
  });

  return response.json({
    data: companies.map((company) =>
      toCompanyResponse(company, {
      contactCount: company._count.contacts,
      }),
    ),
  });
});

router.get("/api/organizations/:organizationSlug/companies/:companyId", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const company = await prisma.company.findFirst({
    where: {
      id: request.params.companyId,
      organizationId: organization.id,
      archivedAt: null,
    },
    include: {
      contacts: {
        where: {
          archivedAt: null,
        },
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

router.get("/api/organizations/:organizationSlug/contacts", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: organization.id,
      archivedAt: null,
    },
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

  return response.json({
    data: contacts.map((contact) =>
      toContactResponse(contact, {
      company: contact.company,
      }),
    ),
  });
});

router.get("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const contact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
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
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const parseResult = createCompanySchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid company payload",
      details: parseResult.error.flatten(),
    });
  }

  try {
    const company = await prisma.company.create({
      data: {
        organizationId: organization.id,
        name: parseResult.data.name,
        status: toPrismaCompanyStatus(parseResult.data.status),
        website: parseResult.data.website,
        industry: parseResult.data.industry,
        phone: parseResult.data.phone,
      },
    });

    return response.status(201).json({
      data: toCompanyResponse(company),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({ error: "Company name already exists in this organization" });
    }

    throw error;
  }
});

router.patch("/api/organizations/:organizationSlug/companies/:companyId", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const parseResult = updateCompanySchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid company payload",
      details: parseResult.error.flatten(),
    });
  }

  const existingCompany = await prisma.company.findFirst({
    where: {
      id: request.params.companyId,
      organizationId: organization.id,
      archivedAt: null,
    },
  });

  if (!existingCompany) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  try {
    const company = await prisma.company.update({
      where: {
        id: existingCompany.id,
      },
      data: {
        name: parseResult.data.name,
        status: parseResult.data.status
          ? toPrismaCompanyStatus(parseResult.data.status)
          : undefined,
        website: parseResult.data.website,
        industry: parseResult.data.industry,
        phone: parseResult.data.phone,
      },
    });

    return response.json({
      data: toCompanyResponse(company),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({ error: "Company name already exists in this organization" });
    }

    throw error;
  }
});

router.post("/api/organizations/:organizationSlug/contacts", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const parseResult = createContactSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid contact payload",
      details: parseResult.error.flatten(),
    });
  }

  const company = await prisma.company.findFirst({
    where: {
      id: parseResult.data.companyId,
      organizationId: organization.id,
      archivedAt: null,
    },
  });

  if (!company) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  const contact = await prisma.contact.create({
    data: {
      organizationId: organization.id,
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

  return response.status(201).json({
    data: toContactResponse(contact, {
      company: contact.company,
    }),
  });
});

router.patch("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const parseResult = updateContactSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid contact payload",
      details: parseResult.error.flatten(),
    });
  }

  const existingContact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
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
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      return response.status(404).json({ error: "Company not found in this organization" });
    }
  }

  const contact = await prisma.contact.update({
    where: {
      id: existingContact.id,
    },
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

  return response.json({
    data: toContactResponse(contact, {
      company: contact.company,
    }),
  });
});

router.delete("/api/organizations/:organizationSlug/contacts/:contactId", async (request, response) => {
  const organization = await findOrganizationBySlug(request.params.organizationSlug);

  if (!organization) {
    return response.status(404).json({ error: "Organization not found" });
  }

  const existingContact = await prisma.contact.findFirst({
    where: {
      id: request.params.contactId,
      organizationId: organization.id,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!existingContact) {
    return response.status(404).json({ error: "Contact not found in this organization" });
  }

  const archivedContact = await prisma.contact.update({
    where: {
      id: existingContact.id,
    },
    data: {
      archivedAt: new Date(),
    },
    select: {
      id: true,
      archivedAt: true,
    },
  });

  return response.json({
    data: {
      id: archivedContact.id,
      archived: archivedContact.archivedAt !== null,
      archivedAt: archivedContact.archivedAt,
    },
  });
});

export { router as companyContactRouter };
