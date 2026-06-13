import Link from "next/link";

import { UserRole } from "@/generated/prisma/enums";
import { AccessDeniedError } from "@/lib/access-errors";
import { requireCurrentUser } from "@/lib/auth";
import { assertHasRole } from "@/lib/permissions";
import {
  resolveDefaultDashboardRole,
  ROLE_LABELS,
  roleDashboardPath,
} from "@/lib/roles";

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

  try {
    await assertHasRole(user.id, role);
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) {
      throw error;
    }

    const fallbackRole = resolveDefaultDashboardRole(user);

    return (
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase text-primary">
            Access denied
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
            {ROLE_LABELS[role]} workspace unavailable
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Your account does not currently include the {ROLE_LABELS[role]} role.
            Ask an administrator to assign that role if you need this workspace.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={roleDashboardPath(fallbackRole)}
          >
            Go to {ROLE_LABELS[fallbackRole]} workspace
          </Link>
        </div>
      </section>
    );
  }

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
