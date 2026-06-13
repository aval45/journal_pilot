import "server-only";

import { createHmac } from "node:crypto";

import { AuditActorType, AuditOutcome } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const AUDIT_ACTIONS = {
  ACCESS_DENIED: "ACCESS_DENIED",
  DRAFT_HARD_DELETED: "DRAFT_HARD_DELETED",
  EDITOR_DECISION_CREATED: "EDITOR_DECISION_CREATED",
  FILE_UPLOADED: "FILE_UPLOADED",
  MANUSCRIPT_ARCHIVED: "MANUSCRIPT_ARCHIVED",
  MANUSCRIPT_SOFT_DELETED: "MANUSCRIPT_SOFT_DELETED",
  MANUSCRIPT_SUBMITTED: "MANUSCRIPT_SUBMITTED",
  MANUSCRIPT_WITHDRAWN: "MANUSCRIPT_WITHDRAWN",
  RATE_LIMITED: "RATE_LIMITED",
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  ROLE_CONTEXT_CHANGED: "ROLE_CONTEXT_CHANGED",
  ROLE_CHANGED: "ROLE_CHANGED",
  SIGNED_URL_CREATED: "SIGNED_URL_CREATED",
} as const;

export type AuditLogDb = {
  auditLog: {
    create: (args: {
      data: {
        action: string;
        actorType: AuditActorType;
        actorUserId?: string | null;
        entityId?: string | null;
        entityType: string;
        ipHash?: string | null;
        metadata?: AuditMetadata | null;
        outcome: AuditOutcome;
        userAgentHash?: string | null;
      };
    }) => Promise<unknown>;
  };
};

export type AuditMetadata = Record<string, unknown>;

export type AuditLogInput = {
  action: string;
  actorType: AuditActorType;
  actorUserId?: string | null;
  entityId?: string | null;
  entityType: string;
  ipAddress?: string | null;
  metadata?: AuditMetadata | null;
  outcome?: AuditOutcome;
  userAgent?: string | null;
};

const SENSITIVE_METADATA_KEYS = [
  "authorization",
  "bucketpath",
  "confidentialcomments",
  "cookie",
  "filecontent",
  "filepath",
  "manuscriptcontent",
  "password",
  "secret",
  "service_role",
  "signedurl",
  "supabasesecret",
  "token",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  return SENSITIVE_METADATA_KEYS.some((sensitiveKey) =>
    normalized.includes(sensitiveKey),
  );
}

export function sanitizeAuditMetadata(
  metadata?: AuditMetadata | null,
): AuditMetadata | null {
  if (!metadata) {
    return null;
  }

  const sanitizedEntries: Array<[string, AuditMetadata[keyof AuditMetadata]]> = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    sanitizedEntries.push([
      key,
      Array.isArray(value)
        ? value.map((item) => (isRecord(item) ? sanitizeAuditMetadata(item) : item))
        : isRecord(value)
          ? sanitizeAuditMetadata(value)
          : value,
    ]);
  }

  return Object.fromEntries(sanitizedEntries);
}

export function hashAuditValue(value: string) {
  const salt = process.env.RATE_LIMIT_SALT;

  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SALT is required for audit hashing.");
  }

  return createHmac("sha256", salt ?? "journalpilot-local-audit-salt")
    .update(value)
    .digest("hex");
}

export async function writeAuditLogWithClient(
  db: AuditLogDb,
  input: AuditLogInput,
) {
  await db.auditLog.create({
    data: {
      action: input.action,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      outcome: input.outcome ?? AuditOutcome.SUCCESS,
      ipHash: input.ipAddress ? hashAuditValue(input.ipAddress) : null,
      userAgentHash: input.userAgent ? hashAuditValue(input.userAgent) : null,
      metadata: sanitizeAuditMetadata(input.metadata),
    },
  });
}

export async function writeAuditLog(input: AuditLogInput) {
  await writeAuditLogWithClient(prisma as unknown as AuditLogDb, input);
}

export async function tryWriteAuditLog(input: AuditLogInput) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    // Audit failures must not leak details or block user-safe action handling.
    console.error("Audit log write failed.", error);
  }
}
