"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  autosaveManuscriptDraftAction,
  createManuscriptDraftAction,
} from "@/lib/actions/manuscript";
import type { SubmissionWizardOptions } from "@/lib/data/submission-options";
import { cn } from "@/lib/utils";
import { parseKeywordsInput } from "@/lib/validators/manuscript";

type SubmissionWizardProps = {
  journals: SubmissionWizardOptions;
};

const steps = [
  {
    label: "Journal",
    description: "Choose the journal and article type.",
  },
  {
    label: "Manuscript",
    description: "Add title, abstract, and keywords.",
  },
];

export function SubmissionWizard({ journals }: SubmissionWizardProps) {
  const [step, setStep] = useState(0);
  const [journalId, setJournalId] = useState(journals[0]?.id ?? "");
  const [articleTypeId, setArticleTypeId] = useState(
    journals[0]?.articleTypes[0]?.id ?? "",
  );
  const [manuscriptId, setManuscriptId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedJournal = useMemo(
    () => journals.find((journal) => journal.id === journalId),
    [journalId, journals],
  );
  const articleTypes = selectedJournal?.articleTypes ?? [];

  function changeJournal(nextJournalId: string) {
    const nextJournal = journals.find((journal) => journal.id === nextJournalId);

    setJournalId(nextJournalId);
    setArticleTypeId(nextJournal?.articleTypes[0]?.id ?? "");
  }

  function saveStepOne() {
    setMessage(null);
    startTransition(async () => {
      const result = manuscriptId
        ? { success: true as const, data: { manuscriptId } }
        : await createManuscriptDraftAction({
            articleTypeId,
            journalId,
          });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setManuscriptId(result.data.manuscriptId);
      setStep(1);
      setMessage("Draft started. Journal selection saved.");
    });
  }

  function saveStepTwo() {
    setMessage(null);
    startTransition(async () => {
      let draft = manuscriptId;

      if (!draft) {
        const draftResult = await createManuscriptDraftAction({
          articleTypeId,
          journalId,
        });

        if (!draftResult.success) {
          setMessage(draftResult.error);
          return;
        }

        draft = draftResult.data.manuscriptId;
      }

      if (!draft) {
        setMessage("We could not start this draft. Please try again.");
        return;
      }

      const result = await autosaveManuscriptDraftAction({
        abstract,
        articleTypeId,
        journalId,
        keywords: parseKeywordsInput(keywords),
        manuscriptId: draft,
        title,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setManuscriptId(result.data.manuscriptId);
      setMessage("Draft saved.");
    });
  }

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 md:grid-cols-2">
        {steps.map((item, index) => {
          const complete = index < step || (index === 1 && Boolean(manuscriptId));
          const active = index === step;
          const Icon = complete ? CheckCircle2 : Circle;

          return (
            <li
              className={cn(
                "rounded-lg border border-border bg-card p-4",
                active && "border-primary",
              )}
              key={item.label}
            >
              <div className="flex items-start gap-3">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 h-5 w-5",
                    complete || active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {message ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-card-foreground">
                Journal and article type
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This selection is saved as soon as you continue to manuscript
                details.
              </p>
            </div>

            <label className="block text-sm font-semibold text-card-foreground">
              Journal
              <select
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => changeJournal(event.target.value)}
                value={journalId}
              >
                {journals.map((journal) => (
                  <option key={journal.id} value={journal.id}>
                    {journal.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-card-foreground">
              Article type
              <select
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => setArticleTypeId(event.target.value)}
                value={articleTypeId}
              >
                <option value="">Not sure yet</option>
                {articleTypes.map((articleType) => (
                  <option key={articleType.id} value={articleType.id}>
                    {articleType.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end">
              <button
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending || !journalId}
                onClick={saveStepOne}
                type="button"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                ) : null}
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-card-foreground">
                Manuscript details
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Save the draft before adding co-authors, files, declarations, and
                submission review.
              </p>
            </div>

            <label className="block text-sm font-semibold text-card-foreground">
              Title
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                maxLength={500}
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>

            <label className="block text-sm font-semibold text-card-foreground">
              Abstract
              <textarea
                className="mt-2 min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                maxLength={5000}
                onChange={(event) => setAbstract(event.target.value)}
                value={abstract}
              />
            </label>

            <label className="block text-sm font-semibold text-card-foreground">
              Keywords
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => setKeywords(event.target.value)}
                value={keywords}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Separate up to 12 keywords with commas.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                onClick={() => setStep(0)}
                type="button"
              >
                Back
              </button>
              <button
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={saveStepTwo}
                type="button"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                ) : null}
                Save draft
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
