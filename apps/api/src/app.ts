import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./routes/auth-routes.js";
import { companyContactRouter } from "./routes/company-contact-routes.js";
import { dealRouter } from "./routes/deal-routes.js";
import { workRouter } from "./routes/work-routes.js";
import { teamRouter } from "./routes/team-routes.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { requireTrustedOrigin, sensitiveAuthLimiter } from "./middleware/security.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use(requireTrustedOrigin);
  app.use("/api/auth/login", sensitiveAuthLimiter);
  app.use("/api/auth/forgot-password", sensitiveAuthLimiter);
  app.use("/api/auth/reset-password", sensitiveAuthLimiter);
  app.use(authRouter);
  app.use(companyContactRouter);
  app.use(dealRouter);
  app.use(workRouter);
  app.use(teamRouter);

  app.get("/api/health", async (_request, response) => {
    const [organizations, users, companies, contacts, deals, activities, tasks] = await prisma.$transaction([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.company.count(),
      prisma.contact.count(),
      prisma.deal.count(),
      prisma.activity.count(),
      prisma.task.count(),
    ]);

    response.json({
      ok: true,
      service: "agency-crm-api",
      timestamp: new Date().toISOString(),
      database: "connected",
      counts: {
        organizations,
        users,
        companies,
        contacts,
        deals,
        activities,
        tasks,
      },
    });
  });

  return app;
}
