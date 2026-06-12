# JournalPilot — Manuscript Submission & Peer Review Platform

> Product Requirements Document (PRD). Split from `prompt_revised.md`; implementation-agent instructions now live in `implementation_prompt.md`.


> A modern academic journal management system with role-based workflows, manuscript tracking, peer review, editor decisions, and admin configuration.

> **Important:** Do not copy the branding, logo, UI, text, or proprietary screens of Editorial Manager, ScholarOne, or any existing platform. Original branding and implementation only.

---

# Product Overview

JournalPilot is a web-based manuscript submission and peer-review management platform for academic journals.

**Four roles:** Authors submit and track manuscripts. Reviewers accept invitations and submit reviews. Editors manage submissions, assign reviewers, and make decisions. Admins configure journals, article types, and email templates.

**Multi-role support:** A single user can hold multiple roles simultaneously (e.g., an academic who is both an Author and a Reviewer). The platform uses a roles array, not a single role field.

**Best one-line description:** JournalPilot is a modern manuscript submission and peer-review workflow platform that gives academic journals a clean role-based dashboard to manage the full submission-to-decision lifecycle.

---

# Target Users

## Author
- Submit manuscripts via multi-step wizard
- Upload files (manuscript, figures, tables, supplementary)
- Add co-authors
- Track submission status and view timeline
- Respond to revision requests
- View decision letters

## Reviewer
- View and respond to review invitations
- Download manuscript files after accepting
- Submit scored review with comments and recommendation
- Give confidential comments to editors separately

## Editor
- View new submissions and perform initial editorial checks
- Assign reviewers and track review progress
- Make decisions: Accept / Minor Revision / Major Revision / Reject
- Write and send decision letters

## Admin
- Manage journals, users, and roles
- Configure article types and submission requirements
- Manage email templates
- View platform analytics

---

# Core Workflow

```
Author creates draft
        ↓
Author submits manuscript
        ↓
Initial editorial check
        ↓
Editor assigned
        ↓
Reviewers invited
        ↓
Reviewers accept / decline
        ↓
Reviews submitted
        ↓
Editor reviews feedback
        ↓
Decision made
        ↓
Accepted / Rejected / Revision Requested
        ↓
(If revision) Author submits revised manuscript  ← revisionNumber increments
        ↓
Re-enters review cycle
```

---

# Manuscript Statuses

```
DRAFT
SUBMITTED
INITIAL_CHECK
WITH_EDITOR
REVIEWERS_INVITED
UNDER_REVIEW
REVIEWS_COMPLETED
DECISION_IN_PROCESS
REVISION_REQUESTED
REVISION_SUBMITTED
ACCEPTED
REJECTED
WITHDRAWN
```

Every status transition must create a `ManuscriptStatusHistory` record, including who triggered it and an optional note.

## Status Transition Rules

Only the following transitions are legal. The shared `transitionStatus` helper must enforce this map and reject any unlisted transition.

```ts
const ALLOWED_TRANSITIONS: Record<ManuscriptStatus, ManuscriptStatus[]> = {
  DRAFT:                ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED:            ['INITIAL_CHECK', 'WITHDRAWN'],
  INITIAL_CHECK:        ['WITH_EDITOR', 'REJECTED', 'WITHDRAWN'],   // desk reject allowed
  WITH_EDITOR:          ['REVIEWERS_INVITED', 'REJECTED', 'WITHDRAWN'],
  REVIEWERS_INVITED:    ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW:         ['REVIEWS_COMPLETED', 'WITHDRAWN'],
  REVIEWS_COMPLETED:    ['DECISION_IN_PROCESS'],
  DECISION_IN_PROCESS:  ['ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'],
  REVISION_REQUESTED:   ['REVISION_SUBMITTED', 'WITHDRAWN'],
  REVISION_SUBMITTED:   ['WITH_EDITOR'],                             // re-enters editor assignment
  ACCEPTED:             [],                                          // terminal
  REJECTED:             [],                                          // terminal
  WITHDRAWN:            [],                                          // terminal
}
```

`lib/status-machine.ts` must also define a transition authorization policy, such as `TRANSITION_POLICIES`, keyed by `fromStatus -> toStatus`.

Each policy should specify:

- allowed actor type: `USER` or `SYSTEM`
- required `UserRole[]` for user actors
- resource relationship check: author, handling editor, admin, reviewer, or none
- required `systemAction` for system actors
- whether an audit/status-history note is required

`assertCanTransition` and `transitionStatus` must use this policy so every transition has one source of truth for legal edge + actor + role + resource relationship.

**Who can trigger which transitions:**

| Transition | Actor |
|-----------|-------|
| DRAFT → SUBMITTED | Author |
| SUBMITTED → INITIAL_CHECK | Editor / Admin |
| INITIAL_CHECK → WITH_EDITOR | Admin (assigns editor) |
| INITIAL_CHECK → REJECTED | Editor / Admin (desk reject) |
| WITH_EDITOR → REVIEWERS_INVITED | Editor |
| REVIEWERS_INVITED → UNDER_REVIEW | System (auto when ≥1 reviewer accepts for the current revision) |
| UNDER_REVIEW → REVIEWS_COMPLETED | System (auto when submitted reviews for the current revision meet `Manuscript.requiredReviewCount`; editor override requires audit note if implemented) |
| REVIEWS_COMPLETED → DECISION_IN_PROCESS | Editor |
| DECISION_IN_PROCESS → ACCEPTED / REJECTED / REVISION_REQUESTED | Editor |
| REVISION_REQUESTED → REVISION_SUBMITTED | Author |
| REVISION_SUBMITTED → WITH_EDITOR | System (auto on revision submit) |
| Any non-terminal → WITHDRAWN | Author |

MVP assignment note:

- Editors may view newly submitted manuscripts and perform editorial checks, but `INITIAL_CHECK -> WITH_EDITOR` is Admin-triggered because it assigns the handling editor.
- If the product later supports self-assignment for small journals, update this table and `assertCanTransition` before implementing that behavior.

`assertCanTransition` must enforce this actor/role table, not only the `ALLOWED_TRANSITIONS` map. Treat it as the authoritative transition authorization gate.

Rules:

- User-triggered transitions must verify the user's role and resource relationship, such as author ownership or handling-editor assignment.
- System-triggered transitions must require an allowlisted `systemAction`.
- Server Actions may still call `assertHasRole` for readability, but must not rely on action-local role checks as the only protection.
- Unit tests must prove that an authenticated user with the wrong role cannot trigger editor/admin/system transitions.

---

# Manuscript Display ID Strategy

Do not expose internal CUID manuscript IDs to users in the UI, emails, decision letters, or support conversations.

Use `Manuscript.displayId` as the human-readable identifier.

Recommended format:

```txt
JP-{YEAR}-{SEQUENCE}
```

Example:

```txt
JP-2026-00042
```

If journals need separate prefixes, use the journal slug or configured journal prefix:

```txt
BSPC-2026-00042
```

Rules:

- `displayId` is nullable while the manuscript is a draft.
- Generate `displayId` only when the manuscript first transitions from `DRAFT` to `SUBMITTED`.
- Generate IDs inside the same database transaction as manuscript submission.
- Use `ManuscriptCounter` keyed by `journalId + year` to avoid duplicate IDs under concurrent submissions.
- Use an atomic increment-and-return strategy, not a read-then-write counter update. Recommended PostgreSQL pattern: `INSERT ... ON CONFLICT ... DO UPDATE SET "nextValue" = "ManuscriptCounter"."nextValue" + 1 RETURNING "nextValue"`, or lock the counter row with `SELECT ... FOR UPDATE` before reading and incrementing.
- If the returned `nextValue` is the value after incrementing, subtract one for the assigned sequence; document the convention in `generateDisplayId`.
- Show `displayId` everywhere in the UI instead of the internal `id`.
- Keep internal `id` for routing and database relations only.

Implementation boundary:

- Put `generateDisplayId` in a manuscript submission/domain helper, not inside the generic status-machine module.
- The submit action must call `generateDisplayId` and `transitionStatus` in the same transaction.
- `transitionStatus` must reject `DRAFT -> SUBMITTED` if the transaction attempts to persist a submitted manuscript without a non-null `displayId`.


---

# System Actor for Automatic Status Transitions

Some manuscript transitions are triggered by the system, not a human user.

Examples:

```txt
REVIEWERS_INVITED → UNDER_REVIEW
UNDER_REVIEW → REVIEWS_COMPLETED
REVISION_SUBMITTED → WITH_EDITOR
```

Do not create a fake "system user" account.

Use `ManuscriptStatusHistory.actorType`.

Rules:

```txt
Human-triggered transition:
actorType = USER
changedById = currentUser.id
systemAction = null

System-triggered transition:
actorType = SYSTEM
changedById = null
systemAction = descriptive enum/string such as AUTO_REVIEW_STARTED
```

`changedById` is nullable only to support system-triggered transitions. For `actorType = USER`, the transition helper must require a real user UUID.

Recommended system action names:

```txt
AUTO_REVIEW_STARTED
AUTO_REVIEWS_COMPLETED
AUTO_REVISION_RETURNED_TO_EDITOR
AUTO_INVITATION_EXPIRED
```


---

# Current Framework Baseline

Use the latest stable **Next.js 16** release.

As of June 12, 2026, the official Next.js docs show the latest version as 16.2.2. Treat that as a point-in-time verification, not a hard pin. At implementation time, install the latest stable Next.js 16 release and then read the installed docs from `node_modules/next/dist/docs/` before coding.

Important current-version rules:

- Use `npx create-next-app@latest`.
- Use App Router only.
- Use TypeScript strict mode.
- Use React 19-compatible patterns.
- Use Node.js `20.9.0+`.
- Use TypeScript `5.1.0+`.
- Turbopack is stable and enabled by default in Next.js 16; do not add legacy `--turbo` / `--turbopack` scripts unless the current docs explicitly require it.
- In Next.js 16, `middleware.ts` has been renamed to `proxy.ts`.
- Use `proxy.ts` only for lightweight/optimistic redirects and request checks. Do **not** use Proxy as the authorization layer.
- Definitive authorization must happen in server actions, server-only data access helpers, and server-rendered pages/layouts.
- Use Cache Components intentionally: set `cacheComponents: true` only when implementing the Next.js 16 `use cache` model, and keep private dashboard data dynamic by default.
- Use the Turbopack analyzer command from current docs, e.g. `next experimental-analyze`, before production and after adding heavy dependencies.
- Add `AGENTS.md` at project root so AI coding agents are instructed to read version-matched Next.js docs from `node_modules/next/dist/docs/` before changing Next.js code.

Recommended `AGENTS.md`:

```md
<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data may be outdated — the installed docs are the source of truth.

<!-- END:nextjs-agent-rules -->
```


---

# Tech Stack

## Frontend
- Next.js 16 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- TanStack Table
- Lucide React
- Recharts (analytics)
- Sonner (toasts)

