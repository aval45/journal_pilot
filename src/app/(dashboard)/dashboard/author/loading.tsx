export default function AuthorDashboardLoading() {
  return (
    <section className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-center">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-muted"></div>
          <div className="h-8 w-64 rounded bg-muted"></div>
          <div className="h-4 w-96 rounded bg-muted"></div>
        </div>
        <div className="h-10 w-36 rounded-md bg-muted"></div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-24 rounded bg-muted"></div>
              <div className="h-5 w-5 rounded bg-muted"></div>
            </div>
            <div className="mt-4 h-8 w-12 rounded bg-muted"></div>
            <div className="mt-3 h-4 w-40 rounded bg-muted"></div>
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Left Column (Recent Manuscripts) */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-8 w-48 rounded bg-muted"></div>
          <div className="mt-2 h-4 w-72 rounded bg-muted"></div>
          
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-border pb-4">
                <div className="space-y-2 w-2/3">
                  <div className="h-5 w-3/4 rounded bg-muted"></div>
                  <div className="h-4 w-1/2 rounded bg-muted"></div>
                </div>
                <div className="h-6 w-24 rounded-full bg-muted"></div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column (Revision Requests) */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-8 w-40 rounded bg-muted"></div>
          <div className="mt-2 h-4 w-56 rounded bg-muted"></div>

          <div className="mt-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md border border-border p-4">
                <div className="h-4 w-full rounded bg-muted"></div>
                <div className="mt-2 h-4 w-2/3 rounded bg-muted"></div>
                <div className="mt-3 h-3 w-1/2 rounded bg-muted"></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
