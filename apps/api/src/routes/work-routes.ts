import { Router } from "express";
import { z } from "zod";
import { toApiRole } from "../lib/auth-context.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();

router.use("/api/organizations/:organizationSlug/activities", requireAuth, requireOrganizationAccess);
router.use("/api/organizations/:organizationSlug/tasks", requireAuth, requireOrganizationAccess);

const identifierSchema = z.string().trim().min(1).max(64);
const activityTypeSchema = z.enum(["call", "email", "meeting", "note"]);
const taskPrioritySchema = z.enum(["low", "medium", "high"]);
const nullableText = (maximumLength: number) => z.string().trim().min(1).max(maximumLength).nullable().optional();

const activityInputSchema = z.object({
  companyId: identifierSchema,
  contactId: identifierSchema.nullable().optional(),
  dealId: identifierSchema.nullable().optional(),
  type: activityTypeSchema,
  subject: z.string().trim().min(1).max(160),
  body: nullableText(4_000),
  occurredAt: z.iso.datetime().optional(),
});

const taskInputSchema = z.object({
  companyId: identifierSchema,
  contactId: identifierSchema.nullable().optional(),
  dealId: identifierSchema.nullable().optional(),
  assigneeMembershipId: identifierSchema.optional(),
  title: z.string().trim().min(1).max(160),
  description: nullableText(4_000),
  priority: taskPrioritySchema,
  dueAt: z.iso.date().nullable().optional(),
});

const taskUpdateSchema = taskInputSchema.partial().extend({
  completed: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one task field must be provided" });

const listQuerySchema = z.object({
  companyId: identifierSchema.optional(),
  dealId: identifierSchema.optional(),
  scope: z.enum(["mine", "all"]).optional(),
  status: z.enum(["open", "completed"]).optional(),
});

const membershipSelect = {
  id: true,
  role: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

type MembershipSummary = {
  id: string;
  role: "ADMIN" | "MANAGER" | "SALES_REP";
  user: { id: string; firstName: string; lastName: string; email: string };
};

type CurrentMembership = { id: string; role: "admin" | "manager" | "sales_rep" };

function isLeadership(role: CurrentMembership["role"]) {
  return role !== "sales_rep";
}

function ownedCompanyScope(membership: CurrentMembership) {
  return isLeadership(membership.role) ? {} : { ownerMembershipId: membership.id };
}

function workAccessScope(membership: CurrentMembership) {
  return isLeadership(membership.role) ? {} : { company: { ownerMembershipId: membership.id } };
}

function toActivityType(value: z.infer<typeof activityTypeSchema>) {
  return value.toUpperCase() as "CALL" | "EMAIL" | "MEETING" | "NOTE";
}

function toTaskPriority(value: z.infer<typeof taskPrioritySchema>) {
  return value.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
}

function toApiActivityType(value: "CALL" | "EMAIL" | "MEETING" | "NOTE") {
  return value.toLowerCase() as z.infer<typeof activityTypeSchema>;
}

function toApiTaskPriority(value: "LOW" | "MEDIUM" | "HIGH") {
  return value.toLowerCase() as z.infer<typeof taskPrioritySchema>;
}

function toMembershipResponse(membership: MembershipSummary) {
  return { id: membership.id, role: toApiRole(membership.role), user: membership.user };
}

function toDueDate(value: string | null | undefined) {
  return value === undefined ? undefined : value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function findAccessibleCompany(organizationId: string, companyId: string, membership: CurrentMembership) {
  return prisma.company.findFirst({
    where: { id: companyId, organizationId, archivedAt: null, ...ownedCompanyScope(membership) },
    select: { id: true, name: true },
  });
}

async function validateLinks(
  organizationId: string,
  companyId: string,
  contactId: string | null | undefined,
  dealId: string | null | undefined,
) {
  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId, companyId, archivedAt: null },
      select: { id: true },
    });
    if (!contact) return { error: "Contact must belong to the selected company" } as const;
  }

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId, companyId, archivedAt: null },
      select: { id: true },
    });
    if (!deal) return { error: "Deal must belong to the selected company" } as const;
  }

  return { contactId: contactId ?? null, dealId: dealId ?? null } as const;
}

async function findActiveMembership(organizationId: string, membershipId: string) {
  return prisma.membership.findFirst({
    where: { id: membershipId, organizationId, archivedAt: null, user: { isActive: true, archivedAt: null } },
    select: membershipSelect,
  });
}

