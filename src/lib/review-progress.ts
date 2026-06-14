import "server-only";

import {
  ManuscriptStatus,
  ReviewInvitationStatus,
} from "@/generated/prisma/enums";
import {
  shouldCompleteReviews,
  shouldStartReview,
} from "@/lib/editor-workflow";
import { prisma } from "@/lib/prisma";
import {
  transitionStatusWithClient,
  type StatusMachineDb,
} from "@/lib/status-machine";
import type { AuditLogDb } from "@/lib/audit";

type ReviewProgressDb = StatusMachineDb &
  AuditLogDb & {
    review: {
      count: (args: Record<string, unknown>) => Promise<number>;
    };
    reviewInvitation: StatusMachineDb["reviewInvitation"] & {
      count: (args: Record<string, unknown>) => Promise<number>;
    };
  };

async function getProgressManuscript(db: ReviewProgressDb, manuscriptId: string) {
  return db.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
    },
    select: {
      id: true,
      requiredReviewCount: true,
      revisionNumber: true,
      status: true,
    },
  }) as Promise<{
    id: string;
    requiredReviewCount: number;
    revisionNumber: number;
    status: ManuscriptStatus;
  } | null>;
}

export async function refreshReviewProgressWithClient(
  db: ReviewProgressDb,
  manuscriptId: string,
) {
  let manuscript = await getProgressManuscript(db, manuscriptId);

  if (!manuscript) {
    return null;
  }

  const acceptedInvitationCount = await db.reviewInvitation.count({
    where: {
      deletedAt: null,
      manuscriptId,
      revisionNumber: manuscript.revisionNumber,
      status: ReviewInvitationStatus.ACCEPTED,
    },
  });

  if (
    shouldStartReview({
      acceptedInvitationCount,
      status: manuscript.status,
    })
  ) {
    await transitionStatusWithClient(db, {
      actor: { type: "SYSTEM", systemAction: "AUTO_REVIEW_STARTED" },
      manuscriptId,
      toStatus: ManuscriptStatus.UNDER_REVIEW,
    });
    manuscript = await getProgressManuscript(db, manuscriptId);
  }

  if (!manuscript) {
    return null;
  }

  const submittedReviewCount = await db.review.count({
    where: {
      manuscriptId,
      revisionNumber: manuscript.revisionNumber,
    },
  });

  if (
    shouldCompleteReviews({
      requiredReviewCount: manuscript.requiredReviewCount,
      status: manuscript.status,
      submittedReviewCount,
    })
  ) {
    await transitionStatusWithClient(db, {
      actor: { type: "SYSTEM", systemAction: "AUTO_REVIEWS_COMPLETED" },
      manuscriptId,
      toStatus: ManuscriptStatus.REVIEWS_COMPLETED,
    });
  }

  return {
    acceptedInvitationCount,
    submittedReviewCount,
  };
}

export async function refreshReviewProgress(manuscriptId: string) {
  return prisma.$transaction((tx) =>
    refreshReviewProgressWithClient(
      tx as unknown as ReviewProgressDb,
      manuscriptId,
    ),
  );
}
