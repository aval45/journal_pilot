export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-3xl rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium uppercase text-muted-foreground">
          Foundation
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-card-foreground">
          JournalPilot
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Feature 1 has the project scaffold, base tooling, security headers,
          environment template, and design-system source ready for the first
          product surfaces.
        </p>
        <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-4">
            Next.js 16
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            Tailwind CSS
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            shadcn/ui base
          </div>
        </div>
      </section>
    </main>
  );
}
