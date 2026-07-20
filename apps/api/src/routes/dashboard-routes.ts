import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();
router.use("/api/organizations/:organizationSlug/dashboard", requireAuth, requireOrganizationAccess);

const openDealStages = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"] as const;

function startOfToday() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function endOfUpcomingWindow() {
  const date = startOfToday();
  date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

router.get("/api/organizations/:organizationSlug/dashboard", async (request, response) => {
  const { organization, membership } = request.auth!;
  const isLeadership = membership.role !== "sales_rep";
  const companyScope = isLeadership ? {} : { ownerMembershipId: membership.id };
  const dealScope = isLeadership ? {} : { ownerMembershipId: membership.id };
  const taskScope = isLeadership
    ? {}
    : { assigneeMembershipId: membership.id, company: { ownerMembershipId: membership.id } };
  const activityScope = isLeadership ? {} : { company: { ownerMembershipId: membership.id } };
  const today = startOfToday();
  const upcomingEnd = endOfUpcomingWindow();
  const activeCompanyWhere = { organizationId: organization.id, archivedAt: null, ...companyScope };
  const activeDealWhere = { organizationId: organization.id, archivedAt: null, ...dealScope };
  const openTaskWhere = { organizationId: organization.id, archivedAt: null, completedAt: null, ...taskScope };

  const [activeClients, leads, pipeline, won, dealStages, overdueTasks, dueSoonTasks, upcomingTasks, recentActivities] = await Promise.all([
    prisma.company.count({ where: { ...activeCompanyWhere, status: "ACTIVE_CLIENT" } }),
    prisma.company.count({ where: { ...activeCompanyWhere, status: "LEAD" } }),
    prisma.deal.aggregate({ where: { ...activeDealWhere, stage: { in: [...openDealStages] } }, _sum: { amountCents: true } }),
    prisma.deal.aggregate({ where: { ...activeDealWhere, stage: "WON" }, _sum: { amountCents: true } }),
    prisma.deal.groupBy({ where: activeDealWhere, by: ["stage"], _count: { id: true }, _sum: { amountCents: true } }),
    prisma.task.count({ where: { ...openTaskWhere, dueAt: { lt: today } } }),
    prisma.task.count({ where: { ...openTaskWhere, dueAt: { gte: today, lte: upcomingEnd } } }),
    prisma.task.findMany({
      where: openTaskWhere,
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, priority: true, dueAt: true, company: { select: { id: true, name: true } } },
    }),
    prisma.activity.findMany({
      where: { organizationId: organization.id, archivedAt: null, ...activityScope },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, type: true, subject: true, occurredAt: true, company: { select: { id: true, name: true } } },
    }),
  ]);

  return response.json({
    data: {
      scope: isLeadership ? "organization" : "personal",
      metrics: {
        pipelineValueCents: pipeline._sum.amountCents ?? 0,
        wonValueCents: won._sum.amountCents ?? 0,
        activeClients,
        leads,
        overdueTasks,
        dueSoonTasks,
      },
      dealStages: dealStages.map((stage) => ({
        stage: stage.stage.toLowerCase(),
        count: stage._count.id,
        valueCents: stage._sum.amountCents ?? 0,
      })),
      upcomingTasks,
      recentActivities: recentActivities.map((activity) => ({
        ...activity,
        type: activity.type.toLowerCase(),
      })),
    },
  });
});

export { router as dashboardRouter };
