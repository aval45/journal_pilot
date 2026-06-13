"use client";

import { Loader2, Send } from "lucide-react";
import { useReducer, useTransition } from "react";

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

type SubmitState = {
  authorshipConfirmed: boolean;
  coverLetter: string;
  message: string | null;
  noConflictsConfirmed: boolean;
  originalityConfirmed: boolean;
};

type SubmitAction =
  | { type: "coverLetter"; value: string }
  | { type: "message"; value: string | null }
  | { checked: boolean; type: "authorship" | "originality" | "conflicts" };

function submitReducer(state: SubmitState, action: SubmitAction): SubmitState {
  switch (action.type) {
    case "authorship":
      return { ...state, authorshipConfirmed: action.checked };
    case "conflicts":
      return { ...state, noConflictsConfirmed: action.checked };
    case "coverLetter":
      return { ...state, coverLetter: action.value };
    case "message":
      return { ...state, message: action.value };
    case "originality":
      return { ...state, originalityConfirmed: action.checked };
  }
}

export function SubmitManuscriptPanel({
  initialCoverLetter,
  manuscriptId,
  status,
}: SubmitManuscriptPanelProps) {
  const [state, dispatch] = useReducer(submitReducer, {
    authorshipConfirmed: false,
    coverLetter: initialCoverLetter ?? "",
    message: null,
    noConflictsConfirmed: false,
    originalityConfirmed: false,
  });
  const [isPending, startTransition] = useTransition();
  const isRevision = status === ManuscriptStatus.REVISION_REQUESTED;

  function submit() {
    dispatch({ type: "message", value: null });
    startTransition(async () => {
      const action = isRevision ? submitRevisionAction : submitManuscriptAction;
      const result = await action({
        authorshipConfirmed: state.authorshipConfirmed,
        coverLetter: state.coverLetter,
        manuscriptId,
        noConflictsConfirmed: state.noConflictsConfirmed,
        originalityConfirmed: state.originalityConfirmed,
      });

      if (!result.success) {
        dispatch({ type: "message", value: result.error });
        return;
      }

      dispatch({
        type: "message",
        value: isRevision
          ? "Revision submitted and returned to the editor."
          : "Manuscript submitted.",
      });
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

      {state.message ? (
        <div className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </div>
      ) : null}

      <label className="mt-5 block text-sm font-semibold text-card-foreground">
        Cover letter
        <textarea
          className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          maxLength={10000}
          onChange={(event) =>
            dispatch({ type: "coverLetter", value: event.target.value })
          }
          value={state.coverLetter}
        />
      </label>

      <div className="mt-5 space-y-3">
        {[
          {
            checked: state.authorshipConfirmed,
            label:
              "All listed authors contributed to this manuscript and approve submission.",
            type: "authorship" as const,
          },
          {
            checked: state.originalityConfirmed,
            label:
              "This manuscript is original and is not under consideration elsewhere.",
            type: "originality" as const,
          },
          {
            checked: state.noConflictsConfirmed,
            label:
              "Conflict-of-interest disclosures are complete and accurate.",
            type: "conflicts" as const,
          },
        ].map((item) => (
          <label
            className="flex items-start gap-3 text-sm text-card-foreground"
            key={item.label}
          >
            <input
              checked={item.checked}
              className="mt-1 h-4 w-4 rounded border-input"
              onChange={(event) =>
                dispatch({ checked: event.target.checked, type: item.type })
              }
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
            !state.authorshipConfirmed ||
            !state.originalityConfirmed ||
            !state.noConflictsConfirmed
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
