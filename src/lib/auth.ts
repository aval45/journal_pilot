import "server-only";

import { redirect } from "next/navigation";

import type { UserModel } from "@/generated/prisma/models";
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

export async function getCurrentUser(): Promise<UserModel | null> {
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
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    // TODO(feature-8): write ACCESS_DENIED audit logs for missing/deactivated users.
    throw new AuthenticationError();
  }

  return user;
}

export async function requireCurrentUserOrRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
