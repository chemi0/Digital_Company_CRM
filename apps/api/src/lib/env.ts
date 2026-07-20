import "./load-env.js";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend"]).default("console"),
  EMAIL_FROM: z.string().trim().min(3).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  MEMBER_REACTIVATION_WINDOW_MINUTES: z.coerce.number().int().positive().default(525_600),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER === "console") {
    context.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "Console email delivery cannot be used in production" });
  }

  if (value.EMAIL_PROVIDER === "smtp") {
    for (const key of ["EMAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required for SMTP email delivery` });
    }
  }

  if (value.EMAIL_PROVIDER === "resend") {
    for (const key of ["EMAIL_FROM", "RESEND_API_KEY"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required for Resend email delivery` });
    }
  }
});

export const env = envSchema.parse(process.env);
