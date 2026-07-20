import { prisma } from "./prisma.js";

export type AuditEventInput = {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  subjectType?: string;
  subjectId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function auditEventData(input: AuditEventInput) {
  return {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    metadata: input.metadata,
  };
}

export function recordAuditEvent(input: AuditEventInput) {
  return prisma.auditEvent.create({ data: auditEventData(input) });
}
