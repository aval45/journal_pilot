"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AuditActorType,
  EditorialDecision,
  ManuscriptStatus,
  UserRole,
} from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { ActionInputError, withActionErrorHandling } from "@/lib/actions/utils";
import {
  AUDIT_ACTIONS,
  writeAuditLogWithClient,
  type AuditLogDb,
} from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { statusForEditorialDecision } from "@/lib/editor-workflow";
import { prisma } from "@/lib/prisma";
import { assertHasRole } from "@/lib/permissions";
import {
  assertServerActionRateLimit,
  RATE_LIMIT_SUBJECTS,
} from "@/lib/rate-limit";
import { refreshReviewProgressWithClient } from "@/lib/review-progress";
import {
  transitionStatusWithClient,
  type StatusMachineDb,
} from "@/lib/status-machine";

export type EditorActionState = ActionResult<{ message: string }>;

const initialCheckSchema = z.object({
  manuscriptId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

const assignEditorSchema = z.object({
  editorId: z.string().min(1),
  manuscriptId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

const reviewerInvitationSchema = z.object({
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid due date."),
  manuscriptId: z.string().min(1),
  reviewerId: z.string().min(1),
});

const refreshProgressSchema = z.object({
  manuscriptId: z.string().min(1),
});

const editorialDecisionSchema = z.object({
  decision: z.enum(EditorialDecision),
  decisionLetter: z.string().trim().min(1).max(20_000),
  manuscriptId: z.string().min(1),
});

type EditorWorkflowDb = StatusMachineDb &
  AuditLogDb & {
    editorDecision: {
      create: (args: Record<string, unknown>) => Promise<unknown>;
    };
    manuscript: StatusMachineDb["manuscript"] & {
      update: (args: Record<string, unknown>) => Promise<unknown>;
    };
    review: {
      count: (args: Record<string, unknown>) => Promise<number>;
    };
    reviewInvitation: StatusMachineDb["reviewInvitation"] & {
      count: (args: Record<string, unknown>) => Promise<number>;
      create: (args: Record<string, unknown>) => Promise<unknown>;
      findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
    };
  };

const SUCCESS = (message: string): EditorActionState => ({
  success: true,
  data: { message },
});

const failure = (message: string): EditorActionState => ({
  success: false,
  error: message,
});

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateEditorPaths(manuscriptId: string) {
  revalidatePath("/dashboard/editor");
  revalidatePath(`/dashboard/editor/manuscripts/${manuscriptId}`);
}

async function limitEditorAction({
  manuscriptId,
  subject,
  userId,
}: {
  manuscriptId: string;
  subject: typeof RATE_LIMIT_SUBJECTS[keyof typeof RATE_LIMIT_SUBJECTS];
  userId: string;
}) {
  await assertServerActionRateLimit({
    actorType: AuditActorType.USER,
    actorUserId: userId,
    manuscriptId,
    subject,
    userId,
  });
}

export async function startInitialCheckAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  return withActionErrorHandling(async () => {
    const parsed = initialCheckSchema.safeParse({
      manuscriptId: getString(formData, "manuscriptId"),
      note: getString(formData, "note"),
    });

    if (!parsed.success) {
      return failure("Choose a valid manuscript.");
    }

    const user = await requireAuth();
    await limitEditorAction({
      manuscriptId: parsed.data.manuscriptId,
      subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE,
      userId: user.id,
    });

    await prisma.$transaction((tx) =>
      transitionStatusWithClient(tx as unknown as StatusMachineDb & AuditLogDb, {
        actor: { type: "USER", userId: user.id },
        manuscriptId: parsed.data.manuscriptId,
        note: parsed.data.note || "Initial editorial check started.",
        toStatus: ManuscriptStatus.INITIAL_CHECK,
      }),
    );

    revalidateEditorPaths(parsed.data.manuscriptId);
    return SUCCESS("Initial check started.");
  });
}

export async function assignHandlingEditorAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  return withActionErrorHandling(async () => {
    const parsed = assignEditorSchema.safeParse({
      editorId: getString(formData, "editorId"),
      manuscriptId: getString(formData, "manuscriptId"),
      note: getString(formData, "note"),
    });

    if (!parsed.success) {
      return failure("Choose a valid editor and manuscript.");
    }

    const user = await requireAuth();
    await Promise.all([
      limitEditorAction({
        manuscriptId: parsed.data.manuscriptId,
        subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE,
        userId: user.id,
      }),
      assertHasRole(user.id, UserRole.ADMIN),
    ]);

    await prisma.$transaction(async (tx) => {
      const editor = await tx.user.findFirst({
        where: {
          deactivatedAt: null,
          id: parsed.data.editorId,
          roles: { has: UserRole.EDITOR },
        },
        select: { id: true },
      });

      if (!editor) {
        throw new ActionInputError("Choose an active editor.");
      }

      const manuscript = await tx.manuscript.findFirst({
        where: {
          deletedAt: null,
          id: parsed.data.manuscriptId,
          status: ManuscriptStatus.INITIAL_CHECK,
        },
        select: { id: true },
      });

      if (!manuscript) {
        throw new ActionInputError(
          "Only manuscripts in initial check can be assigned.",
        );
      }

      await tx.manuscript.update({
        where: { id: parsed.data.manuscriptId },
        data: { handlingEditorId: parsed.data.editorId },
      });

      await transitionStatusWithClient(tx as unknown as StatusMachineDb & AuditLogDb, {
        actor: { type: "USER", userId: user.id },
        manuscriptId: parsed.data.manuscriptId,
        note: parsed.data.note || "Handling editor assigned.",
        toStatus: ManuscriptStatus.WITH_EDITOR,
      });
    });

    revalidateEditorPaths(parsed.data.manuscriptId);
    return SUCCESS("Handling editor assigned.");
  });
}

export async function inviteReviewerAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  return withActionErrorHandling(async () => {
    const parsed = reviewerInvitationSchema.safeParse({
      dueDate: getString(formData, "dueDate"),
      manuscriptId: getString(formData, "manuscriptId"),
      reviewerId: getString(formData, "reviewerId"),
    });

    if (!parsed.success) {
      return failure("Choose a reviewer and due date.");
    }

    const user = await requireAuth();
    await limitEditorAction({
      manuscriptId: parsed.data.manuscriptId,
      subject: RATE_LIMIT_SUBJECTS.REVIEWER_INVITATION_SEND,
      userId: user.id,
    });

    const dueDate = new Date(`${parsed.data.dueDate}T23:59:59.999Z`);

    await prisma.$transaction(async (tx) => {
      const manuscript = await tx.manuscript.findFirst({
        where: {
          deletedAt: null,
          id: parsed.data.manuscriptId,
          handlingEditorId: user.id,
          status: {
            in: [
              ManuscriptStatus.WITH_EDITOR,
              ManuscriptStatus.REVIEWERS_INVITED,
              ManuscriptStatus.UNDER_REVIEW,
            ],
          },
        },
        select: {
          revisionNumber: true,
          status: true,
          authors: {
            where: { deletedAt: null },
            select: {
              email: true,
              userId: true,
            },
          },
        },
      });

      if (!manuscript) {
        throw new ActionInputError(
          "Only the handling editor can invite reviewers.",
        );
      }

      if (parsed.data.reviewerId === user.id) {
        throw new ActionInputError(
          "Editors cannot invite themselves as reviewers.",
        );
      }

      const reviewer = await tx.user.findFirst({
        where: {
          deactivatedAt: null,
          id: parsed.data.reviewerId,
          roles: { has: UserRole.REVIEWER },
        },
        select: {
          email: true,
          id: true,
        },
      });

      if (!reviewer) {
        throw new ActionInputError("Choose an active reviewer.");
      }

      const reviewerEmail = reviewer.email.toLowerCase();
      const hasConflict = manuscript.authors.some(
        (author) =>
          author.userId === reviewer.id ||
          author.email.toLowerCase() === reviewerEmail,
      );

      if (hasConflict) {
        throw new ActionInputError(
          "This reviewer has a conflict with the author list.",
        );
      }

      const existingInvitation = await tx.reviewInvitation.findFirst({
        where: {
          deletedAt: null,
          manuscriptId: parsed.data.manuscriptId,
          reviewerId: parsed.data.reviewerId,
          revisionNumber: manuscript.revisionNumber,
        },
        select: { id: true },
      });

      if (existingInvitation) {
        throw new ActionInputError(
          "This reviewer is already invited for this revision.",
        );
      }

      await tx.reviewInvitation.create({
        data: {
          dueDate,
          invitedById: user.id,
          manuscriptId: parsed.data.manuscriptId,
          reviewerId: parsed.data.reviewerId,
          revisionNumber: manuscript.revisionNumber,
        },
      });

      await writeAuditLogWithClient(tx as unknown as AuditLogDb, {
        action: AUDIT_ACTIONS.REVIEW_INVITATION_CREATED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        entityId: parsed.data.manuscriptId,
        entityType: "Manuscript",
        metadata: {
          revisionNumber: manuscript.revisionNumber,
          reviewerId: parsed.data.reviewerId,
        },
      });

      if (manuscript.status === ManuscriptStatus.WITH_EDITOR) {
        await transitionStatusWithClient(
          tx as unknown as StatusMachineDb & AuditLogDb,
          {
            actor: { type: "USER", userId: user.id },
            manuscriptId: parsed.data.manuscriptId,
            note: "Reviewer invited.",
            toStatus: ManuscriptStatus.REVIEWERS_INVITED,
          },
        );
      }
    });

    revalidateEditorPaths(parsed.data.manuscriptId);
    return SUCCESS("Reviewer invitation created.");
  });
}

export async function refreshReviewProgressAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  return withActionErrorHandling(async () => {
    const parsed = refreshProgressSchema.safeParse({
      manuscriptId: getString(formData, "manuscriptId"),
    });

    if (!parsed.success) {
      return failure("Choose a valid manuscript.");
    }

    const user = await requireAuth();
    await Promise.all([
      limitEditorAction({
        manuscriptId: parsed.data.manuscriptId,
        subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE,
        userId: user.id,
      }),
      assertHasRole(user.id, UserRole.EDITOR),
    ]);

    await prisma.$transaction(async (tx) => {
      const manuscript = await tx.manuscript.findFirst({
        where: {
          deletedAt: null,
          handlingEditorId: user.id,
          id: parsed.data.manuscriptId,
          status: {
            in: [
              ManuscriptStatus.REVIEWERS_INVITED,
              ManuscriptStatus.UNDER_REVIEW,
            ],
          },
        },
        select: { id: true },
      });

      if (!manuscript) {
        throw new ActionInputError(
          "Only the handling editor can refresh review progress.",
        );
      }

      await refreshReviewProgressWithClient(
        tx as unknown as EditorWorkflowDb,
        parsed.data.manuscriptId,
      );
    });

    revalidateEditorPaths(parsed.data.manuscriptId);
    return SUCCESS("Review progress refreshed.");
  });
}

