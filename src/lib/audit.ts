import "server-only";

import { createHash } from "node:crypto";

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

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return [
            key,
            value.map((item) =>
              isRecord(item) ? sanitizeAuditMetadata(item) : item,
            ),
          ];
        }

        return [
          key,
          isRecord(value) ? sanitizeAuditMetadata(value) : value,
        ];
      }),
  );
}

export function hashAuditValue(value: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? "journalpilot-local-audit-salt";

  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
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
  } catch {
    // Audit failures must not leak details or block user-safe action handling.
  }
}
