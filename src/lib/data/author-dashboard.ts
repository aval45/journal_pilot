import "server-only";

import { ManuscriptStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type AuthorDashboardData = Awaited<
  ReturnType<typeof getAuthorDashboardData>
>;

const ACTIVE_MANUSCRIPT_WHERE = {
  archivedAt: null,
  deletedAt: null,
} as const;

export async function getAuthorDashboardData(userId: string) {
  const [statusGroups, recentManuscripts, revisionRequests] =
    await Promise.all([
      prisma.manuscript.groupBy({
        by: ["status"],
        where: {
          ...ACTIVE_MANUSCRIPT_WHERE,
          submittingAuthorId: userId,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.manuscript.findMany({
        where: {
          ...ACTIVE_MANUSCRIPT_WHERE,
          submittingAuthorId: userId,
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          displayId: true,
          title: true,
          status: true,
          revisionNumber: true,
          updatedAt: true,
          journal: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.manuscript.findMany({
        where: {
          ...ACTIVE_MANUSCRIPT_WHERE,
          status: ManuscriptStatus.REVISION_REQUESTED,
          submittingAuthorId: userId,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          displayId: true,
          title: true,
          revisionNumber: true,
          updatedAt: true,
          decisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              decision: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

  const countsByStatus = Object.fromEntries(
    Object.values(ManuscriptStatus).map((status) => [status, 0]),
  ) as Record<ManuscriptStatus, number>;

  for (const group of statusGroups) {
    countsByStatus[group.status] = group._count._all;
  }

  return {
    counts: {
      active:
        countsByStatus.SUBMITTED +
        countsByStatus.INITIAL_CHECK +
        countsByStatus.WITH_EDITOR +
        countsByStatus.REVIEWERS_INVITED +
        countsByStatus.UNDER_REVIEW +
        countsByStatus.REVIEWS_COMPLETED +
        countsByStatus.DECISION_IN_PROCESS +
        countsByStatus.REVISION_SUBMITTED,
      accepted: countsByStatus.ACCEPTED,
      drafts: countsByStatus.DRAFT,
      revisionRequests: countsByStatus.REVISION_REQUESTED,
      submitted: countsByStatus.SUBMITTED,
      total: Object.values(countsByStatus).reduce(
        (total, count) => total + count,
        0,
      ),
      withdrawn: countsByStatus.WITHDRAWN,
    },
    recentManuscripts,
    revisionRequests,
  };
}