## Backend
- Next.js Server Actions (mutations) + Route Handlers (webhooks only)
- Supabase Auth (email/password + magic link)
- `@supabase/ssr` for cookie-based SSR auth clients
- Supabase PostgreSQL
- Supabase Storage (manuscript files)
- Prisma ORM 7 with `@prisma/adapter-pg` and `pg`

## Later
- Resend (transactional email)
- Redis queue (deadline reminders)
- ORCID OAuth
- Cloudflare R2 or AWS S3
- AI reviewer recommendation (keyword matching)
- Plagiarism check placeholder

---

# Prisma ORM Baseline

Use the latest stable **Prisma ORM 7** setup.

Important current-version rules:

- Use the `prisma-client` generator, not legacy `prisma-client-js`.
- Set an explicit generated client output, e.g. `../src/generated/prisma`.
- For Prisma ORM 7, do **not** add `previewFeatures = ["multiSchema"]` for `schemas` / `@@schema`; multi-schema is documented as a normal datasource/model feature. Only add a preview flag if the installed Prisma docs for the exact project version explicitly require it.
- Configure the database URL in `prisma.config.ts`; do not put `url` / `directUrl` in `schema.prisma`.
- Use `@prisma/adapter-pg` and `pg` for PostgreSQL/Supabase runtime access.
- Instantiate Prisma Client with a driver adapter in `lib/prisma.ts`.
- Use the pooled `DATABASE_URL` for runtime app queries.
- Use the direct `DIRECT_URL` environment variable as `datasource.url` in `prisma.config.ts` for migrations/admin CLI operations when needed. Prisma ORM 7 removed the old `datasource.directUrl` config property.
- Keep a Prisma client singleton to avoid connection explosions in development/serverless environments.
- For soft-delete partial uniqueness, prefer raw SQL migrations unless the team explicitly accepts Prisma's `partialIndexes` Preview feature after verifying current docs.

Recommended Prisma files:

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma CLI/migrations should use the direct connection.
    url: env("DIRECT_URL"),
  },
});
```

```ts
// lib/prisma.ts
import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```


---

# App Structure

Use `/dashboard/{role}` as the consistent route pattern.

```txt
app/
  (auth)/
    login/
    register/
    forgot-password/
  (dashboard)/
    dashboard/
      layout.tsx              ← shared shell: sidebar + topbar
      author/
        page.tsx              ← Author dashboard
        manuscripts/
          new/                ← 5-step wizard
          [id]/               ← manuscript detail
          [id]/timeline/
      reviewer/
        page.tsx              ← Reviewer dashboard
        invitations/
          [id]/               ← accept / decline
        reviews/
          [id]/               ← active review form
      editor/
        page.tsx              ← Editor dashboard
        manuscripts/
          [id]/               ← manuscript detail
          [id]/assign/        ← reviewer assignment
          [id]/decision/      ← decision + letter
      admin/
        page.tsx              ← Admin dashboard
        journals/
        users/
        article-types/
        email-templates/
        analytics/
  api/
    webhooks/                 ← third-party callbacks only

components/
  ui/                         ← shadcn/ui base overrides
  layout/                     ← DashboardShell, SidebarNav, Topbar, RoleSwitcher
  manuscript/                 ← ManuscriptCard, SubmissionStepper, Timeline
  review/                     ← ReviewForm, InvitationCard
  editor/                     ← ReviewerAssignmentPanel, DecisionLetterEditor
  admin/                      ← AdminStatsCard, JournalSwitcher
  shared/                     ← StatusBadge, RoleBadge, FileUploadCard, EmptyState

lib/
  auth.ts                     ← Supabase auth helpers
  supabase/                   ← @supabase/ssr browser/server/proxy clients
  prisma.ts                   ← Prisma client singleton
  permissions.ts              ← role-based access check functions
  storage.ts                  ← Supabase Storage helpers + signed URL helpers
  status-machine.ts           ← ALLOWED_TRANSITIONS map + transitionStatus helper
  validators/                 ← Zod schemas per domain
  data/                       ← server-only read/query helpers using Prisma
  actions/                    ← server action files per domain
  audit.ts                    ← append-only audit logging helper
  rate-limit.ts               ← Redis-backed rate limiting helper

proxy.ts                    ← Next.js 16 Proxy for optimistic route redirects only; definitive auth stays server-side

prisma/
  schema.prisma
  seed.ts                     ← seed script

prisma.config.ts              ← Prisma ORM 7 config using DIRECT_URL for migrations/admin CLI
```

---

# Multi-Role Dashboard Routing

Users can hold multiple roles, so dashboard routing must be deterministic.

Rules:

```txt
/dashboard
        ↓
Redirect to last active role dashboard if available
        ↓
Else redirect to primaryRole
        ↓
Else redirect to first role in roles array
```

Examples:

```txt
roles = [AUTHOR, REVIEWER], primaryRole = AUTHOR
/dashboard → /dashboard/author

