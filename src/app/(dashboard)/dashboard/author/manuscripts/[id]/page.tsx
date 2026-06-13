import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CoAuthorPanel } from "@/components/submission/co-author-panel";
import { FileUploadCard } from "@/components/submission/file-upload-card";
import { SubmitManuscriptPanel } from "@/components/submission/submit-manuscript-panel";
import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
import { formatFileSize } from "@/lib/file-policy";
import { requireCurrentUser } from "@/lib/auth";
import { getAuthorManuscriptDetail } from "@/lib/data/manuscript-detail";
import { assertHasRole } from "@/lib/permissions";

const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  ACCEPTED: "Accepted",
  DECISION_IN_PROCESS: "Decision in process",
  DRAFT: "Draft",
  INITIAL_CHECK: "Initial check",
  REJECTED: "Rejected",
  REVIEWERS_INVITED: "Reviewers invited",
  REVIEWS_COMPLETED: "Reviews completed",
  REVISION_REQUESTED: "Revision requested",
  REVISION_SUBMITTED: "Revision submitted",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  WITHDRAWN: "Withdrawn",
  WITH_EDITOR: "With editor",
};

type ManuscriptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuthorManuscriptPage({
  params,
}: ManuscriptPageProps) {
  const [{ id }, user] = await Promise.all([params, requireCurrentUser()]);
  const [, manuscript] = await Promise.all([
    assertHasRole(user.id, UserRole.AUTHOR),
    getAuthorManuscriptDetail({
      manuscriptId: id,
      userId: user.id,
    }),
  ]);

  if (!manuscript) {
    notFound();
  }

  const editable = manuscript.status === ManuscriptStatus.DRAFT;

  return (
    <section className="space-y-6">
      <Link
        href="/dashboard/author"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        Back to manuscripts
      </Link>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-primary">
              {manuscript.displayId ?? "Draft manuscript"}
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
              {manuscript.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {manuscript.journal.name}
              {manuscript.articleType
                ? ` · ${manuscript.articleType.name}`
                : ""}{" "}
              · Revision {manuscript.revisionNumber}
            </p>
          </div>
          <span className="w-fit rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground">
            {STATUS_LABELS[manuscript.status]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <CoAuthorPanel
            authors={manuscript.authors}
            editable={editable}
            manuscriptId={manuscript.id}
          />
          {editable ? <FileUploadCard manuscriptId={manuscript.id} /> : null}
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-serif text-2xl font-semibold text-card-foreground">
              Uploaded files
            </h3>
            <div className="mt-5 divide-y divide-border rounded-md border border-border">
              {manuscript.files.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No files have been uploaded yet.
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
          {manuscript.status === ManuscriptStatus.DRAFT ||
          manuscript.status === ManuscriptStatus.REVISION_REQUESTED ? (
            <SubmitManuscriptPanel
              initialCoverLetter={manuscript.coverLetter}
              manuscriptId={manuscript.id}
              status={manuscript.status}
            />
          ) : null}
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="font-serif text-2xl font-semibold text-card-foreground">
            Draft status
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Co-author changes are available only while the manuscript is a draft.
            Submitted manuscripts preserve the author list used for review.
          </p>
          <div className="mt-5 rounded-md border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Keywords
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {manuscript.keywords.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No keywords saved.
                </span>
              ) : (
                manuscript.keywords.map((keyword) => (
                  <span
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                    key={keyword}
                  >
                    {keyword}
                  </span>
                ))
              )}
            </div>
          </div>
          <Link
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            href={`/dashboard/author/manuscripts/${manuscript.id}/timeline`}
          >
            View timeline
          </Link>
        </aside>
      </div>
    </section>
  );
}
