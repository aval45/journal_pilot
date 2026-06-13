import { describe, expect, test, vi } from "vitest";

import { AuditActorType, AuditOutcome } from "@/generated/prisma/enums";
import {
  AUDIT_ACTIONS,
  hashAuditValue,
  sanitizeAuditMetadata,
  writeAuditLogWithClient,
} from "@/lib/audit";

describe("audit logging", () => {
  test("sanitizes secrets and confidential content from metadata", () => {
    expect(
      sanitizeAuditMetadata({
        safe: "kept",
        signedUrl: "remove-me",
        nested: {
          token: "remove-me",
          decision: "kept",
        },
        list: [{ password: "remove-me", status: "kept" }],
      }),
    ).toEqual({
      safe: "kept",
      nested: {
        decision: "kept",
      },
      list: [{ status: "kept" }],
    });
  });

  test("hashes IP and user-agent values instead of storing raw values", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });

    await writeAuditLogWithClient(
      {
        auditLog: {
          create,
        },
      },
      {
        action: AUDIT_ACTIONS.ACCESS_DENIED,
        actorType: AuditActorType.USER,
        actorUserId: "user-1",
        entityType: "Manuscript",
        entityId: "manuscript-1",
        outcome: AuditOutcome.DENIED,
        ipAddress: "203.0.113.10",
        userAgent: "Test Agent",
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipHash: hashAuditValue("203.0.113.10"),
        userAgentHash: hashAuditValue("Test Agent"),
      }),
    });
    expect(create.mock.calls[0][0].data.ipHash).not.toBe("203.0.113.10");
    expect(create.mock.calls[0][0].data.userAgentHash).not.toBe("Test Agent");
  });

  test("creates audit log rows for sensitive actions", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });

    await writeAuditLogWithClient(
      {
        auditLog: {
          create,
        },
      },
      {
        action: AUDIT_ACTIONS.MANUSCRIPT_SUBMITTED,
        actorType: AuditActorType.USER,
        actorUserId: "user-1",
        entityType: "Manuscript",
        entityId: "manuscript-1",
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.MANUSCRIPT_SUBMITTED,
        actorType: AuditActorType.USER,
        actorUserId: "user-1",
        entityId: "manuscript-1",
        entityType: "Manuscript",
        outcome: AuditOutcome.SUCCESS,
      }),
    });
  });
});
