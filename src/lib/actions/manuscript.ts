"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { requireCurrentUser } from "@/lib/auth";
import { sanitizeFileName } from "@/lib/file-policy";
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
  coAuthorSchema,
  createDraftShellSchema,
  removeCoAuthorSchema,
  reorderCoAuthorsSchema,
  uploadMetadataSchema,
} from "@/lib/validators/manuscript";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

async function assertEditableDraftForAuthor(userId: string, manuscriptId: string) {
  await assertAuthorOf(userId, manuscriptId);

  const manuscript = await prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
      status: ManuscriptStatus.DRAFT,
      submittingAuthorId: userId,
    },
    select: { id: true },
  });

  return Boolean(manuscript);
}

export async function addCoAuthorAction(input: unknown): Promise<ActionResult> {
  const parsed = coAuthorSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Check the co-author fields and try again." };
  }

  const user = await requireCurrentUser();
  const rateLimitError = await limitDraftMutation(user.id);

  if (rateLimitError) {
    return rateLimitError;
  }

  const canEdit = await assertEditableDraftForAuthor(
    user.id,
    parsed.data.manuscriptId,
  );

  if (!canEdit) {
    return { success: false, error: "Only draft manuscripts can be edited." };
  }

  const existingAuthor = await prisma.manuscriptAuthor.findFirst({
    where: {
      deletedAt: null,
      email: parsed.data.email,
      manuscriptId: parsed.data.manuscriptId,
    },
    select: { id: true },
  });

  if (existingAuthor) {
    return { success: false, error: "That co-author is already listed." };
  }

  const [existingUser, lastAuthor] = await Promise.all([
    prisma.user.findFirst({
      where: {
        deactivatedAt: null,
        email: parsed.data.email,
      },
      select: { id: true },
    }),
    prisma.manuscriptAuthor.findFirst({
      where: {
        deletedAt: null,
        manuscriptId: parsed.data.manuscriptId,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    }),
  ]);

  await prisma.manuscriptAuthor.create({
    data: {
      affiliation: parsed.data.affiliation || null,
      email: parsed.data.email,
      isPrimary: false,
      manuscriptId: parsed.data.manuscriptId,
      name: parsed.data.name,
      order: (lastAuthor?.order ?? 0) + 1,
      userId: existingUser?.id ?? null,
    },
  });

  revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

  return { success: true, data: undefined };
}

export async function removeCoAuthorAction(input: unknown): Promise<ActionResult> {
  const parsed = removeCoAuthorSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Choose a valid co-author." };
  }

  const user = await requireCurrentUser();
  const canEdit = await assertEditableDraftForAuthor(
    user.id,
    parsed.data.manuscriptId,
  );

  if (!canEdit) {
    return { success: false, error: "Only draft manuscripts can be edited." };
  }

  const author = await prisma.manuscriptAuthor.findFirst({
    where: {
      id: parsed.data.authorId,
      deletedAt: null,
      manuscriptId: parsed.data.manuscriptId,
    },
    select: {
      isPrimary: true,
    },
  });

  if (!author) {
    return { success: false, error: "That co-author is no longer listed." };
  }

  if (author.isPrimary) {
    return { success: false, error: "The primary author cannot be removed." };
  }

  await prisma.manuscriptAuthor.update({
    where: { id: parsed.data.authorId },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
      deletionReason: "Removed during draft editing.",
    },
  });

  revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

  return { success: true, data: undefined };
}

export async function reorderCoAuthorsAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = reorderCoAuthorsSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Choose a valid author order." };
  }

  const user = await requireCurrentUser();
  const canEdit = await assertEditableDraftForAuthor(
    user.id,
    parsed.data.manuscriptId,
  );

  if (!canEdit) {
    return { success: false, error: "Only draft manuscripts can be edited." };
  }

  const authors = await prisma.manuscriptAuthor.findMany({
    where: {
      deletedAt: null,
      manuscriptId: parsed.data.manuscriptId,
    },
    select: {
      id: true,
      isPrimary: true,
    },
  });
  const activeIds = new Set(authors.map((author) => author.id));
  const primaryAuthor = authors.find((author) => author.isPrimary);

  if (
    parsed.data.authorIds.length !== authors.length ||
    parsed.data.authorIds.some((id) => !activeIds.has(id)) ||
    primaryAuthor?.id !== parsed.data.authorIds[0]
  ) {
    return {
      success: false,
      error: "Keep the primary author first and include each active co-author.",
    };
  }

  await prisma.$transaction(
    parsed.data.authorIds.map((authorId, index) =>
      prisma.manuscriptAuthor.update({
        where: { id: authorId },
        data: { order: index + 1 },
      }),
    ),
  );

  revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

  return { success: true, data: undefined };
}

function getManuscriptFilesBucket() {
  return process.env.MANUSCRIPT_FILES_BUCKET ?? "manuscript-files";
}

export async function createManuscriptUploadUrlAction(
  input: unknown,
): Promise<
  ActionResult<{
    bucket: string;
    fileId: string;
    path: string;
    token: string;
  }>
> {
  const parsed = uploadMetadataSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Choose an accepted file under 50 MB." };
  }

  const user = await requireCurrentUser();

  try {
    await assertServerActionRateLimit({
      actorType: "USER",
      actorUserId: user.id,
      subject: RATE_LIMIT_SUBJECTS.FILE_METADATA_CREATE,
      userId: user.id,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      return rateLimitActionError();
    }

    throw error;
  }

  const canEdit = await assertEditableDraftForAuthor(
    user.id,
    parsed.data.manuscriptId,
  );

  if (!canEdit) {
    return { success: false, error: "Only draft manuscripts can accept uploads." };
  }

  const fileId = randomUUID();
  const safeFileName = sanitizeFileName(parsed.data.fileName);
  const filePath = `${user.id}/manuscripts/${parsed.data.manuscriptId}/${fileId}-${safeFileName}`;
  const bucket = getManuscriptFilesBucket();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, { upsert: false });

  if (error || !data?.token) {
    return {
      success: false,
      error:
        "We could not prepare the upload. Confirm the private manuscript bucket exists.",
    };
  }

  await prisma.manuscriptFile.create({
    data: {
      fileCategory: parsed.data.fileCategory,
      fileName: safeFileName,
      filePath,
      fileSize: parsed.data.fileSize,
      id: fileId,
      manuscriptId: parsed.data.manuscriptId,
      mimeType: parsed.data.mimeType,
      sha256: parsed.data.sha256,
      storageBucket: bucket,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

  return {
    success: true,
    data: {
      bucket,
      fileId,
      path: data.path,
      token: data.token,
    },
  };
}
