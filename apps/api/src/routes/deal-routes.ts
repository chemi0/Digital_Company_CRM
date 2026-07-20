import { Router } from "express";
import { z } from "zod";
import { toApiRole } from "../lib/auth-context.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditEvent } from "../lib/audit-log.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();

router.use("/api/organizations/:organizationSlug/deals", requireAuth, requireOrganizationAccess);

const dealStageSchema = z.enum(["new_lead", "contacted", "qualified", "proposal_sent", "won", "lost"]);
const identifierSchema = z.string().trim().min(1).max(64);
const nullableTrimmedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength).nullable().optional();

const createDealSchema = z.object({
  companyId: identifierSchema,
  primaryContactId: identifierSchema.nullable().optional(),
  ownerMembershipId: identifierSchema.optional(),
  title: z.string().trim().min(1).max(160),
  stage: dealStageSchema,
  amountCents: z.number().int().min(0).max(2_147_483_647),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  source: nullableTrimmedText(80),
  expectedCloseDate: z.iso.date().nullable().optional(),
  description: nullableTrimmedText(4_000),
});

const updateDealSchema = createDealSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one deal field must be provided" },
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

type DealOwnerResolution =
  | { ownerMembershipId: string }
  | { error: string; status: number };

function isLeadershipRole(role: "admin" | "manager" | "sales_rep") {
  return role !== "sales_rep";
}

function dealOwnershipScope(membershipId: string, role: "admin" | "manager" | "sales_rep") {
  return isLeadershipRole(role) ? {} : { ownerMembershipId: membershipId };
}

function companyOwnershipScope(membershipId: string, role: "admin" | "manager" | "sales_rep") {
  return isLeadershipRole(role) ? {} : { ownerMembershipId: membershipId };
}

function toPrismaDealStage(stage: z.infer<typeof dealStageSchema>) {
  switch (stage) {
    case "new_lead":
      return "NEW_LEAD";
    case "contacted":
      return "CONTACTED";
    case "qualified":
      return "QUALIFIED";
    case "proposal_sent":
      return "PROPOSAL_SENT";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
  }
}

function toApiDealStage(stage: "NEW_LEAD" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST") {
  switch (stage) {
    case "NEW_LEAD":
      return "new_lead";
    case "CONTACTED":
      return "contacted";
    case "QUALIFIED":
      return "qualified";
    case "PROPOSAL_SENT":
      return "proposal_sent";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
  }
}

function toOwnerResponse(owner: OwnerMembership) {
  return {
    id: owner.id,
    role: toApiRole(owner.role),
    user: owner.user,
  };
}

function toDealResponse(
  deal: {
    id: string;
    organizationId: string;
    companyId: string;
    primaryContactId: string | null;
    ownerMembershipId: string;
    title: string;
    stage: "NEW_LEAD" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST";
    amountCents: number;
    currency: string;
    source: string | null;
    expectedCloseDate: Date | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    ownerMembership: OwnerMembership;
  },
  extras?: Record<string, unknown>,
) {
  return {
    id: deal.id,
    organizationId: deal.organizationId,
    companyId: deal.companyId,
    primaryContactId: deal.primaryContactId,
    ownerMembershipId: deal.ownerMembershipId,
    title: deal.title,
    stage: toApiDealStage(deal.stage),
    amountCents: deal.amountCents,
    currency: deal.currency,
    source: deal.source,
    expectedCloseDate: deal.expectedCloseDate,
    description: deal.description,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    owner: toOwnerResponse(deal.ownerMembership),
    ...extras,
  };
}

function toDatabaseDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

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

async function resolveDealOwner(
  organizationId: string,
  currentMembership: { id: string; role: "admin" | "manager" | "sales_rep" },
  requestedOwnerMembershipId: string | undefined,
  defaultOwnerMembershipId: string,
): Promise<DealOwnerResolution> {
  if (!isLeadershipRole(currentMembership.role)) {
    if (requestedOwnerMembershipId && requestedOwnerMembershipId !== currentMembership.id) {
      return { error: "Sales reps cannot assign a deal to another owner", status: 403 };
    }

    return { ownerMembershipId: currentMembership.id };
  }

  const ownerMembershipId = requestedOwnerMembershipId ?? defaultOwnerMembershipId;
  const membership = await findActiveMembership(organizationId, ownerMembershipId);

  if (!membership) {
    return { error: "Deal owner must be an active member of this organization", status: 400 };
  }

  return { ownerMembershipId: membership.id };
}

