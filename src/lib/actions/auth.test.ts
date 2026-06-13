import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertServerActionRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  deleteSupabaseUser: vi.fn(),
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

vi.mock("@/lib/env", () => ({
  getAppUrl: () => "http://localhost:3000",
}));

describe("auth server action rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.deleteSupabaseUser.mockResolvedValue({ data: {}, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          deleteUser: mocks.deleteSupabaseUser,
        },
      },
    });
  });

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

  test("register deletes the Supabase user when Prisma user creation fails", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
            },
          },
          error: null,
        }),
      },
    });
    mocks.prismaUserCreate.mockRejectedValue(new Error("database failed"));

    const { registerAction } = await import("@/lib/actions/auth");
    const formData = new FormData();
    formData.set("name", "Ada Lovelace");
    formData.set("email", "ada@example.com");
    formData.set("password", "correct-horse-battery-staple");

    await expect(
      registerAction({ success: false, error: "" }, formData),
    ).resolves.toEqual({
      success: false,
      error: "We could not finish creating the account. Please try again.",
    });
    expect(mocks.prismaUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "ada@example.com",
        id: "user-1",
        name: "Ada Lovelace",
      }),
    });
    expect(mocks.deleteSupabaseUser).toHaveBeenCalledWith("user-1");
  });
});
