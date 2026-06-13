"use server";

import { z } from "zod";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AUDIT_ACTIONS, tryWriteAuditLog } from "@/lib/audit";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAuthorOf, assertHasRole } from "@/lib/permissions";
import {
  assertServerActionRateLimit,
  isRateLimitError,
  RATE_LIMIT_SUBJECTS,
  rateLimitActionError,
} from "@/lib/rate-limit";
import { transitionStatus } from "@/lib/status-machine";

const lifecycleSchema = z.object({
  manuscriptId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

function safeError(message: string): ActionResult {
  return { success: false, error: message };
}

async function limitManuscriptLifecycle(userId: string, manuscriptId: string) {
  try {
    await assertServerActionRateLimit({
      actorType: "USER",
      actorUserId: userId,
      manuscriptId,
      subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_LIFECYCLE,
      userId,
    });

    return null;
  } catch (error) {
    if (isRateLimitError(error)) {
      return rateLimitActionError();
    }

    throw error;
  }
}

export async function softDeleteDraftManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return safeError("Choose a valid manuscript.");
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitManuscriptLifecycle(
    user.id,
    parsed.data.manuscriptId,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  await assertAuthorOf(user.id, parsed.data.manuscriptId);

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: parsed.data.manuscriptId,
      deletedAt: null,
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
}

export async function restoreManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return safeError("Choose a valid manuscript.");
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitManuscriptLifecycle(
    user.id,
    parsed.data.manuscriptId,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  await assertHasRole(user.id, UserRole.ADMIN);

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
}

export async function archiveManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return safeError("Choose a valid manuscript.");
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitManuscriptLifecycle(
    user.id,
    parsed.data.manuscriptId,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  await assertHasRole(user.id, UserRole.ADMIN);

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
}

export async function withdrawManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return safeError("Choose a valid manuscript.");
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitManuscriptLifecycle(
    user.id,
    parsed.data.manuscriptId,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  await transitionStatus({
    actor: { type: "USER", userId: user.id },
    manuscriptId: parsed.data.manuscriptId,
    note: parsed.data.reason,
    toStatus: ManuscriptStatus.WITHDRAWN,
  });

  await prisma.manuscript.update({
    where: { id: parsed.data.manuscriptId },
    data: {
      withdrawnById: user.id,
      withdrawalReason: parsed.data.reason,
    },
  });

  await tryWriteAuditLog({
    action: AUDIT_ACTIONS.MANUSCRIPT_WITHDRAWN,
    actorType: "USER",
    actorUserId: user.id,
    entityType: "Manuscript",
    entityId: parsed.data.manuscriptId,
  });

  return { success: true, data: undefined };
}

export async function hardDeleteDraftManuscriptAction(
  input: z.infer<typeof lifecycleSchema>,
): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return safeError("Choose a valid manuscript.");
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitManuscriptLifecycle(
    user.id,
    parsed.data.manuscriptId,
  );

  if (rateLimitError) {
    return rateLimitError;
  }

  await assertAuthorOf(user.id, parsed.data.manuscriptId);

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: parsed.data.manuscriptId,
      deletedAt: null,
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
}
