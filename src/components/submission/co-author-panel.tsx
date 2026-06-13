"use client";

import { ArrowDown, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  addCoAuthorAction,
  removeCoAuthorAction,
  reorderCoAuthorsAction,
} from "@/lib/actions/manuscript";

type CoAuthor = {
  id: string;
  affiliation: string | null;
  email: string;
  isPrimary: boolean;
  name: string;
  order: number;
  userId: string | null;
};

type CoAuthorPanelProps = {
  authors: CoAuthor[];
  editable: boolean;
  manuscriptId: string;
};

export function CoAuthorPanel({
  authors,
  editable,
  manuscriptId,
}: CoAuthorPanelProps) {
  const [orderedAuthors, setOrderedAuthors] = useState(authors);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveAuthor(authorId: string, direction: -1 | 1) {
    const index = orderedAuthors.findIndex((author) => author.id === authorId);
    const nextIndex = index + direction;

    if (index <= 0 || nextIndex <= 0 || nextIndex >= orderedAuthors.length) {
      return;
    }

    const nextAuthors = [...orderedAuthors];
    const [author] = nextAuthors.splice(index, 1);
    nextAuthors.splice(nextIndex, 0, author);
    setOrderedAuthors(nextAuthors);
    setMessage(null);
    startTransition(async () => {
      const result = await reorderCoAuthorsAction({
        authorIds: nextAuthors.map((item) => item.id),
        manuscriptId,
      });

      setMessage(result.success ? "Author order saved." : result.error);
    });
  }

  function addAuthor() {
    setMessage(null);
    startTransition(async () => {
      const result = await addCoAuthorAction({
        affiliation,
        email,
        manuscriptId,
        name,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setName("");
      setEmail("");
      setAffiliation("");
      setMessage("Co-author added. Refreshing author list.");
      window.location.reload();
    });
  }

  function removeAuthor(authorId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await removeCoAuthorAction({
        authorId,
        manuscriptId,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setOrderedAuthors((current) =>
        current.filter((author) => author.id !== authorId),
      );
      setMessage("Co-author removed.");
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-card-foreground">
          Authors
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep the submitting author as primary. Additional co-authors are
          auto-linked when their email matches an existing account.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="mt-5 divide-y divide-border rounded-md border border-border">
        {orderedAuthors.map((author, index) => (
          <div
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={author.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-card-foreground">
                  {index + 1}. {author.name}
                </p>
                {author.isPrimary ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-primary">
                    Primary
                  </span>
                ) : null}
                {author.userId ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Linked account
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {author.email}
                {author.affiliation ? ` · ${author.affiliation}` : ""}
              </p>
            </div>

            {editable ? (
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Move ${author.name} up`}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={author.isPrimary || index <= 1 || isPending}
                  onClick={() => moveAuthor(author.id, -1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Move ${author.name} down`}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    author.isPrimary ||
                    index === orderedAuthors.length - 1 ||
                    isPending
                  }
                  onClick={() => moveAuthor(author.id, 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Remove ${author.name}`}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={author.isPrimary || isPending}
                  onClick={() => removeAuthor(author.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editable ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block text-sm font-semibold text-card-foreground">
            Name
            <input
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="block text-sm font-semibold text-card-foreground">
            Email
            <input
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-semibold text-card-foreground">
            Affiliation
            <input
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) => setAffiliation(event.target.value)}
              value={affiliation}
            />
          </label>
          <button
            className="inline-flex h-10 cursor-pointer items-center justify-center self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={addAuthor}
            type="button"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Add
          </button>
        </div>
      ) : null}
    </section>
  );
}
