"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { withActionErrorHandling } from "@/lib/actions/utils";
import type { AuditLogDb } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { sanitizeFileName } from "@/lib/file-policy";
import {
  generateDisplayId,
  type DisplayIdDb,
} from "@/lib/manuscripts/display-id";
import { prisma } from "@/lib/prisma";
import { assertAuthorOf, assertHasRole } from "@/lib/permissions";
import {
  assertServerActionRateLimit,
  RATE_LIMIT_SUBJECTS,
} from "@/lib/rate-limit";
import {
  autosaveDraftSchema,
  coAuthorSchema,
  createDraftShellSchema,
  removeCoAuthorSchema,
  reorderCoAuthorsSchema,
  submitManuscriptSchema,
  uploadMetadataSchema,
} from "@/lib/validators/manuscript";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  transitionStatusWithClient,
  type StatusMachineDb,
} from "@/lib/status-machine";

async function limitDraftMutation(userId: string) {
  await assertServerActionRateLimit({
    actorType: "USER",
    actorUserId: userId,
    subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_AUTOSAVE,
    userId,
  });
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
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = createDraftShellSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Choose a valid journal." };
    }

    await assertHasRole(user.id, UserRole.AUTHOR);
    await limitDraftMutation(user.id);

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
  });
}

export async function autosaveManuscriptDraftAction(
  input: unknown,
): Promise<ActionResult<{ manuscriptId: string }>> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = autosaveDraftSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Check the manuscript fields and try again." };
    }

    await limitDraftMutation(user.id);
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
  });
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

async function getUploadableManuscriptForAuthor(
  userId: string,
  manuscriptId: string,
) {
  await assertAuthorOf(userId, manuscriptId);

  return prisma.manuscript.findFirst({
    where: {
      id: manuscriptId,
      deletedAt: null,
      status: {
        in: [ManuscriptStatus.DRAFT, ManuscriptStatus.REVISION_REQUESTED],
      },
      submittingAuthorId: userId,
    },
    select: {
      revisionNumber: true,
      status: true,
    },
  });
}

export async function addCoAuthorAction(input: unknown): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = coAuthorSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Check the co-author fields and try again." };
    }

    await limitDraftMutation(user.id);

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
  });
}

export async function removeCoAuthorAction(input: unknown): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = removeCoAuthorSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Choose a valid co-author." };
    }

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
  });
}

export async function reorderCoAuthorsAction(
  input: unknown,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = reorderCoAuthorsSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Choose a valid author order." };
    }

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
  });
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
    signedUrl: string;
  }>
> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = uploadMetadataSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Choose an accepted file under 50 MB." };
    }

    await assertServerActionRateLimit({
      actorType: "USER",
      actorUserId: user.id,
      subject: RATE_LIMIT_SUBJECTS.FILE_METADATA_CREATE,
      userId: user.id,
    });

    const manuscript = await getUploadableManuscriptForAuthor(
      user.id,
      parsed.data.manuscriptId,
    );

    if (!manuscript) {
      return {
        success: false,
        error: "Only draft or revision-requested manuscripts can accept uploads.",
      };
    }

    const fileId = randomUUID();
    const safeFileName = sanitizeFileName(parsed.data.fileName);
    const filePath = `${user.id}/manuscripts/${parsed.data.manuscriptId}/${fileId}-${safeFileName}`;
    const bucket = getManuscriptFilesBucket();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath, { upsert: false });

    if (error || !data?.signedUrl) {
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
        revisionNumber:
          manuscript.status === ManuscriptStatus.REVISION_REQUESTED
            ? manuscript.revisionNumber + 1
            : manuscript.revisionNumber,
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
        signedUrl: data.signedUrl,
      },
    };
  });
}

async function limitSubmission(userId: string) {
  await assertServerActionRateLimit({
    actorType: "USER",
    actorUserId: userId,
    subject: RATE_LIMIT_SUBJECTS.MANUSCRIPT_SUBMIT,
    userId,
  });
}

export async function submitManuscriptAction(
  input: unknown,
): Promise<ActionResult<{ displayId: string }>> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = submitManuscriptSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Complete the declarations before submitting.",
      };
    }

    await limitSubmission(user.id);
    await assertAuthorOf(user.id, parsed.data.manuscriptId);

    const result = await prisma.$transaction(async (tx) => {
      const manuscript = await tx.manuscript.findFirst({
        where: {
          id: parsed.data.manuscriptId,
          deletedAt: null,
          status: ManuscriptStatus.DRAFT,
          submittingAuthorId: user.id,
        },
        select: {
          displayId: true,
          journalId: true,
        },
      });

      if (!manuscript) {
        return null;
      }

      const displayId =
        manuscript.displayId ??
        (await generateDisplayId({
          db: tx as unknown as DisplayIdDb,
          journalId: manuscript.journalId,
        }));

      await tx.manuscript.update({
        where: { id: parsed.data.manuscriptId },
        data: {
          coverLetter: parsed.data.coverLetter || null,
        },
      });

      await transitionStatusWithClient(
        tx as unknown as StatusMachineDb & AuditLogDb,
        {
          actor: { type: "USER", userId: user.id },
          displayId,
          manuscriptId: parsed.data.manuscriptId,
          note: "Author submitted manuscript.",
          toStatus: ManuscriptStatus.SUBMITTED,
        },
      );

      return { displayId };
    });

    if (!result) {
      return {
        success: false,
        error: "Only draft manuscripts can be submitted.",
      };
    }

    revalidatePath("/dashboard/author");
    revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

    return { success: true, data: result };
  });
}

export async function submitRevisionAction(
  input: unknown,
): Promise<ActionResult> {
  return withActionErrorHandling(async () => {
    const user = await requireAuth();
    const parsed = submitManuscriptSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Complete the declarations before submitting.",
      };
    }

    await limitSubmission(user.id);
    await assertAuthorOf(user.id, parsed.data.manuscriptId);

    const submitted = await prisma.$transaction(async (tx) => {
      const manuscript = await tx.manuscript.findFirst({
        where: {
          id: parsed.data.manuscriptId,
          deletedAt: null,
          status: ManuscriptStatus.REVISION_REQUESTED,
          submittingAuthorId: user.id,
        },
        select: {
          revisionNumber: true,
        },
      });

      if (!manuscript) {
        return false;
      }

      await tx.manuscript.update({
        where: { id: parsed.data.manuscriptId },
        data: {
          coverLetter: parsed.data.coverLetter || null,
          revisionNumber: manuscript.revisionNumber + 1,
        },
      });

      await transitionStatusWithClient(
        tx as unknown as StatusMachineDb & AuditLogDb,
        {
          actor: { type: "USER", userId: user.id },
          manuscriptId: parsed.data.manuscriptId,
          note: "Author submitted revision.",
          toStatus: ManuscriptStatus.REVISION_SUBMITTED,
        },
      );
      await transitionStatusWithClient(
        tx as unknown as StatusMachineDb & AuditLogDb,
        {
          actor: {
            type: "SYSTEM",
            systemAction: "AUTO_REVISION_RETURNED_TO_EDITOR",
          },
          manuscriptId: parsed.data.manuscriptId,
          note: "Revision returned to editor automatically.",
          toStatus: ManuscriptStatus.WITH_EDITOR,
        },
      );

      return true;
    });

    if (!submitted) {
      return {
        success: false,
        error: "Only revision-requested manuscripts can be resubmitted.",
      };
    }

    revalidatePath("/dashboard/author");
    revalidatePath(`/dashboard/author/manuscripts/${parsed.data.manuscriptId}`);

    return { success: true, data: undefined };
  });
}
