import { Menu, Search } from "lucide-react";

import { UserRole } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/roles";

import { RoleSwitcher } from "./role-switcher";
import { SidebarNav } from "./sidebar-nav";
import { UserDropdown } from "./user-dropdown";

type TopbarProps = {
  userName: string;
  userEmail: string;
  roles: UserRole[];
  activeRole: UserRole;
};

export function Topbar({ userName, userEmail, roles, activeRole }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <details className="relative lg:hidden">
            <summary
              className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors duration-200 hover:bg-secondary [&::-webkit-details-marker]:hidden"
              aria-label="Open navigation"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </summary>
            <div className="absolute left-0 top-12 z-30 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
              <div className="mb-3">
                <RoleSwitcher roles={roles} activeRole={activeRole} />
              </div>
              <SidebarNav roles={roles} />
            </div>
          </details>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {ROLE_LABELS[activeRole]} dashboard
            </p>
            <h1 className="truncate text-base font-semibold text-card-foreground">
              Welcome, {userName}
            </h1>
          </div>
        </div>

        <div className="hidden min-w-56 max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground md:flex">
          <Search aria-hidden="true" className="h-4 w-4" />
          <span>Search manuscripts</span>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden w-44 md:block">
            <RoleSwitcher roles={roles} activeRole={activeRole} />
          </div>
          <UserDropdown userName={userName} userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
