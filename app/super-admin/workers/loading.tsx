// Streamed while the directory loads. Mirrors the real layout so the page does not
// jump when data lands — a skeleton with the wrong shape is worse than a spinner.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workers…</span>

      <div className="flex items-end justify-between">
        <div>
          <Bar className="h-3 w-12" />
          <Bar className="mt-2 h-7 w-40" />
          <Bar className="mt-2 h-3 w-56" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded border border-gray-200 bg-white p-3">
            <Bar className="h-2.5 w-16" />
            <Bar className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Bar className="h-9 w-full max-w-xs" />
        <Bar className="h-9 w-32" />
        <Bar className="h-9 w-32" />
        <Bar className="h-9 w-32" />
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
            <Bar className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Bar className="h-3.5 w-40" />
              <Bar className="mt-1.5 h-2.5 w-24" />
            </div>
            <Bar className="hidden h-5 w-24 md:block" />
            <Bar className="h-5 w-20" />
            <Bar className="hidden h-5 w-16 lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
