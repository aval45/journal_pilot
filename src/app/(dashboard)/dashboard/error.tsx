"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="mt-4 font-serif text-2xl font-semibold text-card-foreground">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. Our team has been
        notified. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        type="button"
      >
        <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
        Try again
      </button>
      {process.env.NODE_ENV === "development" ? (
        <pre className="mt-8 max-w-full overflow-auto rounded bg-secondary p-4 text-left text-xs text-secondary-foreground">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
      ) : null}
    </div>
  );
}
