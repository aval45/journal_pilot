import { beforeEach, describe, expect, test, vi } from "vitest";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  assertHasRole: vi.fn(),
  assertServerActionRateLimit: vi.fn(),
  manuscriptDelete: vi.fn(),
  manuscriptFindFirst: vi.fn(),
  manuscriptUpdate: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/permissions", () => ({
  assertHasRole: mocks.assertHasRole,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    manuscript: {
      delete: mocks.manuscriptDelete,
      findFirst: mocks.manuscriptFindFirst,
      update: mocks.manuscriptUpdate,
    },
    $transaction: vi.fn(),
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
  transitionStatusWithClient: vi.fn(),
}));

describe("manuscript lifecycle actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not hard delete a submitted manuscript", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "author-1" });
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.assertHasRole.mockResolvedValue(undefined);
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

  test("does not soft delete when the caller is only a co-author", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "co-author-1" });
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.assertHasRole.mockResolvedValue(undefined);
    mocks.manuscriptFindFirst.mockResolvedValue(null);

    const { softDeleteDraftManuscriptAction } = await import(
      "@/lib/actions/lifecycle"
    );

    await expect(
      softDeleteDraftManuscriptAction({ manuscriptId: "manuscript-1" }),
    ).resolves.toEqual({
      success: false,
      error: "This manuscript is no longer available.",
    });
    expect(mocks.assertHasRole).toHaveBeenCalledWith(
      "co-author-1",
      UserRole.AUTHOR,
    );
    expect(mocks.manuscriptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submittingAuthorId: "co-author-1",
        }),
      }),
    );
    expect(mocks.manuscriptUpdate).not.toHaveBeenCalled();
  });

  test("restore only updates manuscripts that are actually deleted", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "admin-1" });
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.assertHasRole.mockResolvedValue(undefined);
    mocks.manuscriptFindFirst.mockResolvedValue({
      deletedAt: null,
    });

    const { restoreManuscriptAction } = await import("@/lib/actions/lifecycle");

    await expect(
      restoreManuscriptAction({ manuscriptId: "manuscript-1" }),
    ).resolves.toEqual({
      success: false,
      error: "Only deleted manuscripts can be restored.",
    });
    expect(mocks.manuscriptUpdate).not.toHaveBeenCalled();
  });

  test("archive rejects terminal manuscript statuses", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "admin-1" });
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.assertHasRole.mockResolvedValue(undefined);
    mocks.manuscriptFindFirst.mockResolvedValue({
      archivedAt: null,
      status: ManuscriptStatus.WITHDRAWN,
    });

    const { archiveManuscriptAction } = await import("@/lib/actions/lifecycle");

    await expect(
      archiveManuscriptAction({ manuscriptId: "manuscript-1" }),
    ).resolves.toEqual({
      success: false,
      error: "Withdrawn or decided manuscripts cannot be archived.",
    });
    expect(mocks.manuscriptUpdate).not.toHaveBeenCalled();
  });
});
