import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-card p-8 shadow-sm">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm font-medium text-muted-foreground">
        Loading...
      </p>
    </div>
  );
}
