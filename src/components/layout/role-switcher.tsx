"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { UserRole } from "@/generated/prisma/enums";
import { switchDashboardRoleAction } from "@/lib/actions/role";
import { ROLE_LABELS, roleDashboardPath } from "@/lib/roles";

type RoleSwitcherProps = {
  roles: UserRole[];
  activeRole: UserRole;
};

export function RoleSwitcher({ roles, activeRole }: RoleSwitcherProps) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <div className="space-y-1">
      <label htmlFor="role-switcher" className="sr-only">
        Switch dashboard role
      </label>
      <div className="relative">
        <select
          id="role-switcher"
          defaultValue={activeRole}
          className="h-10 w-full cursor-pointer appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm font-medium text-foreground transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => {
            const role = event.currentTarget.value as UserRole;
            setError("");

            startTransition(async () => {
              const result = await switchDashboardRoleAction({ role });

              if (!result.success) {
                setError(result.error);
                return;
              }

              router.push(roleDashboardPath(role));
            });
          }}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
