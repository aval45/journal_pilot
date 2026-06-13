import "server-only";

import { prisma } from "@/lib/prisma";

export type AuthorManuscriptDetail = NonNullable<
  Awaited<ReturnType<typeof getAuthorManuscriptDetail>>
>;

export async function getAuthorManuscriptDetail({
  manuscriptId,
  userId,
}: {
  manuscriptId: string;
  userId: string;
}) {
  return prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
      OR: [
        { submittingAuthorId: userId },
        {
          authors: {
            some: {
              deletedAt: null,
              userId,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      abstract: true,
      displayId: true,
      keywords: true,
      revisionNumber: true,
      status: true,
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
          id: true,
          affiliation: true,
          email: true,
          isPrimary: true,
          name: true,
          order: true,
          userId: true,
        },
      },
      files: {
        where: {
          deletedAt: null,
          storagePurgedAt: null,
        },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          fileCategory: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          revisionNumber: true,
          uploadedAt: true,
        },
      },
      journal: {
        select: {
          name: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          fromStatus: true,
          note: true,
          toStatus: true,
        },
      },
    },
  });
}
