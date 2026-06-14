import "server-only";

import {
  ManuscriptStatus,
  UserRole,
} from "@/generated/prisma/enums";
import type { UserModel } from "@/generated/prisma/models";
import { AccessDeniedError } from "@/lib/access-errors";
import { reviewDeadlineState } from "@/lib/editor-workflow";
import { prisma } from "@/lib/prisma";

export type EditorDashboardData = Awaited<
  ReturnType<typeof getEditorDashboardData>
>;

export type EditorManuscriptDetail = NonNullable<
  Awaited<ReturnType<typeof getEditorManuscriptDetail>>
>;

const ACTIVE_MANUSCRIPT_WHERE = {
  archivedAt: null,
  deletedAt: null,
} as const;

const EDITOR_VISIBLE_UNASSIGNED_STATUSES = [
  ManuscriptStatus.SUBMITTED,
  ManuscriptStatus.INITIAL_CHECK,
] as const;

const PENDING_DECISION_STATUSES: ManuscriptStatus[] = [
  ManuscriptStatus.REVIEWS_COMPLETED,
  ManuscriptStatus.DECISION_IN_PROCESS,
];

function canUseEditorWorkspace(user: Pick<UserModel, "roles">) {
  return user.roles.includes(UserRole.EDITOR) || user.roles.includes(UserRole.ADMIN);
}

function manuscriptAccessWhere(user: Pick<UserModel, "id" | "roles">) {
  if (user.roles.includes(UserRole.ADMIN)) {
    return ACTIVE_MANUSCRIPT_WHERE;
  }

  if (!canUseEditorWorkspace(user)) {
    throw new AccessDeniedError();
  }

  return {
    ...ACTIVE_MANUSCRIPT_WHERE,
    OR: [
      { handlingEditorId: user.id },
      {
        handlingEditorId: null,
        status: { in: [...EDITOR_VISIBLE_UNASSIGNED_STATUSES] },
      },
    ],
  };
}

export async function getEditorDashboardData(
  user: Pick<UserModel, "id" | "roles">,
) {
  const where = manuscriptAccessWhere(user);
  const now = new Date();

  const [manuscripts, editors, reviewers] = await Promise.all([
    prisma.manuscript.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        displayId: true,
        requiredReviewCount: true,
        revisionNumber: true,
        status: true,
        submittedAt: true,
        title: true,
        updatedAt: true,
        articleType: {
          select: {
            name: true,
          },
        },
        handlingEditor: {
          select: {
            id: true,
            name: true,
          },
        },
        invitations: {
          where: {
            deletedAt: null,
          },
          orderBy: { dueDate: "asc" },
          select: {
            dueDate: true,
            id: true,
            revisionNumber: true,
            status: true,
            review: {
              select: {
                id: true,
              },
            },
          },
        },
        journal: {
          select: {
            name: true,
          },
        },
        reviews: {
          select: {
            id: true,
            revisionNumber: true,
          },
        },
        submittingAuthor: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        roles: {
          has: UserRole.EDITOR,
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        roles: {
          has: UserRole.REVIEWER,
        },
      },
      orderBy: { name: "asc" },
      select: {
        email: true,
        id: true,
        name: true,
        profile: {
          select: {
            expertise: true,
          },
        },
      },
    }),
  ]);

  const enrichedManuscripts = manuscripts.map((manuscript) => {
    const currentInvitations = manuscript.invitations.filter(
      (invitation) => invitation.revisionNumber === manuscript.revisionNumber,
    );
    const currentReviewCount = manuscript.reviews.filter(
      (review) => review.revisionNumber === manuscript.revisionNumber,
    ).length;
    const overdueCount = currentInvitations.filter(
      (invitation) =>
        reviewDeadlineState({
          dueDate: invitation.dueDate,
          now,
          status: invitation.status,
        }) !== null,
    ).length;

    return {
      ...manuscript,
      currentInvitationCount: currentInvitations.length,
      currentReviewCount,
      overdueCount,
    };
  });

  return {
    editors,
    manuscripts: enrichedManuscripts,
    metrics: {
      newSubmissions: enrichedManuscripts.filter(
        (manuscript) => manuscript.status === ManuscriptStatus.SUBMITTED,
      ).length,
      overdueReviews: enrichedManuscripts.reduce(
        (total, manuscript) => total + manuscript.overdueCount,
        0,
      ),
      pendingDecisions: enrichedManuscripts.filter((manuscript) =>
        PENDING_DECISION_STATUSES.includes(manuscript.status),
      ).length,
      totalVisible: enrichedManuscripts.length,
    },
    reviewers,
  };
}

export async function getEditorManuscriptDetail({
  manuscriptId,
  user,
}: {
  manuscriptId: string;
  user: Pick<UserModel, "id" | "roles">;
}) {
  const where = manuscriptAccessWhere(user);
  const manuscript = await prisma.manuscript.findFirst({
    where: {
      ...where,
      id: manuscriptId,
    },
    select: {
      abstract: true,
      coverLetter: true,
      decisionAt: true,
      displayId: true,
      id: true,
      keywords: true,
      requiredReviewCount: true,
      revisionNumber: true,
      status: true,
      submittedAt: true,
      title: true,
      updatedAt: true,
      articleType: {
        select: {
          name: true,
        },
      },
      authors: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        select: {
          affiliation: true,
          email: true,
          id: true,
          isPrimary: true,
          name: true,
          order: true,
          userId: true,
        },
      },
      decisions: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          decision: true,
          decisionLetter: true,
          id: true,
          revisionNumber: true,
        },
      },
      files: {
        where: {
          deletedAt: null,
          storagePurgedAt: null,
        },
        orderBy: { uploadedAt: "desc" },
        select: {
          fileCategory: true,
          fileName: true,
          fileSize: true,
          id: true,
          mimeType: true,
          revisionNumber: true,
          uploadedAt: true,
        },
      },
      handlingEditor: {
        select: {
          id: true,
          name: true,
        },
      },
      invitations: {
        where: {
          deletedAt: null,
        },
        orderBy: { invitedAt: "desc" },
        select: {
          dueDate: true,
          id: true,
          invitedAt: true,
          respondedAt: true,
          revisionNumber: true,
          status: true,
          review: {
            select: {
              id: true,
              recommendation: true,
              submittedAt: true,
            },
          },
          reviewer: {
            select: {
              email: true,
              id: true,
              name: true,
            },
          },
        },
      },
      journal: {
        select: {
          name: true,
        },
      },
      reviews: {
        select: {
          id: true,
          recommendation: true,
          revisionNumber: true,
          submittedAt: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          createdAt: true,
          fromStatus: true,
          id: true,
          note: true,
          systemAction: true,
          toStatus: true,
        },
      },
      submittingAuthor: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return manuscript;
}
