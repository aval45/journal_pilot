import { UserRole } from "@/generated/prisma/enums";
import {
  createSupabaseProxyContext,
  type SupabaseProxyUser,
} from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ROLE_TO_SEGMENT: Record<UserRole, string> = {
  AUTHOR: "author",
  REVIEWER: "reviewer",
  EDITOR: "editor",
  ADMIN: "admin",
};

const SEGMENT_TO_ROLE: Record<string, UserRole> = {
  author: UserRole.AUTHOR,
  reviewer: UserRole.REVIEWER,
  editor: UserRole.EDITOR,
  admin: UserRole.ADMIN,
};

const ROLE_ORDER = [
  UserRole.AUTHOR,
  UserRole.REVIEWER,
  UserRole.EDITOR,
  UserRole.ADMIN,
];

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toUpperCase();

  if (role in ROLE_TO_SEGMENT) {
    return role as UserRole;
  }

  return null;
}

function getMetadataRoles(user: SupabaseProxyUser) {
  const rawRoles = Array.isArray(user.app_metadata.roles)
    ? user.app_metadata.roles
    : [];
  const roles = rawRoles
    .map(normalizeRole)
    .filter((role): role is UserRole => Boolean(role));

  return roles.length > 0 ? roles : [UserRole.AUTHOR];
}

function getMetadataRole(user: SupabaseProxyUser, key: string) {
  return normalizeRole(user.app_metadata[key]);
}

function resolveDefaultRole(user: SupabaseProxyUser) {
  const roles = getMetadataRoles(user);
  const lastActiveRole = getMetadataRole(user, "lastActiveRole");
  const primaryRole = getMetadataRole(user, "primaryRole");

  if (lastActiveRole && roles.includes(lastActiveRole)) {
    return lastActiveRole;
  }

  if (primaryRole && roles.includes(primaryRole)) {
    return primaryRole;
  }

  return ROLE_ORDER.find((role) => roles.includes(role)) ?? roles[0];
}

function redirectWithAuthCookies(url: URL, responseWithCookies: NextResponse) {
  const response = NextResponse.redirect(url);

  responseWithCookies.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = responseWithCookies.headers.get(header);

    if (value) {
      response.headers.set(header, value);
    }
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await createSupabaseProxyContext(request);
  const { pathname } = request.nextUrl;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return redirectWithAuthCookies(loginUrl, response);
  }

  const defaultRole = resolveDefaultRole(user);
  const defaultPath = `/dashboard/${ROLE_TO_SEGMENT[defaultRole]}`;

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return redirectWithAuthCookies(new URL(defaultPath, request.url), response);
  }

  const roleSegment = pathname.split("/")[2];
  const requestedRole = SEGMENT_TO_ROLE[roleSegment ?? ""];

  if (!requestedRole) {
    return redirectWithAuthCookies(new URL(defaultPath, request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
