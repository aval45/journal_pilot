import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers as nextHeaders } from "next/headers";

import { AuditActorType, AuditOutcome } from "@/generated/prisma/enums";
import { AUDIT_ACTIONS, hashAuditValue, tryWriteAuditLog } from "@/lib/audit";

export const RATE_LIMIT_USER_MESSAGE =
  "Too many attempts. Please try again later.";

export const RATE_LIMIT_SUBJECTS = {
  ADMIN_ROLE_CHANGE: "admin-role-change",
  AUTH_FORGOT_PASSWORD: "auth-forgot-password",
  AUTH_LOGIN: "auth-login",
  AUTH_REGISTER: "auth-register",
  AUTH_RESEND_VERIFICATION: "auth-resend-verification",
  AUTH_MAGIC_LINK: "auth-magic-link",
  DASHBOARD_ROLE_SWITCH: "dashboard-role-switch",
  EDITOR_DECISION_CREATE: "editor-decision-create",
  FILE_METADATA_CREATE: "file-metadata-create",
  MANUSCRIPT_AUTOSAVE: "manuscript-autosave",
  MANUSCRIPT_LIFECYCLE: "manuscript-lifecycle",
  MANUSCRIPT_SUBMIT: "manuscript-submit",
  PUBLIC_ROUTE: "public-route",
  REVIEW_SUBMIT: "review-submit",
  REVIEWER_INVITATION_SEND: "reviewer-invitation-send",
  SIGNED_URL_CREATE: "signed-url-create",
  WEBHOOK_ROUTE: "webhook-route",
} as const;

export type RateLimitSubject =
  (typeof RATE_LIMIT_SUBJECTS)[keyof typeof RATE_LIMIT_SUBJECTS];

export type RateLimitPolicy = {
  limit: number;
  window: Duration;
  reason: string;
};

export const RATE_LIMIT_POLICIES = {
  [RATE_LIMIT_SUBJECTS.ADMIN_ROLE_CHANGE]: {
    limit: 30,
    window: "1 h",
    reason: "admin role changes",
  },
  [RATE_LIMIT_SUBJECTS.AUTH_FORGOT_PASSWORD]: {
    limit: 3,
    window: "1 h",
    reason: "forgot password requests",
  },
  [RATE_LIMIT_SUBJECTS.AUTH_LOGIN]: {
    limit: 5,
    window: "10 m",
    reason: "login attempts",
  },
  [RATE_LIMIT_SUBJECTS.AUTH_REGISTER]: {
    limit: 3,
    window: "1 h",
    reason: "registration attempts",
  },
  [RATE_LIMIT_SUBJECTS.AUTH_RESEND_VERIFICATION]: {
    limit: 3,
    window: "1 h",
    reason: "verification email requests",
  },
  [RATE_LIMIT_SUBJECTS.AUTH_MAGIC_LINK]: {
    limit: 3,
    window: "1 h",
    reason: "magic-link requests",
  },
  [RATE_LIMIT_SUBJECTS.DASHBOARD_ROLE_SWITCH]: {
    limit: 60,
    window: "1 h",
    reason: "dashboard role switches",
  },
  [RATE_LIMIT_SUBJECTS.EDITOR_DECISION_CREATE]: {
    limit: 20,
    window: "1 h",
    reason: "editor decisions",
  },
  [RATE_LIMIT_SUBJECTS.FILE_METADATA_CREATE]: {
    limit: 30,
    window: "1 h",
    reason: "file metadata creation",
  },
  [RATE_LIMIT_SUBJECTS.MANUSCRIPT_AUTOSAVE]: {
    limit: 60,
    window: "1 m",
    reason: "manuscript draft autosave",
  },
  [RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE]: {
    limit: 30,
    window: "1 h",
    reason: "manuscript lifecycle changes",
  },
  [RATE_LIMIT_SUBJECTS.MANUSCRIPT_SUBMIT]: {
    limit: 10,
    window: "1 h",
    reason: "manuscript submissions",
  },
  [RATE_LIMIT_SUBJECTS.PUBLIC_ROUTE]: {
    limit: 120,
    window: "1 m",
    reason: "public route requests",
  },
  [RATE_LIMIT_SUBJECTS.REVIEW_SUBMIT]: {
    limit: 20,
    window: "1 h",
    reason: "review submissions",
  },
  [RATE_LIMIT_SUBJECTS.REVIEWER_INVITATION_SEND]: {
    limit: 50,
    window: "1 d",
    reason: "reviewer invitations",
  },
  [RATE_LIMIT_SUBJECTS.SIGNED_URL_CREATE]: {
    limit: 60,
    window: "1 h",
    reason: "signed URL generation",
  },
  [RATE_LIMIT_SUBJECTS.WEBHOOK_ROUTE]: {
    limit: 300,
    window: "1 m",
    reason: "webhook route requests",
  },
} satisfies Record<RateLimitSubject, RateLimitPolicy>;

