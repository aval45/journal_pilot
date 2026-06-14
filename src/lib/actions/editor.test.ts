import { beforeEach, describe, expect, test, vi } from "vitest";

import { EditorialDecision, ManuscriptStatus, UserRole } from "@/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  assertHasRole: vi.fn(),
  assertServerActionRateLimit: vi.fn(),
  editorDecisionCreate: vi.fn(),
  manuscriptFindFirst: vi.fn(),
  manuscriptUpdate: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuth: vi.fn(),
  reviewInvitationCreate: vi.fn(),
  reviewInvitationFindFirst: vi.fn(),
  transaction: vi.fn(),
  transitionStatusWithClient: vi.fn(),
  userFindFirst: vi.fn(),
  writeAuditLogWithClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  DeactivatedAccountError: class DeactivatedAccountError extends Error {},
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/permissions", () => ({
  assertHasRole: mocks.assertHasRole,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  assertServerActionRateLimit: mocks.assertServerActionRateLimit,
  RATE_LIMIT_SUBJECTS: {
    EDITOR_DECISION_CREATE: "editor-decision-create",
    MANUSCRIPT_LIFECYCLE: "manuscript-lifecycle",
    REVIEWER_INVITATION_SEND: "reviewer-invitation-send",
  },
  rateLimitActionError: () => ({
    success: false,
    error: "Too many attempts. Please try again later.",
  }),
  RateLimitError: class RateLimitError extends Error {},
}));

vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>(
    "@/lib/audit",
  );

  return {
    ...actual,
    writeAuditLogWithClient: mocks.writeAuditLogWithClient,
  };
});

vi.mock("@/lib/status-machine", () => ({
  transitionStatusWithClient: mocks.transitionStatusWithClient,
}));

vi.mock("@/lib/review-progress", () => ({
  refreshReviewProgressWithClient: vi.fn(),
}));

function editorFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("dueDate", "2026-07-01");
  formData.set("manuscriptId", "manuscript-1");
  formData.set("reviewerId", "reviewer-1");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function createTx() {
  return {
    auditLog: {
      create: vi.fn(),
    },
    editorDecision: {
      create: mocks.editorDecisionCreate,
    },
    manuscript: {
      findFirst: mocks.manuscriptFindFirst,
      update: mocks.manuscriptUpdate,
    },
    manuscriptAuthor: {
      findFirst: vi.fn(),
    },
    manuscriptStatusHistory: {
      create: vi.fn(),
    },
    review: {
      count: vi.fn(),
    },
    reviewInvitation: {
      count: vi.fn(),
      create: mocks.reviewInvitationCreate,
      findFirst: mocks.reviewInvitationFindFirst,
    },
    user: {
      findFirst: mocks.userFindFirst,
    },
  };
}

