export default function AuthorManuscriptLoading() {
  return (
    <section className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 w-2/3">
            <div className="h-4 w-32 rounded bg-muted"></div>
            <div className="h-8 w-3/4 rounded bg-muted"></div>
            <div className="h-4 w-1/2 rounded bg-muted"></div>
          </div>
          <div className="h-7 w-28 rounded-full bg-muted"></div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main Content Skeleton */}
        <div className="space-y-6">
          <div className="h-64 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="h-8 w-40 rounded bg-muted mb-6"></div>
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-16 w-full rounded bg-muted"></div>
              ))}
            </div>
          </div>
          
          <div className="h-48 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="h-8 w-40 rounded bg-muted mb-6"></div>
            <div className="h-20 w-full rounded bg-muted"></div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <aside className="h-80 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-8 w-32 rounded bg-muted mb-4"></div>
          <div className="space-y-2 mb-6">
            <div className="h-4 w-full rounded bg-muted"></div>
            <div className="h-4 w-5/6 rounded bg-muted"></div>
          </div>
          <div className="h-24 w-full rounded-md bg-muted mb-4"></div>
          <div className="h-10 w-full rounded-md bg-muted"></div>
        </aside>
      </div>
    </section>
  );
}
