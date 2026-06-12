import "server-only";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export class AccessDeniedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

type TransitionActor =
  | { type: "USER"; userId: string }
  | { type: "SYSTEM"; systemAction: SystemAction };

type SystemAction =
  | "AUTO_REVIEW_STARTED"
  | "AUTO_REVIEWS_COMPLETED"
  | "AUTO_REVISION_RETURNED_TO_EDITOR"
  | "AUTO_INVITATION_EXPIRED";

type UserRelationship =
  | "author"
  | "handlingEditor"
  | "admin"
  | "roleOnly";

type TransitionPolicy =
  | {
      actorType: "USER";
      roles: UserRole[];
      relationship: UserRelationship;
    }
  | {
      actorType: "SYSTEM";
      systemAction: SystemAction;
    };

const ALLOWED_TRANSITIONS: Record<ManuscriptStatus, ManuscriptStatus[]> = {
  DRAFT: [ManuscriptStatus.SUBMITTED, ManuscriptStatus.WITHDRAWN],
  SUBMITTED: [ManuscriptStatus.INITIAL_CHECK, ManuscriptStatus.WITHDRAWN],
  INITIAL_CHECK: [
    ManuscriptStatus.WITH_EDITOR,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.WITHDRAWN,
  ],
  WITH_EDITOR: [
    ManuscriptStatus.REVIEWERS_INVITED,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.WITHDRAWN,
  ],
  REVIEWERS_INVITED: [ManuscriptStatus.UNDER_REVIEW, ManuscriptStatus.WITHDRAWN],
  UNDER_REVIEW: [ManuscriptStatus.REVIEWS_COMPLETED, ManuscriptStatus.WITHDRAWN],
  REVIEWS_COMPLETED: [ManuscriptStatus.DECISION_IN_PROCESS],
  DECISION_IN_PROCESS: [
    ManuscriptStatus.ACCEPTED,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.REVISION_REQUESTED,
  ],
  REVISION_REQUESTED: [
    ManuscriptStatus.REVISION_SUBMITTED,
    ManuscriptStatus.WITHDRAWN,
  ],
  REVISION_SUBMITTED: [ManuscriptStatus.WITH_EDITOR],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const TRANSITION_POLICIES: Record<string, TransitionPolicy> = {
  "DRAFT->SUBMITTED": {
    actorType: "USER",
    roles: [UserRole.AUTHOR],
    relationship: "author",
  },
  "SUBMITTED->INITIAL_CHECK": {
    actorType: "USER",
    roles: [UserRole.EDITOR, UserRole.ADMIN],
    relationship: "roleOnly",
  },
  "INITIAL_CHECK->WITH_EDITOR": {
    actorType: "USER",
    roles: [UserRole.ADMIN],
    relationship: "admin",
  },
  "INITIAL_CHECK->REJECTED": {
    actorType: "USER",
    roles: [UserRole.EDITOR, UserRole.ADMIN],
    relationship: "roleOnly",
  },
  "WITH_EDITOR->REVIEWERS_INVITED": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "WITH_EDITOR->REJECTED": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "REVIEWERS_INVITED->UNDER_REVIEW": {
    actorType: "SYSTEM",
    systemAction: "AUTO_REVIEW_STARTED",
  },
  "UNDER_REVIEW->REVIEWS_COMPLETED": {
    actorType: "SYSTEM",
    systemAction: "AUTO_REVIEWS_COMPLETED",
  },
  "REVIEWS_COMPLETED->DECISION_IN_PROCESS": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "DECISION_IN_PROCESS->ACCEPTED": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "DECISION_IN_PROCESS->REJECTED": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "DECISION_IN_PROCESS->REVISION_REQUESTED": {
    actorType: "USER",
    roles: [UserRole.EDITOR],
    relationship: "handlingEditor",
  },
  "REVISION_REQUESTED->REVISION_SUBMITTED": {
    actorType: "USER",
    roles: [UserRole.AUTHOR],
    relationship: "author",
  },
  "REVISION_SUBMITTED->WITH_EDITOR": {
    actorType: "SYSTEM",
    systemAction: "AUTO_REVISION_RETURNED_TO_EDITOR",
  },
};

function transitionKey(fromStatus: ManuscriptStatus, toStatus: ManuscriptStatus) {
  return `${fromStatus}->${toStatus}`;
}

function isTerminalStatus(status: ManuscriptStatus) {
  const terminalStatuses: ManuscriptStatus[] = [
    ManuscriptStatus.ACCEPTED,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.WITHDRAWN,
  ];

  return terminalStatuses.includes(status);
}

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

function hasAnyRole(userRoles: UserRole[], allowedRoles: UserRole[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
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

async function assertRelationship(
  userId: string,
  manuscriptId: string,
  relationship: UserRelationship,
) {
  if (relationship === "roleOnly") {
    return;
  }

  if (relationship === "author") {
    await assertAuthorOf(userId, manuscriptId);
    return;
  }

  if (relationship === "handlingEditor") {
    await assertEditorOf(userId, manuscriptId);
    return;
  }

  if (relationship === "admin") {
    await assertHasRole(userId, UserRole.ADMIN);
    return;
  }
}

export async function assertCanTransition(
  actor: TransitionActor,
  manuscriptId: string,
  toStatus: ManuscriptStatus,
) {
  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!manuscript) {
    throw new AccessDeniedError();
  }

  const fromStatus = manuscript.status;
  const allowedTargets = ALLOWED_TRANSITIONS[fromStatus];

  if (!allowedTargets.includes(toStatus)) {
    throw new AccessDeniedError("This status transition is not allowed.");
  }

  const policy =
    toStatus === ManuscriptStatus.WITHDRAWN && !isTerminalStatus(fromStatus)
      ? ({
          actorType: "USER",
          roles: [UserRole.AUTHOR],
          relationship: "author",
        } satisfies TransitionPolicy)
      : TRANSITION_POLICIES[transitionKey(fromStatus, toStatus)];

  if (!policy) {
    throw new AccessDeniedError("This status transition is not configured.");
  }

  if (policy.actorType === "SYSTEM") {
    if (actor.type !== "SYSTEM" || actor.systemAction !== policy.systemAction) {
      throw new AccessDeniedError();
    }

    return;
  }

  if (actor.type !== "USER") {
    throw new AccessDeniedError();
  }

  const user = await getActiveUser(actor.userId);

  if (!hasAnyRole(user.roles, policy.roles)) {
    throw new AccessDeniedError();
  }

  await assertRelationship(actor.userId, manuscriptId, policy.relationship);
}
