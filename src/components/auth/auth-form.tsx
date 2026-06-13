"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/lib/actions/auth-state";

type AuthAction = (
  previousState: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type Field = {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
};

type AuthFormProps = {
  action: AuthAction;
  initialState: AuthActionState;
  fields: Field[];
  submitLabel: string;
  footerText: string;
  footerHref: string;
  footerLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function AuthForm({
  action,
  initialState,
  fields,
  submitLabel,
  footerText,
  footerHref,
  footerLabel,
  secondaryHref,
  secondaryLabel,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const message = state.success ? state.data.message : state.error;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <label
            htmlFor={field.name}
            className="block text-sm font-medium text-card-foreground"
          >
            {field.label}
          </label>
          <input
            aria-label={field.label}
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ))}

      {message ? (
        <p
          aria-live="polite"
          className={
            state.success
              ? "text-sm text-primary"
              : "text-sm text-destructive"
          }
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Working..." : submitLabel}
      </button>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {footerText}{" "}
          <Link
            href={footerHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {footerLabel}
          </Link>
        </p>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