async function findAccessibleCompany(
  organizationId: string,
  companyId: string,
  membership: { id: string; role: "admin" | "manager" | "sales_rep" },
) {
  return prisma.company.findFirst({
    where: {
      id: companyId,
      organizationId,
      archivedAt: null,
      ...companyOwnershipScope(membership.id, membership.role),
    },
    select: {
      id: true,
      ownerMembershipId: true,
      name: true,
    },
  });
}

async function validatePrimaryContact(
  organizationId: string,
  companyId: string,
  primaryContactId: string | null | undefined,
) {
  if (!primaryContactId) {
    return primaryContactId ?? null;
  }

  const contact = await prisma.contact.findFirst({
    where: {
      id: primaryContactId,
      organizationId,
      companyId,
      archivedAt: null,
    },
    select: { id: true },
  });

  return contact?.id ?? null;
}

router.get("/api/organizations/:organizationSlug/deals", async (request, response) => {
  const { organization, membership } = request.auth!;
  const deals = await prisma.deal.findMany({
    where: {
      organizationId: organization.id,
      archivedAt: null,
      ...dealOwnershipScope(membership.id, membership.role),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      ownerMembership: { select: ownerSelect },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      primaryContact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return response.json({
    data: deals.map((deal) =>
      toDealResponse(deal, {
        company: deal.company,
        primaryContact: deal.primaryContact,
      }),
    ),
  });
});

router.get("/api/organizations/:organizationSlug/deals/:dealId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const deal = await prisma.deal.findFirst({
    where: {
      id: request.params.dealId,
      organizationId: organization.id,
      archivedAt: null,
      ...dealOwnershipScope(membership.id, membership.role),
    },
    include: {
      ownerMembership: { select: ownerSelect },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      primaryContact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!deal) {
    return response.status(404).json({ error: "Deal not found in this organization" });
  }

  return response.json({
    data: toDealResponse(deal, {
      company: deal.company,
      primaryContact: deal.primaryContact,
    }),
  });
});

router.post("/api/organizations/:organizationSlug/deals", async (request, response) => {
  const parseResult = createDealSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid deal payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;
  const company = await findAccessibleCompany(organization.id, parseResult.data.companyId, membership);

  if (!company) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  const primaryContactId = await validatePrimaryContact(
    organization.id,
    company.id,
    parseResult.data.primaryContactId,
  );

  if (parseResult.data.primaryContactId && !primaryContactId) {
    return response.status(400).json({ error: "Primary contact must belong to the selected company" });
  }

  const ownerResult = await resolveDealOwner(
    organization.id,
    membership,
    parseResult.data.ownerMembershipId,
    company.ownerMembershipId,
  );

  if ("status" in ownerResult) {
    return response.status(ownerResult.status).json({ error: ownerResult.error });
  }

  const deal = await prisma.deal.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      primaryContactId,
      ownerMembershipId: ownerResult.ownerMembershipId,
      title: parseResult.data.title,
      stage: toPrismaDealStage(parseResult.data.stage),
      amountCents: parseResult.data.amountCents,
      currency: parseResult.data.currency,
      source: parseResult.data.source ?? null,
      expectedCloseDate: toDatabaseDate(parseResult.data.expectedCloseDate),
      description: parseResult.data.description ?? null,
    },
    include: {
      ownerMembership: { select: ownerSelect },
      company: { select: { id: true, name: true } },
      primaryContact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "deal.created", subjectType: "deal", subjectId: deal.id, metadata: { stage: deal.stage } });

  return response.status(201).json({
    data: toDealResponse(deal, {
      company: deal.company,
      primaryContact: deal.primaryContact,
    }),
  });
});

