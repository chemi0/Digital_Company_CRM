import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "../lib/auth.js";
import { loadActiveAuthContextForUser } from "../lib/auth-context.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const accessToken = request.cookies[ACCESS_TOKEN_COOKIE];

  if (!accessToken) {
    return response.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(accessToken);
    const [authContext, session] = await Promise.all([
      loadActiveAuthContextForUser(payload.userId),
      prisma.authSession.findFirst({ where: { id: payload.sessionId, userId: payload.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);

    if (!session || !authContext || authContext.organization.slug !== payload.organizationSlug) {
      return response.status(401).json({ error: "Authentication required" });
    }

    request.auth = {
      sessionId: payload.sessionId,
      userId: payload.userId,
      organization: authContext.organization,
      membership: authContext.membership,
    };

    return next();
  } catch {
    return response.status(401).json({ error: "Authentication required" });
  }
}

export function requireOrganizationAccess(request: Request, response: Response, next: NextFunction) {
  if (!request.auth) {
    return response.status(401).json({ error: "Authentication required" });
  }

  if (request.params.organizationSlug !== request.auth.organization.slug) {
    return response.status(403).json({ error: "Forbidden organization access" });
  }

  return next();
}

export function requireLeadershipRole(request: Request, response: Response, next: NextFunction) {
  if (!request.auth) {
    return response.status(401).json({ error: "Authentication required" });
  }

  if (request.auth.membership.role === "sales_rep") {
    return response.status(403).json({ error: "Leadership access required" });
  }

  return next();
}
