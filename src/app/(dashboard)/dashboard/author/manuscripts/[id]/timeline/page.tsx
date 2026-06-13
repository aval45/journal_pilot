import Link from "next/link";
import { notFound } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import { getAuthorManuscriptDetail } from "@/lib/data/manuscript-detail";
import { assertHasRole } from "@/lib/permissions";

type TimelinePageProps = {
  params: Promise<{ id: string }>;
};

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(date: Date) {
  return TIMELINE_DATE_FORMATTER.format(date);
}

export default async function ManuscriptTimelinePage({
  params,
}: TimelinePageProps) {
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

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase text-primary">
          Manuscript timeline
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
          {manuscript.title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {manuscript.displayId ?? "Draft"} · Revision{" "}
          {manuscript.revisionNumber}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {manuscript.statusHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No status history has been recorded yet.
          </p>
        ) : (
          <ol className="space-y-4">
            {manuscript.statusHistory.map((event) => (
              <li className="border-l border-border pl-4" key={event.id}>
                <p className="text-sm font-semibold text-card-foreground">
                  {event.fromStatus ?? "Created"} → {event.toStatus}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(event.createdAt)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Link
        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        href={`/dashboard/author/manuscripts/${manuscript.id}`}
      >
        Back to manuscript
      </Link>
    </section>
  );
}
