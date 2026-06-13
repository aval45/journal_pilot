import { ArrowRight, FilePenLine, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";

import { UserRole } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import { getAuthorDashboardData } from "@/lib/data/author-dashboard";
import { assertHasRole } from "@/lib/permissions";

const STATUS_LABELS: Record<string, string> = {
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function AuthorDashboardPage() {
  const user = await requireCurrentUser();
  await assertHasRole(user.id, UserRole.AUTHOR);
  const data = await getAuthorDashboardData(user.id);

  const cards = [
    {
      label: "Drafts",
      value: data.counts.drafts,
      detail: "Manuscripts not yet submitted",
      icon: FilePenLine,
    },
    {
      label: "Active",
      value: data.counts.active,
      detail: "In editorial or review workflow",
      icon: FileText,
    },
    {
      label: "Revision requests",
      value: data.counts.revisionRequests,
      detail: "Awaiting author response",
      icon: RefreshCw,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase text-primary">
            Author workspace
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
            Manuscript activity
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Track drafts, submitted manuscripts, editorial movement, and revision
            requests from your author queue.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          href="/dashboard/author/manuscripts/new"
        >
          New manuscript
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
              key={card.label}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  {card.label}
                </p>
                <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-card-foreground">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {card.detail}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-card-foreground">
                Recent manuscripts
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest author-owned records across draft and submission states.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-border">
            {data.recentManuscripts.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No manuscripts yet. Start a new manuscript when you are ready.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.recentManuscripts.map((manuscript) => (
                  <Link
                    className="flex items-center justify-between gap-4 p-4 text-sm transition-colors hover:bg-secondary"
                    href={`/dashboard/author/manuscripts/${manuscript.id}`}
                    key={manuscript.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-card-foreground">
                        {manuscript.title}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {manuscript.displayId ?? "Draft"} ·{" "}
                        {manuscript.journal.name} · Revision{" "}
                        {manuscript.revisionNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {STATUS_LABELS[manuscript.status]}
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(manuscript.updatedAt)}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="font-serif text-2xl font-semibold text-card-foreground">
            Revision requests
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Items currently waiting for a revised submission.
          </p>

          <div className="mt-5 space-y-3">
            {data.revisionRequests.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No open revision requests.
              </div>
            ) : (
              data.revisionRequests.map((manuscript) => (
                <Link
                  className="block rounded-md border border-border p-4 transition-colors hover:bg-secondary"
                  href={`/dashboard/author/manuscripts/${manuscript.id}`}
                  key={manuscript.id}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-card-foreground">
                    {manuscript.title}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {manuscript.displayId ?? "Draft"} · Revision{" "}
                    {manuscript.revisionNumber} · Updated{" "}
                    {formatDate(manuscript.updatedAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