export type RateLimitActor = {
  actorType?: AuditActorType;
  actorUserId?: string | null;
};

export type RateLimitScope = RateLimitActor & {
  email?: string | null;
  fileId?: string | null;
  headers?: Headers;
  ipAddress?: string | null;
  key?: string;
  manuscriptId?: string | null;
  subject: RateLimitSubject;
  userId?: string | null;
};

export type RateLimitCheck = {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
  success: boolean;
};

type RawRateLimitCheck = Omit<RateLimitCheck, "retryAfter">;

export type RateLimiterClient = {
  limit: (key: string) => Promise<RawRateLimitCheck>;
};

type RateLimitOptions = {
  auditDeny?: typeof tryWriteAuditLog;
  limiter?: RateLimiterClient;
};

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(RATE_LIMIT_USER_MESSAGE);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

const limiterCache = new Map<RateLimitSubject, RateLimiterClient>();

function getTrustedHeaderName() {
  return process.env.TRUSTED_CLIENT_IP_HEADER?.toLowerCase() ?? "x-real-ip";
}

function getTrustedProxyCount() {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "0", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getHeaderValue(headers: Headers, name: string) {
  const value = headers.get(name);

  return value?.split(",")[0]?.trim() || null;
}

export function getTrustedClientIp(headers: Headers) {
  const trustedHeader = getHeaderValue(headers, getTrustedHeaderName());

  if (trustedHeader) {
    return trustedHeader;
  }

  const cloudflareHeader = getHeaderValue(headers, "cf-connecting-ip");

  if (cloudflareHeader) {
    return cloudflareHeader;
  }

  const trueClientHeader = getHeaderValue(headers, "true-client-ip");

  if (trueClientHeader) {
    return trueClientHeader;
  }

  const trustedProxyCount = getTrustedProxyCount();
  const forwardedFor = headers.get("x-forwarded-for");

  if (!forwardedFor || trustedProxyCount === 0) {
    return null;
  }

  const hops = forwardedFor
    .split(",")
    .flatMap((hop) => {
      const trimmed = hop.trim();

      return trimmed ? [trimmed] : [];
    });
  const clientIndex = hops.length - trustedProxyCount - 1;

  return clientIndex >= 0 ? hops[clientIndex] : null;
}

export function buildRateLimitKey(scope: RateLimitScope) {
  if (scope.key) {
    return scope.key;
  }

  const segments = [`subject:${scope.subject}`];
  const ipAddress = scope.ipAddress ?? null;

  if (scope.userId) {
    segments.push(`user:${scope.userId}`);
  }

  if (scope.email) {
    segments.push(`email:${hashAuditValue(scope.email.toLowerCase())}`);
  }

  if (scope.manuscriptId) {
    segments.push(`manuscript:${scope.manuscriptId}`);
  }

  if (scope.fileId) {
    segments.push(`file:${scope.fileId}`);
  }

  if (ipAddress) {
    segments.push(`ip:${hashAuditValue(ipAddress)}`);
  }

  return segments.join(":");
}

function getRedisLimiter(subject: RateLimitSubject) {
  const cached = limiterCache.get(subject);

  if (cached) {
    return cached;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  const policy = RATE_LIMIT_POLICIES[subject];
  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    analytics: true,
    prefix: `journalpilot:${subject}`,
  });

  limiterCache.set(subject, limiter);

  return limiter;
}

