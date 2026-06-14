import { ManuscriptStatus } from "@/generated/prisma/enums";

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

const STATUS_TONES: Record<ManuscriptStatus, string> = {
  ACCEPTED: "border-accent/40 bg-accent/10 text-foreground",
  DECISION_IN_PROCESS: "border-primary/40 bg-primary/10 text-foreground",
  DRAFT: "border-border bg-secondary text-muted-foreground",
  INITIAL_CHECK: "border-primary/40 bg-primary/10 text-foreground",
  REJECTED: "border-destructive/40 bg-destructive/10 text-foreground",
  REVIEWERS_INVITED: "border-primary/40 bg-primary/10 text-foreground",
  REVIEWS_COMPLETED: "border-accent/40 bg-accent/10 text-foreground",
  REVISION_REQUESTED: "border-destructive/40 bg-destructive/10 text-foreground",
  REVISION_SUBMITTED: "border-primary/40 bg-primary/10 text-foreground",
  SUBMITTED: "border-primary/40 bg-primary/10 text-foreground",
  UNDER_REVIEW: "border-primary/40 bg-primary/10 text-foreground",
  WITHDRAWN: "border-border bg-secondary text-muted-foreground",
  WITH_EDITOR: "border-primary/40 bg-primary/10 text-foreground",
};

export function StatusBadge({ status }: { status: ManuscriptStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
