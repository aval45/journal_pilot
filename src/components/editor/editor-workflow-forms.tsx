"use client";

import { useActionState } from "react";
import { CheckCircle2, GitPullRequestArrow, Send, UserPlus } from "lucide-react";

import { EditorialDecision } from "@/generated/prisma/enums";
import {
  assignHandlingEditorAction,
  createEditorialDecisionAction,
  inviteReviewerAction,
  refreshReviewProgressAction,
  startInitialCheckAction,
  type EditorActionState,
} from "@/lib/actions/editor";
import { EDITORIAL_DECISION_LABELS } from "@/lib/editor-workflow";

const INITIAL_STATE: EditorActionState = {
  success: false,
  error: "",
};

type Option = {
  id: string;
  label: string;
  meta?: string | null;
};

function ActionMessage({ state }: { state: EditorActionState }) {
  const message = state.success ? state.data.message : state.error;

  if (!message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={state.success ? "text-sm text-primary" : "text-sm text-destructive"}
    >
      {message}
    </p>
  );
}

function SubmitButton({
  icon,
  label,
  pending,
}: {
  icon: React.ReactNode;
  label: string;
  pending: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {icon}
      {pending ? "Working..." : label}
    </button>
  );
}

export function InitialCheckForm({ manuscriptId }: { manuscriptId: string }) {
  const [state, formAction, pending] = useActionState(
    startInitialCheckAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <label className="block text-sm font-semibold text-card-foreground">
        Check note
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          maxLength={500}
          name="note"
          placeholder="Record any triage note for the editorial timeline."
        />
      </label>
      <ActionMessage state={state} />
      <SubmitButton
        icon={<CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />}
        label="Start initial check"
        pending={pending}
      />
    </form>
  );
}

export function AssignEditorForm({
  editors,
  manuscriptId,
}: {
  editors: Option[];
  manuscriptId: string;
}) {
  const [state, formAction, pending] = useActionState(
    assignHandlingEditorAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <label className="block text-sm font-semibold text-card-foreground">
        Handling editor
        <select
          className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          name="editorId"
          required
        >
          <option value="">Select editor</option>
          {editors.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-card-foreground">
        Assignment note
        <textarea
          className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          maxLength={500}
          name="note"
        />
      </label>
      <ActionMessage state={state} />
      <SubmitButton
        icon={<GitPullRequestArrow aria-hidden="true" className="mr-2 h-4 w-4" />}
        label="Assign editor"
        pending={pending}
      />
    </form>
  );
}

export function ReviewerInvitationForm({
  manuscriptId,
  reviewers,
}: {
  manuscriptId: string;
  reviewers: Option[];
}) {
  const [state, formAction, pending] = useActionState(
    inviteReviewerAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <label className="block text-sm font-semibold text-card-foreground">
        Reviewer
        <select
          className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          name="reviewerId"
          required
        >
          <option value="">Select reviewer</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              {reviewer.label}
              {reviewer.meta ? ` - ${reviewer.meta}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-card-foreground">
        Due date
        <input
          className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          name="dueDate"
          required
          type="date"
        />
      </label>
      <ActionMessage state={state} />
      <SubmitButton
        icon={<UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />}
        label="Invite reviewer"
        pending={pending}
      />
    </form>
  );
}

export function RefreshProgressForm({ manuscriptId }: { manuscriptId: string }) {
  const [state, formAction, pending] = useActionState(
    refreshReviewProgressAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <ActionMessage state={state} />
      <SubmitButton
        icon={<CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />}
        label="Refresh progress"
        pending={pending}
      />
    </form>
  );
}

export function DecisionLetterEditor({ manuscriptId }: { manuscriptId: string }) {
  const [state, formAction, pending] = useActionState(
    createEditorialDecisionAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <label className="block text-sm font-semibold text-card-foreground">
        Decision
        <select
          className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          name="decision"
          required
        >
          {Object.values(EditorialDecision).map((decision) => (
            <option key={decision} value={decision}>
              {EDITORIAL_DECISION_LABELS[decision]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-card-foreground">
        Decision letter
        <textarea
          className="mt-2 min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-ring"
          maxLength={20000}
          name="decisionLetter"
          required
          placeholder="Write the decision letter that will be visible to the submitting author."
        />
      </label>
      <ActionMessage state={state} />
      <SubmitButton
        icon={<Send aria-hidden="true" className="mr-2 h-4 w-4" />}
        label="Save decision"
        pending={pending}
      />
    </form>
  );
}