async function resolveAssignee(
  organizationId: string,
  currentMembership: CurrentMembership,
  requestedMembershipId: string | undefined,
) {
  if (!isLeadership(currentMembership.role)) {
    if (requestedMembershipId && requestedMembershipId !== currentMembership.id) {
      return { error: "Sales reps cannot assign tasks to another member", status: 403 } as const;
    }
    return { assigneeMembershipId: currentMembership.id } as const;
  }

  const assigneeMembershipId = requestedMembershipId ?? currentMembership.id;
  const assignee = await findActiveMembership(organizationId, assigneeMembershipId);
  if (!assignee) return { error: "Task assignee must be an active organization member", status: 400 } as const;
  return { assigneeMembershipId: assignee.id } as const;
}

function toActivityResponse(activity: {
  id: string; organizationId: string; companyId: string; contactId: string | null; dealId: string | null;
  type: "CALL" | "EMAIL" | "MEETING" | "NOTE"; subject: string; body: string | null; occurredAt: Date;
  createdAt: Date; updatedAt: Date; authorMembership: MembershipSummary;
}, extras?: Record<string, unknown>) {
  return {
    id: activity.id, organizationId: activity.organizationId, companyId: activity.companyId,
    contactId: activity.contactId, dealId: activity.dealId, type: toApiActivityType(activity.type),
    subject: activity.subject, body: activity.body, occurredAt: activity.occurredAt,
    createdAt: activity.createdAt, updatedAt: activity.updatedAt, author: toMembershipResponse(activity.authorMembership), ...extras,
  };
}

function toTaskResponse(task: {
  id: string; organizationId: string; companyId: string; contactId: string | null; dealId: string | null;
  assigneeMembershipId: string; createdByMembershipId: string; title: string; description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH"; dueAt: Date | null; completedAt: Date | null; createdAt: Date; updatedAt: Date;
  assigneeMembership: MembershipSummary; createdByMembership: MembershipSummary;
}, extras?: Record<string, unknown>) {
  return {
    id: task.id, organizationId: task.organizationId, companyId: task.companyId, contactId: task.contactId,
    dealId: task.dealId, assigneeMembershipId: task.assigneeMembershipId, createdByMembershipId: task.createdByMembershipId,
    title: task.title, description: task.description, priority: toApiTaskPriority(task.priority), dueAt: task.dueAt,
    completedAt: task.completedAt, createdAt: task.createdAt, updatedAt: task.updatedAt,
    assignee: toMembershipResponse(task.assigneeMembership), createdBy: toMembershipResponse(task.createdByMembership), ...extras,
  };
}

router.get("/api/organizations/:organizationSlug/activities", async (request, response) => {
  const query = listQuerySchema.safeParse(request.query);
  if (!query.success) return response.status(400).json({ error: "Invalid activity query" });
  const { organization, membership } = request.auth!;
  const activities = await prisma.activity.findMany({
    where: {
      organizationId: organization.id, archivedAt: null, companyId: query.data.companyId, dealId: query.data.dealId,
      ...workAccessScope(membership),
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    include: {
      authorMembership: { select: membershipSelect }, company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } },
    },
  });
  return response.json({ data: activities.map((activity) => toActivityResponse(activity, { company: activity.company, contact: activity.contact, deal: activity.deal })) });
});

router.post("/api/organizations/:organizationSlug/activities", async (request, response) => {
  const parsed = activityInputSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid activity payload", details: parsed.error.flatten() });
  const { organization, membership } = request.auth!;
  const company = await findAccessibleCompany(organization.id, parsed.data.companyId, membership);
  if (!company) return response.status(404).json({ error: "Company not found in this organization" });
  const links = await validateLinks(organization.id, company.id, parsed.data.contactId, parsed.data.dealId);
  if ("error" in links) return response.status(400).json(links);
  const activity = await prisma.activity.create({
    data: { organizationId: organization.id, companyId: company.id, contactId: links.contactId, dealId: links.dealId,
      authorMembershipId: membership.id, type: toActivityType(parsed.data.type), subject: parsed.data.subject,
      body: parsed.data.body ?? null, occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined },
    include: { authorMembership: { select: membershipSelect }, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } },
  });
  return response.status(201).json({ data: toActivityResponse(activity, { company: activity.company, contact: activity.contact, deal: activity.deal }) });
});

router.get("/api/organizations/:organizationSlug/tasks", async (request, response) => {
  const query = listQuerySchema.safeParse(request.query);
  if (!query.success) return response.status(400).json({ error: "Invalid task query" });
  const { organization, membership } = request.auth!;
  const scope = isLeadership(membership.role) && query.data.scope === "all" ? {} : { assigneeMembershipId: membership.id };
  const status = query.data.status === "completed" ? { completedAt: { not: null } } : { completedAt: null };
  const tasks = await prisma.task.findMany({
    where: { organizationId: organization.id, archivedAt: null, companyId: query.data.companyId, dealId: query.data.dealId, ...status, ...scope, ...workAccessScope(membership) },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { assigneeMembership: { select: membershipSelect }, createdByMembership: { select: membershipSelect }, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } },
  });
  return response.json({ data: tasks.map((task) => toTaskResponse(task, { company: task.company, contact: task.contact, deal: task.deal })) });
});

