import { ReviewInvitationStatus } from "@/generated/prisma/enums";
import { reviewDeadlineState } from "@/lib/editor-workflow";

export function DeadlineBadge({
  dueDate,
  status,
}: {
  dueDate?: Date | null;
  status: ReviewInvitationStatus;
}) {
  const state = reviewDeadlineState({ dueDate, status });

  if (!state) {
    return null;
  }

  return (
    <span className="inline-flex w-fit rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-foreground">
      {state === "late" ? "Late" : "Overdue"}
    </span>
  );
}
