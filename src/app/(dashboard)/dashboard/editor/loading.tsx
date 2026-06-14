function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-muted ${className}`} />;
}

export default function EditorDashboardLoading() {
  return (
    <section className="animate-pulse space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="mt-3 h-8 w-64" />
        <SkeletonBlock className="mt-4 h-4 w-full max-w-3xl" />
        <SkeletonBlock className="mt-2 h-4 w-2/3 max-w-2xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
            key={item}
          >
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-4 w-4" />
            </div>
            <SkeletonBlock className="mt-4 h-8 w-14" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SkeletonBlock className="h-7 w-40" />
            <SkeletonBlock className="mt-3 h-4 w-72" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <SkeletonBlock className="h-9 w-24" key={item} />
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[920px] divide-y divide-border">
            <div className="grid grid-cols-[2fr_1fr_1fr_1.3fr_1fr] gap-4 px-4 py-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <SkeletonBlock className="h-3 w-24" key={item} />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1.3fr_1fr] gap-4 px-4 py-4"
                key={row}
              >
                <div>
                  <SkeletonBlock className="h-5 w-72" />
                  <SkeletonBlock className="mt-2 h-3 w-56" />
                </div>
                <SkeletonBlock className="h-6 w-28 rounded-full" />
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
