import { Activity, AlertTriangle, FileText, Inbox } from "lucide-react";

import { ManuscriptTitleLink } from "@/components/editor/manuscript-title-link";
import { StatusBadge } from "@/components/editor/status-badge";
import { ManuscriptStatus } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import { getEditorDashboardData } from "@/lib/data/editor-dashboard";

type EditorDashboardPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const FILTERS: Array<{ label: string; value: "all" | ManuscriptStatus }> = [
  { label: "All", value: "all" },
  { label: "New", value: ManuscriptStatus.SUBMITTED },
  { label: "Initial check", value: ManuscriptStatus.INITIAL_CHECK },
  { label: "With editor", value: ManuscriptStatus.WITH_EDITOR },
  { label: "Review", value: ManuscriptStatus.UNDER_REVIEW },
  { label: "Decision", value: ManuscriptStatus.REVIEWS_COMPLETED },
];

const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

function formatDate(date?: Date | null) {
  return date ? MEDIUM_DATE_FORMATTER.format(date) : "Not set";
}

export default async function EditorDashboardPage({
  searchParams,
}: EditorDashboardPageProps) {
  const [user, params] = await Promise.all([requireCurrentUser(), searchParams]);
  const data = await getEditorDashboardData(user);
  const selectedStatus = Object.values(ManuscriptStatus).includes(
    params.status as ManuscriptStatus,
  )
    ? (params.status as ManuscriptStatus)
    : "all";
  const manuscripts =
    selectedStatus === "all"
      ? data.manuscripts
      : data.manuscripts.filter(
          (manuscript) => manuscript.status === selectedStatus,
        );

  const metrics = [
    {
      icon: Inbox,
      label: "New submissions",
      value: data.metrics.newSubmissions,
    },
    {
      icon: Activity,
      label: "Pending decisions",
      value: data.metrics.pendingDecisions,
    },
    {
      icon: AlertTriangle,
      label: "Overdue or late",
      value: data.metrics.overdueReviews,
    },
    {
      icon: FileText,
      label: "Visible manuscripts",
      value: data.metrics.totalVisible,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase text-primary">
          Editor workspace
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
          Editorial queue
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track submitted manuscripts, reviewer progress, deadlines, and
          decision-ready files from one operational queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
              key={metric.label}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-3 font-serif text-3xl font-semibold text-card-foreground">
                {metric.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-card-foreground">
              Manuscripts
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter by workflow state and open a manuscript for assignment,
              reviewer, progress, or decision actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const href =
                filter.value === "all"
                  ? "/dashboard/editor"
                  : `/dashboard/editor?status=${filter.value}`;
              const active = selectedStatus === filter.value;

              return (
                <a
                  className={`inline-flex min-h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-semibold transition-colors duration-200 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  href={href}
                  key={filter.value}
                >
                  {filter.label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Manuscript</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Editor</th>
                <th className="px-4 py-3 font-semibold">Reviews</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {manuscripts.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No manuscripts match this filter.
                  </td>
                </tr>
              ) : (
                manuscripts.map((manuscript) => (
                  <tr
                    className="transition-colors duration-200 hover:bg-secondary/60"
                    key={manuscript.id}
                  >
                    <td className="px-4 py-4 align-top">
                      <ManuscriptTitleLink
                        id={manuscript.id}
                        title={manuscript.title}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {manuscript.displayId ?? "Unassigned ID"} ·{" "}
                        {manuscript.journal.name}
                        {manuscript.articleType
                          ? ` · ${manuscript.articleType.name}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge status={manuscript.status} />
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {manuscript.handlingEditor?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      <span className="font-semibold text-card-foreground">
                        {manuscript.currentReviewCount}
                      </span>{" "}
                      / {manuscript.requiredReviewCount} reviews ·{" "}
                      {manuscript.currentInvitationCount} invites
                      {manuscript.overdueCount > 0 ? (
                        <span className="ml-2 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-foreground">
                          {manuscript.overdueCount} late
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {formatDate(manuscript.submittedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