roles = [AUTHOR, REVIEWER], lastActiveRole = REVIEWER
/dashboard → /dashboard/reviewer
```

`RoleSwitcher` updates `lastActiveRole` when the user manually switches dashboards.

If a user visits a dashboard for a role they do not have, redirect them to their resolved default dashboard.


---

# Database Schema

> **Recommended fix applied:** `User.id` now uses the Supabase Auth UUID instead of `cuid()`. When a user registers with Supabase Auth, create the matching app-level `User` row using `auth.users.id` as `User.id`. This prevents `auth.uid()` mismatch problems later if table RLS is added.

> **Multi-role support:** `User.roles` is a `UserRole[]` array, not a single field. A user can hold multiple roles simultaneously (e.g., `[AUTHOR, REVIEWER]`). Proxy and permissions check `roles.includes(...)`.

> **Email identity rule:** Store user and co-author emails normalized to lowercase. Prisma `String @unique` on PostgreSQL is case-sensitive, so case-insensitive uniqueness must be enforced either by using `@db.Citext` with the `citext` extension or by a raw SQL unique index on `lower(email)`. Do not rely on UI-only normalization for identity or conflict-of-interest checks.

> **Revision model:** Revisions are tracked on the same `Manuscript` row by incrementing `revisionNumber`. Files, reviewer invitations, reviews, and editor decisions are versioned by associating them with the revision number active when they are created. There is no separate row per revision and no self-referential parent/child relation.

> **Revision upload timing:** While a manuscript is in `REVISION_REQUESTED`, the current submitted revision remains `Manuscript.revisionNumber`. Files uploaded for the pending revision must be stored with `revisionNumber = manuscript.revisionNumber + 1`. On revision submit, the action promotes `Manuscript.revisionNumber` to that next value in the same transaction as the status transitions.

> **Revision submit transaction:** Submitting a revision must be atomic: validate pending revision files and metadata, create a USER status history entry for `REVISION_REQUESTED -> REVISION_SUBMITTED`, increment `Manuscript.revisionNumber`, then create a SYSTEM status history entry for `REVISION_SUBMITTED -> WITH_EDITOR` with `AUTO_REVISION_RETURNED_TO_EDITOR`. If any step fails, the manuscript must remain in `REVISION_REQUESTED`.

> **RLS note:** This schema intentionally does **not** add `@@map` / `@map` snake_case mappings yet because table-level RLS is not part of the MVP. If table RLS is added later, either write policies using the exact Prisma-generated table/column names or add consistent `@@map` / `@map` mappings before writing SQL policies.
>
> **Deletion compatibility note:** The explicit `onDelete: Restrict` on `Manuscript.journal` does not conflict with soft delete. Journals should be deactivated, archived, or soft-deleted instead of hard-deleted while manuscripts still reference them.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  // Prisma ORM 7: no multiSchema preview flag is required for schemas / @@schema.
  // If using an older Prisma version, verify installed docs before adding previewFeatures.
}

datasource db {
  provider = "postgresql"
  schemas  = ["app"]
}

// ─── Enums ────────────────────────────────────────────────

enum UserRole {
  AUTHOR
  REVIEWER
  EDITOR
  ADMIN

  @@schema("app")
}

enum ManuscriptStatus {
  DRAFT
  SUBMITTED
  INITIAL_CHECK
  WITH_EDITOR
  REVIEWERS_INVITED
  UNDER_REVIEW
  REVIEWS_COMPLETED
  DECISION_IN_PROCESS
  REVISION_REQUESTED
  REVISION_SUBMITTED
  ACCEPTED
  REJECTED
  WITHDRAWN

  @@schema("app")
}

enum ReviewInvitationStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED

  @@schema("app")
}

enum EditorialDecision {
  ACCEPT
  MINOR_REVISION
  MAJOR_REVISION
  REJECT

  @@schema("app")
}

enum ReviewRecommendation {
  ACCEPT
  MINOR_REVISION
  MAJOR_REVISION
  REJECT

  @@schema("app")
}

enum FileCategory {
  MANUSCRIPT
  FIGURE
  TABLE
  SUPPLEMENTARY
  COVER_LETTER
  REVIEW_ATTACHMENT
  DECISION_LETTER

  @@schema("app")
}

enum StatusChangeActorType {
  USER
  SYSTEM

  @@schema("app")
}

enum AuditActorType {
  USER
  SYSTEM
  ANONYMOUS
  EXTERNAL

  @@schema("app")
}

enum AuditOutcome {
  SUCCESS
  DENIED
  ERROR

  @@schema("app")
}

// ─── Models ───────────────────────────────────────────────

model User {
  // Must equal Supabase Auth auth.users.id
  id        String     @id @db.Uuid
  email     String     @unique
  name      String
  roles          UserRole[] @default([AUTHOR])
  primaryRole    UserRole   @default(AUTHOR)
  lastActiveRole UserRole?
  createdAt      DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deactivatedAt   DateTime?
  deactivatedById String?    @db.Uuid

  profile              Profile?
  submittedManuscripts Manuscript[]              @relation("SubmittingAuthor")
  handledManuscripts   Manuscript[]              @relation("HandlingEditor")
  coAuthoredManuscripts ManuscriptAuthor[]
  statusChanges        ManuscriptStatusHistory[]
  reviewInvitations    ReviewInvitation[]        @relation("ReviewerInvitations")
  sentReviewInvitations ReviewInvitation[]        @relation("ReviewInvitationsSent")
  reviews              Review[]
  decisions            EditorDecision[]
  uploadedFiles        ManuscriptFile[]
  auditLogs            AuditLog[]
  @@schema("app")
}

model Profile {
  id          String  @id @default(cuid())
  userId      String  @unique @db.Uuid
  affiliation String?
  department  String?
  country     String?
  orcid       String?
  expertise   String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@schema("app")
}

model Journal {
  id          String   @id @default(cuid())
  name        String
  slug        String   // active uniqueness enforced by partial SQL index because Journal is soft-deletable
  description String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
  deletedById    String?  @db.Uuid
  deletionReason String?

  manuscripts        Manuscript[]
  articleTypes       ArticleType[]
  emailTemplates     EmailTemplate[]
  manuscriptCounters ManuscriptCounter[]

  @@index([deletedAt])
  @@schema("app")
}

model ArticleType {
  id          String   @id @default(cuid())
  journalId   String
  name        String
  description String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
  deletedById    String?  @db.Uuid
  deletionReason String?

  journal     Journal      @relation(fields: [journalId], references: [id], onDelete: Cascade)
  manuscripts Manuscript[]

  // Active uniqueness for [journalId, name] is enforced by a partial SQL index because ArticleType is soft-deletable.
  @@index([journalId, name])
  @@index([journalId])
  @@index([deletedAt])
  @@schema("app")
}

model Manuscript {
  id                 String           @id @default(cuid())
  displayId          String?          @unique // human-readable ID generated on submission, e.g. JP-2026-00042
  journalId          String
  articleTypeId      String?
  title              String
  abstract           String
  keywords           String[]
  coverLetter        String?          // typed/pasted cover letter; uploaded cover letters use FileCategory.COVER_LETTER
  status             ManuscriptStatus @default(DRAFT)
  submittingAuthorId String           @db.Uuid
  handlingEditorId   String?          @db.Uuid
  revisionNumber     Int              @default(1)
  requiredReviewCount Int             @default(2)
  submittedAt        DateTime?
  decisionAt         DateTime?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  archivedAt         DateTime?
  deletedAt          DateTime?
  deletedById        String?          @db.Uuid
  deletionReason     String?
  withdrawnAt        DateTime?
  withdrawnById      String?          @db.Uuid
  withdrawalReason   String?

  // Intentionally Restrict — journals should be deactivated/archived, not hard deleted, because manuscripts must remain auditable.
  journal          Journal      @relation(fields: [journalId], references: [id], onDelete: Restrict)
  articleType      ArticleType? @relation(fields: [articleTypeId], references: [id], onDelete: SetNull)
  submittingAuthor User         @relation("SubmittingAuthor", fields: [submittingAuthorId], references: [id])
  handlingEditor   User?        @relation("HandlingEditor", fields: [handlingEditorId], references: [id])

  authors       ManuscriptAuthor[]
  files         ManuscriptFile[]
  statusHistory ManuscriptStatusHistory[]
  invitations   ReviewInvitation[]
  reviews       Review[]
  decisions     EditorDecision[]

  @@index([journalId])
  @@index([articleTypeId])
  @@index([submittingAuthorId])
  @@index([handlingEditorId])
  @@index([status])
  @@index([keywords], type: Gin)
  @@index([deletedAt])
  @@index([archivedAt])
  @@schema("app")
}

model ManuscriptAuthor {
  id           String  @id @default(cuid())
  manuscriptId String
  userId       String? @db.Uuid   // linked when co-author has a platform account; null for external co-authors
  name         String
  email        String
  affiliation  String?
  order          Int
  isPrimary      Boolean   @default(false)
  deletedAt      DateTime?
  deletedById    String?   @db.Uuid
  deletionReason String?

  manuscript Manuscript @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  user       User?      @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([manuscriptId])
  @@index([userId])
  @@index([deletedAt])
  @@schema("app")
}

model ManuscriptFile {
  id             String       @id @default(cuid())
  manuscriptId   String
  fileName       String       // sanitized original display name
  filePath       String       // private Supabase Storage object path/key, not a permanent public URL
  storageBucket  String       // private bucket name, e.g. manuscript-files
  mimeType       String
  fileCategory   FileCategory
  fileSize       Int
  sha256         String?
  revisionNumber Int          @default(1)   // which revision this file belongs to
  uploadedById     String       @db.Uuid
  uploadedAt       DateTime     @default(now())
  deletedAt        DateTime?
  deletedById      String?      @db.Uuid
  deletionReason   String?
  storagePurgedAt  DateTime?

  manuscript Manuscript @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  uploadedBy User       @relation(fields: [uploadedById], references: [id])

  @@index([manuscriptId])
  @@index([manuscriptId, revisionNumber])
  @@index([uploadedById])
  @@index([deletedAt])
  @@index([storagePurgedAt])
  @@schema("app")
}

model ManuscriptStatusHistory {
  id           String                @id @default(cuid())
  manuscriptId String
  fromStatus   ManuscriptStatus?
  toStatus     ManuscriptStatus
  actorType    StatusChangeActorType @default(USER)
  changedById  String?               @db.Uuid
  systemAction String?               // required when actorType = SYSTEM, e.g. AUTO_REVIEW_STARTED
  note         String?
  createdAt    DateTime              @default(now())

  manuscript Manuscript @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  changedBy  User?      @relation(fields: [changedById], references: [id])

  @@index([manuscriptId, createdAt])
  @@index([changedById])
  @@index([actorType])
  @@schema("app")
}

model ReviewInvitation {
  id           String                 @id @default(cuid())
  manuscriptId String
  reviewerId   String                 @db.Uuid
  invitedById  String                 @db.Uuid
  revisionNumber Int                  @default(1)
  status       ReviewInvitationStatus @default(PENDING)
  invitedAt    DateTime               @default(now())
  respondedAt     DateTime?
  dueDate         DateTime?
  deletedAt       DateTime?
  deletedById     String?   @db.Uuid
  deletionReason  String?

  manuscript Manuscript @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  reviewer   User       @relation("ReviewerInvitations", fields: [reviewerId], references: [id])
  invitedBy  User       @relation("ReviewInvitationsSent", fields: [invitedById], references: [id])
  review     Review?

  // Active uniqueness for [manuscriptId, revisionNumber, reviewerId] is enforced by a partial SQL index because invitations can be soft-deleted/cancelled.
  @@index([manuscriptId, revisionNumber, reviewerId])
  @@index([manuscriptId, revisionNumber])
  @@index([reviewerId])
  @@index([invitedById])
  @@index([status])
  @@index([dueDate])
  @@index([deletedAt])
  @@schema("app")
}

model Review {
  id                   String            @id @default(cuid())
  manuscriptId         String
  reviewerId           String            @db.Uuid
  invitationId         String            @unique
  revisionNumber       Int               @default(1)
  recommendation       ReviewRecommendation
  commentsToAuthor     String
  confidentialComments String?
  scoreOriginality     Int?
  scoreMethodology     Int?
  scoreClarity         Int?
  submittedAt          DateTime          @default(now())

  manuscript Manuscript       @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  reviewer   User             @relation(fields: [reviewerId], references: [id])
  invitation ReviewInvitation @relation(fields: [invitationId], references: [id])

  @@index([manuscriptId, revisionNumber, submittedAt])
  @@index([reviewerId])
  @@schema("app")
}

model EditorDecision {
  id             String            @id @default(cuid())
  manuscriptId   String
  editorId       String            @db.Uuid
  revisionNumber Int               @default(1)
  decision       EditorialDecision
  decisionLetter String
  createdAt      DateTime          @default(now())

  manuscript Manuscript @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  editor     User       @relation(fields: [editorId], references: [id])

  @@index([manuscriptId, revisionNumber, createdAt])
  @@index([editorId])
  @@schema("app")
}

model EmailTemplate {
  id        String   @id @default(cuid())
  journalId String?
  name      String
  slug      String   // e.g. "review-invitation", "decision-accept", "revision-request"
  subject   String
  body      String   // supports {{manuscript_title}}, {{author_name}} tokens
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
  deletedById    String?  @db.Uuid
  deletionReason String?

  journal Journal? @relation(fields: [journalId], references: [id], onDelete: Cascade)

  // Active uniqueness is enforced by NULL-aware partial SQL indexes because journalId is nullable and EmailTemplate is soft-deletable.
  @@index([journalId, slug])
  @@index([journalId])
  @@index([deletedAt])
  @@schema("app")
}

model ManuscriptCounter {
  id        String   @id @default(cuid())
  journalId String
  year      Int
  nextValue Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  journal Journal @relation(fields: [journalId], references: [id], onDelete: Restrict)

  @@unique([journalId, year])
  @@index([journalId])
  @@schema("app")
}

model AuditLog {
  id            String                @id @default(cuid())
  actorType     AuditActorType        @default(USER)
  actorUserId   String?               @db.Uuid
  action        String                // e.g. MANUSCRIPT_SUBMITTED, ROLE_CHANGED, SIGNED_URL_CREATED, ACCESS_DENIED
  entityType    String                // e.g. Manuscript, ReviewInvitation, User, ManuscriptFile
  entityId      String?
  outcome       AuditOutcome          @default(SUCCESS)
  ipHash        String?
  userAgentHash String?
  metadata      Json?
  createdAt     DateTime              @default(now())

  actorUser User? @relation(fields: [actorUserId], references: [id])

  @@index([actorUserId])
  @@index([actorUserId, createdAt])
  @@index([action])
  @@index([entityType, entityId])
  @@index([outcome])
  @@index([createdAt])
  @@schema("app")
}
```

---

# Next.js Data Access Pattern

Use a **Data Access Layer** for this project.

Rules:

- Put database reads in `lib/data/*.ts`.
- Put mutations in `lib/actions/*.ts`.
- Add `import "server-only"` at the top of all files that import Prisma, Supabase server clients, service keys, private environment variables, or sensitive authorization logic.
- Never import Prisma, service-role clients, or server-only modules from Client Components.
- Return minimal DTOs to Client Components. Do not pass full Prisma records containing hidden fields, private file paths, internal notes, confidential comments, or audit metadata.
- Use Server Components for dashboard reads where possible.
- Use Server Actions for mutations.
- Use Route Handlers only for webhooks, OAuth callbacks, health checks, and API integrations that genuinely need HTTP endpoints.
- Do not mix direct client Supabase table access with Prisma for the same application tables.


---

# Server Actions vs Route Handlers

Use the App Router-native split:

```txt
Server Actions = internal app mutations triggered by the JournalPilot UI
Route Handlers = real HTTP endpoints for external systems, callbacks, webhooks, health checks, or streaming/proxy downloads
```

## Use Server Actions for

```txt
create manuscript draft
autosave manuscript draft
add/reorder co-authors
record uploaded file metadata
submit manuscript
withdraw/archive/restore
accept/decline review invitation
submit review
assign reviewer
make editor decision
generate permission-checked signed download URL
change user roles
edit journals, article types, and email templates
```

Every Server Action must:

- Validate input with Zod.
- Load the current user server-side.
- Check authorization through `lib/permissions.ts`.
- Use the Data Access Layer / Prisma only from server-only modules.
- Create audit logs for sensitive actions.
- Return `ActionResult<T>`.
- Revalidate only the affected path/tag.

## Use Route Handlers for

```txt
app/api/webhooks/resend/route.ts
app/api/webhooks/supabase/route.ts
app/auth/callback/route.ts
app/api/health/route.ts
app/api/files/[id]/download/route.ts    # only if streaming/proxying files instead of returning signed URLs
```

