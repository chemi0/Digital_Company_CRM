import { Router } from "express";
import { z } from "zod";
import { toApiRole } from "../lib/auth-context.js";
import { createInvitationToken, hashInvitationToken, sendInvitationEmail } from "../lib/invitation-email.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOrganizationAccess } from "../middleware/auth.js";

const router = Router();
router.use("/api/organizations/:organizationSlug", requireAuth, requireOrganizationAccess);

const roleSchema = z.enum(["admin", "manager", "sales_rep"]);
const inviteSchema = z.object({ email: z.email(), role: roleSchema });
const roleUpdateSchema = z.object({ role: roleSchema });
const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  archivedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true } },
} as const;

function isAdmin(role: "admin" | "manager" | "sales_rep") {
  return role === "admin";
}

function isLeadership(role: "admin" | "manager" | "sales_rep") {
  return role !== "sales_rep";
}

function toPrismaRole(role: z.infer<typeof roleSchema>) {
  return role.toUpperCase() as "ADMIN" | "MANAGER" | "SALES_REP";
}

function requiresReactivationInvitation(archivedAt: Date | null) {
  return archivedAt !== null && archivedAt.getTime() <= Date.now() - (env.MEMBER_REACTIVATION_WINDOW_MINUTES * 60_000);
}

function toMemberResponse(member: { id: string; role: "ADMIN" | "MANAGER" | "SALES_REP"; createdAt: Date; archivedAt: Date | null; user: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; lastLoginAt: Date | null } }) {
  return { id: member.id, role: toApiRole(member.role), createdAt: member.createdAt, archivedAt: member.archivedAt, requiresReactivationInvitation: requiresReactivationInvitation(member.archivedAt), user: member.user };
}

function toInviteResponse(invitation: { id: string; email: string; role: "ADMIN" | "MANAGER" | "SALES_REP"; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null; createdAt: Date; invitedByUser: { firstName: string; lastName: string } }) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: toApiRole(invitation.role),
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    status: invitation.acceptedAt ? "accepted" : invitation.revokedAt ? "revoked" : invitation.expiresAt <= new Date() ? "expired" : "pending",
    invitedBy: `${invitation.invitedByUser.firstName} ${invitation.invitedByUser.lastName}`,
  };
}

router.get("/api/organizations/:organizationSlug/team", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isLeadership(membership.role)) return response.status(403).json({ error: "Leadership access required" });
  const members = await prisma.membership.findMany({ where: { organizationId: organization.id, archivedAt: null, user: { isActive: true, archivedAt: null } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: memberSelect });
  return response.json({ data: members.map(toMemberResponse) });
});

router.get("/api/organizations/:organizationSlug/team/inactive", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isAdmin(membership.role)) return response.status(403).json({ error: "Admin access required" });
  const members = await prisma.membership.findMany({ where: { organizationId: organization.id, archivedAt: { not: null }, user: { isActive: true, archivedAt: null } }, orderBy: { archivedAt: "desc" }, select: memberSelect });
  return response.json({ data: members.map(toMemberResponse) });
});

router.get("/api/organizations/:organizationSlug/invitations", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isLeadership(membership.role)) return response.status(403).json({ error: "Leadership access required" });
  const invitations = await prisma.invitation.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, include: { invitedByUser: { select: { firstName: true, lastName: true } } } });
  return response.json({ data: invitations.map(toInviteResponse) });
});

