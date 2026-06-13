"use client";

import { Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { ManuscriptStatus } from "@/generated/prisma/enums";
import {
  submitManuscriptAction,
  submitRevisionAction,
} from "@/lib/actions/manuscript";

type SubmitManuscriptPanelProps = {
  initialCoverLetter?: string | null;
  manuscriptId: string;
  status: ManuscriptStatus;
};

export function SubmitManuscriptPanel({
  initialCoverLetter,
  manuscriptId,
  status,
}: SubmitManuscriptPanelProps) {
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter ?? "");
  const [authorshipConfirmed, setAuthorshipConfirmed] = useState(false);
  const [originalityConfirmed, setOriginalityConfirmed] = useState(false);
  const [noConflictsConfirmed, setNoConflictsConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isRevision = status === ManuscriptStatus.REVISION_REQUESTED;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const action = isRevision ? submitRevisionAction : submitManuscriptAction;
      const result = await action({
        authorshipConfirmed,
        coverLetter,
        manuscriptId,
        noConflictsConfirmed,
        originalityConfirmed,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setMessage(
        isRevision
          ? "Revision submitted and returned to the editor."
          : "Manuscript submitted.",
      );
      window.location.reload();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-card-foreground">
          Review and submit
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add an optional cover letter, confirm declarations, and send the
          manuscript into editorial workflow.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <label className="mt-5 block text-sm font-semibold text-card-foreground">
        Cover letter
        <textarea
          className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          maxLength={10000}
          onChange={(event) => setCoverLetter(event.target.value)}
          value={coverLetter}
        />
      </label>

      <div className="mt-5 space-y-3">
        {[
          {
            checked: authorshipConfirmed,
            label:
              "All listed authors contributed to this manuscript and approve submission.",
            setter: setAuthorshipConfirmed,
          },
          {
            checked: originalityConfirmed,
            label:
              "This manuscript is original and is not under consideration elsewhere.",
            setter: setOriginalityConfirmed,
          },
          {
            checked: noConflictsConfirmed,
            label:
              "Conflict-of-interest disclosures are complete and accurate.",
            setter: setNoConflictsConfirmed,
          },
        ].map((item) => (
          <label
            className="flex items-start gap-3 text-sm text-card-foreground"
            key={item.label}
          >
            <input
              checked={item.checked}
              className="mt-1 h-4 w-4 rounded border-input"
              onChange={(event) => item.setter(event.target.checked)}
              type="checkbox"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isPending ||
            !authorshipConfirmed ||
            !originalityConfirmed ||
            !noConflictsConfirmed
          }
          onClick={submit}
          type="button"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {isRevision ? "Submit revision" : "Submit manuscript"}
        </button>
      </div>
    </section>
  );
}
