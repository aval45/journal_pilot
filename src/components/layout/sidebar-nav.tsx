"use client";

import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, roleDashboardPath } from "@/lib/roles";

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  AUTHOR: FileText,
  REVIEWER: ClipboardCheck,
  EDITOR: BarChart3,
  ADMIN: Settings,
};

type SidebarNavProps = {
  roles: UserRole[];
};

export function SidebarNav({ roles }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard roles" className="space-y-1">
      {roles.map((role) => {
        const href = roleDashboardPath(role);
        const Icon = ROLE_ICONS[role];
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={role}
            href={href}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{ROLE_LABELS[role]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
