import type { MembershipRole } from "../generated/prisma/enums.js";
import { prisma } from "./prisma.js";

export function toApiRole(role: MembershipRole): "admin" | "manager" | "sales_rep" {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "MANAGER":
      return "manager";
    case "SALES_REP":
      return "sales_rep";
  }
}

export async function loadActiveAuthContextForUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      archivedAt: null,
    },
    include: {
      memberships: {
        where: {
          archivedAt: null,
          organization: {
            archivedAt: null,
          },
        },
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return null;
  }

  const membership = user.memberships[0];

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      lastLoginAt: user.lastLoginAt,
    },
    organization: {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
    },
    membership: {
      id: membership.id,
      role: toApiRole(membership.role),
    },
  };
}
