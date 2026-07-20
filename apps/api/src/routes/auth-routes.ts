import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  getRefreshSessionExpiry,
  hashToken,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/auth.js";
import { loadActiveAuthContextForUser } from "../lib/auth-context.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { hashInvitationToken } from "../lib/invitation-email.js";

const router = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(32),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(12).max(128).optional(),
});

const invitationPreviewSchema = z.object({ token: z.string().min(32) });

async function buildSessionResponse(userId: string, sessionId: string) {
  const authContext = await loadActiveAuthContextForUser(userId);

  if (!authContext) {
    return null;
  }

  return {
    ...authContext.user,
    sessionId,
    organization: authContext.organization,
    membership: authContext.membership,
  };
}

async function createSessionForUser(userId: string, organizationSlug: string, role: "admin" | "manager" | "sales_rep", userAgent: string | undefined) {
  const authSession = await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(`${userId}-${Date.now()}-${Math.random()}`),
      expiresAt: getRefreshSessionExpiry(),
      userAgent,
    },
  });

  const accessToken = signAccessToken({
    sessionId: authSession.id,
    userId,
    organizationSlug,
    role,
  });
  const refreshToken = signRefreshToken({
    sessionId: authSession.id,
    userId,
  });

  await prisma.authSession.update({
    where: { id: authSession.id },
    data: {
      tokenHash: hashToken(refreshToken),
    },
  });

  return { accessToken, refreshToken, sessionId: authSession.id };
}

router.post("/api/auth/login", async (request, response) => {
  const parseResult = loginSchema.safeParse(request.body);

  if (!parseResult.success) {
    return response.status(400).json({
      error: "Invalid login payload",
      details: parseResult.error.flatten(),
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: parseResult.data.email,
      isActive: true,
      archivedAt: null,
    },
  });

  if (!user) {
    return response.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(parseResult.data.password, user.passwordHash);

  if (!passwordMatches) {
    return response.status(401).json({ error: "Invalid email or password" });
  }

  const authContext = await loadActiveAuthContextForUser(user.id);

  if (!authContext) {
    return response.status(401).json({ error: "No active organization membership" });
  }

  const { accessToken, refreshToken, sessionId } = await createSessionForUser(
    user.id,
    authContext.organization.slug,
    authContext.membership.role,
    request.get("user-agent"),
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  setAuthCookies(response, accessToken, refreshToken);

  return response.json({
    data: {
      ...authContext.user,
      sessionId,
      organization: authContext.organization,
      membership: authContext.membership,
    },
  });
});

router.get("/api/auth/invitation-preview", async (request, response) => {
  const parsed = invitationPreviewSchema.safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ error: "Invalid invitation link" });
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hashInvitationToken(parsed.data.token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { organization: { select: { name: true } } },
  });
  if (!invitation) return response.status(400).json({ error: "This invitation is invalid, expired, or already used" });

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  if (!existingUser) return response.json({ data: { mode: "new_account", organizationName: invitation.organization.name } });
  const inactiveMembership = await prisma.membership.findFirst({ where: { organizationId: invitation.organizationId, userId: existingUser.id, archivedAt: { not: null } }, select: { id: true } });
  if (!inactiveMembership) return response.status(400).json({ error: "This invitation cannot be used for an active account" });
  return response.json({ data: { mode: "reactivation", organizationName: invitation.organization.name } });
});

router.post("/api/auth/accept-invitation", async (request, response) => {
  const parsed = acceptInvitationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid invitation acceptance payload", details: parsed.error.flatten() });
  const invitation = await prisma.invitation.findFirst({ where: { tokenHash: hashInvitationToken(parsed.data.token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (!invitation) return response.status(400).json({ error: "This invitation is invalid, expired, or already used" });
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) {
    const inactiveMembership = await prisma.membership.findFirst({ where: { organizationId: invitation.organizationId, userId: existingUser.id, archivedAt: { not: null } }, select: { id: true, role: true } });
    if (!inactiveMembership) return response.status(409).json({ error: "This email already belongs to an active account" });
    try {
      const membership = await prisma.$transaction(async (transaction) => {
        const restoredMembership = await transaction.membership.update({ where: { id: inactiveMembership.id }, data: { archivedAt: null }, select: { id: true, role: true } });
        const accepted = await transaction.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
        if (accepted.count !== 1) throw new Error("Invitation was already accepted");
        return restoredMembership;
      });
      return response.json({ data: { membership: { id: membership.id, role: membership.role.toLowerCase(), reactivated: true } } });
    } catch {
      return response.status(400).json({ error: "This reactivation invitation could not be accepted" });
    }
  }
  if (!parsed.data.firstName || !parsed.data.lastName || !parsed.data.password) return response.status(400).json({ error: "First name, last name, and password are required for a new account" });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const membership = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({ data: { email: invitation.email, passwordHash, firstName: parsed.data.firstName!, lastName: parsed.data.lastName! } });
      const createdMembership = await transaction.membership.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role }, select: { id: true, role: true } });
      const accepted = await transaction.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
      if (accepted.count !== 1) throw new Error("Invitation was already accepted");
      return createdMembership;
    });
    return response.status(201).json({ data: { membership: { id: membership.id, role: membership.role.toLowerCase() } } });
  } catch {
    return response.status(400).json({ error: "This invitation could not be accepted" });
  }
});

router.get("/api/auth/me", requireAuth, async (request, response) => {
  const session = await buildSessionResponse(request.auth!.userId, request.auth!.sessionId);

  if (!session) {
    return response.status(401).json({ error: "Authentication required" });
  }

  return response.json({ data: session });
});

router.post("/api/auth/refresh", async (request, response) => {
  const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

  if (!refreshToken) {
    return response.status(401).json({ error: "Refresh token required" });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      clearAuthCookies(response);
      return response.status(401).json({ error: "Refresh token required" });
    }

    const authContext = await loadActiveAuthContextForUser(payload.userId);

    if (!authContext) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
        },
      });
      clearAuthCookies(response);
      return response.status(401).json({ error: "Refresh token required" });
    }

    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    const nextSession = await createSessionForUser(
      payload.userId,
      authContext.organization.slug,
      authContext.membership.role,
      request.get("user-agent"),
    );

    setAuthCookies(response, nextSession.accessToken, nextSession.refreshToken);

    return response.json({
      data: {
        ...authContext.user,
        sessionId: nextSession.sessionId,
        organization: authContext.organization,
        membership: authContext.membership,
      },
    });
  } catch {
    clearAuthCookies(response);
    return response.status(401).json({ error: "Refresh token required" });
  }
});

router.post("/api/auth/logout", async (request, response) => {
  const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.authSession.updateMany({
        where: {
          id: payload.sessionId,
          userId: payload.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    } catch {
      // Ignore invalid refresh tokens during logout and still clear cookies.
    }
  }

  clearAuthCookies(response);

  return response.json({
    data: {
      loggedOut: true,
    },
  });
});

export { router as authRouter };
