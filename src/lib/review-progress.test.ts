import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ManuscriptStatus,
  ReviewInvitationStatus,
} from "@/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  transitionStatusWithClient: vi.fn(),
}));

vi.mock("@/lib/status-machine", () => ({
  transitionStatusWithClient: mocks.transitionStatusWithClient,
}));

function createDb({
  acceptedInvitationCount,
  manuscripts,
  submittedReviewCount,
}: {
  acceptedInvitationCount: number;
  manuscripts: Array<{
    id: string;
    requiredReviewCount: number;
    revisionNumber: number;
    status: ManuscriptStatus;
  }>;
  submittedReviewCount: number;
}) {
  let manuscriptIndex = 0;

  return {
    auditLog: { create: vi.fn() },
    manuscript: {
      findFirst: vi.fn(async () => manuscripts[manuscriptIndex++] ?? null),
      update: vi.fn(),
    },
    manuscriptAuthor: { findFirst: vi.fn() },
    manuscriptStatusHistory: { create: vi.fn() },
    review: {
      count: vi.fn(async () => submittedReviewCount),
    },
    reviewInvitation: {
      count: vi.fn(async () => acceptedInvitationCount),
      findFirst: vi.fn(),
    },
    user: { findFirst: vi.fn() },
  };
}

describe("review progress automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transitionStatusWithClient.mockResolvedValue({});
  });

  test("uses a SYSTEM actor when an accepted invitation starts review", async () => {
    const db = createDb({
      acceptedInvitationCount: 1,
      manuscripts: [
        {
          id: "manuscript-1",
          requiredReviewCount: 2,
          revisionNumber: 2,
          status: ManuscriptStatus.REVIEWERS_INVITED,
        },
        {
          id: "manuscript-1",
          requiredReviewCount: 2,
          revisionNumber: 2,
          status: ManuscriptStatus.UNDER_REVIEW,
        },
      ],
      submittedReviewCount: 0,
    });

    const { refreshReviewProgressWithClient } = await import(
      "@/lib/review-progress"
    );

    await refreshReviewProgressWithClient(db, "manuscript-1");

    expect(db.reviewInvitation.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        manuscriptId: "manuscript-1",
        revisionNumber: 2,
        status: ReviewInvitationStatus.ACCEPTED,
      },
    });
    expect(mocks.transitionStatusWithClient).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actor: { type: "SYSTEM", systemAction: "AUTO_REVIEW_STARTED" },
        manuscriptId: "manuscript-1",
        toStatus: ManuscriptStatus.UNDER_REVIEW,
      }),
    );
  });

  test("uses a SYSTEM actor when submitted reviews complete review", async () => {
    const db = createDb({
      acceptedInvitationCount: 1,
      manuscripts: [
        {
          id: "manuscript-1",
          requiredReviewCount: 2,
          revisionNumber: 2,
          status: ManuscriptStatus.UNDER_REVIEW,
        },
      ],
      submittedReviewCount: 2,
    });

    const { refreshReviewProgressWithClient } = await import(
      "@/lib/review-progress"
    );

    await refreshReviewProgressWithClient(db, "manuscript-1");

    expect(mocks.transitionStatusWithClient).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actor: { type: "SYSTEM", systemAction: "AUTO_REVIEWS_COMPLETED" },
        manuscriptId: "manuscript-1",
        toStatus: ManuscriptStatus.REVIEWS_COMPLETED,
      }),
    );
  });
});
