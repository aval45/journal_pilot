import {
  EditorialDecision,
  ManuscriptStatus,
  ReviewInvitationStatus,
} from "@/generated/prisma/enums";

export const EDITORIAL_DECISION_LABELS: Record<EditorialDecision, string> = {
  ACCEPT: "Accept",
  MAJOR_REVISION: "Request major revision",
  MINOR_REVISION: "Request minor revision",
  REJECT: "Reject",
};

export function statusForEditorialDecision(decision: EditorialDecision) {
  if (decision === EditorialDecision.ACCEPT) {
    return ManuscriptStatus.ACCEPTED;
  }

  if (decision === EditorialDecision.REJECT) {
    return ManuscriptStatus.REJECTED;
  }

  return ManuscriptStatus.REVISION_REQUESTED;
}

export function shouldStartReview({
  acceptedInvitationCount,
  status,
}: {
  acceptedInvitationCount: number;
  status: ManuscriptStatus;
}) {
  return (
    status === ManuscriptStatus.REVIEWERS_INVITED && acceptedInvitationCount > 0
  );
}

export function shouldCompleteReviews({
  requiredReviewCount,
  submittedReviewCount,
  status,
}: {
  requiredReviewCount: number;
  submittedReviewCount: number;
  status: ManuscriptStatus;
}) {
  return (
    status === ManuscriptStatus.UNDER_REVIEW &&
    submittedReviewCount >= requiredReviewCount
  );
}

export function reviewDeadlineState({
  dueDate,
  now = new Date(),
  status,
}: {
  dueDate?: Date | null;
  now?: Date;
  status: ReviewInvitationStatus;
}) {
  if (!dueDate || dueDate >= now) {
    return null;
  }

  if (status === ReviewInvitationStatus.PENDING) {
    return "overdue" as const;
  }

  if (status === ReviewInvitationStatus.ACCEPTED) {
    return "late" as const;
  }

  return null;
}
