import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();
const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

router.use("/api/organizations/:organizationSlug/search", requireAuth, requireOrganizationAccess);

router.get("/api/organizations/:organizationSlug/search", async (request, response) => {
  const parsedQuery = searchQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({ error: "Search queries must contain between 2 and 100 characters" });
  }

  const { organization, membership } = request.auth!;
  const isLeadership = membership.role !== "sales_rep";
  const companyScope = isLeadership ? {} : { ownerMembershipId: membership.id };
  const contactScope = isLeadership ? {} : { company: { ownerMembershipId: membership.id } };
  const dealScope = isLeadership ? {} : { ownerMembershipId: membership.id };
  const query = parsedQuery.data.q;

  const [companies, contacts, deals] = await Promise.all([
    prisma.company.findMany({
      where: {
        organizationId: organization.id,
        archivedAt: null,
        ...companyScope,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { website: { contains: query, mode: "insensitive" } },
          { industry: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
    prisma.contact.findMany({
      where: {
        organizationId: organization.id,
        archivedAt: null,
        ...contactScope,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, company: { select: { id: true, name: true } } },
    }),
    prisma.deal.findMany({
      where: {
        organizationId: organization.id,
        archivedAt: null,
        ...dealScope,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { source: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, stage: true, company: { select: { id: true, name: true } } },
    }),
  ]);

  return response.json({
    data: {
      companies: companies.map((company) => ({ ...company, status: company.status.toLowerCase() })),
      contacts,
      deals: deals.map((deal) => ({ ...deal, stage: deal.stage.toLowerCase() })),
    },
  });
});

export { router as searchRouter };