Do not create CRUD-style Route Handlers for every internal form mutation. If the request is only made by this app's UI, prefer a Server Action.

## Webhook Signature Verification

Every webhook or third-party callback Route Handler must verify a signature before parsing or processing the event.

Rules:

- Read the raw request body bytes before JSON parsing.
- Verify HMAC-SHA256 signatures using the provider-specific secret and header name.
- Prefer provider SDK verification helpers when available.
- If implementing directly, compute the HMAC over the raw body and compare with the supplied signature using constant-time comparison.
- For custom/internal webhooks, use an `X-Signature-256` style header carrying a SHA-256 HMAC.
- Reject missing, malformed, expired, or mismatched signatures immediately with a generic `401` or `403`.
- Apply rate limits and method checks, but never treat rate limits as a substitute for signature verification.
- Do not log raw payloads, secrets, signatures, tokens, or manuscript/review content.

---

# Security Strategy

Use a hybrid security model.


## Supabase SSR Auth Rule

Use `@supabase/ssr` for cookie-based auth clients in Next.js 16.

Use Supabase's current API key naming:

```txt
Client-safe browser key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
Server-only privileged key: SUPABASE_SECRET_KEY
Legacy projects may still expose anon/service_role keys, but new builds should prefer publishable/secret keys and keep any legacy service_role key server-only.
```

Create separate helpers:

```txt
lib/supabase/browser.ts  → browser client with publishable key only
lib/supabase/server.ts   → server client using cookies
lib/supabase/proxy.ts    → proxy helper to refresh/update auth cookies during optimistic routing
```

Rules:

- Do not use localStorage-only auth for SSR pages.
- Do not expose `SUPABASE_SECRET_KEY` or a legacy `SUPABASE_SERVICE_ROLE_KEY` to browser clients.
- Server-rendered pages/layouts must read the current user through the server Supabase client and then load app profile/roles through Prisma.
- `proxy.ts` may refresh auth cookies and redirect, but real authorization still happens in server-only data/actions.
- Registration is a cross-system operation: create the Supabase Auth user first, then create the Prisma `User` row with the same UUID. If the Prisma write fails, compensate by deleting or disabling the just-created Supabase Auth user with a server-only admin client, and return a generic retryable error.

## Supabase Schema Exposure Rule

Supabase exposes the `public` schema through its Data API. For Prisma-managed application tables, choose one of these safe options:

### Chosen option for MVP

Create Prisma-managed application tables in the private `app` schema, and do not expose that schema through Supabase's Data API. The Prisma schema must include `schemas = ["app"]`, and all JournalPilot models/enums must use `@@schema("app")`.

Keep browser access limited to:

```txt
Supabase Auth
Supabase Storage
server-generated signed URLs
```

### Fallback option only

If Prisma-managed tables stay in `public`, enable RLS on those tables with deny-by-default policies for direct `anon` / `authenticated` table access, then perform real access through server-side Prisma actions.

Even if table RLS is enabled, keep `lib/permissions.ts` and server action authorization as the primary app security layer because Prisma server connections do not automatically behave like the logged-in browser user.

Do not expose Prisma-managed application tables directly to browser Supabase clients.


## MVP Security Model

For the MVP, use **Prisma + server-side authorization checks** for main application tables.

Main application tables:

```txt
User
Profile
Journal
ArticleType
Manuscript
ManuscriptAuthor
ManuscriptFile
ManuscriptStatusHistory
ReviewInvitation
Review
EditorDecision
EmailTemplate
ManuscriptCounter
AuditLog
```

Rules for the MVP:

- Do **not** expose Prisma or database credentials to the client.
- Do **not** use `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` in the browser.
- Use `proxy.ts` only for lightweight/optimistic dashboard redirects. Do not rely on Proxy as the authorization layer.
- Use `lib/permissions.ts` for reusable authorization checks.
- Use `lib/actions/*.ts` for all server-side mutations and permission enforcement.
- Every server action must call `requireCurrentUser()` before reading or mutating sensitive user data.
- `requireCurrentUser()` in `lib/auth.ts` must load the app-level `User`, verify `deactivatedAt IS NULL`, and reject deactivated accounts with `ACCESS_DENIED`.
- Deactivated account denials must create an `AuditLog` entry when audit logging exists; before the audit helper exists, leave a clearly marked TODO at the single `requireCurrentUser()` enforcement point.
- Every file download must be permission-checked server-side before generating a signed URL.
- Use Supabase's built-in Auth rate limits and add JournalPilot app-layer limits around auth-adjacent UI actions such as login, register, forgot-password, resend verification, and magic-link requests. For Server Actions, rely on same-origin/default origin checks, configure `serverActions.allowedOrigins` only when required, and always verify authentication + authorization inside the action.

### Permission helper signatures

```ts
// lib/permissions.ts
export async function assertHasRole(userId: string, role: UserRole): Promise<void>
export async function assertAuthorOf(userId: string, manuscriptId: string): Promise<void>
export async function assertEditorOf(userId: string, manuscriptId: string): Promise<void>
export async function assertReviewerOf(userId: string, manuscriptId: string): Promise<void>
export async function assertCanTransition(actor: { type: 'USER'; userId: string } | { type: 'SYSTEM'; systemAction: string }, manuscriptId: string, toStatus: ManuscriptStatus): Promise<void>
export async function assertCanSoftDelete(userId: string, resourceType: string, resourceId: string): Promise<void>
export async function assertCanRestore(userId: string, resourceType: string, resourceId: string): Promise<void>
```

`assertCanTransition` must read the current manuscript, derive `fromStatus -> toStatus`, validate `ALLOWED_TRANSITIONS`, and enforce the actor/role/resource relationship from the transition table above. This helper is the full transition gate, not a syntax-only status validator.

### Server action return type

All server actions must return this type for consistent client-side handling:

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Safety contract:

- `error` must be a user-facing safe message only.
- Never return raw Prisma, PostgreSQL, Supabase, Redis, Storage, webhook, or validation-library exception messages directly.
- Catch internal exceptions, log sanitized details to observability and/or `AuditLog`, and return a generic message such as `Something went wrong. Please try again.`
- For expected validation failures, map errors to safe field messages without exposing table names, column names, constraint names, SQL, stack traces, bucket paths, or signed URLs.

## Validation Limits

All user-entered text must have Zod limits in `lib/validators/{domain}.ts` before being accepted by Server Actions.

Recommended initial limits:

```txt
Manuscript.title: 1-500 characters
Manuscript.abstract: 1-5,000 characters
Manuscript.keywords: 1-12 keywords, each 1-80 characters
Manuscript.coverLetter: 0-10,000 characters
ManuscriptAuthor.name: 1-200 characters
ManuscriptAuthor.email: valid email, lowercase-normalized, max 320 characters
ManuscriptAuthor.affiliation: 0-300 characters
Review.commentsToAuthor: 1-10,000 characters
Review.confidentialComments: 0-10,000 characters
EditorDecision.decisionLetter: 1-20,000 characters
EmailTemplate.subject: 1-200 characters
EmailTemplate.body: 1-20,000 characters
EmailTemplate.slug: lowercase slug, 1-120 characters
Journal.name: 1-200 characters
Journal.slug: lowercase slug, 1-80 characters
ArticleType.name: 1-120 characters
```

Rules:

- Normalize emails and slugs before persistence.
- Trim text fields before validation where appropriate.
- Return safe validation messages through `ActionResult`.
- Add tests for max-length rejection on manuscript submission, reviews, editor decisions, and email templates.

## Email Template Safety

Email templates may use only allowlisted tokens such as `{{manuscript_title}}`, `{{author_name}}`, `{{display_id}}`, `{{decision}}`, and `{{due_date}}`.

Rules:

- Render token previews through the same server-side renderer used for real emails.
- Escape token values by default.
- If rich HTML email bodies are added, sanitize HTML with a strict allowlist before storing or sending.
- Do not allow arbitrary JavaScript, remote script tags, event-handler attributes, or unsanitized user-supplied HTML.
- Do not include confidential reviewer comments in author-facing templates.
- Audit template create/update/delete actions without logging full template bodies if they may contain sensitive operational text.

## Supabase Storage Security

Use private Supabase Storage buckets for sensitive files.

Recommended buckets:

```txt
manuscript-files
review-files
decision-letters
```

Recommended file path pattern:

```txt
{userId}/manuscripts/{manuscriptId}/{fileId}-{safeFileName}
```

### File upload constraints

- **Max file size:** 50 MB per file
- **Allowed types:** `.pdf`, `.docx`, `.doc`, `.tex`, `.zip` (LaTeX source), `.jpg`, `.png`, `.tiff` (figures)
- Validate allowed MIME types on both client (before upload) and server (before storing the record)
- Store `storageBucket`, `filePath`, sanitized `fileName`, `mimeType`, `fileSize`, and optional `sha256` in `ManuscriptFile`.
- Reject metadata records where the MIME type, extension, or byte size does not match the accepted policy.


### File upload hardening

- Never trust the original file name.
- Generate random storage object names using file IDs.
- Store the original file name only as metadata after sanitization.
- Validate extension and MIME type on both client and server.
- Do not serve uploaded manuscripts inline by default; prefer signed download URLs with `Content-Disposition: attachment`.
- Do not allow executable/script formats.
- For `.zip` LaTeX sources, add decompression-bomb limits and scan contents before processing.
- Post-MVP: add antivirus/malware scanning for uploaded files.
- Post-MVP: add content-type sniffing and checksum storage (`sha256`) for file integrity and duplicate detection.


### MVP file access strategy

- Authors upload files only under their own `userId` folder.
- Store only the private `filePath` in `ManuscriptFile`, not a permanent public URL.
- Generate signed download URLs from the server only after checking permissions.
- Signed download URL actions must require `deletedAt IS NULL` and `storagePurgedAt IS NULL`.
- If `storagePurgedAt IS NOT NULL`, return a safe distinct message such as `This file is no longer available.` Do not generate a signed URL and do not let the user hit a broken Supabase Storage URL.
- Signed download URL TTL: 15 minutes. Regenerate a fresh signed URL on every download request.
- Editors and reviewers should access files through server-generated signed URLs, not permanent public links.
- Reviewers can only access manuscript files after accepting an invitation.
- For direct client uploads, create Supabase Storage policies that allow authenticated users to upload only into their own `{userId}/...` folder.
- Alternative safer approach: generate signed upload URLs server-side after checking permissions, then upload through that signed URL.

## Why Table RLS Is Not Enabled in MVP

Table-level RLS is valuable, but with Prisma it requires extra setup because Prisma server queries do not automatically run as the logged-in Supabase Auth user. Therefore, the MVP should not depend on `auth.uid()` table policies for Prisma-managed queries.

For MVP, treat table RLS as **post-MVP defense-in-depth**, not the primary authorization layer.

## Post-MVP Table RLS Plan