function retryAfterSeconds(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

async function logRateLimitDenial(
  scope: RateLimitScope,
  check: RateLimitCheck,
  key: string,
  auditDeny: typeof tryWriteAuditLog,
) {
  await auditDeny({
    action: AUDIT_ACTIONS.RATE_LIMITED,
    actorType: scope.actorType ?? AuditActorType.ANONYMOUS,
    actorUserId: scope.actorUserId ?? scope.userId ?? null,
    entityType: "RateLimit",
    entityId: scope.subject,
    outcome: AuditOutcome.DENIED,
    ipAddress: scope.ipAddress,
    metadata: {
      keyHash: hashAuditValue(key),
      limit: check.limit,
      reason: RATE_LIMIT_POLICIES[scope.subject].reason,
      remaining: check.remaining,
      reset: check.reset,
      retryAfter: check.retryAfter,
      subject: scope.subject,
    },
  });
}

export async function checkRateLimit(
  scope: RateLimitScope,
  options: RateLimitOptions = {},
): Promise<RateLimitCheck> {
  const ipAddress =
    scope.ipAddress ??
    (scope.headers ? getTrustedClientIp(scope.headers) : null);
  const scopeWithIp = { ...scope, ipAddress };
  const policy = RATE_LIMIT_POLICIES[scope.subject];
  const key = buildRateLimitKey(scopeWithIp);
  const limiter = options.limiter ?? getRedisLimiter(scope.subject);

  if (!limiter) {
    return {
      limit: policy.limit,
      remaining: policy.limit,
      reset: Date.now(),
      retryAfter: 0,
      success: true,
    };
  }

  const result = await limiter.limit(key);
  const check = {
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: retryAfterSeconds(result.reset),
    success: result.success,
  };

  if (!check.success) {
    await logRateLimitDenial(
      scopeWithIp,
      check,
      key,
      options.auditDeny ?? tryWriteAuditLog,
    );
  }

  return check;
}

export async function assertRateLimit(
  scope: RateLimitScope,
  options: RateLimitOptions = {},
) {
  const check = await checkRateLimit(scope, options);

  if (!check.success) {
    throw new RateLimitError(check.retryAfter);
  }
}

export async function assertServerActionRateLimit(
  scope: Omit<RateLimitScope, "headers"> & { headers?: Headers },
  options: RateLimitOptions = {},
) {
  const headerStore = scope.headers ?? (await nextHeaders());

  await assertRateLimit({ ...scope, headers: headerStore }, options);
}

export async function checkRouteRateLimit(
  request: Request,
  scope: Omit<RateLimitScope, "headers">,
  options: RateLimitOptions = {},
) {
  return checkRateLimit({ ...scope, headers: request.headers }, options);
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function rateLimitActionError() {
  return {
    success: false as const,
    error: RATE_LIMIT_USER_MESSAGE,
  };
}

export function rateLimitJsonResponse(check: RateLimitCheck) {
  return Response.json(
    { error: RATE_LIMIT_USER_MESSAGE },
    {
      status: 429,
      headers: {
        "Retry-After": String(check.retryAfter),
        "X-RateLimit-Limit": String(check.limit),
        "X-RateLimit-Remaining": String(check.remaining),
        "X-RateLimit-Reset": String(check.reset),
      },
    },
  );
}

function normalizeSignatureHeader(value: string) {
  return value.trim().replace(/^sha256=/i, "").toLowerCase();
}

export function verifyWebhookSignature({
  body,
  secret,
  signature,
}: {
  body: ArrayBuffer | Buffer | string;
  secret: string;
  signature?: string | null;
}) {
  if (!secret || !signature) {
    return false;
  }

  const suppliedSignature = normalizeSignatureHeader(signature);

  if (!/^[a-f0-9]{64}$/.test(suppliedSignature)) {
    return false;
  }

  const bodyBuffer =
    typeof body === "string"
      ? Buffer.from(body, "utf8")
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(new Uint8Array(body));
  const expectedSignature = createHmac("sha256", secret)
    .update(bodyBuffer)
    .digest("hex");
  const supplied = Buffer.from(suppliedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function readAndVerifyWebhookBody({
  request,
  secret,
  signatureHeaderName = "x-signature-256",
}: {
  request: Request;
  secret: string;
  signatureHeaderName?: string;
}) {
  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get(signatureHeaderName);

  if (!verifyWebhookSignature({ body, secret, signature })) {
    return null;
  }

  return body;
}
