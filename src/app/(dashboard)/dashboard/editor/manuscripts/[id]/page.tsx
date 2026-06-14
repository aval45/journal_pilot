import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import {
  AssignEditorForm,
  DecisionLetterEditor,
  InitialCheckForm,
  RefreshProgressForm,
  ReviewerInvitationForm,
} from "@/components/editor/editor-workflow-forms";
import { DeadlineBadge } from "@/components/editor/deadline-badge";
import { StatusBadge } from "@/components/editor/status-badge";
import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import {
  getEditorDashboardData,
  getEditorManuscriptDetail,
} from "@/lib/data/editor-dashboard";
import { EDITORIAL_DECISION_LABELS } from "@/lib/editor-workflow";
import { formatFileSize } from "@/lib/file-policy";

type EditorManuscriptPageProps = {
  params: Promise<{ id: string }>;
};

const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

const REVIEWER_ACTION_STATUSES: ManuscriptStatus[] = [
  ManuscriptStatus.WITH_EDITOR,
  ManuscriptStatus.REVIEWERS_INVITED,
  ManuscriptStatus.UNDER_REVIEW,
];

const PROGRESS_ACTION_STATUSES: ManuscriptStatus[] = [
  ManuscriptStatus.REVIEWERS_INVITED,
  ManuscriptStatus.UNDER_REVIEW,
];

const DECISION_ACTION_STATUSES: ManuscriptStatus[] = [
  ManuscriptStatus.REVIEWS_COMPLETED,
  ManuscriptStatus.DECISION_IN_PROCESS,
];

function formatDate(date?: Date | null) {
  return date ? MEDIUM_DATE_FORMATTER.format(date) : "Not set";
}

function workflowHint(status: ManuscriptStatus) {
  if (status === ManuscriptStatus.SUBMITTED) {
    return "Start the initial editorial check to record triage and move the manuscript forward.";
  }

  if (status === ManuscriptStatus.INITIAL_CHECK) {
    return "An admin can assign a handling editor and move this manuscript into editor handling.";
  }

  if (
    status === ManuscriptStatus.WITH_EDITOR ||
    status === ManuscriptStatus.REVIEWERS_INVITED ||
    status === ManuscriptStatus.UNDER_REVIEW
  ) {
    return "Invite reviewers, monitor deadlines, and refresh automated progress when reviews arrive.";
  }

  if (
    status === ManuscriptStatus.REVIEWS_COMPLETED ||
    status === ManuscriptStatus.DECISION_IN_PROCESS
  ) {
    return "Reviews are ready for an editorial decision and author-visible letter.";
  }

  return "This manuscript has no editor action available in the current state.";
}