export async function createEditorialDecisionAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  return withActionErrorHandling(async () => {
    const parsed = editorialDecisionSchema.safeParse({
      decision: getString(formData, "decision"),
      decisionLetter: getString(formData, "decisionLetter"),
      manuscriptId: getString(formData, "manuscriptId"),
    });

    if (!parsed.success) {
      return failure("Choose a decision and enter a decision letter.");
    }

    const user = await requireAuth();
    await limitEditorAction({
      manuscriptId: parsed.data.manuscriptId,
      subject: RATE_LIMIT_SUBJECTS.EDITOR_DECISION_CREATE,
      userId: user.id,
    });

    const targetStatus = statusForEditorialDecision(parsed.data.decision);
    const decidedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const manuscript = await tx.manuscript.findFirst({
        where: {
          deletedAt: null,
          handlingEditorId: user.id,
          id: parsed.data.manuscriptId,
          status: {
            in: [
              ManuscriptStatus.REVIEWS_COMPLETED,
              ManuscriptStatus.DECISION_IN_PROCESS,
            ],
          },
        },
        select: {
          revisionNumber: true,
          status: true,
        },
      });

      if (!manuscript) {
        throw new ActionInputError(
          "Only the handling editor can decide this manuscript.",
        );
      }

      if (manuscript.status === ManuscriptStatus.REVIEWS_COMPLETED) {
        await transitionStatusWithClient(
          tx as unknown as StatusMachineDb & AuditLogDb,
          {
            actor: { type: "USER", userId: user.id },
            manuscriptId: parsed.data.manuscriptId,
            note: "Decision drafting started.",
            toStatus: ManuscriptStatus.DECISION_IN_PROCESS,
          },
        );
      }

      await tx.editorDecision.create({
        data: {
          decision: parsed.data.decision,
          decisionLetter: parsed.data.decisionLetter,
          editorId: user.id,
          manuscriptId: parsed.data.manuscriptId,
          revisionNumber: manuscript.revisionNumber,
        },
      });

      await transitionStatusWithClient(tx as unknown as StatusMachineDb & AuditLogDb, {
        actor: { type: "USER", userId: user.id },
        manuscriptId: parsed.data.manuscriptId,
        note: `Editorial decision: ${parsed.data.decision.replaceAll("_", " ").toLowerCase()}.`,
        toStatus: targetStatus,
      });

      await tx.manuscript.update({
        where: { id: parsed.data.manuscriptId },
        data: { decisionAt: decidedAt },
      });

      await writeAuditLogWithClient(tx as unknown as AuditLogDb, {
        action: AUDIT_ACTIONS.EDITOR_DECISION_CREATED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        entityId: parsed.data.manuscriptId,
        entityType: "Manuscript",
        metadata: {
          decision: parsed.data.decision,
          revisionNumber: manuscript.revisionNumber,
          toStatus: targetStatus,
        },
      });
    });

    revalidateEditorPaths(parsed.data.manuscriptId);
    revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);
    return SUCCESS("Editorial decision saved.");
  });
}
