import { createHmac } from "node:crypto";

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  assertRateLimit,
  buildRateLimitKey,
  getTrustedClientIp,
  RATE_LIMIT_SUBJECTS,
  RateLimitError,
  verifyWebhookSignature,
} from "@/lib/rate-limit";

describe("rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("does not trust raw x-forwarded-for by default", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.55, 10.0.0.10",
    });

    expect(getTrustedClientIp(headers)).toBeNull();
  });

  test("uses configured trusted proxy depth from the right side of x-forwarded-for", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "1");

    const headers = new Headers({
      "x-forwarded-for": "198.51.100.55, 203.0.113.10, 10.0.0.10",
    });

    expect(getTrustedClientIp(headers)).toBe("203.0.113.10");
  });

  test("prefers trusted platform IP headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.55",
      "x-real-ip": "203.0.113.10",
    });

    expect(getTrustedClientIp(headers)).toBe("203.0.113.10");
  });

  test("hashes IP and email values in rate limit keys", () => {
    const key = buildRateLimitKey({
      email: "Author@Example.com",
      ipAddress: "203.0.113.10",
      subject: RATE_LIMIT_SUBJECTS.AUTH_LOGIN,
    });

    expect(key).toContain("subject:auth-login");
    expect(key).not.toContain("Author@Example.com");
    expect(key).not.toContain("author@example.com");
    expect(key).not.toContain("203.0.113.10");
  });

  test("throws and writes a sanitized audit denial when a limit is exceeded", async () => {
    const auditDeny = vi.fn().mockResolvedValue(undefined);
    const reset = Date.now() + 30_000;

    await expect(
      assertRateLimit(
        {
          actorType: "ANONYMOUS",
          email: "author@example.com",
          ipAddress: "203.0.113.10",
          subject: RATE_LIMIT_SUBJECTS.AUTH_LOGIN,
        },
        {
          auditDeny,
          limiter: {
            limit: vi.fn().mockResolvedValue({
              limit: 5,
              remaining: 0,
              reset,
              retryAfter: 30,
              success: false,
            }),
          },
        },
      ),
    ).rejects.toBeInstanceOf(RateLimitError);

    expect(auditDeny).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RATE_LIMITED",
        entityId: RATE_LIMIT_SUBJECTS.AUTH_LOGIN,
        outcome: "DENIED",
        metadata: expect.objectContaining({
          keyHash: expect.any(String),
          subject: RATE_LIMIT_SUBJECTS.AUTH_LOGIN,
        }),
      }),
    );
    expect(JSON.stringify(auditDeny.mock.calls[0][0].metadata)).not.toContain(
      "author@example.com",
    );
    expect(JSON.stringify(auditDeny.mock.calls[0][0].metadata)).not.toContain(
      "203.0.113.10",
    );
  });

  test("verifies raw-body webhook signatures with HMAC-SHA256", () => {
    const body = JSON.stringify({ event: "test" });
    const secret = "webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(
      verifyWebhookSignature({
        body,
        secret,
        signature: `sha256=${signature}`,
      }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        body,
        secret,
        signature: `sha256=${"0".repeat(64)}`,
      }),
    ).toBe(false);
  });
});
