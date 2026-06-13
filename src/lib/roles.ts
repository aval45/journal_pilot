import { UserRole } from "@/generated/prisma/enums";

const ROLE_ORDER = [
  UserRole.AUTHOR,
  UserRole.REVIEWER,
  UserRole.EDITOR,
  UserRole.ADMIN,
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  AUTHOR: "Author",
  REVIEWER: "Reviewer",
  EDITOR: "Editor",
  ADMIN: "Admin",
};

const ROLE_SEGMENTS: Record<UserRole, string> = {
  AUTHOR: "author",
  REVIEWER: "reviewer",
  EDITOR: "editor",
  ADMIN: "admin",
};

export function roleDashboardPath(role: UserRole) {
  return `/dashboard/${ROLE_SEGMENTS[role]}`;
}

export function resolveDefaultDashboardRole(user: {
  roles: UserRole[];
  primaryRole: UserRole;
  lastActiveRole: UserRole | null;
}) {
  if (user.lastActiveRole && user.roles.includes(user.lastActiveRole)) {
    return user.lastActiveRole;
  }

  if (user.roles.includes(user.primaryRole)) {
    return user.primaryRole;
  }

  return ROLE_ORDER.find((role) => user.roles.includes(role)) ?? user.roles[0];
}
