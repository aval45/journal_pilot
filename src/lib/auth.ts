import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { UserModel } from "@/generated/prisma/models";
import { AUDIT_ACTIONS, tryWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {
  constructor(message = "You must be signed in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class DeactivatedAccountError extends Error {
  constructor() {
    super("This account is deactivated.");
    this.name = "DeactivatedAccountError";
  }
}

export const getCurrentUser = cache(async (): Promise<UserModel | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: authUser.id,
      deactivatedAt: null,
    },
  });

  return user;
});

export async function requireCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    throw new AuthenticationError();
  }

  const user = await prisma.user.findFirst({
    where: {
      id: authUser.id,
    },
  });

  if (!user) {
    throw new AuthenticationError();
  }

  if (user.deactivatedAt) {
    await tryWriteAuditLog({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actorType: "USER",
      actorUserId: user.id,
      entityType: "User",
      entityId: user.id,
      outcome: "DENIED",
      metadata: {
        reason: "deactivated_account",
      },
    });
    throw new DeactivatedAccountError();
  }

  return user;
}

export async function requireAuth() {
  return requireCurrentUser();
}

export async function requireCurrentUserOrRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
