-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."UserRole" AS ENUM ('AUTHOR', 'REVIEWER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."ManuscriptStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'INITIAL_CHECK', 'WITH_EDITOR', 'REVIEWERS_INVITED', 'UNDER_REVIEW', 'REVIEWS_COMPLETED', 'DECISION_IN_PROCESS', 'REVISION_REQUESTED', 'REVISION_SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "app"."ReviewInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "app"."EditorialDecision" AS ENUM ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

-- CreateEnum
CREATE TYPE "app"."ReviewRecommendation" AS ENUM ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

-- CreateEnum
CREATE TYPE "app"."FileCategory" AS ENUM ('MANUSCRIPT', 'FIGURE', 'TABLE', 'SUPPLEMENTARY', 'COVER_LETTER', 'REVIEW_ATTACHMENT', 'DECISION_LETTER');

-- CreateEnum
CREATE TYPE "app"."StatusChangeActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "app"."AuditActorType" AS ENUM ('USER', 'SYSTEM', 'ANONYMOUS', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "app"."AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'ERROR');

-- CreateTable
CREATE TABLE "app"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" "app"."UserRole"[] DEFAULT ARRAY['AUTHOR']::"app"."UserRole"[],
    "primaryRole" "app"."UserRole" NOT NULL DEFAULT 'AUTHOR',
    "lastActiveRole" "app"."UserRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Profile" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "affiliation" TEXT,
    "department" TEXT,
    "country" TEXT,
    "orcid" TEXT,
    "expertise" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Journal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ArticleType" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,

    CONSTRAINT "ArticleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Manuscript" (
    "id" TEXT NOT NULL,
    "displayId" TEXT,
    "journalId" TEXT NOT NULL,
    "articleTypeId" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[],
    "coverLetter" TEXT,
    "status" "app"."ManuscriptStatus" NOT NULL DEFAULT 'DRAFT',
    "submittingAuthorId" UUID NOT NULL,
    "handlingEditorId" UUID,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "requiredReviewCount" INTEGER NOT NULL DEFAULT 2,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" UUID,
    "withdrawalReason" TEXT,

    CONSTRAINT "Manuscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ManuscriptAuthor" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "affiliation" TEXT,
    "order" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,

    CONSTRAINT "ManuscriptAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ManuscriptFile" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileCategory" "app"."FileCategory" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" UUID NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,
    "storagePurgedAt" TIMESTAMP(3),

    CONSTRAINT "ManuscriptFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ManuscriptStatusHistory" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "fromStatus" "app"."ManuscriptStatus",
    "toStatus" "app"."ManuscriptStatus" NOT NULL,
    "actorType" "app"."StatusChangeActorType" NOT NULL DEFAULT 'USER',
    "changedById" UUID,
    "systemAction" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManuscriptStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ReviewInvitation" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "reviewerId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "app"."ReviewInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,

    CONSTRAINT "ReviewInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Review" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "reviewerId" UUID NOT NULL,
    "invitationId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "recommendation" "app"."ReviewRecommendation" NOT NULL,
    "commentsToAuthor" TEXT NOT NULL,
    "confidentialComments" TEXT,
    "scoreOriginality" INTEGER,
    "scoreMethodology" INTEGER,
    "scoreClarity" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."EditorDecision" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "editorId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "decision" "app"."EditorialDecision" NOT NULL,
    "decisionLetter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."EmailTemplate" (
    "id" TEXT NOT NULL,
    "journalId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ManuscriptCounter" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManuscriptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "app"."AuditActorType" NOT NULL DEFAULT 'USER',
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "outcome" "app"."AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "app"."User"("email");

-- CreateIndex
CREATE INDEX "User_deactivatedAt_idx" ON "app"."User"("deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "app"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Journal_deletedAt_idx" ON "app"."Journal"("deletedAt");

-- CreateIndex
CREATE INDEX "ArticleType_journalId_name_idx" ON "app"."ArticleType"("journalId", "name");

-- CreateIndex
CREATE INDEX "ArticleType_journalId_idx" ON "app"."ArticleType"("journalId");

-- CreateIndex
CREATE INDEX "ArticleType_deletedAt_idx" ON "app"."ArticleType"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Manuscript_displayId_key" ON "app"."Manuscript"("displayId");

-- CreateIndex
CREATE INDEX "Manuscript_journalId_idx" ON "app"."Manuscript"("journalId");

-- CreateIndex
CREATE INDEX "Manuscript_articleTypeId_idx" ON "app"."Manuscript"("articleTypeId");

-- CreateIndex
CREATE INDEX "Manuscript_submittingAuthorId_idx" ON "app"."Manuscript"("submittingAuthorId");

-- CreateIndex
CREATE INDEX "Manuscript_handlingEditorId_idx" ON "app"."Manuscript"("handlingEditorId");

-- CreateIndex
CREATE INDEX "Manuscript_status_idx" ON "app"."Manuscript"("status");

-- CreateIndex
CREATE INDEX "Manuscript_keywords_idx" ON "app"."Manuscript" USING GIN ("keywords");

-- CreateIndex
CREATE INDEX "Manuscript_deletedAt_idx" ON "app"."Manuscript"("deletedAt");

-- CreateIndex
CREATE INDEX "Manuscript_archivedAt_idx" ON "app"."Manuscript"("archivedAt");

-- CreateIndex
CREATE INDEX "ManuscriptAuthor_manuscriptId_idx" ON "app"."ManuscriptAuthor"("manuscriptId");

-- CreateIndex
CREATE INDEX "ManuscriptAuthor_userId_idx" ON "app"."ManuscriptAuthor"("userId");

-- CreateIndex
CREATE INDEX "ManuscriptAuthor_deletedAt_idx" ON "app"."ManuscriptAuthor"("deletedAt");

-- CreateIndex
CREATE INDEX "ManuscriptFile_manuscriptId_idx" ON "app"."ManuscriptFile"("manuscriptId");

-- CreateIndex
CREATE INDEX "ManuscriptFile_manuscriptId_revisionNumber_idx" ON "app"."ManuscriptFile"("manuscriptId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ManuscriptFile_uploadedById_idx" ON "app"."ManuscriptFile"("uploadedById");

-- CreateIndex
CREATE INDEX "ManuscriptFile_deletedAt_idx" ON "app"."ManuscriptFile"("deletedAt");

-- CreateIndex
CREATE INDEX "ManuscriptFile_storagePurgedAt_idx" ON "app"."ManuscriptFile"("storagePurgedAt");

-- CreateIndex
CREATE INDEX "ManuscriptStatusHistory_manuscriptId_createdAt_idx" ON "app"."ManuscriptStatusHistory"("manuscriptId", "createdAt");

-- CreateIndex
CREATE INDEX "ManuscriptStatusHistory_changedById_idx" ON "app"."ManuscriptStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "ManuscriptStatusHistory_actorType_idx" ON "app"."ManuscriptStatusHistory"("actorType");

-- CreateIndex
CREATE INDEX "ReviewInvitation_manuscriptId_revisionNumber_reviewerId_idx" ON "app"."ReviewInvitation"("manuscriptId", "revisionNumber", "reviewerId");

-- CreateIndex
CREATE INDEX "ReviewInvitation_manuscriptId_revisionNumber_idx" ON "app"."ReviewInvitation"("manuscriptId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ReviewInvitation_reviewerId_idx" ON "app"."ReviewInvitation"("reviewerId");

-- CreateIndex
CREATE INDEX "ReviewInvitation_invitedById_idx" ON "app"."ReviewInvitation"("invitedById");

-- CreateIndex
CREATE INDEX "ReviewInvitation_status_idx" ON "app"."ReviewInvitation"("status");

-- CreateIndex
CREATE INDEX "ReviewInvitation_dueDate_idx" ON "app"."ReviewInvitation"("dueDate");

-- CreateIndex
CREATE INDEX "ReviewInvitation_deletedAt_idx" ON "app"."ReviewInvitation"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_invitationId_key" ON "app"."Review"("invitationId");

-- CreateIndex
CREATE INDEX "Review_manuscriptId_revisionNumber_submittedAt_idx" ON "app"."Review"("manuscriptId", "revisionNumber", "submittedAt");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "app"."Review"("reviewerId");

-- CreateIndex
CREATE INDEX "EditorDecision_manuscriptId_revisionNumber_createdAt_idx" ON "app"."EditorDecision"("manuscriptId", "revisionNumber", "createdAt");

-- CreateIndex
CREATE INDEX "EditorDecision_editorId_idx" ON "app"."EditorDecision"("editorId");

-- CreateIndex
CREATE INDEX "EmailTemplate_journalId_slug_idx" ON "app"."EmailTemplate"("journalId", "slug");

-- CreateIndex
CREATE INDEX "EmailTemplate_journalId_idx" ON "app"."EmailTemplate"("journalId");

-- CreateIndex
CREATE INDEX "EmailTemplate_deletedAt_idx" ON "app"."EmailTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "ManuscriptCounter_journalId_idx" ON "app"."ManuscriptCounter"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "ManuscriptCounter_journalId_year_key" ON "app"."ManuscriptCounter"("journalId", "year");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "app"."AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "app"."AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "app"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "app"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_outcome_idx" ON "app"."AuditLog"("outcome");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "app"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "app"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ArticleType" ADD CONSTRAINT "ArticleType_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "app"."Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Manuscript" ADD CONSTRAINT "Manuscript_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "app"."Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Manuscript" ADD CONSTRAINT "Manuscript_articleTypeId_fkey" FOREIGN KEY ("articleTypeId") REFERENCES "app"."ArticleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Manuscript" ADD CONSTRAINT "Manuscript_submittingAuthorId_fkey" FOREIGN KEY ("submittingAuthorId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Manuscript" ADD CONSTRAINT "Manuscript_handlingEditorId_fkey" FOREIGN KEY ("handlingEditorId") REFERENCES "app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptAuthor" ADD CONSTRAINT "ManuscriptAuthor_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptAuthor" ADD CONSTRAINT "ManuscriptAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptFile" ADD CONSTRAINT "ManuscriptFile_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptFile" ADD CONSTRAINT "ManuscriptFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptStatusHistory" ADD CONSTRAINT "ManuscriptStatusHistory_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptStatusHistory" ADD CONSTRAINT "ManuscriptStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Review" ADD CONSTRAINT "Review_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Review" ADD CONSTRAINT "Review_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "app"."ReviewInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."EditorDecision" ADD CONSTRAINT "EditorDecision_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "app"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."EditorDecision" ADD CONSTRAINT "EditorDecision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "app"."Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ManuscriptCounter" ADD CONSTRAINT "ManuscriptCounter_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "app"."Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- JournalPilot integrity hardening.
-- Prisma manages the base schema above; raw SQL handles partial uniqueness and
-- checks that Prisma cannot express cleanly.

-- User role invariants for multi-role dashboards.
ALTER TABLE "app"."User"
ALTER COLUMN "roles" SET NOT NULL;

ALTER TABLE "app"."User"
ADD CONSTRAINT user_roles_not_empty
CHECK (array_length("roles", 1) >= 1);

ALTER TABLE "app"."User"
ADD CONSTRAINT user_primary_role_in_roles
CHECK ("primaryRole" = ANY("roles"));

ALTER TABLE "app"."User"
ADD CONSTRAINT user_last_active_role_in_roles
CHECK ("lastActiveRole" IS NULL OR "lastActiveRole" = ANY("roles"));

-- Store email values lowercase in application code as well.
CREATE UNIQUE INDEX unique_user_email_lower
ON "app"."User" (lower("email"));

-- Active-record uniqueness for soft-deletable tables.
CREATE UNIQUE INDEX unique_active_journal_slug
ON "app"."Journal" ("slug")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_article_type_name
ON "app"."ArticleType" ("journalId", "name")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_primary_manuscript_author
ON "app"."ManuscriptAuthor" ("manuscriptId")
WHERE "isPrimary" = true AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_manuscript_author_email
ON "app"."ManuscriptAuthor" ("manuscriptId", lower("email"))
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_manuscript_author_order
ON "app"."ManuscriptAuthor" ("manuscriptId", "order")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_global_email_template_slug
ON "app"."EmailTemplate" ("slug")
WHERE "journalId" IS NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_journal_email_template_slug
ON "app"."EmailTemplate" ("journalId", "slug")
WHERE "journalId" IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX unique_active_review_invitation
ON "app"."ReviewInvitation" ("manuscriptId", "revisionNumber", "reviewerId")
WHERE "deletedAt" IS NULL;

-- Status history actor integrity.
ALTER TABLE "app"."ManuscriptStatusHistory"
ADD CONSTRAINT status_history_actor_integrity
CHECK (
  (
    "actorType" = 'USER'
    AND "changedById" IS NOT NULL
    AND "systemAction" IS NULL
  )
  OR
  (
    "actorType" = 'SYSTEM'
    AND "changedById" IS NULL
    AND "systemAction" IS NOT NULL
  )
);

-- Audit actor integrity. Anonymous/external events must not masquerade as USER.
ALTER TABLE "app"."AuditLog"
ADD CONSTRAINT audit_actor_integrity
CHECK (
  ("actorType" = 'USER' AND "actorUserId" IS NOT NULL)
  OR
  ("actorType" <> 'USER')
);

-- Basic manuscript/revision/file sanity checks.
ALTER TABLE "app"."Manuscript"
ADD CONSTRAINT manuscript_revision_positive
CHECK ("revisionNumber" >= 1);

ALTER TABLE "app"."Manuscript"
ADD CONSTRAINT manuscript_required_review_count_positive
CHECK ("requiredReviewCount" >= 1);

ALTER TABLE "app"."ReviewInvitation"
ADD CONSTRAINT review_invitation_revision_positive
CHECK ("revisionNumber" >= 1);

ALTER TABLE "app"."Review"
ADD CONSTRAINT review_revision_positive
CHECK ("revisionNumber" >= 1);

ALTER TABLE "app"."EditorDecision"
ADD CONSTRAINT editor_decision_revision_positive
CHECK ("revisionNumber" >= 1);

ALTER TABLE "app"."ManuscriptFile"
ADD CONSTRAINT manuscript_file_revision_positive
CHECK ("revisionNumber" >= 1);

ALTER TABLE "app"."ManuscriptFile"
ADD CONSTRAINT manuscript_file_size_policy
CHECK ("fileSize" > 0 AND "fileSize" <= 52428800);

ALTER TABLE "app"."Review"
ADD CONSTRAINT review_score_ranges
CHECK (
  ("scoreOriginality" IS NULL OR ("scoreOriginality" >= 1 AND "scoreOriginality" <= 5))
  AND ("scoreMethodology" IS NULL OR ("scoreMethodology" >= 1 AND "scoreMethodology" <= 5))
  AND ("scoreClarity" IS NULL OR ("scoreClarity" >= 1 AND "scoreClarity" <= 5))
);
