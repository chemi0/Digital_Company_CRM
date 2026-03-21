import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const port = env.PORT;

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  const [organizations, users, companies, contacts] = await prisma.$transaction([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.company.count(),
    prisma.contact.count(),
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
    },
  });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
