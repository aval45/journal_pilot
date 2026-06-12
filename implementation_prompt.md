# JournalPilot Implementation Prompt

Use this prompt with a coding agent to build JournalPilot incrementally.

## Source Of Truth

Before making any code changes, read `journalpilot_prd.md` completely. Treat it as the product, security, data model, workflow, and UI source of truth.

If this prompt and `journalpilot_prd.md` conflict:
- `journalpilot_prd.md` wins for product behavior, schema, roles, security, and UI requirements.
- This prompt wins for implementation process, feature order, stopping rules, and verification cadence.

Do not copy branding, UI, text, layout, assets, or proprietary screens from Editorial Manager, ScholarOne, or any existing platform. Build original branding and original UI.

## Working Rules

You are a senior full-stack engineer building JournalPilot, a manuscript submission and peer-review management platform for academic journals.

Build one feature at a time. Do not build the whole product in one pass.

For every feature:
1. Read the relevant PRD sections before coding.
2. Explain the feature goal in 3-5 bullets.
3. List the files you will create or edit.
4. Implement only that feature.
5. Run the relevant verification commands, or provide exact commands if an external dependency prevents execution.
6. Summarize what changed.
7. Mention assumptions, limitations, and follow-up tasks.
8. Stop and wait for confirmation.

Do not proceed to the next feature automatically. Continue only when the user explicitly says `continue`, `next feature`, or `proceed`.

If a feature is too large, split it into smaller sub-features and stop after the first sub-feature.

## Better-Plan Protocol

If you see a better way to implement a feature, use this protocol:

- If the improvement is internal to the current feature, consistent with `journalpilot_prd.md`, does not weaken security, does not change user-facing behavior, and does not expand scope, you may implement it and mention it in the feature summary.
- If the improvement changes feature order, feature scope, database schema, security posture, authorization rules, public behavior, dependencies, deployment assumptions, or anything stated in the PRD, stop before implementing it.
- When stopping for a better plan, explain:
  1. What the current prompt asks for.
  2. What you recommend instead.
  3. Why it is better.
  4. Risks or tradeoffs.
  5. Files/features affected.
  6. Whether the PRD should be updated.
- Wait for explicit user confirmation before implementing a changed plan.
- Do not silently skip required PRD behavior because an alternative seems simpler.
- Do not use this protocol to avoid hard parts of the build. A better plan must improve correctness, security, maintainability, performance, or delivery risk.

## Current-Version Rules

- Use the latest stable Next.js 16 release.
- Before writing or changing Next.js code, read the installed version-matched docs from `node_modules/next/dist/docs/`.
- Use App Router only.
- Use TypeScript strict mode.
- Use React 19-compatible patterns.
- Use Node.js 20.9.0 or newer.
- Use TypeScript 5.1.0 or newer.
- In Next.js 16, use `proxy.ts`, not `middleware.ts`.
- Use `proxy.ts` only for lightweight redirects and request checks.
- Do not use Proxy as the definitive authorization layer.
- Enforce authorization in server-rendered pages/layouts, server-only data helpers, and Server Actions.
- Use Prisma ORM 7 with the `prisma-client` generator, `prisma.config.ts`, `@prisma/adapter-pg`, and `pg`.

## Tech Stack

- Next.js 16 App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Table
- Lucide React
- Recharts
- Sonner
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- `@supabase/ssr`
- Prisma ORM 7
- `@prisma/adapter-pg`
- `pg`
- Redis-backed rate limiting, preferably Upstash Redis and `@upstash/ratelimit`

## Non-Negotiable Architecture

