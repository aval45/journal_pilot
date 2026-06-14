"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { logoutAction } from "@/lib/actions/logout";

type UserDropdownProps = {
  userName: string;
  userEmail: string;
};

export function UserDropdown({ userName, userEmail }: UserDropdownProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <details className="group relative">
      <summary
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground outline-none transition-colors duration-200 hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
        aria-label="User account menu"
      >
        {initials}
      </summary>

      <button
        aria-label="Close account menu"
        className="fixed inset-0 z-40 hidden cursor-default group-open:block"
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.removeAttribute("open");
          }
        }}
        type="button"
      />

      <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-border bg-card shadow-lg opacity-0 pointer-events-none transition-all duration-200 group-open:pointer-events-auto group-open:opacity-100">
        <div className="flex flex-col space-y-1 border-b border-border p-4">
          <p className="text-sm font-medium leading-none text-card-foreground">
            {userName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <div className="p-2">
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
            {isPending ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>
    </details>
  );
}
