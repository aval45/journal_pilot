import "server-only";

import {
  ManuscriptStatus,
  StatusChangeActorType,
  UserRole,
} from "@/generated/prisma/enums";
import { AccessDeniedError } from "@/lib/access-errors";
import {
  AUDIT_ACTIONS,
  writeAuditLogWithClient,
  type AuditLogDb,
  type AuditMetadata,
} from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type SystemAction =
  | "AUTO_REVIEW_STARTED"
  | "AUTO_REVIEWS_COMPLETED"
  | "AUTO_REVISION_RETURNED_TO_EDITOR"
  | "AUTO_INVITATION_EXPIRED";

export type TransitionActor =
  | { type: "USER"; userId: string }
  | { type: "SYSTEM"; systemAction: SystemAction };

export type UserRelationship =
  | "author"
  | "handlingEditor"
  | "admin"
  | "roleOnly";

export type TransitionPolicy =
  | {
      actorType: "USER";
      roles: UserRole[];
      relationship: UserRelationship;
      noteRequired?: boolean;
    }
  | {
      actorType: "SYSTEM";
      systemAction: SystemAction;
      noteRequired?: boolean;
    };

type QueryArgs = Record<string, unknown>;

export type StatusMachineDb = {
  manuscript: {
    findFirst: (
      args: QueryArgs,
    ) => Promise<{
      displayId?: string | null;
      id?: string;
      status: ManuscriptStatus;
    } | null>;
    update: (args: QueryArgs) => Promise<unknown>;
  };
  manuscriptAuthor: {
    findFirst: (args: QueryArgs) => Promise<{ id: string } | null>;
  };
  manuscriptStatusHistory: {
    create: (args: QueryArgs) => Promise<unknown>;
  };
  auditLog: {
    create: (args: {
      data: {
        action: string;
        actorType: "USER" | "SYSTEM" | "ANONYMOUS" | "EXTERNAL";
        actorUserId?: string | null;
        entityId?: string | null;
        entityType: string;
        ipHash?: string | null;
        metadata?: AuditMetadata | null;
        outcome: "SUCCESS" | "DENIED" | "ERROR";
        userAgentHash?: string | null;
      };
    }) => Promise<unknown>;
  };
  reviewInvitation: {
    findFirst: (args: QueryArgs) => Promise<{ id: string } | null>;
  };
  user: {
    findFirst: (
      args: QueryArgs,
    ) => Promise<{ id: string; roles: UserRole[] } | null>;
  };
};