export default async function EditorManuscriptPage({
  params,
}: EditorManuscriptPageProps) {
  const [{ id }, user] = await Promise.all([params, requireCurrentUser()]);
  const [dashboardData, manuscript] = await Promise.all([
    getEditorDashboardData(user),
    getEditorManuscriptDetail({ manuscriptId: id, user }),
  ]);

  if (!manuscript) {
    notFound();
  }

  const isAdmin = user.roles.includes(UserRole.ADMIN);
  const canInviteReviewers =
    manuscript.handlingEditor?.id === user.id &&
    REVIEWER_ACTION_STATUSES.includes(manuscript.status);
  const canRefreshProgress =
    manuscript.handlingEditor?.id === user.id &&
    PROGRESS_ACTION_STATUSES.includes(manuscript.status);
  const canDecide =
    manuscript.handlingEditor?.id === user.id &&
    DECISION_ACTION_STATUSES.includes(manuscript.status);
  const currentInvitations = manuscript.invitations.filter(
    (invitation) => invitation.revisionNumber === manuscript.revisionNumber,
  );
  const currentReviews = manuscript.reviews.filter(
    (review) => review.revisionNumber === manuscript.revisionNumber,
  );

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
        href="/dashboard/editor"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        Back to editorial queue
      </Link>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-primary">
              {manuscript.displayId ?? "Unassigned ID"}
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
              {manuscript.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {manuscript.journal.name}
              {manuscript.articleType
                ? ` · ${manuscript.articleType.name}`
                : ""}{" "}
              · Revision {manuscript.revisionNumber} · Submitted by{" "}
              {manuscript.submittingAuthor.name}
            </p>
          </div>
          <StatusBadge status={manuscript.status} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <FileText aria-hidden="true" className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-serif text-2xl font-semibold text-card-foreground">
                  Manuscript summary
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {manuscript.abstract}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {manuscript.keywords.map((keyword) => (
                <span
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  key={keyword}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-serif text-2xl font-semibold text-card-foreground">
              Review progress
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentReviews.length} of {manuscript.requiredReviewCount} required
              reviews submitted for revision {manuscript.revisionNumber}.
            </p>
            <div className="mt-5 divide-y divide-border rounded-md border border-border">
              {currentInvitations.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No reviewers have been invited for this revision.
                </div>
              ) : (
                currentInvitations.map((invitation) => (
                  <div
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={invitation.id}
                  >
                    <div>
                      <p className="font-semibold text-card-foreground">
                        {invitation.reviewer.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {invitation.status.toLowerCase()} · Due{" "}
                        {formatDate(invitation.dueDate)}
                        {invitation.review
                          ? ` · Review submitted ${formatDate(
                              invitation.review.submittedAt,
                            )}`
                          : ""}
                      </p>
                    </div>
                    <DeadlineBadge
                      dueDate={invitation.dueDate}
                      status={invitation.status}
                    />
                  </div>
                ))
              )}
            </div>
            {canRefreshProgress ? (
              <div className="mt-5">
                <RefreshProgressForm manuscriptId={manuscript.id} />
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-serif text-2xl font-semibold text-card-foreground">
              Files
            </h3>
            <div className="mt-5 divide-y divide-border rounded-md border border-border">
              {manuscript.files.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No files are available for this manuscript.
                </div>
              ) : (
                manuscript.files.map((file) => (
                  <div
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={file.id}
                  >
                    <div>
                      <p className="font-semibold text-card-foreground">
                        {file.fileName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {file.fileCategory.replaceAll("_", " ")} ·{" "}
                        {file.mimeType} · {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      Revision {file.revisionNumber}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {manuscript.decisions.length > 0 ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="font-serif text-2xl font-semibold text-card-foreground">
                Decision history
              </h3>
              <div className="mt-5 space-y-4">
                {manuscript.decisions.map((decision) => (
                  <article
                    className="rounded-md border border-border bg-background p-4"
                    key={decision.id}
                  >
                    <p className="text-sm font-semibold text-card-foreground">
                      {EDITORIAL_DECISION_LABELS[decision.decision]} · Revision{" "}
                      {decision.revisionNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(decision.createdAt)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {decision.decisionLetter}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-serif text-2xl font-semibold text-card-foreground">
              Workflow
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {workflowHint(manuscript.status)}
            </p>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-card-foreground">
                  Handling editor
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {manuscript.handlingEditor?.name ?? "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-card-foreground">Submitted</dt>
                <dd className="mt-1 text-muted-foreground">
                  {formatDate(manuscript.submittedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-card-foreground">Decision</dt>
                <dd className="mt-1 text-muted-foreground">
                  {formatDate(manuscript.decisionAt)}
                </dd>
              </div>
            </dl>
          </section>

          {manuscript.status === ManuscriptStatus.SUBMITTED ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-card-foreground">
                Initial check
              </h3>
              <div className="mt-4">
                <InitialCheckForm manuscriptId={manuscript.id} />
              </div>
            </section>
          ) : null}

          {isAdmin && manuscript.status === ManuscriptStatus.INITIAL_CHECK ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-card-foreground">
                Assign editor
              </h3>
              <div className="mt-4">
                <AssignEditorForm
                  editors={dashboardData.editors.map((editor) => ({
                    id: editor.id,
                    label: editor.name,
                  }))}
                  manuscriptId={manuscript.id}
                />
              </div>
            </section>
          ) : null}

          {canInviteReviewers ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-card-foreground">
                Invite reviewer
              </h3>
              <div className="mt-4">
                <ReviewerInvitationForm
                  manuscriptId={manuscript.id}
                  reviewers={dashboardData.reviewers.map((reviewer) => ({
                    id: reviewer.id,
                    label: reviewer.name,
                    meta: reviewer.profile?.expertise ?? reviewer.email,
                  }))}
                />
              </div>
            </section>
          ) : null}

          {canDecide ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-card-foreground">
                Decision letter
              </h3>
              <div className="mt-4">
                <DecisionLetterEditor manuscriptId={manuscript.id} />
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