describe("editor workflow actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      id: "editor-1",
      roles: [UserRole.EDITOR],
    });
    mocks.assertHasRole.mockResolvedValue(undefined);
    mocks.assertServerActionRateLimit.mockResolvedValue(undefined);
    mocks.reviewInvitationFindFirst.mockResolvedValue(null);
    mocks.reviewInvitationCreate.mockResolvedValue({});
    mocks.editorDecisionCreate.mockResolvedValue({});
    mocks.manuscriptUpdate.mockResolvedValue({});
    mocks.transitionStatusWithClient.mockResolvedValue({});
    mocks.writeAuditLogWithClient.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(createTx()),
    );
  });

  test("blocks editors from inviting themselves as reviewers", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue({
      authors: [],
      revisionNumber: 3,
      status: ManuscriptStatus.WITH_EDITOR,
    });

    const { inviteReviewerAction } = await import("@/lib/actions/editor");

    await expect(
      inviteReviewerAction(
        { success: false, error: "" },
        editorFormData({ reviewerId: "editor-1" }),
      ),
    ).resolves.toEqual({
      success: false,
      error: "Editors cannot invite themselves as reviewers.",
    });
    expect(mocks.reviewInvitationCreate).not.toHaveBeenCalled();
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });

  test("blocks reviewer invitations when reviewer email matches an author", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue({
      authors: [{ email: "reviewer@example.com", userId: null }],
      revisionNumber: 3,
      status: ManuscriptStatus.WITH_EDITOR,
    });
    mocks.userFindFirst.mockResolvedValue({
      email: "Reviewer@Example.com",
      id: "reviewer-1",
    });

    const { inviteReviewerAction } = await import("@/lib/actions/editor");

    await expect(
      inviteReviewerAction({ success: false, error: "" }, editorFormData()),
    ).resolves.toEqual({
      success: false,
      error: "This reviewer has a conflict with the author list.",
    });
    expect(mocks.reviewInvitationCreate).not.toHaveBeenCalled();
  });

  test("blocks reviewer invitations when reviewer userId matches an author", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue({
      authors: [{ email: "coauthor@example.com", userId: "reviewer-1" }],
      revisionNumber: 3,
      status: ManuscriptStatus.WITH_EDITOR,
    });
    mocks.userFindFirst.mockResolvedValue({
      email: "reviewer@example.com",
      id: "reviewer-1",
    });

    const { inviteReviewerAction } = await import("@/lib/actions/editor");

    await expect(
      inviteReviewerAction({ success: false, error: "" }, editorFormData()),
    ).resolves.toEqual({
      success: false,
      error: "This reviewer has a conflict with the author list.",
    });
    expect(mocks.reviewInvitationCreate).not.toHaveBeenCalled();
  });

  test("stores the manuscript revision number when creating a review invitation", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue({
      authors: [],
      revisionNumber: 3,
      status: ManuscriptStatus.REVIEWERS_INVITED,
    });
    mocks.userFindFirst.mockResolvedValue({
      email: "reviewer@example.com",
      id: "reviewer-1",
    });

    const { inviteReviewerAction } = await import("@/lib/actions/editor");

    await expect(
      inviteReviewerAction({ success: false, error: "" }, editorFormData()),
    ).resolves.toEqual({
      success: true,
      data: { message: "Reviewer invitation created." },
    });
    expect(mocks.reviewInvitationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        manuscriptId: "manuscript-1",
        reviewerId: "reviewer-1",
        revisionNumber: 3,
      }),
    });
  });

  test("requires ADMIN role before assigning a handling editor", async () => {
    const formData = editorFormData({
      editorId: "editor-2",
      manuscriptId: "manuscript-1",
    });

    const { assignHandlingEditorAction } = await import("@/lib/actions/editor");

    await assignHandlingEditorAction({ success: false, error: "" }, formData);

    expect(mocks.assertHasRole).toHaveBeenCalledWith("editor-1", UserRole.ADMIN);
  });

  test("creates an editorial decision, transition, and decisionAt in one transaction", async () => {
    const transactionOrder: string[] = [];

    mocks.manuscriptFindFirst.mockResolvedValue({
      revisionNumber: 4,
      status: ManuscriptStatus.DECISION_IN_PROCESS,
    });
    mocks.editorDecisionCreate.mockImplementation(async () => {
      transactionOrder.push("decision");
      return {};
    });
    mocks.transitionStatusWithClient.mockImplementation(async () => {
      transactionOrder.push("transition");
      return {};
    });
    mocks.manuscriptUpdate.mockImplementation(async () => {
      transactionOrder.push("decisionAt");
      return {};
    });

    const formData = editorFormData({
      decision: EditorialDecision.ACCEPT,
      decisionLetter: "Accepted after editorial review.",
      manuscriptId: "manuscript-1",
    });

    const { createEditorialDecisionAction } = await import(
      "@/lib/actions/editor"
    );

    await expect(
      createEditorialDecisionAction({ success: false, error: "" }, formData),
    ).resolves.toEqual({
      success: true,
      data: { message: "Editorial decision saved." },
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.editorDecisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: EditorialDecision.ACCEPT,
        editorId: "editor-1",
        manuscriptId: "manuscript-1",
        revisionNumber: 4,
      }),
    });
    expect(mocks.transitionStatusWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        manuscriptId: "manuscript-1",
        toStatus: ManuscriptStatus.ACCEPTED,
      }),
    );
    expect(mocks.manuscriptUpdate).toHaveBeenCalledWith({
      where: { id: "manuscript-1" },
      data: { decisionAt: expect.any(Date) },
    });
    expect(transactionOrder).toEqual(["decision", "transition", "decisionAt"]);
  });
});
