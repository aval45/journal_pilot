import { notFound } from "next/navigation";

import { CoAuthorPanel } from "@/components/submission/co-author-panel";
import { ManuscriptStatus, UserRole } from "@/generated/prisma/enums";
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
  const { id } = await params;
  const user = await requireCurrentUser();
  await assertHasRole(user.id, UserRole.AUTHOR);
  const manuscript = await getAuthorManuscriptDetail({
    manuscriptId: id,
    userId: user.id,
  });

  if (!manuscript) {
    notFound();
  }

  const editable = manuscript.status === ManuscriptStatus.DRAFT;

  return (
    <section className="space-y-6">
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
        </aside>
      </div>
    </section>
  );
}