router.post("/api/organizations/:organizationSlug/invitations", async (request, response) => {
  const parsed = inviteSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid invitation payload", details: parsed.error.flatten() });
  const { organization, membership } = request.auth!;
  if (!isLeadership(membership.role)) return response.status(403).json({ error: "Leadership access required" });
  if (!isAdmin(membership.role) && parsed.data.role !== "sales_rep") return response.status(403).json({ error: "Managers may only invite sales reps" });

  const email = parsed.data.email.toLowerCase();
  const [existingUser, inviter] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { firstName: true, lastName: true } }),
  ]);
  if (existingUser) return response.status(409).json({ error: "This email already belongs to a registered user" });
  if (!inviter) return response.status(401).json({ error: "Authentication required" });
  const token = createInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async (transaction) => {
    await transaction.invitation.updateMany({ where: { organizationId: organization.id, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return transaction.invitation.create({ data: { organizationId: organization.id, email, role: toPrismaRole(parsed.data.role), tokenHash: hashInvitationToken(token), invitedByUserId: request.auth!.userId, expiresAt }, include: { invitedByUser: { select: { firstName: true, lastName: true } } } });
  });
  const invitationUrl = `${env.CLIENT_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
  try {
    await sendInvitationEmail({ recipient: email, organizationName: organization.name, inviterName: `${inviter.firstName} ${inviter.lastName}`, roleLabel: parsed.data.role.replace("_", " "), invitationUrl });
  } catch {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    return response.status(502).json({ error: "Invitation email could not be sent" });
  }
  return response.status(201).json({ data: toInviteResponse(invitation) });
});

router.delete("/api/organizations/:organizationSlug/invitations/:invitationId", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isLeadership(membership.role)) return response.status(403).json({ error: "Leadership access required" });
  const invitation = await prisma.invitation.findFirst({ where: { id: request.params.invitationId, organizationId: organization.id, acceptedAt: null, revokedAt: null } });
  if (!invitation) return response.status(404).json({ error: "Pending invitation not found" });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  return response.json({ data: { id: invitation.id, revoked: true } });
});

router.patch("/api/organizations/:organizationSlug/team/:membershipId", async (request, response) => {
  const parsed = roleUpdateSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid role payload" });
  const { organization, membership } = request.auth!;
  if (!isAdmin(membership.role)) return response.status(403).json({ error: "Admin access required" });
  if (request.params.membershipId === membership.id) return response.status(409).json({ error: "You cannot change your own role" });
  const target = await prisma.membership.findFirst({ where: { id: request.params.membershipId, organizationId: organization.id, archivedAt: null }, select: memberSelect });
  if (!target) return response.status(404).json({ error: "Team member not found" });
  const updated = await prisma.membership.update({ where: { id: target.id }, data: { role: toPrismaRole(parsed.data.role) }, select: memberSelect });
  return response.json({ data: toMemberResponse(updated) });
});

router.delete("/api/organizations/:organizationSlug/team/:membershipId", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isAdmin(membership.role)) return response.status(403).json({ error: "Admin access required" });
  if (request.params.membershipId === membership.id) return response.status(409).json({ error: "You cannot deactivate yourself" });
  const target = await prisma.membership.findFirst({ where: { id: request.params.membershipId, organizationId: organization.id, archivedAt: null }, select: { id: true, userId: true, role: true } });
  if (!target) return response.status(404).json({ error: "Team member not found" });
  if (target.role === "ADMIN") {
    const adminCount = await prisma.membership.count({ where: { organizationId: organization.id, role: "ADMIN", archivedAt: null } });
    if (adminCount <= 1) return response.status(409).json({ error: "At least one active admin is required" });
  }
  await prisma.$transaction([
    prisma.membership.update({ where: { id: target.id }, data: { archivedAt: new Date() } }),
    prisma.authSession.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } }),
  ]);
  return response.json({ data: { id: target.id, deactivated: true } });
});

router.patch("/api/organizations/:organizationSlug/team/:membershipId/reactivate", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isAdmin(membership.role)) return response.status(403).json({ error: "Admin access required" });
  const target = await prisma.membership.findFirst({ where: { id: request.params.membershipId, organizationId: organization.id, archivedAt: { not: null } }, select: memberSelect });
  if (!target) return response.status(404).json({ error: "Inactive member not found" });
  if (requiresReactivationInvitation(target.archivedAt)) return response.status(409).json({ error: "This member must confirm reactivation through an email invitation" });

  await prisma.membership.update({ where: { id: target.id }, data: { archivedAt: null } });
  return response.json({ data: { id: target.id, reactivated: true } });
});

router.post("/api/organizations/:organizationSlug/team/:membershipId/reactivation-invitation", async (request, response) => {
  const { organization, membership } = request.auth!;
  if (!isAdmin(membership.role)) return response.status(403).json({ error: "Admin access required" });
  const [target, inviter] = await Promise.all([
    prisma.membership.findFirst({ where: { id: request.params.membershipId, organizationId: organization.id, archivedAt: { not: null } }, select: memberSelect }),
    prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { firstName: true, lastName: true } }),
  ]);
  if (!target) return response.status(404).json({ error: "Inactive member not found" });
  if (!inviter) return response.status(401).json({ error: "Authentication required" });
  if (!requiresReactivationInvitation(target.archivedAt)) return response.status(409).json({ error: "This member can be reactivated directly" });

  const token = createInvitationToken();
  const invitation = await prisma.$transaction(async (transaction) => {
    await transaction.invitation.updateMany({ where: { organizationId: organization.id, email: target.user.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return transaction.invitation.create({ data: { organizationId: organization.id, email: target.user.email, role: target.role, tokenHash: hashInvitationToken(token), invitedByUserId: request.auth!.userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000) }, include: { invitedByUser: { select: { firstName: true, lastName: true } } } });
  });

  try {
    await sendInvitationEmail({ recipient: target.user.email, organizationName: organization.name, inviterName: `${inviter.firstName} ${inviter.lastName}`, roleLabel: toApiRole(target.role).replace("_", " "), invitationUrl: `${env.CLIENT_URL}/accept-invitation?token=${encodeURIComponent(token)}`, kind: "reactivation" });
  } catch {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    return response.status(502).json({ error: "Reactivation email could not be sent" });
  }

  return response.status(201).json({ data: toInviteResponse(invitation) });
});

export { router as teamRouter };
