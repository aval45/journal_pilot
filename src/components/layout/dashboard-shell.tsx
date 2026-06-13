import { UserRole } from "@/generated/prisma/enums";

import { RoleSwitcher } from "./role-switcher";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

type DashboardShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    roles: UserRole[];
    primaryRole: UserRole;
    lastActiveRole: UserRole | null;
  };
  activeRole: UserRole;
};

export function DashboardShell({
  children,
  user,
  activeRole,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-border bg-card lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-6 px-4 py-5">
          <div>
            <p className="font-serif text-2xl font-semibold text-card-foreground">
              JournalPilot
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
          </div>

          <RoleSwitcher roles={user.roles} activeRole={activeRole} />
          <SidebarNav roles={user.roles} />

          <div className="mt-auto rounded-md border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
            Role-aware navigation is active. Access is still enforced in
            server-rendered pages and actions.
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <Topbar
          userName={user.name}
          roles={user.roles}
          activeRole={activeRole}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
