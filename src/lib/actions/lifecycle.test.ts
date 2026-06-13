import { describe, expect, test, vi } from "vitest";

import { ManuscriptStatus } from "@/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  assertAuthorOf: vi.fn(),
  assertServerActionRateLimit: vi.fn(),
  manuscriptDelete: vi.fn(),
  manuscriptFindFirst: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/lib/permissions", () => ({
  assertAuthorOf: mocks.assertAuthorOf,
  assertHasRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    manuscript: {
      delete: mocks.manuscriptDelete,
      findFirst: mocks.manuscriptFindFirst,
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  assertServerActionRateLimit: mocks.assertServerActionRateLimit,
  isRateLimitError: () => false,
  RATE_LIMIT_SUBJECTS: {
    MANUSCRIPT_LIFECYCLE: "manuscript-lifecycle",
  },
  rateLimitActionError: () => ({
    success: false,
    error: "Too many attempts. Please try again later.",
  }),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    DRAFT_HARD_DELETED: "DRAFT_HARD_DELETED",
    MANUSCRIPT_ARCHIVED: "MANUSCRIPT_ARCHIVED",
    MANUSCRIPT_SOFT_DELETED: "MANUSCRIPT_SOFT_DELETED",
    MANUSCRIPT_WITHDRAWN: "MANUSCRIPT_WITHDRAWN",
  },
  tryWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/status-machine", () => ({
  transitionStatus: vi.fn(),
}));

describe("manuscript lifecycle actions", () => {
  test("does not hard delete a submitted manuscript", async () => {
    mocks.requireCurrentUser.mockResolvedValue({ id: "author-1" });
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.assertAuthorOf.mockResolvedValue(undefined);
    mocks.manuscriptFindFirst.mockResolvedValue({
      status: ManuscriptStatus.SUBMITTED,
    });

    const { hardDeleteDraftManuscriptAction } = await import(
      "@/lib/actions/lifecycle"
    );

    await expect(
      hardDeleteDraftManuscriptAction({ manuscriptId: "manuscript-1" }),
    ).resolves.toEqual({
      success: false,
      error: "Only drafts can be permanently deleted.",
    });
    expect(mocks.manuscriptDelete).not.toHaveBeenCalled();
  });
});
