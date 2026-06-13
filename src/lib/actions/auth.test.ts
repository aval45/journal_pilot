import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertServerActionRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  prismaUserCreate: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/rate-limit", () => ({
  assertServerActionRateLimit: mocks.assertServerActionRateLimit,
  isRateLimitError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "RateLimitError",
  RATE_LIMIT_SUBJECTS: {
    AUTH_FORGOT_PASSWORD: "auth-forgot-password",
    AUTH_LOGIN: "auth-login",
    AUTH_REGISTER: "auth-register",
  },
  rateLimitActionError: () => ({
    success: false,
    error: "Too many attempts. Please try again later.",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: mocks.prismaUserCreate,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

describe("auth server action rate limits", () => {
  test("login returns a generic error and does not call Supabase when rate limited", async () => {
    mocks.assertServerActionRateLimit.mockRejectedValue({
      name: "RateLimitError",
    });

    const { loginAction } = await import("@/lib/actions/auth");
    const formData = new FormData();
    formData.set("email", "author@example.com");
    formData.set("password", "correct-horse-battery-staple");

    await expect(
      loginAction({ success: false, error: "" }, formData),
    ).resolves.toEqual({
      success: false,
      error: "Too many attempts. Please try again later.",
    });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