Add table-level RLS later only after these conditions are met:

1. `User.id` uses the Supabase Auth UUID. This is already reflected in the schema.
2. The app has stable server-side permission checks.
3. Prisma table and column names are aligned with SQL policies.
4. Either use exact Prisma-generated names in policies or add explicit `@@map` / `@map` fields.
5. RLS policies are tested with real Supabase Auth sessions.

When adding table RLS later, mirror the same access rules already implemented in `lib/permissions.ts`.

---

# Performance and Scalability Strategy

Design for fast dashboards, low database load, and minimal client JavaScript.

## Performance goals

Target these before production:

```txt
Dashboard initial server response: < 1.5s for normal data sizes
Dashboard client JS: keep route-specific bundles small; investigate any large dependency
Core Web Vitals: good LCP, INP, and CLS on real devices
Database queries: avoid N+1 queries; paginate all large lists
File downloads: signed URL generation should be fast; file transfer happens through Supabase Storage/CDN, not through Server Actions
```

## Next.js rendering strategy

- Prefer Server Components by default.
- Use Client Components only for interactive UI: forms, dialogs, tables with client-side controls, drag-and-drop upload, rich text editor, and charts.
- Do not put entire dashboard pages behind `"use client"`.
- Use `loading.tsx` and skeletons for dashboard routes.
- Use Suspense boundaries around slower dashboard sections such as analytics charts, activity feeds, and large tables.
- Use streaming Server Components where useful instead of blocking the whole page.
- Use Route Handlers only when a real HTTP endpoint is needed; avoid unnecessary internal JSON round trips.

## Next.js 16 caching strategy

Next.js 16 uses explicit caching patterns. If enabling Cache Components, set `cacheComponents: true` in `next.config.ts` and use `use cache` only for safe shared/public computations. Cache only what is safe.

Cache candidates:

```txt
public landing pages
journal list / public journal metadata
article type list per journal
static email-template token documentation
admin analytics aggregates with short TTL
```

Do not globally cache sensitive per-user data such as:

```txt
manuscript details
reviewer confidential comments
signed file URLs
decision letters
user role assignments
private dashboard tables
```

Rules:

- Keep user-specific dashboard data dynamic by default.
- Use cache tags only for safe shared data.
- Invalidate affected paths/tags after mutations using `revalidatePath`, `revalidateTag`, or current Next.js 16 cache APIs as appropriate.
- Never cache signed URLs beyond their 15-minute TTL.
- Do not cache responses that include private file paths, confidential comments, or audit metadata.

## Client JavaScript and bundle budget

- Keep dashboards mostly server-rendered.
- Dynamically import heavy client-only dependencies:
  - rich text editor
  - Recharts analytics widgets
  - drag-and-drop upload components
  - complex TanStack Table interactions
- Use the current Turbopack analyzer command before production and after adding any heavy dependency: `npx next experimental-analyze --output`.
- Keep icon imports tree-shaken; import only the used Lucide icons.
- Avoid large date/time libraries unless necessary; prefer lightweight formatting or native APIs where possible.
- Do not ship Prisma, Supabase service clients, or server-only code to the client.

## Image, font, and asset performance

- Use `next/image` for public images and marketing/journal assets.
- Configure `images.remotePatterns` narrowly if remote images are allowed.
- Use `next/font` for fonts to avoid layout shift and unnecessary third-party requests.
- Do not use `next/image` for private manuscript files; those should be signed downloads, not public image optimization routes.

## Database performance strategy

- Use cursor-based pagination for large tables: manuscripts, reviews, audit logs, users, files.
- Select only needed fields. Avoid returning full Prisma records to UI components.
- Add indexes for all common filters and sorts:
  - manuscript status
  - submitting author
  - handling editor
  - reviewer invitation status
  - due dates
  - soft-delete fields
  - audit log entity/action/createdAt
- Avoid N+1 queries. Use batched queries, targeted `include`, or separate aggregate queries.
- Dashboard stat cards must use aggregate queries that return counts only, not full rows.
- Where a page needs multiple counts from the same table, prefer one grouped aggregate/raw SQL query or one focused data helper that batches the counts. Avoid scattered independent count calls across components.
- Keep transactions short. Do not upload files, call external APIs, or send emails inside DB transactions.
- Use `prisma.$transaction` for display ID generation, status transition + history, and editor decision + status update.
- Use Supabase pooled runtime connection for app traffic and direct connection only for migrations/admin CLI.
- Monitor slow queries and add indexes based on real query plans.
- For analytics, prefer pre-aggregated queries/materialized views or cached aggregate tables once data grows.

## Supabase Storage performance

- Upload files directly to Supabase Storage using secure Storage policies or signed upload URLs; do not upload manuscript files through Server Actions.
- Store only metadata and private `filePath` in Postgres.
- Return signed URLs for downloads instead of proxying files through Next.js unless you need streaming audit/control.
- Keep signed URL TTL at 15 minutes.
- Use random object names and sanitized original names as metadata.
- Add `sha256` metadata for integrity/deduplication where feasible.
- Purge deleted storage objects through scheduled cleanup jobs, not during user-facing requests.

## Tables and dashboard performance

- TanStack Table should use server-side pagination/filtering/sorting once lists can exceed a few hundred rows.
- Do not fetch all manuscripts/reviews/users and filter them in the browser.
- Default page size: 20–50 rows.
- Add debounced search inputs.
- Avoid rendering huge timelines or audit logs at once; paginate or virtualize long lists.

## Observability and performance monitoring

- Add `instrumentation.ts` for OpenTelemetry-compatible tracing.
- Track slow server actions, slow DB queries, signed URL generation latency, upload failure rates, and dashboard render timings.
- Track Core Web Vitals in production.
- Log performance metrics without storing manuscript content, secrets, signed URLs, or confidential comments.
- Add a production performance checklist before launch.

## Performance anti-patterns to avoid

```txt
Putting whole pages behind "use client"
Creating internal /api CRUD routes for every form action
Fetching all rows then filtering client-side
Returning full Prisma objects to Client Components
Uploading large files through Server Actions
Using public URLs for private files
Caching user-specific confidential data
Doing external API calls inside DB transactions
Rendering Recharts/rich text editor in the initial dashboard bundle
```


---

# Mandatory RLS Rule

RLS is mandatory for every table in any schema exposed through Supabase APIs.

For JournalPilot:

## Preferred MVP architecture

- Prisma-managed application tables must live in a private schema such as `app`.
- The `app` schema must not be exposed through Supabase's Data API.
- Browser Supabase clients must not directly query Prisma-managed app tables.
- All app-table reads and writes must go through:
  - Server Components
  - `lib/data/*.ts`
  - Server Actions in `lib/actions/*.ts`
  - `lib/permissions.ts`
  - Prisma on the server

## If any table is in an exposed schema

If any Prisma-managed table is placed in an exposed schema such as `public`:

- Enable RLS immediately.
- Use deny-by-default policies.
- Add explicit policies only for intentionally exposed access.
- Do not rely on anon keys being safe.
- Do not expose manuscript, review, editor-decision, audit, or file-metadata tables directly to browser clients.

## Storage RLS

Supabase Storage access must be protected with one of these approaches:

1. Private buckets + Storage RLS policies on `storage.objects`.
2. Server-generated signed upload/download URLs after permission checks.

Private manuscript files must never be stored in public buckets.

## Important

RLS is not a replacement for server-side authorization.

Even when RLS is enabled, every Server Action and server-only data helper must still:

- authenticate the current user,
- validate input,
- check permissions,
- return minimal DTOs,
- create audit logs for sensitive actions.

This gives defense in depth:

```txt
Private schema / RLS
+ server-side permission checks
+ private Storage / signed URLs
+ audit logs
+ no service keys in browser
```


---

# Next.js Security Configuration

Create `next.config.ts` with security-conscious defaults.

Rules:

- Consider enabling `cacheComponents: true` only when implementing the explicit Next.js 16 Cache Components model.
- Do not increase Server Action body size for file uploads. File uploads must go through Supabase Storage direct upload policies or signed upload URLs.
- Keep Server Action body size low, e.g. `1mb` or `2mb`, because manuscript files are not submitted through Server Actions.
- Read the installed Next.js docs for the exact `serverActions` config shape before editing `next.config.ts`; current Next.js 16 docs place `allowedOrigins` and `bodySizeLimit` under `experimental.serverActions`.
- Use `serverActions.allowedOrigins` only when deploying behind a known reverse proxy/domain setup. Otherwise rely on same-origin default behavior.
- Add security headers for application routes:
  - Content Security Policy with nonces or hashes for scripts, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`
  - `Permissions-Policy` with unnecessary browser capabilities disabled
  - HSTS in production HTTPS deployments
- Add a CSP policy before production. If rich text is used for decision letters, sanitize HTML and do not allow arbitrary script/style injection.

Do not put secrets in `next.config.ts`.


---

# Deletion, Archival, and Retention Strategy

Use a **hybrid deletion model**.

Academic systems need a strong audit trail. Do not permanently erase official manuscript records casually. Once a manuscript is submitted, most related records should remain recoverable and auditable.

## Deletion Types

### Soft delete

Soft delete means the row stays in the database but is hidden from normal UI and normal queries.

Use soft delete for:

```txt
Manuscript
ManuscriptAuthor
ManuscriptFile
ReviewInvitation
Journal
ArticleType
EmailTemplate
```


Do **not** soft-delete these models:

```txt
AuditLog
ManuscriptCounter
```

`AuditLog` is append-only and must not be soft-deleted because it is the security/audit trail.

`ManuscriptCounter` is operational state for display ID generation. It has no `deletedAt` fields and should not be soft-deleted. If a journal is decommissioned, keep the counter row for historical ID integrity, or handle cleanup only through a controlled admin/migration process after confirming no manuscripts depend on it.

Soft-deletable models should include:

```prisma
deletedAt      DateTime?
deletedById    String?   @db.Uuid
deletionReason String?
```

For normal app queries, always filter:

```ts
where: {
  deletedAt: null,
}
```

Admins may view soft-deleted records in archive screens.

### Hard delete

Hard delete means the row/object is permanently removed.

Hard delete is allowed only for:

```txt
Unsubmitted drafts
Failed uploads
Temporary files
Test data
Expired temporary records
```

Do not hard delete submitted manuscripts, reviews, editor decisions, or status history during normal app usage.

### Append-only records

These records should normally never be edited destructively or hard deleted:

```txt
Review
EditorDecision
ManuscriptStatusHistory
```

If a correction is needed, create a new correction/replacement record or add an audit/status-history note instead of deleting the original record.

## UI Wording

Avoid using "delete" for submitted academic records.

Use:

```txt
Withdraw manuscript
Archive manuscript
Deactivate user
Remove draft
Permanently delete draft
Restore archived record
```

Use "delete permanently" only for drafts, failed uploads, temporary files, or admin retention cleanup.

## Storage Retention

Supabase Storage files can consume much more space than database rows.

For files:

1. Mark `ManuscriptFile.deletedAt`.
2. Hide the file from normal UI.
3. Keep the actual private Supabase Storage object during the retention window.
4. Purge the object later using a scheduled cleanup job.

Recommended retention windows:

```txt
Failed/temporary uploads: purge after 24-72 hours
Unsubmitted draft files: purge after 30 days
Withdrawn manuscript files: keep 1-3 years
Submitted/accepted/rejected manuscript files: keep according to journal policy
```

## Storage Object Purge Rules

Do not immediately delete storage objects when a user removes a submitted file.

Instead:

```txt
User removes/archives file
        ↓
