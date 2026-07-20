import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../lib/env.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireTrustedOrigin(request: Request, response: Response, next: NextFunction) {
  const origin = request.get("origin");
  if (unsafeMethods.has(request.method) && origin && origin !== env.CLIENT_URL) {
    return response.status(403).json({ error: "Untrusted request origin" });
  }
  return next();
}

export const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  handler: (_request, response) => response.status(429).json({ error: "Too many attempts. Please try again later." }),
});
