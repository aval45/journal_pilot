import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRouteRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRouteRateLimit: mocks.checkRouteRateLimit,
  rateLimitJsonResponse: (check: { retryAfter: number }) =>
    Response.json(
      { error: "Too many attempts. Please try again later." },
      {
        headers: { "Retry-After": String(check.retryAfter) },
        status: 429,
      },
    ),
  RATE_LIMIT_SUBJECTS: {
    PUBLIC_ROUTE: "public-route",
  },
}));

describe("health route rate limiting", () => {
  test("returns 429 when the public route limit is exceeded", async () => {
    mocks.checkRouteRateLimit.mockResolvedValue({
      limit: 120,
      remaining: 0,
      reset: Date.now() + 10_000,
      retryAfter: 10,
      success: false,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/health"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    await expect(response.json()).resolves.toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });
});
