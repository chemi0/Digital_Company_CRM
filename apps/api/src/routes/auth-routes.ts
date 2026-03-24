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

const router = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

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
