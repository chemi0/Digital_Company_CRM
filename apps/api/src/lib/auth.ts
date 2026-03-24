import crypto from "node:crypto";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export const ACCESS_TOKEN_COOKIE = "agency_crm_access_token";
export const REFRESH_TOKEN_COOKIE = "agency_crm_refresh_token";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type AccessTokenPayload = {
  sessionId: string;
  userId: string;
  organizationSlug: string;
  role: "admin" | "manager" | "sales_rep";
};

type RefreshTokenPayload = {
  sessionId: string;
  userId: string;
};

function getCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    subject: payload.userId,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    subject: payload.userId,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload &
    jwt.JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload &
    jwt.JwtPayload;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    getCookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    getCookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000),
  );
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_TOKEN_COOKIE, getCookieOptions(0));
  response.clearCookie(REFRESH_TOKEN_COOKIE, getCookieOptions(0));
}

export function getRefreshSessionExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
