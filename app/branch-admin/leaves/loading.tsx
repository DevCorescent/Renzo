// Skeleton shown while the Server Component fetches (Next streams this in). Mirrors
// the real layout — four stat cards, a toolbar row and a table — so the shift when
// data lands is minimal.

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div>
        <Shimmer className="h-6 w-32" />
        <Shimmer className="mt-2 h-4 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded border border-gray-200 bg-white p-4">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="mt-3 h-7 w-10" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Shimmer className="h-9 w-64" />
        <Shimmer className="h-9 w-32" />
        <Shimmer className="h-9 w-32" />
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <Shimmer className="h-4 w-32" />
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="hidden h-4 w-40 sm:block" />
              <Shimmer className="ml-auto h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
