import { UserRole } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import { assertHasRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

type DashboardRolePageProps = {
  role: UserRole;
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  AUTHOR: "Drafts, active submissions, revision requests, and recent manuscript activity will appear here.",
  REVIEWER: "Pending invitations, active reviews, due dates, and completed review history will appear here.",
  EDITOR: "Editorial queues, reviewer progress, overdue reviews, and decision workflows will appear here.",
  ADMIN: "Journal configuration, users, article types, templates, and analytics will appear here.",
};

export async function DashboardRolePage({ role }: DashboardRolePageProps) {
  const user = await requireCurrentUser();
  await assertHasRole(user.id, role);

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase text-primary">
          {ROLE_LABELS[role]}
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
          {ROLE_LABELS[role]} workspace
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {ROLE_DESCRIPTIONS[role]}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Queue", "Activity", "Next actions"].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-card-foreground">
              {label}
            </p>
            <div className="mt-4 h-20 rounded-md border border-dashed border-border bg-background" />
          </div>
        ))}
      </div>
    </section>
  );
}
