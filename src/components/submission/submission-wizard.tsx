"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { Dispatch } from "react";
import { useMemo, useReducer, useTransition } from "react";

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

type ArticleTypeOption = SubmissionWizardOptions[number]["articleTypes"][number];

type WizardState = {
  abstract: string;
  articleTypeId: string;
  journalId: string;
  keywords: string;
  manuscriptId: string | null;
  message: string | null;
  step: number;
  title: string;
};

type WizardAction =
  | { articleTypeId: string; journalId: string; type: "journal" }
  | {
      field: "abstract" | "articleTypeId" | "keywords" | "title";
      type: "field";
      value: string;
    }
  | { type: "message"; value: string | null }
  | { manuscriptId: string; message: string; type: "draftStarted" }
  | { manuscriptId: string; message: string; type: "draftSaved" }
  | { step: number; type: "step" };

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

function StepList({
  currentStep,
  manuscriptId,
}: {
  currentStep: number;
  manuscriptId: string | null;
}) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {steps.map((item, index) => {
        const complete = index < currentStep || (index === 1 && Boolean(manuscriptId));
        const active = index === currentStep;
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
  );
}

function JournalStep({
  articleTypeId,
  articleTypes,
  changeJournal,
  dispatch,
  isPending,
  journalId,
  journals,
  saveStepOne,
}: {
  articleTypeId: string;
  articleTypes: ArticleTypeOption[];
  changeJournal: (journalId: string) => void;
  dispatch: Dispatch<WizardAction>;
  isPending: boolean;
  journalId: string;
  journals: SubmissionWizardOptions;
  saveStepOne: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-card-foreground">
          Journal and article type
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This selection is saved as soon as you continue to manuscript details.
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
          onChange={(event) =>
            dispatch({
              field: "articleTypeId",
              type: "field",
              value: event.target.value,
            })
          }
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
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Continue
        </button>
      </div>
    </div>
  );
}

function ManuscriptStep({
  dispatch,
  isPending,
  saveStepTwo,
  state,
}: {
  dispatch: Dispatch<WizardAction>;
  isPending: boolean;
  saveStepTwo: () => void;
  state: WizardState;
}) {
  return (
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
          onChange={(event) =>
            dispatch({
              field: "title",
              type: "field",
              value: event.target.value,
            })
          }
          value={state.title}
        />
      </label>

      <label className="block text-sm font-semibold text-card-foreground">
        Abstract
        <textarea
          className="mt-2 min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          maxLength={5000}
          onChange={(event) =>
            dispatch({
              field: "abstract",
              type: "field",
              value: event.target.value,
            })
          }
          value={state.abstract}
        />
      </label>

      <label className="block text-sm font-semibold text-card-foreground">
        Keywords
        <input
          className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          onChange={(event) =>
            dispatch({
              field: "keywords",
              type: "field",
              value: event.target.value,
            })
          }
          value={state.keywords}
        />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          Separate up to 12 keywords with commas.
        </span>
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          onClick={() => dispatch({ step: 0, type: "step" })}
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
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save draft
        </button>
      </div>
    </div>
  );
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "draftSaved":
      return {
        ...state,
        manuscriptId: action.manuscriptId,
        message: action.message,
      };
    case "draftStarted":
      return {
        ...state,
        manuscriptId: action.manuscriptId,
        message: action.message,
        step: 1,
      };
    case "field":
      return { ...state, [action.field]: action.value };
    case "journal":
      return {
        ...state,
        articleTypeId: action.articleTypeId,
        journalId: action.journalId,
      };
    case "message":
      return { ...state, message: action.value };
    case "step":
      return { ...state, step: action.step };
  }
}

export function SubmissionWizard({ journals }: SubmissionWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, {
    abstract: "",
    articleTypeId: journals[0]?.articleTypes[0]?.id ?? "",
    journalId: journals[0]?.id ?? "",
    keywords: "",
    manuscriptId: null,
    message: null,
    step: 0,
    title: "",
  });
  const [isPending, startTransition] = useTransition();

  const selectedJournal = useMemo(
    () => journals.find((journal) => journal.id === state.journalId),
    [state.journalId, journals],
  );
  const articleTypes = selectedJournal?.articleTypes ?? [];

  function changeJournal(nextJournalId: string) {
    const nextJournal = journals.find((journal) => journal.id === nextJournalId);

    dispatch({
      articleTypeId: nextJournal?.articleTypes[0]?.id ?? "",
      journalId: nextJournalId,
      type: "journal",
    });
  }

  function saveStepOne() {
    dispatch({ type: "message", value: null });
    startTransition(async () => {
      const result = state.manuscriptId
        ? { success: true as const, data: { manuscriptId: state.manuscriptId } }
        : await createManuscriptDraftAction({
            articleTypeId: state.articleTypeId,
            journalId: state.journalId,
          });

      if (!result.success) {
        dispatch({ type: "message", value: result.error });
        return;
      }

      dispatch({
        manuscriptId: result.data.manuscriptId,
        message: "Draft started. Journal selection saved.",
        type: "draftStarted",
      });
    });
  }

  function saveStepTwo() {
    dispatch({ type: "message", value: null });
    startTransition(async () => {
      let draft = state.manuscriptId;

      if (!draft) {
        const draftResult = await createManuscriptDraftAction({
          articleTypeId: state.articleTypeId,
          journalId: state.journalId,
        });

        if (!draftResult.success) {
          dispatch({ type: "message", value: draftResult.error });
          return;
        }

        draft = draftResult.data.manuscriptId;
      }

      if (!draft) {
        dispatch({
          type: "message",
          value: "We could not start this draft. Please try again.",
        });
        return;
      }

      const result = await autosaveManuscriptDraftAction({
        abstract: state.abstract,
        articleTypeId: state.articleTypeId,
        journalId: state.journalId,
        keywords: parseKeywordsInput(state.keywords),
        manuscriptId: draft,
        title: state.title,
      });

      if (!result.success) {
        dispatch({ type: "message", value: result.error });
        return;
      }

      dispatch({
        manuscriptId: result.data.manuscriptId,
        message: "Draft saved.",
        type: "draftSaved",
      });
    });
  }

  return (
    <div className="space-y-6">
      <StepList currentStep={state.step} manuscriptId={state.manuscriptId} />

      {state.message ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {state.step === 0 ? (
          <JournalStep
            articleTypeId={state.articleTypeId}
            articleTypes={articleTypes}
            changeJournal={changeJournal}
            dispatch={dispatch}
            isPending={isPending}
            journalId={state.journalId}
            journals={journals}
            saveStepOne={saveStepOne}
          />
        ) : (
          <ManuscriptStep
            dispatch={dispatch}
            isPending={isPending}
            saveStepTwo={saveStepTwo}
            state={state}
          />
        )}
      </section>
    </div>
  );
}
