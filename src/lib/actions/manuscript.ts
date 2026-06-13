"use server";

import { revalidatePath } from "next/cache";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAuthorOf, assertHasRole } from "@/lib/permissions";
import {
  assertServerActionRateLimit,
  isRateLimitError,
  RATE_LIMIT_SUBJECTS,
  rateLimitActionError,
} from "@/lib/rate-limit";
import {
  autosaveDraftSchema,
  createDraftShellSchema,
} from "@/lib/validators/manuscript";

async function limitDraftMutation(userId: string) {
  try {
    await assertServerActionRateLimit({
      actorType: "USER",
      actorUserId: userId,
      subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_AUTOSAVE,
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

async function assertActiveJournalAndArticleType({
  articleTypeId,
  journalId,
}: {
  articleTypeId?: string | null;
  journalId: string;
}) {
  const journal = await prisma.journal.findFirst({
    where: {
      id: journalId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });

  if (!journal) {
    return false;
  }

  if (!articleTypeId) {
    return true;
  }

  const articleType = await prisma.articleType.findFirst({
    where: {
      id: articleTypeId,
      deletedAt: null,
      isActive: true,
      journalId,
    },
    select: { id: true },
  });

  return Boolean(articleType);
}

export async function createManuscriptDraftAction(
  input: unknown,
): Promise<ActionResult<{ manuscriptId: string }>> {
  const parsed = createDraftShellSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Choose a valid journal." };
  }

  const user = await requireCurrentUser();
  await assertHasRole(user.id, UserRole.AUTHOR);
  const rateLimitError = await limitDraftMutation(user.id);

  if (rateLimitError) {
    return rateLimitError;
  }

  const articleTypeId = parsed.data.articleTypeId || null;
  const isValidScope = await assertActiveJournalAndArticleType({
    articleTypeId,
    journalId: parsed.data.journalId,
  });

  if (!isValidScope) {
    return { success: false, error: "Choose a valid journal and article type." };
  }

  const manuscript = await prisma.manuscript.create({
    data: {
      abstract: "Draft abstract pending.",
      articleTypeId,
      journalId: parsed.data.journalId,
      keywords: [],
      status: ManuscriptStatus.DRAFT,
      submittingAuthorId: user.id,
      title: "Untitled manuscript",
      authors: {
        create: {
          email: user.email,
          isPrimary: true,
          name: user.name,
          order: 1,
          userId: user.id,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/author");

  return { success: true, data: { manuscriptId: manuscript.id } };
}

export async function autosaveManuscriptDraftAction(
  input: unknown,
): Promise<ActionResult<{ manuscriptId: string }>> {
  const parsed = autosaveDraftSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Check the manuscript fields and try again." };
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitDraftMutation(user.id);

  if (rateLimitError) {
    return rateLimitError;
  }

  await assertAuthorOf(user.id, parsed.data.manuscriptId);

  const articleTypeId = parsed.data.articleTypeId || null;
  const isValidScope = await assertActiveJournalAndArticleType({
    articleTypeId,
    journalId: parsed.data.journalId,
  });

  if (!isValidScope) {
    return { success: false, error: "Choose a valid journal and article type." };
  }

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: parsed.data.manuscriptId,
      deletedAt: null,
      status: ManuscriptStatus.DRAFT,
      submittingAuthorId: user.id,
    },
    select: { id: true },
  });

  if (!manuscript) {
    return { success: false, error: "Only draft manuscripts can be edited." };
  }

  await prisma.manuscript.update({
    where: { id: parsed.data.manuscriptId },
    data: {
      abstract: parsed.data.abstract,
      articleTypeId,
      journalId: parsed.data.journalId,
      keywords: parsed.data.keywords,
      title: parsed.data.title,
    },
  });

  revalidatePath("/dashboard/author");
  revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

  return {
    success: true,
    data: { manuscriptId: parsed.data.manuscriptId },
  };
}
