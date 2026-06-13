import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SubmissionWizard } from "@/components/submission/submission-wizard";
import { UserRole } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/auth";
import { getSubmissionWizardOptions } from "@/lib/data/submission-options";
import { assertHasRole } from "@/lib/permissions";

export default async function NewManuscriptPage() {
  const [user, journals] = await Promise.all([
    requireCurrentUser(),
    getSubmissionWizardOptions(),
  ]);
  await assertHasRole(user.id, UserRole.AUTHOR);

  return (
    <section className="mx-auto max-w-[1200px] space-y-6">
      <Link
        href="/dashboard/author"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        Back to manuscripts
      </Link>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase text-primary">
          Submission wizard
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-card-foreground">
          Start a manuscript draft
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Begin with journal scope, then save title, abstract, and keywords. Your
          draft can be completed with co-authors, files, declarations, and final
          review in the next steps.
        </p>
      </div>

      {journals.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No active journals are available yet. Ask an administrator to seed or
          configure journals before creating a submission.
        </div>
      ) : (
        <SubmissionWizard journals={journals} />
      )}
    </section>
  );
}