Set ManuscriptFile.deletedAt
        ↓
Hide from UI and signed URL generation
        ↓
Scheduled cleanup checks retention policy
        ↓
Delete actual Supabase Storage object if eligible
```


## Cascade and Soft Delete Compatibility

Some child records use `onDelete: Cascade` from `Manuscript`.

This does **not** conflict with soft delete.

`onDelete: Cascade` fires only when a manuscript row is hard-deleted. Hard deletes are restricted to unsubmitted drafts, failed uploads, temporary records, test data, or retention cleanup. Soft-deleting or archiving a submitted manuscript does not cascade; all child records remain intact for audit, archive, and restoration workflows.


## Soft Delete and Unique Constraints

Soft delete can conflict with unique fields such as `Journal.slug`, `ArticleType.name`, `EmailTemplate.slug`, and `ReviewInvitation(manuscriptId, revisionNumber, reviewerId)`.

When needed, use partial unique indexes in raw SQL migrations so only active rows must be unique.

Example:

```sql
CREATE UNIQUE INDEX unique_active_journal_slug
ON "app"."Journal" ("slug")
WHERE "deletedAt" IS NULL;
```

Prisma does not cleanly model every partial index, so keep these in migration SQL when required.


## Required Partial Unique Indexes for Soft-Deleted Records

Some soft-deletable models need active-record uniqueness. Do **not** rely on Prisma `@unique` / `@@unique` for these fields because soft-deleted rows would still block reuse.

Use raw SQL migrations for partial unique indexes.

```sql
-- Journal slugs must be unique only among active journals.
CREATE UNIQUE INDEX unique_active_journal_slug
ON "app"."Journal" ("slug")
WHERE "deletedAt" IS NULL;

-- Article type names must be unique only among active article types within a journal.
CREATE UNIQUE INDEX unique_active_article_type_name
ON "app"."ArticleType" ("journalId", "name")
WHERE "deletedAt" IS NULL;

-- A manuscript must have at most one active primary author.
CREATE UNIQUE INDEX unique_active_primary_manuscript_author
ON "app"."ManuscriptAuthor" ("manuscriptId")
WHERE "isPrimary" = true AND "deletedAt" IS NULL;

-- Active co-author emails must not duplicate within the same manuscript.
-- Store emails lowercase; this index protects against accidental mixed-case duplicates.
CREATE UNIQUE INDEX unique_active_manuscript_author_email
ON "app"."ManuscriptAuthor" ("manuscriptId", lower("email"))
WHERE "deletedAt" IS NULL;

-- Active co-author order must be unique within a manuscript.
CREATE UNIQUE INDEX unique_active_manuscript_author_order
ON "app"."ManuscriptAuthor" ("manuscriptId", "order")
WHERE "deletedAt" IS NULL;

-- Global email template slugs must be unique among active global templates.
-- Needed because Postgres unique indexes treat NULL values as distinct.
CREATE UNIQUE INDEX unique_active_global_email_template_slug
ON "app"."EmailTemplate" ("slug")
WHERE "journalId" IS NULL AND "deletedAt" IS NULL;

-- Journal-specific email template slugs must be unique among active templates within the same journal.
CREATE UNIQUE INDEX unique_active_journal_email_template_slug
ON "app"."EmailTemplate" ("journalId", "slug")
WHERE "journalId" IS NOT NULL AND "deletedAt" IS NULL;

-- Review invitations should allow re-inviting a reviewer in a new revision round
-- or after a previous invitation is soft-deleted/cancelled.
CREATE UNIQUE INDEX unique_active_review_invitation
ON "app"."ReviewInvitation" ("manuscriptId", "revisionNumber", "reviewerId")
WHERE "deletedAt" IS NULL;
```

Keep normal non-unique Prisma indexes in the schema for query performance, but use SQL migrations for active-record uniqueness.


## Required Database Integrity Checks

Some invariants are enforced in TypeScript and should also be protected with raw SQL migration checks where PostgreSQL can express them cleanly.

```sql
-- User role invariants for multi-role dashboards.
ALTER TABLE "app"."User"
ADD CONSTRAINT user_roles_not_empty
CHECK (array_length("roles", 1) >= 1);

ALTER TABLE "app"."User"
ADD CONSTRAINT user_primary_role_in_roles
CHECK ("primaryRole" = ANY("roles"));

ALTER TABLE "app"."User"
ADD CONSTRAINT user_last_active_role_in_roles
CHECK ("lastActiveRole" IS NULL OR "lastActiveRole" = ANY("roles"));

-- Case-insensitive user email uniqueness when not using @db.Citext.
-- Store email values lowercase in application code as well.
CREATE UNIQUE INDEX unique_user_email_lower
ON "app"."User" (lower("email"));

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

-- Audit actor integrity. Unauthenticated events must use ANONYMOUS, not USER with a null actorUserId.
ALTER TABLE "app"."AuditLog"
ADD CONSTRAINT audit_actor_integrity
CHECK (
  ("actorType" = 'USER' AND "actorUserId" IS NOT NULL)
  OR
  ("actorType" <> 'USER')
);

-- Basic manuscript/file sanity checks.
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
ADD CONSTRAINT manuscript_file_size_policy
CHECK ("fileSize" > 0 AND "fileSize" <= 52428800);
```

Keep these constraints in migrations and document any intentionally relaxed local-development exceptions.


## Query Rule

All normal data access helpers and server actions must exclude soft-deleted rows by default.

Create a reusable helper pattern such as:

```ts
const activeWhere = {
  deletedAt: null,
}
```

Admin archive screens may intentionally include deleted rows, but this must be explicit.

## User Account Deletion

Do not hard delete users by default.

Use account deactivation/anonymization:

```prisma
deactivatedAt   DateTime?
deactivatedById String?   @db.Uuid
```


User records use **deactivation**, not soft delete.

- `User` does not use `deletedAt`.
- Deactivated users are hidden from reviewer search, editor assignment, role assignment, and normal user-management lists.
- Deactivated users remain visible in audit records, historical manuscripts, reviews, decisions, and status history.
- Historical relations must remain intact for academic accountability.

A deactivated user cannot log into app dashboards or perform actions, but historical records remain linked for auditability.

## User Role Management

`User.roles`, `primaryRole`, and `lastActiveRole` must be updated atomically.

Rules:

- Admin role-change actions must update `roles`, `primaryRole`, and `lastActiveRole` in a single Prisma update or a single database transaction.
- If the current `primaryRole` is removed, set `primaryRole` to an explicit admin-selected role or the first role in the new roles array.
- If `lastActiveRole` is removed, set it to `null` or to the new `primaryRole`.
- Never write an empty `roles` array.
- Verify Prisma's enum-array default behavior during Feature 2 with `prisma validate`, migration generation, and a test insert. Keep the `user_roles_not_empty` database check as a safety net.
- Role changes must create an audit log with old/new roles and primary role, without logging secrets or tokens.


---

# Rate Limiting and Abuse Protection

Rate limiting is mandatory for abuse-prone actions.

Rate limiting is **not** a replacement for authentication, authorization, RLS, validation, or audit logging. It is an additional abuse-control layer that protects cost, availability, email delivery, file storage, and database resources.

## Layered rate limiting model

Use rate limiting at multiple layers:

```txt
Platform/WAF limit
        ↓
Next.js app-level rate limiter
        ↓
Supabase Auth built-in rate limits
        ↓
Database/storage constraints and audit logs
```

## Recommended implementation

Use a Redis-backed limiter for app-level limits.

Preferred portable option:

```txt
Upstash Redis + @upstash/ratelimit
```

Alternative on Vercel:

```txt
Vercel WAF Rate Limiting for coarse public-route limits
+ app-level rate limits for user/action-specific limits
```

Do not rely on in-memory rate limiting for production because serverless deployments can have many isolated instances.

## Rate limit helper

Create:

```txt
lib/rate-limit.ts
```

The helper should support:

```ts
export async function assertRateLimit(params: {
  key: string
  limit: number
  window: string
  reason: string
}): Promise<void>
```

Use stable keys:

```txt
Authenticated user action:
user:{userId}:action:{actionName}

Anonymous/auth action:
ip:{ipHash}:action:{actionName}

Combined sensitive action:
user:{userId}:ip:{ipHash}:action:{actionName}

File action:
user:{userId}:file:{fileId}:action:signed-url
```

Never store raw IP addresses in Redis keys or AuditLog metadata. Use a salted hash.

### Client IP extraction

`lib/rate-limit.ts` must centralize client IP extraction.

Rules:

- Read client IP from the deployment platform's trusted request metadata/header.
- On Vercel, prefer the platform-provided trusted IP helper/header documented for the deployed runtime, such as `x-real-ip` or Vercel's forwarded IP metadata, and verify against current Vercel docs before launch.
- Do not naively trust the left-most value of raw `X-Forwarded-For`; clients can inject or prepend that header before the request reaches a proxy.
- If running behind a self-managed reverse proxy, trust forwarded headers only when the immediate proxy is controlled by the team and strips/rebuilds incoming forwarding headers.
- If no trusted IP source exists, fall back to user/account/action keys and treat IP-based limits as best-effort only.

## Initial rate limit policy

Start conservative and tune based on logs.

| Action | Suggested limit |
|---|---:|
| Login attempts | Supabase Auth built-in + 5 per 10 minutes per IP/email |
| Register attempts | 3 per hour per IP |
| Forgot password | Supabase Auth built-in + 3 per hour per email/IP |
| Manuscript draft autosave | 60 per minute per user |
| Manuscript submit | 10 per hour per user |
| File upload metadata create | 30 per hour per user |
| Signed download URL generation | 60 per hour per user + 10 per minute burst |
| Reviewer invitation send | 50 per day per editor |
| Review submission | 20 per hour per reviewer |
| Editor decision creation | 20 per hour per editor |
| Admin role changes | 30 per hour per admin |
| Public/webhook route handlers | WAF/platform limit + signature verification |

## Where to enforce limits

Enforce rate limits inside Server Actions and Route Handlers, not only in `proxy.ts`.

```txt
Server Action:
validate input
→ requireCurrentUser()
→ assertRateLimit()
→ assert permissions
→ mutate data
→ audit log

