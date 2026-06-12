import type { ReactNode } from "react";

type AuthPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
}: AuthPanelProps) {
  return (
    <section className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase text-primary">{eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-card-foreground">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children}
    </section>
  );
}
