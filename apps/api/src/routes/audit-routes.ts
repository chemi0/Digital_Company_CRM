import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });
const pageSize = 10;

router.use("/api/organizations/:organizationSlug/audit-log", requireAuth, requireOrganizationAccess);

router.get("/api/organizations/:organizationSlug/audit-log", async (request, response) => {
  const { organization, membership } = request.auth!;
  const query = paginationSchema.safeParse(request.query);

  if (!query.success) {
    return response.status(400).json({ error: "Invalid audit-log page" });
  }

  if (membership.role !== "admin") {
    return response.status(403).json({ error: "Admin access required" });
  }

  const [totalItems, events] = await Promise.all([
    prisma.auditEvent.count({ where: { organizationId: organization.id } }),
    prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      skip: (query.data.page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return response.json({
    data: events.map((event) => ({
      id: event.id,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      metadata: event.metadata,
      createdAt: event.createdAt,
      actor: event.actor,
    })),
    pagination: {
      page: query.data.page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
  });
});

export { router as auditRouter };