Route Handler:
verify method/content type
→ read raw body when signature verification is required
→ verify signature/auth
→ assertRateLimit()
→ process request
→ audit log
```

`proxy.ts` may apply coarse request throttling if supported by the deployment platform, but it must not be the only rate-limiting layer.

## Supabase Auth limits

Supabase Auth has built-in rate limits for auth endpoints. Configure them in the Supabase dashboard where available, but still add app-level limits around your own auth UI and password-reset initiation.

## Storage abuse controls

For uploads:

- Keep buckets private.
- Validate file size and type before upload.
- Use signed upload URLs or strict Storage RLS.
- Rate limit upload metadata creation.
- Rate limit signed download URL generation.
- Add per-manuscript and per-user file count limits.
- Add max total draft storage per user if needed.

## Response behavior

When rate limited:

- Return a generic error message such as: `Too many attempts. Please try again later.`
- Do not reveal whether an email/user exists.
- Include `retryAfter` in `ActionResult` when useful.
- For Route Handlers, return HTTP `429 Too Many Requests`.
- Create an `AuditLog` entry with outcome `DENIED` and action such as `RATE_LIMITED`.


---

# Security Audit Logging

Add append-only security audit logging.

Use `AuditLog` for events that are broader than manuscript status changes.

Log at minimum:

```txt
LOGIN_SUCCESS / LOGIN_FAILURE
REGISTER_SUCCESS / REGISTER_FAILURE
ROLE_CHANGED
USER_DEACTIVATED
ACCESS_DENIED
MANUSCRIPT_CREATED
MANUSCRIPT_SUBMITTED
MANUSCRIPT_WITHDRAWN
FILE_UPLOADED
FILE_SOFT_DELETED
SIGNED_URL_CREATED
REVIEW_INVITATION_CREATED
REVIEW_INVITATION_ACCEPTED
REVIEW_SUBMITTED
EDITOR_DECISION_CREATED
JOURNAL_CREATED / JOURNAL_UPDATED / JOURNAL_ARCHIVED
EMAIL_TEMPLATE_CHANGED
```

Rules:

- Audit logs are append-only.
- Use `AuditActorType.USER` only when `actorUserId` is present.
- Use `AuditActorType.ANONYMOUS` for unauthenticated auth-adjacent events and rate-limit denials.
- Use `AuditActorType.SYSTEM` for scheduled jobs and automatic workflow actions.
- Use `AuditActorType.EXTERNAL` for verified third-party webhook/callback events.
- Do not store raw IP addresses or full user agents unless there is a clear policy reason. Prefer hashed values.
- Do not log secrets, tokens, signed URLs, file contents, passwords, or full manuscript text.
- Sanitize log metadata to prevent log injection.
- Logs should support security review without leaking confidential academic content.
- Production hardening: revoke `UPDATE` and `DELETE` on `"app"."AuditLog"` from the runtime app database role once migrations and operational workflows are ready for an append-only database-level policy. Keep migrations/admin roles separate from runtime roles.


---

# Permission Rules

## Author
- Create and edit own drafts
- Submit own manuscripts
- View own manuscript status, timeline, and files
- Submit revisions when status is `REVISION_REQUESTED`
- Withdraw own manuscripts from any non-terminal status
- Cannot view other authors' manuscripts, assign reviewers, or make decisions

## Reviewer
- View own review invitations
- Accept or decline invitations
- Access manuscript files only for accepted invitations
- Submit one review per accepted invitation
- Cannot see other reviewers' confidential comments or unrelated manuscripts

## Editor
- View manuscripts where `handlingEditorId = userId`
- View newly submitted manuscripts not yet assigned
- Invite reviewers
- Read all reviews for assigned manuscripts (including confidential comments)
- Make decisions and write decision letters
- Cannot view manuscripts assigned to other editors

## Admin
- Full access to all resources
- Configure journals and article types
- Manage users and role assignments
- View all analytics

## Conflict-of-Interest Guards

These rules must be enforced in the reviewer invitation server action:

- An editor **cannot** invite themselves as a reviewer on a manuscript they handle.
- A reviewer invitation must be **blocked** if the reviewer's email matches any `ManuscriptAuthor.email` on that manuscript.
- A reviewer invitation must be **blocked** if the reviewer's `userId` matches any `ManuscriptAuthor.userId` on that manuscript (when linked).

## Deadline Behavior

- `ReviewInvitation.dueDate` is set by the editor when sending the invitation.
- Pending invitations past `dueDate` display an **"Overdue"** badge in the editor's dashboard.
- Active reviews past `dueDate` display a **"Late"** badge.
- Auto-expiration of overdue invitations is **post-MVP** (requires a cron job or scheduled function).

---

# Core Pages

## Public
- Landing page, Login, Register, Forgot password
- Journal selection (on first login if multiple journals exist)

## Author
- Dashboard (submission counts, recent activity, revision requests)
- My submissions (filterable table)
- New manuscript wizard (5 steps, including cover letter support)
- Manuscript detail + timeline
- Revision submission page
- Decision letter view

## Reviewer
- Dashboard (pending invitations count, active reviews, completions)
- Invitation detail (accept / decline with due date)
- Review submission form
- Completed reviews history

## Editor
- Dashboard (new submissions, pending decisions, overdue reviews)
- Manuscript list (filterable by status)
- Manuscript detail
- Reviewer assignment panel
- Review progress view
- Decision page + letter builder

## Admin
- Dashboard (platform stats)
- Journals management
- Users + role assignment
- Article types per journal
- Email template editor (with token preview)
- Analytics

---

# Key Components

```
DashboardShell              ← layout wrapper with sidebar + topbar
SidebarNav                  ← role-aware navigation links (supports multi-role users)
RoleSwitcher                ← lets multi-role users switch between Author, Reviewer, Editor, and Admin dashboards
StatusBadge                 ← coloured badge per ManuscriptStatus
RoleBadge                   ← coloured badge per UserRole
ManuscriptCard              ← summary card for manuscript lists
ManuscriptTable             ← TanStack Table with search and filter
SubmissionStepper           ← 5-step wizard with progress indicator
FileUploadCard              ← drag-and-drop Supabase Storage uploader (with file type/size validation)
AuthorForm                  ← inline co-author add / reorder
Timeline                    ← vertical timeline from ManuscriptStatusHistory
ReviewInvitationCard        ← accept / decline with due date + overdue badge
ReviewForm                  ← scored review with Zod validation
DecisionLetterEditor        ← rich text letter builder
ReviewerAssignmentPanel     ← search reviewers by expertise, send invite (with COI check)
JournalSwitcher             ← admin dropdown to switch journal context
AdminStatsCard              ← metric card for admin analytics
EmptyState                  ← empty list / zero-data states
```

---

# UI Skill Workflow

JournalPilot must use the installed `ui-ux-pro-max` UI skill for UI/UX planning and UI-heavy implementation work.

Installed skill path:

```txt
.codex/skills/ui-ux-pro-max/SKILL.md
```

## Required Design-System Setup

Before implementing dashboard UI, auth pages, forms, tables, charts, upload cards, rich text editors, or responsive shell layouts, generate and persist a project design system with the UI skill:

```powershell
python .codex/skills/ui-ux-pro-max/scripts/search.py "academic publishing SaaS dashboard manuscript peer review clean professional accessible" --design-system --persist -p "JournalPilot" -f markdown
```

This should create:

```txt
design-system/journalpilot/MASTER.md
design-system/journalpilot/pages/
```

`design-system/journalpilot/MASTER.md` becomes the visual design source of truth for the app, subordinate to this PRD for product behavior, security, and database requirements.

## Page-Specific UI Overrides

For major UI surfaces, create page-specific design-system overrides before implementing the page:

```powershell
python .codex/skills/ui-ux-pro-max/scripts/search.py "academic publishing SaaS dashboard manuscript peer review" --design-system --persist -p "JournalPilot" --page "dashboard-shell" -f markdown
python .codex/skills/ui-ux-pro-max/scripts/search.py "academic manuscript submission wizard forms upload stepper" --design-system --persist -p "JournalPilot" --page "submission-wizard" -f markdown
python .codex/skills/ui-ux-pro-max/scripts/search.py "editorial review dashboard dense tables filters decision workflow" --design-system --persist -p "JournalPilot" --page "editor-dashboard" -f markdown
python .codex/skills/ui-ux-pro-max/scripts/search.py "admin analytics SaaS dashboard charts tables management" --design-system --persist -p "JournalPilot" --page "admin-analytics" -f markdown
```

When a page-specific file exists in `design-system/journalpilot/pages/`, it may override `design-system/journalpilot/MASTER.md` only for visual and interaction details. It must not override PRD-defined security, authorization, workflow, status, database, or role behavior.

If generated UI-skill output includes landing-page, conversion, portfolio, product-review, hero, contact-sales, logo-carousel, testimonial, or marketing patterns, ignore those patterns for authenticated app screens. JournalPilot's primary UI is an operational SaaS dashboard, not a marketing site.

## Stack-Specific Searches

Use the UI skill's stack searches before building UI components:

```powershell
python .codex/skills/ui-ux-pro-max/scripts/search.py "dashboard layout responsive forms tables accessibility" --stack nextjs
python .codex/skills/ui-ux-pro-max/scripts/search.py "forms tables dialogs tabs sidebar dashboard" --stack shadcn
python .codex/skills/ui-ux-pro-max/scripts/search.py "keyboard focus aria responsive dashboard" --domain ux
python .codex/skills/ui-ux-pro-max/scripts/search.py "analytics dashboard academic publishing" --domain chart
```

Apply the recommendations only when they are consistent with the PRD and the implementation prompt's Better-Plan Protocol.

## UI Verification Requirements

For every UI-heavy feature:

- Read `design-system/journalpilot/MASTER.md`.
- Read any relevant `design-system/journalpilot/pages/{page}.md` override.
- Use shadcn/ui and Lucide React consistently.
- Avoid emoji icons.
- Verify light and dark mode contrast.
- Verify keyboard focus states and labels.
- Verify responsive layouts at 375px, 768px, 1024px, and 1440px.
- Use Browser tooling or Playwright screenshots where practical.
- Do not let the UI skill introduce marketing-page patterns into dense operational dashboards.

---

# Environment Variables

```env
# Supabase client-safe keys
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Legacy projects only, if the project has not migrated to publishable keys:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase server-only key
# Never expose this in the browser. Use only in server actions / route handlers when absolutely needed.
SUPABASE_SECRET_KEY=
# Legacy projects only, if the project has not migrated to secret keys:
# SUPABASE_SERVICE_ROLE_KEY=

# Prisma ORM 7
DATABASE_URL=       # pooled runtime connection string — used by @prisma/adapter-pg in lib/prisma.ts
DIRECT_URL=         # direct connection string — used by prisma.config.ts for migrations/admin CLI

# App
NEXT_PUBLIC_APP_URL=


# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_SALT=

