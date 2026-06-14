import { describe, expect, test } from "vitest";

import {
  EditorialDecision,
  ManuscriptStatus,
  ReviewInvitationStatus,
} from "@/generated/prisma/enums";
import {
  reviewDeadlineState,
  shouldCompleteReviews,
  shouldStartReview,
  statusForEditorialDecision,
} from "@/lib/editor-workflow";

describe("editor workflow helpers", () => {
  test("maps editorial decisions to manuscript statuses", () => {
    expect(statusForEditorialDecision(EditorialDecision.ACCEPT)).toBe(
      ManuscriptStatus.ACCEPTED,
    );
    expect(statusForEditorialDecision(EditorialDecision.REJECT)).toBe(
      ManuscriptStatus.REJECTED,
    );
    expect(statusForEditorialDecision(EditorialDecision.MINOR_REVISION)).toBe(
      ManuscriptStatus.REVISION_REQUESTED,
    );
    expect(statusForEditorialDecision(EditorialDecision.MAJOR_REVISION)).toBe(
      ManuscriptStatus.REVISION_REQUESTED,
    );
  });

  test("starts review only after an invitation is accepted", () => {
    expect(
      shouldStartReview({
        acceptedInvitationCount: 0,
        status: ManuscriptStatus.REVIEWERS_INVITED,
      }),
    ).toBe(false);
    expect(
      shouldStartReview({
        acceptedInvitationCount: 1,
        status: ManuscriptStatus.REVIEWERS_INVITED,
      }),
    ).toBe(true);
  });

  test("completes reviews only when the current requirement is met", () => {
    expect(
      shouldCompleteReviews({
        requiredReviewCount: 2,
        status: ManuscriptStatus.UNDER_REVIEW,
        submittedReviewCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldCompleteReviews({
        requiredReviewCount: 2,
        status: ManuscriptStatus.UNDER_REVIEW,
        submittedReviewCount: 2,
      }),
    ).toBe(true);
  });

  test("labels overdue pending invitations and late active reviews", () => {
    const now = new Date("2026-06-14T12:00:00.000Z");
    const dueDate = new Date("2026-06-13T12:00:00.000Z");

    expect(
      reviewDeadlineState({
        dueDate,
        now,
        status: ReviewInvitationStatus.PENDING,
      }),
    ).toBe("overdue");
    expect(
      reviewDeadlineState({
        dueDate,
        now,
        status: ReviewInvitationStatus.ACCEPTED,
      }),
    ).toBe("late");
    expect(
      reviewDeadlineState({
        dueDate,
        now,
        status: ReviewInvitationStatus.DECLINED,
      }),
    ).toBeNull();
  });
});
