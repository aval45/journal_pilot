import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function ManuscriptNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <FileQuestion aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 font-serif text-2xl font-semibold text-card-foreground">
        Manuscript not found
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The manuscript you are looking for does not exist, has been deleted, or you do not have permission to view it.
      </p>
      <Link
        href="/dashboard/author"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Return to manuscripts
      </Link>
    </div>
  );
}