# Email (Phase 5+)
RESEND_API_KEY=
```

> Supabase provides pooled and direct Postgres connection strings. In Prisma ORM 7, do not place `url` / `directUrl` in `schema.prisma`; put the direct CLI/migration connection in `prisma.config.ts` as `datasource.url`, and pass the pooled runtime `DATABASE_URL` to `@prisma/adapter-pg` in `lib/prisma.ts`. `SUPABASE_SECRET_KEY` and legacy `SUPABASE_SERVICE_ROLE_KEY` bypass RLS, so they must remain server-only.

---

# Development Checklist

### Phase 1 — Foundation
```
[ ] npx create-next-app@latest --typescript (Next.js 16)
[ ] Add Tailwind CSS and initialise shadcn/ui
[ ] Create Supabase project (Mumbai region ap-south-1)
[ ] Add DATABASE_URL and DIRECT_URL to .env
[ ] Use prisma migrate dev for schema changes; use prisma db push only for throwaway prototypes
[ ] Build auth pages: login, register, forgot-password
[ ] On registration, create app User row using Supabase Auth UUID as User.id
[ ] Create proxy.ts for optimistic /dashboard redirects only; enforce definitive authorization in server-rendered layouts/pages, lib/data, and Server Actions
[ ] Build DashboardShell with SidebarNav and Topbar (with role-aware nav for multi-role users)
[ ] Create placeholder dashboard pages for all 4 roles
[ ] Create lib/status-machine.ts with ALLOWED_TRANSITIONS map and transitionStatus helper
[ ] Create lib/permissions.ts with assertHasRole, assertAuthorOf, assertEditorOf, assertReviewerOf stubs
[ ] Seed local/dev sample users through Supabase Auth/Admin API first, then insert matching app-level User rows using the same UUIDs. Include 1 journal, 2 article types, 1 admin, 1 editor, 2 reviewers (one also an author), 2 authors, and 1 sample manuscript in SUBMITTED status.
[ ] Do not create real production users only through Prisma seed.
```

### Phase 2 — Author Submission
```
[ ] Author dashboard: manuscript count cards + recent activity list
[ ] SubmissionStepper component with 5 steps and progress bar
[ ] Step 1: select journal + article type
[ ] Step 2: title, abstract, keywords
[ ] Step 3: add and reorder co-authors (auto-link to User when email matches)
[ ] Step 4: file upload via Supabase Storage (FileUploadCard with type/size validation)
[ ] Step 5: cover letter, declarations, review all details, and submit → status SUBMITTED → create StatusHistory entry
[ ] Auto-save draft state to DB on each step transition
[ ] Manuscript detail page with Timeline component
[ ] My submissions page with ManuscriptTable
```

### Phase 3 — Editor Workflow
```
[ ] Editor dashboard: new submissions count, pending decisions count, overdue reviews badge
[ ] Manuscript list with status filter (TanStack Table)
[ ] Assign handling editor action
[ ] ReviewerAssignmentPanel: search users by role REVIEWER, COI check, send invitation with due date and current revisionNumber
[ ] Review progress view: invitation statuses per manuscript revision + overdue badges
[ ] DecisionLetterEditor: rich text, decision enum select
[ ] Make decision action → status update via transitionStatus helper → StatusHistory entry
[ ] Decision letter visible to author
```

### Phase 4 — Reviewer Workflow
```
[ ] Reviewer dashboard: pending invitations, active reviews, overdue count
[ ] ReviewInvitationCard: accept / decline with due date + overdue badge
[ ] File access gate: block download if invitation not ACCEPTED
[ ] ReviewForm: recommendation, commentsToAuthor, confidentialComments, scores
[ ] Submit review action → create Review record linked to invitation and invitation revisionNumber
[ ] Completed reviews list
```

### Phase 5 — Admin Panel
```
[ ] Admin dashboard with platform-wide stats
[ ] Journals CRUD
[ ] Article types CRUD per journal
[ ] User list with multi-role assignment (checkboxes, not single select)
[ ] EmailTemplate editor with {{token}} preview rendering
[ ] Analytics page: submissions per month, decisions breakdown (Recharts)
```

---

---

# Demo Flow (for presentations)

1. Author registers and creates a manuscript draft
2. Author completes the 5-step wizard and submits
3. Editor sees the submission and performs initial check
4. Editor assigns a reviewer and sends invitation
5. Reviewer accepts invitation and downloads manuscript files
6. Reviewer submits a scored review with recommendation
7. Editor reads the review (including confidential comments)
8. Editor makes a decision and sends a decision letter
9. Author sees decision and updated status timeline
10. (Revision path) Author submits revised manuscript → `revisionNumber = 2` → re-enters review cycle at WITH_EDITOR

---

# Future Features (Post-MVP)

- ORCID login
- Single-blind and double-blind review modes
- Reviewer recommendation by subject keyword
- Transactional email via Resend
- Deadline reminders via Redis queue (auto-expire overdue invitations)
- Scheduled storage cleanup job for retention-window file purging
- PDF generation for decision letters and submission packages
- Plagiarism check placeholder (iThenticate-style)
- Audit logs
- Configurable submission questions per journal
- Configurable review form builder per article type (replaces hardcoded score fields)
- Revision diff view (compare submission vs revision files)
- Reviewer performance analytics
- Editorial workload analytics
- Public journal landing pages
- Manuscript withdrawal UI and reason-capture form (backend fields and status transition already exist)
- Decision letter templates
- Correction chains for append-only records: add `supersededById` and `correctionNote` to Review and EditorDecision if journals need formal correction workflows
- Antivirus/malware scanning for uploaded manuscript files
- Adaptive abuse detection and dynamic rate limits
- Table-level RLS as defense-in-depth

---

# Current Security and Database Audit Notes

This spec follows the current recommendations below.

## Next.js 16 audit

- Updated framework baseline to Next.js 16.
- Replaced `middleware.ts` terminology with `proxy.ts`.
- Proxy is limited to lightweight redirects and optimistic checks.
- Definitive authorization remains in server actions, server-only data helpers, and server-rendered routes.
- Added `AGENTS.md` instruction so AI coding agents read installed version-matched Next.js docs.
- Added Server Action body-size guidance so manuscript files are not accidentally uploaded through Server Actions.
- Added security headers and CSP guidance.

## Supabase audit

- Kept Supabase Auth UUID as `User.id`.
- Updated environment guidance to prefer current publishable/secret API keys, with legacy anon/service_role names documented only as migration fallbacks.
- Kept secret/service keys server-only.
- Added explicit warning that secret / legacy `service_role` keys bypass RLS.
- Added Supabase schema exposure rule:
  - Prefer a private schema for Prisma-managed tables, or
  - Enable deny-by-default RLS on public tables if they remain in public.
- Kept Storage RLS / signed upload URL requirement for private manuscript files.

## Prisma/Postgres audit

- Prisma ORM 7 requires driver adapters for runtime clients and configures database URLs through Prisma Config.

- Updated to Prisma ORM 7 guidance: `prisma-client` generator, `prisma.config.ts`, and `@prisma/adapter-pg` driver adapter.
- Added `AuditLog` as an append-only security/audit table.
- Split reviewer recommendations from editor decisions with a dedicated `ReviewRecommendation` enum.
- Added `AuditActorType` so unauthenticated and external events are not mislabeled as user events.
- Added reviewer invitation `invitedById` for accountability.
- Added required file metadata fields for private storage bucket, MIME type, and byte size.
- Added raw SQL integrity checks for role-array invariants, status-history actor integrity, audit actor integrity, revision numbers, file size limits, primary authors, co-author email uniqueness, and case-insensitive user email uniqueness.
- Kept partial unique indexes in raw SQL for soft-deletable uniqueness.
- Added `sha256` field for file integrity/deduplication support.
- Kept `ManuscriptCounter` transaction-based display ID generation.
- Confirmed `onDelete: Restrict` for journal/manuscript safety.
- Confirmed file/revision composite index for revision-specific file queries.

## OWASP-aligned security audit

- Added server-side authorization as the deciding control.
- Added audit logging for security-sensitive events.
- Added generic-error and no-secret logging guidance.
- Added file-upload hardening:
  - random storage names
  - extension and MIME validation
  - no executable formats
  - signed downloads
  - no inline serving by default
  - future malware scanning
- Added security header guidance.


---

# Comprehensive Performance Audit Notes

## Frontend/rendering audit

- Use Server Components by default to reduce client-side JavaScript.
- Keep interactive components isolated and small.
- Add `loading.tsx`, Suspense, and streaming where routes have mixed fast/slow data.
- Dynamically import heavy UI modules.
- Analyze bundles before production.

## Caching audit

- User dashboards and confidential manuscript/review data are dynamic by default.
- Cache only safe shared data such as public journal metadata and article types.
- Revalidate precisely after mutations.
- Never cache signed URLs or confidential reviewer/editor content.

## Database audit

- The schema has indexes for the main role/status relationships and soft-delete fields.
- Add query-specific indexes as real dashboard filters stabilize.
- Use cursor pagination for large tables.
- Avoid N+1 queries.
- Use short transactions for status transitions, display ID generation, and editor decisions.
- Keep file transfer out of database transactions.

## Storage audit

- Large manuscript files bypass Server Actions and go to Supabase Storage.
- Database stores metadata and private paths only.
- Downloads use short-lived signed URLs.
- Storage object purge runs asynchronously after retention windows.

## Observability audit

- Add OpenTelemetry-compatible instrumentation.
- Track Core Web Vitals, slow routes/actions, slow DB queries, upload/download errors, and audit-log failures.
- Do not log secrets, signed URLs, file contents, manuscript text, or confidential comments.


---

# Final comprehensive audit patch notes

Final audit adjustments applied:

- Chose the private `app` schema for Prisma-managed tables instead of leaving the schema-exposure choice ambiguous.
- Added `schemas = ["app"]` and `@@schema("app")` guidance for Prisma models/enums.
- Updated partial unique index SQL examples to target `"app"."TableName"`.
- Added `@supabase/ssr` as the recommended SSR auth client package and added browser/server/proxy Supabase helper structure.
- Replaced misleading Server Action CSRF wording with current origin-check + in-action authorization guidance.
- Added explicit Cache Components decision guidance for Next.js 16.

---

# Rate Limiting Audit Notes

Rate limiting is included as a mandatory abuse-control layer.

- Supabase Auth built-in limits protect Supabase auth endpoints, but JournalPilot still rate-limits its own auth UI flows and sensitive app actions.
- Server Actions are callable by direct POST requests, so rate limits must be enforced inside actions, not only in UI or Proxy.
- Route Handlers are public HTTP endpoints, so webhooks, callbacks, health checks, and file endpoints need method checks, signature/auth checks, and rate limits.
- Use Redis-backed limits for production. Avoid in-memory rate limiting except in local development.
- Log rate-limit denials to AuditLog without storing secrets, raw IP addresses, signed URLs, or manuscript content.