router.post("/api/organizations/:organizationSlug/tasks", async (request, response) => {
  const parsed = taskInputSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid task payload", details: parsed.error.flatten() });
  const { organization, membership } = request.auth!;
  const company = await findAccessibleCompany(organization.id, parsed.data.companyId, membership);
  if (!company) return response.status(404).json({ error: "Company not found in this organization" });
  const links = await validateLinks(organization.id, company.id, parsed.data.contactId, parsed.data.dealId);
  if ("error" in links) return response.status(400).json(links);
  const assignee = await resolveAssignee(organization.id, membership, parsed.data.assigneeMembershipId);
  if ("error" in assignee) return response.status(assignee.status as 400 | 403).json({ error: assignee.error });
  const task = await prisma.task.create({
    data: { organizationId: organization.id, companyId: company.id, contactId: links.contactId, dealId: links.dealId,
      assigneeMembershipId: assignee.assigneeMembershipId, createdByMembershipId: membership.id, title: parsed.data.title,
      description: parsed.data.description ?? null, priority: toTaskPriority(parsed.data.priority), dueAt: toDueDate(parsed.data.dueAt) },
    include: { assigneeMembership: { select: membershipSelect }, createdByMembership: { select: membershipSelect }, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } },
  });
  return response.status(201).json({ data: toTaskResponse(task, { company: task.company, contact: task.contact, deal: task.deal }) });
});

router.patch("/api/organizations/:organizationSlug/tasks/:taskId", async (request, response) => {
  const parsed = taskUpdateSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid task payload", details: parsed.error.flatten() });
  const { organization, membership } = request.auth!;
  if (parsed.data.assigneeMembershipId !== undefined && !isLeadership(membership.role)) return response.status(403).json({ error: "Sales reps cannot reassign tasks" });
  const existing = await prisma.task.findFirst({ where: { id: request.params.taskId, organizationId: organization.id, archivedAt: null, ...workAccessScope(membership) }, include: { company: { select: { id: true } } } });
  if (!existing) return response.status(404).json({ error: "Task not found in this organization" });
  const nextCompanyId = parsed.data.companyId ?? existing.companyId;
  const company = parsed.data.companyId ? await findAccessibleCompany(organization.id, nextCompanyId, membership) : existing.company;
  if (!company) return response.status(404).json({ error: "Company not found in this organization" });
  const links = parsed.data.contactId !== undefined || parsed.data.dealId !== undefined || parsed.data.companyId !== undefined
    ? await validateLinks(organization.id, nextCompanyId, parsed.data.contactId ?? existing.contactId, parsed.data.dealId ?? existing.dealId)
    : { contactId: undefined, dealId: undefined };
  if ("error" in links) return response.status(400).json(links);
  const assignee = parsed.data.assigneeMembershipId === undefined ? { assigneeMembershipId: existing.assigneeMembershipId } : await resolveAssignee(organization.id, membership, parsed.data.assigneeMembershipId);
  if ("error" in assignee) return response.status(assignee.status as 400 | 403).json({ error: assignee.error });
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { companyId: parsed.data.companyId, contactId: links.contactId, dealId: links.dealId, assigneeMembershipId: assignee.assigneeMembershipId,
      title: parsed.data.title, description: parsed.data.description, priority: parsed.data.priority ? toTaskPriority(parsed.data.priority) : undefined,
      dueAt: toDueDate(parsed.data.dueAt), completedAt: parsed.data.completed === undefined ? undefined : parsed.data.completed ? new Date() : null },
    include: { assigneeMembership: { select: membershipSelect }, createdByMembership: { select: membershipSelect }, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } },
  });
  return response.json({ data: toTaskResponse(task, { company: task.company, contact: task.contact, deal: task.deal }) });
});

router.delete("/api/organizations/:organizationSlug/tasks/:taskId", async (request, response) => {
  const { organization, membership } = request.auth!;
  const existing = await prisma.task.findFirst({ where: { id: request.params.taskId, organizationId: organization.id, archivedAt: null, ...workAccessScope(membership) }, select: { id: true } });
  if (!existing) return response.status(404).json({ error: "Task not found in this organization" });
  const task = await prisma.task.update({ where: { id: existing.id }, data: { archivedAt: new Date() }, select: { id: true, archivedAt: true } });
  return response.json({ data: { id: task.id, archived: task.archivedAt !== null, archivedAt: task.archivedAt } });
});

export { router as workRouter };