router.patch("/api/organizations/:organizationSlug/deals/:dealId", async (request, response) => {
  const parseResult = updateDealSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid deal payload",
      details: parseResult.error.flatten(),
    });
  }

  const { organization, membership } = request.auth!;

  if (parseResult.data.ownerMembershipId !== undefined && !isLeadershipRole(membership.role)) {
    return response.status(403).json({ error: "Sales reps cannot reassign deal ownership" });
  }

  const existingDeal = await prisma.deal.findFirst({
    where: {
      id: request.params.dealId,
      organizationId: organization.id,
      archivedAt: null,
      ...dealOwnershipScope(membership.id, membership.role),
    },
    include: {
      company: {
        select: {
          id: true,
          ownerMembershipId: true,
        },
      },
      primaryContact: {
        select: {
          companyId: true,
        },
      },
    },
  });

  if (!existingDeal) {
    return response.status(404).json({ error: "Deal not found in this organization" });
  }

  const nextCompanyId = parseResult.data.companyId ?? existingDeal.companyId;
  const company = parseResult.data.companyId
    ? await findAccessibleCompany(organization.id, nextCompanyId, membership)
    : existingDeal.company;

  if (!company) {
    return response.status(404).json({ error: "Company not found in this organization" });
  }

  let nextPrimaryContactId: string | null | undefined;

  if (parseResult.data.primaryContactId !== undefined) {
    nextPrimaryContactId = await validatePrimaryContact(
      organization.id,
      nextCompanyId,
      parseResult.data.primaryContactId,
    );

    if (parseResult.data.primaryContactId && !nextPrimaryContactId) {
      return response.status(400).json({ error: "Primary contact must belong to the selected company" });
    }
  } else if (parseResult.data.companyId && existingDeal.primaryContact?.companyId !== nextCompanyId) {
    nextPrimaryContactId = null;
  }

  const ownerResult = parseResult.data.ownerMembershipId === undefined
    ? { ownerMembershipId: existingDeal.ownerMembershipId }
    : await resolveDealOwner(
        organization.id,
        membership,
        parseResult.data.ownerMembershipId,
        company.ownerMembershipId,
      );

  if ("status" in ownerResult) {
    return response.status(ownerResult.status).json({ error: ownerResult.error });
  }

  const deal = await prisma.deal.update({
    where: { id: existingDeal.id },
    data: {
      companyId: parseResult.data.companyId,
      primaryContactId: nextPrimaryContactId,
      ownerMembershipId: ownerResult.ownerMembershipId,
      title: parseResult.data.title,
      stage: parseResult.data.stage ? toPrismaDealStage(parseResult.data.stage) : undefined,
      amountCents: parseResult.data.amountCents,
      currency: parseResult.data.currency,
      source: parseResult.data.source,
      expectedCloseDate: parseResult.data.expectedCloseDate === undefined
        ? undefined
        : toDatabaseDate(parseResult.data.expectedCloseDate),
      description: parseResult.data.description,
    },
    include: {
      ownerMembership: { select: ownerSelect },
      company: { select: { id: true, name: true } },
      primaryContact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "deal.updated", subjectType: "deal", subjectId: deal.id, metadata: { stage: deal.stage } });

  return response.json({
    data: toDealResponse(deal, {
      company: deal.company,
      primaryContact: deal.primaryContact,
    }),
  });
});

router.delete("/api/organizations/:organizationSlug/deals/:dealId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const existingDeal = await prisma.deal.findFirst({
    where: {
      id: request.params.dealId,
      organizationId: organization.id,
      archivedAt: null,
      ...dealOwnershipScope(membership.id, membership.role),
    },
    select: { id: true },
  });

  if (!existingDeal) {
    return response.status(404).json({ error: "Deal not found in this organization" });
  }

  const archivedDeal = await prisma.deal.update({
    where: { id: existingDeal.id },
    data: { archivedAt: new Date() },
    select: {
      id: true,
      archivedAt: true,
    },
  });

  await recordAuditEvent({ organizationId: organization.id, actorUserId: request.auth!.userId, action: "deal.archived", subjectType: "deal", subjectId: archivedDeal.id });

  return response.json({
    data: {
      id: archivedDeal.id,
      archived: archivedDeal.archivedAt !== null,
      archivedAt: archivedDeal.archivedAt,
    },
  });
});

export { router as dealRouter };
