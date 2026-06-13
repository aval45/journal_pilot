import "server-only";

import { UserRole } from "@/generated/prisma/enums";
import { AccessDeniedError } from "@/lib/access-errors";
import { prisma } from "@/lib/prisma";
export { assertCanTransition } from "@/lib/status-machine";

async function getActiveUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deactivatedAt: null,
    },
  });

  if (!user) {
    throw new AccessDeniedError();
  }

  return user;
}

export async function assertHasRole(userId: string, role: UserRole) {
  const user = await getActiveUser(userId);

  if (!user.roles.includes(role)) {
    throw new AccessDeniedError();
  }
}

export async function assertAuthorOf(userId: string, manuscriptId: string) {
  await assertHasRole(userId, UserRole.AUTHOR);

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
      OR: [
        { submittingAuthorId: userId },
        {
          authors: {
            some: {
              userId,
              deletedAt: null,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!manuscript) {
    throw new AccessDeniedError();
  }
}

export async function assertEditorOf(userId: string, manuscriptId: string) {
  await assertHasRole(userId, UserRole.EDITOR);

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
      handlingEditorId: userId,
    },
    select: { id: true },
  });

  if (!manuscript) {
    throw new AccessDeniedError();
  }
}

export async function assertReviewerOf(userId: string, manuscriptId: string) {
  await assertHasRole(userId, UserRole.REVIEWER);

  const invitation = await prisma.reviewInvitation.findFirst({
    where: {
      manuscriptId,
      reviewerId: userId,
      deletedAt: null,
      status: "ACCEPTED",
    },
    select: { id: true },
  });

  if (!invitation) {
    throw new AccessDeniedError();
  }
}