export const ALLOWED_TRANSITIONS: Record<ManuscriptStatus, ManuscriptStatus[]> = {
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

export const TRANSITION_POLICIES: Record<string, TransitionPolicy> = {
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

export function transitionKey(
  fromStatus: ManuscriptStatus,
  toStatus: ManuscriptStatus,
) {
  return `${fromStatus}->${toStatus}`;
}

export function isTerminalStatus(status: ManuscriptStatus) {
  const terminalStatuses: ManuscriptStatus[] = [
    ManuscriptStatus.ACCEPTED,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.WITHDRAWN,
  ];

  return terminalStatuses.includes(status);
}

export function getTransitionPolicy(
  fromStatus: ManuscriptStatus,
  toStatus: ManuscriptStatus,
) {
  if (toStatus === ManuscriptStatus.WITHDRAWN && !isTerminalStatus(fromStatus)) {
    return {
      actorType: "USER",
      roles: [UserRole.AUTHOR],
      relationship: "author",
    } satisfies TransitionPolicy;
  }

  return TRANSITION_POLICIES[transitionKey(fromStatus, toStatus)] ?? null;
}

export function assertAllowedTransition(
  fromStatus: ManuscriptStatus,
  toStatus: ManuscriptStatus,
) {
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new AccessDeniedError("This status transition is not allowed.");
  }
}

function hasAnyRole(userRoles: UserRole[], allowedRoles: UserRole[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
}

async function getActiveUser(db: StatusMachineDb, userId: string) {
  const user = await db.user.findFirst({
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

async function assertAuthorRelationship(
  db: StatusMachineDb,
  userId: string,
  manuscriptId: string,
) {
  const manuscript = await db.manuscript.findFirst({
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

async function assertEditorRelationship(
  db: StatusMachineDb,
  userId: string,
  manuscriptId: string,
) {
  const manuscript = await db.manuscript.findFirst({
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

async function assertPolicyRelationship(
  db: StatusMachineDb,
  userId: string,
  manuscriptId: string,
  relationship: UserRelationship,
) {
  if (relationship === "roleOnly" || relationship === "admin") {
    return;
  }

  if (relationship === "author") {
    await assertAuthorRelationship(db, userId, manuscriptId);
    return;
  }

  await assertEditorRelationship(db, userId, manuscriptId);
}

export async function assertCanTransitionWithClient(
  db: StatusMachineDb,
  actor: TransitionActor,
  manuscriptId: string,
  toStatus: ManuscriptStatus,
) {
  const manuscript = await db.manuscript.findFirst({
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
  assertAllowedTransition(fromStatus, toStatus);

  const policy = getTransitionPolicy(fromStatus, toStatus);

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

  const user = await getActiveUser(db, actor.userId);

  if (!hasAnyRole(user.roles, policy.roles)) {
    throw new AccessDeniedError();
  }

  await assertPolicyRelationship(
    db,
    actor.userId,
    manuscriptId,
    policy.relationship,
  );
}

export async function assertCanTransition(
  actor: TransitionActor,
  manuscriptId: string,
  toStatus: ManuscriptStatus,
) {
  await assertCanTransitionWithClient(
    prisma as unknown as StatusMachineDb,
    actor,
    manuscriptId,
    toStatus,
  );
}

export async function transitionStatus({
  actor,
  displayId,
  manuscriptId,
  note,
  toStatus,
}: {
  actor: TransitionActor;
  displayId?: string;
  manuscriptId: string;
  note?: string;
  toStatus: ManuscriptStatus;
}) {
  return prisma.$transaction(async (tx) => {
    const manuscript = await tx.manuscript.findFirst({
      where: {
        id: manuscriptId,
        deletedAt: null,
      },
      select: {
        displayId: true,
        status: true,
      },
    });

    if (!manuscript) {
      throw new AccessDeniedError();
    }

    await assertCanTransitionWithClient(
      tx as unknown as StatusMachineDb,
      actor,
      manuscriptId,
      toStatus,
    );

    if (
      manuscript.status === ManuscriptStatus.DRAFT &&
      toStatus === ManuscriptStatus.SUBMITTED &&
      !displayId &&
      !manuscript.displayId
    ) {
      throw new Error("Submitted manuscripts must have a displayId.");
    }

    const updated = await tx.manuscript.update({
      where: { id: manuscriptId },
      data: {
        status: toStatus,
        ...(displayId ? { displayId } : {}),
        ...(toStatus === ManuscriptStatus.SUBMITTED
          ? { submittedAt: new Date() }
          : {}),
        ...(toStatus === ManuscriptStatus.WITHDRAWN
          ? { withdrawnAt: new Date() }
          : {}),
      },
    });

    await tx.manuscriptStatusHistory.create({
      data: {
        manuscriptId,
        fromStatus: manuscript.status,
        toStatus,
        actorType:
          actor.type === "USER"
            ? StatusChangeActorType.USER
            : StatusChangeActorType.SYSTEM,
        changedById: actor.type === "USER" ? actor.userId : null,
        systemAction: actor.type === "SYSTEM" ? actor.systemAction : null,
        note,
      },
    });

    const auditAction =
      toStatus === ManuscriptStatus.SUBMITTED
        ? AUDIT_ACTIONS.MANUSCRIPT_SUBMITTED
        : toStatus === ManuscriptStatus.WITHDRAWN
          ? AUDIT_ACTIONS.MANUSCRIPT_WITHDRAWN
          : "MANUSCRIPT_STATUS_CHANGED";

    await writeAuditLogWithClient(tx as unknown as AuditLogDb, {
      action: auditAction,
      actorType: actor.type === "USER" ? "USER" : "SYSTEM",
      actorUserId: actor.type === "USER" ? actor.userId : null,
      entityId: manuscriptId,
      entityType: "Manuscript",
      metadata: {
        fromStatus: manuscript.status,
        toStatus,
      },
    });

    return updated;
  });
}
