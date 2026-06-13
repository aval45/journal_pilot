import "server-only";

import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import type { AuthActionState } from "@/lib/actions/auth-state";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  assertServerActionRateLimit,
  isRateLimitError,
  RATE_LIMIT_SUBJECTS,
  rateLimitActionError,
  type RateLimitSubject,
} from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from "@/lib/validators/auth";

function validationError(): AuthActionState {
  return {
    success: false,
    error: "Check the form fields and try again.",
  };
}

async function cleanupSupabaseUser(userId: string) {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort compensation. Do not leak privileged cleanup details.
  }
}

async function getAuthRateLimitError(
  subject: RateLimitSubject,
  email: string,
): Promise<AuthActionState | null> {
  try {
    await assertServerActionRateLimit({
      actorType: "ANONYMOUS",
      email,
      subject,
    });

    return null;
  } catch (error) {
    if (isRateLimitError(error)) {
      return rateLimitActionError();
    }

    throw error;
  }
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError();
  }

  const rateLimitError = await getAuthRateLimitError(
    RATE_LIMIT_SUBJECTS.AUTH_LOGIN,
    parsed.data.email,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  redirect("/dashboard");
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError();
  }

  const rateLimitError = await getAuthRateLimitError(
    RATE_LIMIT_SUBJECTS.AUTH_REGISTER,
    parsed.data.email,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
        roles: [UserRole.AUTHOR],
        primaryRole: UserRole.AUTHOR,
        lastActiveRole: UserRole.AUTHOR,
      },
      emailRedirectTo: `${getAppUrl()}/login`,
    },
  });

  if (error || !user) {
    return {
      success: false,
      error: "We could not create the account. Please try again.",
    };
  }

  try {
    await prisma.user.create({
      data: {
        id: user.id,
        email: parsed.data.email,
        name: parsed.data.name,
        roles: [UserRole.AUTHOR],
        primaryRole: UserRole.AUTHOR,
        lastActiveRole: UserRole.AUTHOR,
      },
    });
  } catch {
    await cleanupSupabaseUser(user.id);

    return {
      success: false,
      error: "We could not finish creating the account. Please try again.",
    };
  }

  return {
    success: true,
    data: {
      message: "Account created. Check your email to confirm your sign in.",
    },
  };
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError();
  }

  const rateLimitError = await getAuthRateLimitError(
    RATE_LIMIT_SUBJECTS.AUTH_FORGOT_PASSWORD,
    parsed.data.email,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/login`,
  });

  return {
    success: true,
    data: {
      message: "If that email exists, a password reset link will arrive shortly.",
    },
  };
}
