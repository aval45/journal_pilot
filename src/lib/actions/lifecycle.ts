"use server";

import { z } from "zod";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { withActionErrorHandling } from "@/lib/actions/utils";
import { AUDIT_ACTIONS, tryWriteAuditLog, type AuditLogDb } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAuthorOf, assertHasRole } from "@/lib/permissions";
import {
  assertServerActionRateLimit,
  RATE_LIMIT_SUBJECTS,
} from "@/lib/rate-limit";
import {
  transitionStatusWithClient,
  type StatusMachineDb,
} from "@/lib/status-machine";

const lifecycleSchema = z.object({
  manuscriptId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

function safeError(message: string): ActionResult {
  return { success: false, error: message };
}

function isTerminalStatus(status: ManuscriptStatus) {
  const terminalStatuses: ManuscriptStatus[] = [
    ManuscriptStatus.ACCEPTED,
    ManuscriptStatus.REJECTED,
    ManuscriptStatus.WITHDRAWN,
  ];

  return terminalStatuses.includes(status);
}

async function limitManuscriptLifecycle(userId: string, manuscriptId: string) {
  await assertServerActionRateLimit({
    actorType: "USER",
    actorUserId: userId,
    manuscriptId,
    subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE,
    userId,
  });
}

export async function softDeleteDraftManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = lifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return safeError("Choose a valid manuscript.");
    }

    await limitManuscriptLifecycle(user.id, parsed.data.manuscriptId);
    await assertHasRole(user.id, UserRole.AUTHOR);

    const manuscript = await prisma.manuscript.findFirst({
      where: {
        id: parsed.data.manuscriptId,
        deletedAt: null,
        submittingAuthorId: user.id,
      },
      select: {
        status: true,
      },
    });

    if (!manuscript) {
      return safeError("This manuscript is no longer available.");
    }

    if (manuscript.status !== ManuscriptStatus.DRAFT) {
      return safeError("Submitted manuscripts must be withdrawn or archived.");
    }

    await prisma.manuscript.update({
      where: { id: parsed.data.manuscriptId },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
        deletionReason: parsed.data.reason,
      },
    });

    await tryWriteAuditLog({
      action: AUDIT_ACTIONS.MANUSCRIPT_SOFT_DELETED,
      actorType: "USER",
      actorUserId: user.id,
      entityType: "Manuscript",
      entityId: parsed.data.manuscriptId,
    });

    return { success: true, data: undefined };
  });
}

export async function restoreManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = lifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return safeError("Choose a valid manuscript.");
    }

    await Promise.all([
      limitManuscriptLifecycle(user.id, parsed.data.manuscriptId),
      assertHasRole(user.id, UserRole.ADMIN),
    ]);

    const manuscript = await prisma.manuscript.findFirst({
      where: {
        id: parsed.data.manuscriptId,
      },
      select: {
        deletedAt: true,
      },
    });

    if (!manuscript) {
      return safeError("This manuscript is no longer available.");
    }

    if (!manuscript.deletedAt) {
      return safeError("Only deleted manuscripts can be restored.");
    }

    await prisma.manuscript.update({
      where: { id: parsed.data.manuscriptId },
      data: {
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      },
    });

    await tryWriteAuditLog({
      action: "MANUSCRIPT_RESTORED",
      actorType: "USER",
      actorUserId: user.id,
      entityType: "Manuscript",
      entityId: parsed.data.manuscriptId,
    });

    return { success: true, data: undefined };
  });
}

export async function archiveManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = lifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return safeError("Choose a valid manuscript.");
    }

    await Promise.all([
      limitManuscriptLifecycle(user.id, parsed.data.manuscriptId),
      assertHasRole(user.id, UserRole.ADMIN),
    ]);

    const manuscript = await prisma.manuscript.findFirst({
      where: {
        id: parsed.data.manuscriptId,
        deletedAt: null,
      },
      select: {
        archivedAt: true,
        status: true,
      },
    });

    if (!manuscript) {
      return safeError("This manuscript is no longer available.");
    }

    if (manuscript.archivedAt) {
      return safeError("This manuscript is already archived.");
    }

    if (isTerminalStatus(manuscript.status)) {
      return safeError("Withdrawn or decided manuscripts cannot be archived.");
    }

    await prisma.manuscript.update({
      where: { id: parsed.data.manuscriptId },
      data: {
        archivedAt: new Date(),
      },
    });

    await tryWriteAuditLog({
      action: AUDIT_ACTIONS.MANUSCRIPT_ARCHIVED,
      actorType: "USER",
      actorUserId: user.id,
      entityType: "Manuscript",
      entityId: parsed.data.manuscriptId,
    });

    return { success: true, data: undefined };
  });
}

export async function withdrawManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = lifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return safeError("Choose a valid manuscript.");
    }

    await limitManuscriptLifecycle(user.id, parsed.data.manuscriptId);
    await assertAuthorOf(user.id, parsed.data.manuscriptId);

    await prisma.$transaction(async (tx) => {
      await transitionStatusWithClient(tx as unknown as StatusMachineDb & AuditLogDb, {
        actor: { type: "USER", userId: user.id },
        manuscriptId: parsed.data.manuscriptId,
        note: parsed.data.reason,
        toStatus: ManuscriptStatus.WITHDRAWN,
      });

      await tx.manuscript.update({
        where: { id: parsed.data.manuscriptId },
        data: {
          withdrawnById: user.id,
          withdrawalReason: parsed.data.reason,
        },
      });
    });

    return { success: true, data: undefined };
  });
}

export async function hardDeleteDraftManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = lifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return safeError("Choose a valid manuscript.");
    }

    await limitManuscriptLifecycle(user.id, parsed.data.manuscriptId);
    await assertHasRole(user.id, UserRole.AUTHOR);

    const manuscript = await prisma.manuscript.findFirst({
      where: {
        id: parsed.data.manuscriptId,
        deletedAt: null,
        submittingAuthorId: user.id,
      },
      select: {
        status: true,
      },
    });

    if (!manuscript) {
      return safeError("This manuscript is no longer available.");
    }

    if (manuscript.status !== ManuscriptStatus.DRAFT) {
      return safeError("Only drafts can be permanently deleted.");
    }

    await prisma.manuscript.delete({
      where: { id: parsed.data.manuscriptId },
    });

    await tryWriteAuditLog({
      action: AUDIT_ACTIONS.DRAFT_HARD_DELETED,
      actorType: "USER",
      actorUserId: user.id,
      entityType: "Manuscript",
      entityId: parsed.data.manuscriptId,
    });

    return { success: true, data: undefined };
  });
}