- Use `/dashboard/{role}` as the dashboard route pattern.
- Users have `roles UserRole[]`, not a single role field.
- `User.id` must equal the Supabase Auth user UUID.
- All user foreign keys must use UUID-compatible fields.
- Use Server Actions for application mutations.
- Use Route Handlers only for webhooks, third-party callbacks, health checks, public HTTP callbacks, and future OAuth callbacks.
- Keep Prisma access in server-only modules such as `lib/data/*`, `lib/actions/*`, or server-only helpers.
- Add `import "server-only"` to modules that import Prisma, service clients, private environment variables, or authorization logic.
- Do not import Prisma, service clients, or private env vars from Client Components.
- Validate form and action input with Zod.
- Every mutation must validate input, check permissions, enforce rate limits where applicable, and return a typed `ActionResult<T>`.
- Every sensitive mutation must write audit logs as described in the PRD.
- Normal queries must exclude soft-deleted records by default.
- Submitted academic records use withdrawal, archive, or soft delete. Hard delete is only for drafts, failed uploads, temporary files, test data, and retention cleanup.
- Use private Supabase Storage buckets for manuscript files.
- Store private storage paths, not public URLs.
- Generate signed download URLs server-side only after permission checks.
- Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser Supabase clients and `SUPABASE_SECRET_KEY` only in server-only code when privileged Supabase operations are unavoidable. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names may appear only for projects that have not migrated yet.
- Never expose Supabase secret/service-role keys, database credentials, signed URLs, manuscript content, confidential review comments, or tokens in logs.
- Store emails normalized lowercase and enforce case-insensitive identity and conflict checks.

## Shared Types

All Server Actions must return this shape:

```ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

Prefer named exports over default exports. Do not use `any`.

## Design Direction

Build a quiet, efficient SaaS dashboard. The app should feel closer to Linear, Vercel dashboard, and Stripe dashboard than a marketing site.

Follow the PRD for role dashboards, shell layout, stepper, timeline, tables, status badges, upload cards, empty states, dark mode, skeleton loaders, RoleSwitcher, responsive sidebar, and accessibility requirements.

Use the installed `ui-ux-pro-max` skill for UI/UX planning and UI-heavy implementation.

Required workflow:
- In Feature 1, generate and persist the master design system using `.codex/skills/ui-ux-pro-max/scripts/search.py` exactly as specified in the PRD's UI Skill Workflow section.
- Before implementing any UI-heavy feature, read `design-system/journalpilot/MASTER.md`.
- If a relevant page override exists in `design-system/journalpilot/pages/`, read it and apply it for visual/interaction details only.
- Before building dashboard shell, submission wizard, editor dashboard, admin analytics, or other major UI surfaces, create the relevant page override with the UI skill.
- Use UI skill recommendations only when they do not conflict with the PRD's product, workflow, security, database, and authorization requirements.
- Ignore UI-skill generated marketing, hero, contact-sales, testimonial, product-review, portfolio, or conversion-funnel patterns for authenticated dashboard screens.

Do not create a landing page unless the current feature explicitly asks for one. The first implemented screens should be usable product screens.

## Feature Backlog

Build in this exact order.

### Foundation

Feature 1 - Project setup and base tooling
- Create the Next.js 16 App Router project structure with `npx create-next-app@latest`.
- Confirm Node.js 20.9+ and TypeScript 5.1+.
- Add Tailwind CSS and shadcn/ui.
- Generate and persist the JournalPilot master design system with `ui-ux-pro-max` using the command in the PRD's UI Skill Workflow section.
- Enable TypeScript strict mode.
- Add `AGENTS.md` instructing AI agents to read installed Next.js docs before coding.
- Add `next.config.ts` with security headers, Server Action body size limits, and a documented Cache Components decision.
- Add base folders from the PRD app structure.
- Add `.env.example` with current Supabase publishable/secret key names, all required variables, and server-only warnings.
- Stop after this feature.

Feature 2 - Prisma schema and database setup
- Create `prisma/schema.prisma` using Prisma ORM 7 syntax.
- Use `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`.
- Do not add `previewFeatures = ["multiSchema"]` for Prisma ORM 7 unless the installed Prisma docs for the exact version explicitly require it.
- Create `prisma.config.ts` and configure the `DIRECT_URL` environment variable as Prisma Config `datasource.url` for Prisma CLI and migrations.
- Install and configure `@prisma/adapter-pg` and `pg`.
- Use Supabase UUID-based `User.id`.
- Use `UserRole[]` for multi-role users.
- Add all core models, enums, relations, and indexes from the PRD.
- Use private `app` schema for Prisma-managed tables.
- Add raw SQL migrations for partial unique indexes and integrity checks required by the PRD, including role-array invariants, status-history actor integrity, audit actor integrity, active-record uniqueness, primary-author uniqueness, co-author email uniqueness, case-insensitive user email uniqueness, revision numbers, and file size limits.
- Verify the `app` schema is not exposed through Supabase APIs.
- If any table is in `public` or another exposed schema, enable RLS and deny-by-default policies immediately.
- Run or provide `prisma validate` and `prisma generate`.
- Stop after this feature.

Feature 3 - Supabase auth integration
- Install and use `@supabase/ssr`.
- Add `lib/supabase/browser.ts`, `lib/supabase/server.ts`, and `lib/supabase/proxy.ts`.
- Add `lib/auth.ts`.
- Implement register flow that creates a Supabase Auth user first, then creates the matching Prisma `User` row using the same UUID.
- If Prisma `User` creation fails after Supabase Auth user creation, compensate with a server-only Supabase admin cleanup/disable step and return a generic retryable error.
- Add login, register, and forgot-password pages.
- Read `design-system/journalpilot/MASTER.md` before implementing auth UI and apply the UI skill's accessibility/contrast guidance.
- Stop after this feature.

Feature 4 - Authorization helpers and route protection
- Add `lib/permissions.ts`.
- Add `assertHasRole`, `assertAuthorOf`, `assertEditorOf`, `assertReviewerOf`, and `assertCanTransition`.
- Add `proxy.ts` for optimistic `/dashboard/{role}` redirects only.
- Make Proxy multi-role aware for redirects only.
- Stop after this feature.

Feature 5 - Dashboard shell and multi-role navigation
- Create the `dashboard-shell` page override with `ui-ux-pro-max` before implementation.
- Create `DashboardShell`, `SidebarNav`, `Topbar`, and `RoleSwitcher`.
- Show links for every role the user has.
- Let multi-role users switch between author, reviewer, editor, and admin dashboards.
- Add responsive desktop, tablet, and mobile sidebar behavior.
- Stop after this feature.

Feature 6 - Status machine
- Create `lib/status-machine.ts`.
- Add the `ALLOWED_TRANSITIONS` map from the PRD.
- Add `transitionStatus`.
- Write `ManuscriptStatusHistory` for every status change.
- Support `USER` and `SYSTEM` actors.
- Generate `Manuscript.displayId` on `DRAFT -> SUBMITTED` with `ManuscriptCounter` inside a transaction.
- Add unit tests for valid transitions, invalid transitions, actor rules, and duplicate-safe display ID generation.
- Stop after this feature.

Feature 7 - Soft delete, archive, and retention helpers
- Add soft-delete fields to soft-deletable models if not already present.
- Add user deactivation fields to `User`.
- Add reusable active-record query helpers that filter `deletedAt: null`.
- Add helpers or Server Actions for soft delete, restore, archive, withdraw, and hard-delete draft.
- Enforce that submitted manuscripts use withdrawal or archive, not hard delete.
- Add storage purge planning helpers for deleted files.
- Add unit tests proving normal queries exclude soft-deleted records.
- Stop after this feature.

Feature 8 - Security audit logging baseline
- Add or finalize `AuditLog`.
- Add an append-only audit helper.
- Log access denied, role changes, signed URL generation, uploads, submissions, review submission, and editor decisions.
- Hash IP and user-agent values if captured.
- Ensure logs do not store secrets, tokens, signed URLs, manuscript content, or confidential comments.
- Add tests for audit log creation on sensitive actions.
- Stop after this feature.

Feature 9 - Rate limiting baseline
- Add `lib/rate-limit.ts`.
- Use Redis-backed rate limiting.
- Add required environment variables.
- Add limits for auth-adjacent actions, manuscript submission, autosave, file metadata creation, signed URL generation, reviewer invitations, review submissions, editor decisions, admin role changes, and public Route Handlers.
- Log rate-limit denials to `AuditLog` with outcome `DENIED`.
- Add tests for rate-limited Server Actions and Route Handlers.
- Stop after this feature.

Feature 10 - Seed strategy
- Create `prisma/seed.ts` for journals, article types, and sample app data only.
- Document that real auth users must be created through Supabase Auth/Admin API first.
- Do not create real production users only through Prisma seed.
- Stop after this feature.

### Author

Feature 11 - Author dashboard
- Read `design-system/journalpilot/MASTER.md` before implementation.
- Add manuscript count cards.
- Add recent activity.
- Add revision requests.
- Use real Prisma queries through server-only data/action helpers.
- Stop after this feature.

Feature 12 - Manuscript draft creation
- Create the `submission-wizard` page override with `ui-ux-pro-max` before implementation.
- Add create draft action.
- Add wizard Step 1 and Step 2: journal/article type, title, abstract, keywords.
- Add Zod validation.
- Auto-save draft on step transition.
- Stop after this feature.

Feature 13 - Co-author management
- Add co-author form.
- Add reorder support.
- Auto-link co-author to `User` when email matches an existing account.
- Add primary author rules.
- Stop after this feature.

Feature 14 - File upload security
- Read the `submission-wizard` page override before implementing upload UI.
- Add `FileUploadCard`.
- Add Storage RLS policies or signed upload URL flow before enabling manuscript uploads.
- Verify manuscript buckets are private and never public.
- Store `filePath`, not public URL.
- Store required file metadata: `storageBucket`, sanitized `fileName`, `mimeType`, `fileSize`, and optional `sha256`.
- Validate file type and size on client and server.
- For direct client uploads, allow authenticated users to upload only into their own `{userId}/...` folder, or implement server-generated signed upload URLs.
- Stop after this feature.

Feature 15 - Submit manuscript
- Read the `submission-wizard` page override before implementing review/timeline UI.
- Add cover letter support using `Manuscript.coverLetter` and/or `FileCategory.COVER_LETTER`.
- Add declarations and review step.
- Submit manuscript using `transitionStatus` for `DRAFT -> SUBMITTED`.
- Create status history.
- Add manuscript detail and timeline page.
- Stop after this feature.

### Editor

Feature 16 - Editor dashboard and manuscript list
- Create the `editor-dashboard` page override with `ui-ux-pro-max` before implementation.
- Add new submissions count.
- Add pending decisions count.
- Add overdue reviews count.
- Add manuscript table with filters.
- Stop after this feature.

Feature 17 - Editor assignment and initial check
- Add initial check flow.
- Allow Admin to assign handling editor.
- Transition `SUBMITTED -> INITIAL_CHECK -> WITH_EDITOR`.
- Stop after this feature.

Feature 18 - Reviewer invitation with COI guards
- Read the `editor-dashboard` page override before implementing reviewer assignment UI.
- Add `ReviewerAssignmentPanel`.
- Search users with the `REVIEWER` role.
- Block editors from inviting themselves.
- Block reviewer invitation when reviewer email or user ID matches any `ManuscriptAuthor`.
- Add due date.
- Store the manuscript's current `revisionNumber` on each `ReviewInvitation`.
- Stop after this feature.

Feature 19 - Review progress automation
- Auto transition `REVIEWERS_INVITED -> UNDER_REVIEW` when at least one reviewer accepts.
- Auto transition `UNDER_REVIEW -> REVIEWS_COMPLETED` when submitted reviews for the current revision meet `Manuscript.requiredReviewCount`.
- Show overdue and late badges.
- Stop after this feature.

Feature 20 - Editorial decision
- Read the `editor-dashboard` page override before implementing decision UI.
- Add `DecisionLetterEditor`.
- Create `EditorDecision` with manuscript, editor, decision, and decision letter.
- Store the manuscript's current `revisionNumber` on each `EditorDecision`.
- Make the decision and status transition in one transaction.
- Set `Manuscript.decisionAt`.
- Use `transitionStatus`.
- Support accepted, rejected, and revision-requested outcomes.
- Make decision letter visible to the author.
- Stop after this feature.

### Reviewer

Feature 21 - Reviewer invitation dashboard
- Read `design-system/journalpilot/MASTER.md` before implementation.
- Show pending invitations.
- Allow accept and decline.
- Add due date and overdue badges.
- Stop after this feature.

Feature 22 - Permission-checked file downloads
- Add a Server Action to generate signed download URLs only after permission checks.
- Allow reviewers to access files only after accepting the invitation.
- Apply author, editor, and admin access rules from the PRD.
- Stop after this feature.

Feature 23 - Review submission
- Read `design-system/journalpilot/MASTER.md` before implementing review form UI.
- Add review form.
- Add scores, comments to author, confidential comments, and recommendation.
- Ensure one review per invitation.
- Store the invitation's `revisionNumber` on the `Review`.
- Stop after this feature.

### Admin

Feature 24 - Admin dashboard and journal management
- Read `design-system/journalpilot/MASTER.md` before implementation.
- Add platform stats.
- Add journals CRUD.
- Add article types CRUD per journal.
- Stop after this feature.

Feature 25 - User role management
- Add user list.
- Add multi-role assignment with checkboxes, not a single select.
- Stop after this feature.

Feature 26 - Email template editor
- Read `design-system/journalpilot/MASTER.md` before implementing editor UI.
- Add `EmailTemplate` CRUD.
- Add token preview rendering.
- Use an allowlisted, server-side token renderer that escapes values by default and sanitizes any rich HTML body before storing or sending.
- Stop after this feature.

Feature 27 - Analytics
- Create the `admin-analytics` page override with `ui-ux-pro-max` before implementation.
- Add submissions per month chart.
- Add decisions breakdown chart.
- Use Recharts with performance-safe dynamic imports where needed.
- Stop after this feature.

### Quality, Performance, And Testing

Feature 28 - Performance and observability baseline
- Add Turbopack analyzer workflow using `npx next experimental-analyze --output` and document how to run it.
- Add `instrumentation.ts` for OpenTelemetry-compatible tracing.
- Add server-side pagination, filtering, and sorting requirements for large tables.
- Add performance-safe dynamic imports for Recharts, rich text editor, upload, and table-heavy components.
- Review Prisma indexes against common dashboard filters.
- Add Core Web Vitals tracking plan.
- Add production performance checklist.
- Stop after this feature.

Feature 29 - Unit tests
- Add tests for `lib/permissions.ts`.
- Add tests for `lib/status-machine.ts`.
- Add tests for COI reviewer invitation guards.
- Add tests for soft-delete query helpers.
- Add tests for hard-delete restrictions on submitted manuscripts.
- Stop after this feature.

Feature 30 - Playwright demo flow
- Add Playwright E2E tests for the 10-step demo flow in the PRD.
- Stop after this feature.

## Verification Expectations

Add tests feature by feature. Do not postpone all testing until the end.

Each feature must include working tests or a clear manual verification path.

Required coverage over the full build:
- Permissions helpers.
- Status machine, including `USER` and `SYSTEM` actors.
- Soft-deleted records excluded from normal queries.
- COI guards blocking invalid reviewer invitations.
- Submitted manuscripts cannot be hard deleted through normal user actions.
- Editorial decisions create `EditorDecision` and status history in the same transaction.
- Sensitive actions create `AuditLog` rows without storing secrets, tokens, signed URLs, manuscript content, or confidential comments.
- Client Components cannot import server-only Prisma/data modules.
- The private `app` schema is not exposed through Supabase APIs.
- Any public or exposed table has RLS enabled and deny-by-default behavior.
- Private Storage buckets reject unauthorized access.
- Rate-limited actions return generic errors and do not mutate data.
- Rate-limit denials create `AuditLog` rows without storing raw IP addresses.
- Active global `EmailTemplate` slugs with `journalId NULL` cannot duplicate.
- Bundle analysis before production and after adding large client dependencies.
- Pagination and filtering queries tested against large seeded datasets.
- Core Web Vitals and slow Server Actions tracked in production.

## Response Format For Each Feature

Use this structure:

```md
## Feature N - Name

Goal:
- ...

Files:
- ...

Implementation:
- ...

Verification:
- Command run: ...
- Result: ...

Summary:
- ...

Assumptions and follow-ups:
- ...

Stopped here. Waiting for confirmation before Feature N+1.
```
