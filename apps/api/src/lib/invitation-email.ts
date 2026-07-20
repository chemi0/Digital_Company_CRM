import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import { env } from "./env.js";

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type InvitationEmail = {
  recipient: string;
  organizationName: string;
  inviterName: string;
  roleLabel: string;
  invitationUrl: string;
  kind?: "new_account" | "reactivation";
};

export async function sendInvitationEmail(message: InvitationEmail) {
  const inviterName = escapeHtml(message.inviterName);
  const organizationName = escapeHtml(message.organizationName);
  const roleLabel = escapeHtml(message.roleLabel);
  const isReactivation = message.kind === "reactivation";
  const subject = isReactivation ? `Reactivate your ${message.organizationName} access` : `You are invited to ${message.organizationName}`;
  const text = isReactivation
    ? `${message.inviterName} asked you to reactivate your ${message.organizationName} access as ${message.roleLabel}. Confirm reactivation: ${message.invitationUrl}`
    : `${message.inviterName} invited you to join ${message.organizationName} as ${message.roleLabel}. Accept your invitation: ${message.invitationUrl}`;
  const html = isReactivation
    ? `<p>${inviterName} asked you to reactivate your <strong>${organizationName}</strong> access as ${roleLabel}.</p><p><a href="${message.invitationUrl}">Reactivate access</a></p><p>This link expires in 7 days.</p>`
    : `<p>${inviterName} invited you to join <strong>${organizationName}</strong> as ${roleLabel}.</p><p><a href="${message.invitationUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`;

  if (env.EMAIL_PROVIDER === "console") {
    console.info(`[Invitation email] To: ${message.recipient}\n${text}`);
    return;
  }

  if (env.EMAIL_PROVIDER === "smtp") {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT!,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    });
    await transport.sendMail({ from: env.EMAIL_FROM!, to: message.recipient, subject, text, html });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY!}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM!, to: [message.recipient], subject, text, html }),
  });
  if (!response.ok) throw new Error("Resend did not accept the invitation email");
}

type PasswordResetEmail = {
  recipient: string;
  firstName: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(message: PasswordResetEmail) {
  const firstName = escapeHtml(message.firstName);
  const subject = "Reset your Agency CRM password";
  const text = `Hello ${message.firstName}, reset your Agency CRM password: ${message.resetUrl}`;
  const html = `<p>Hello ${firstName},</p><p>Use this link to reset your Agency CRM password:</p><p><a href="${message.resetUrl}">Reset password</a></p><p>This link expires in 1 hour.</p>`;

  if (env.EMAIL_PROVIDER === "console") {
    console.info(`[Password reset email] To: ${message.recipient}\n${text}`);
    return;
  }

  if (env.EMAIL_PROVIDER === "smtp") {
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST!, port: env.SMTP_PORT!, secure: env.SMTP_SECURE === "true", auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! } });
    await transport.sendMail({ from: env.EMAIL_FROM!, to: message.recipient, subject, text, html });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY!}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM!, to: [message.recipient], subject, text, html }) });
  if (!response.ok) throw new Error("Resend did not accept the password reset email");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}
