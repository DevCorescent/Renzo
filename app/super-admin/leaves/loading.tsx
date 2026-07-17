// OWNER: Gauransh
// MODULE: Super Admin Leave Management

// Route-level skeleton shown while the server component fetches leaves + stats.
// Mirrors the real layout (header, stat band, filter row, grouped cards) so the
// page doesn't jump when data lands.
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="h-8 w-56 animate-pulse rounded bg-gray-100" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded border border-gray-200 bg-white" />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded bg-gray-100" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white">
            <div className="h-11 animate-pulse rounded-t-lg bg-gray-50" />
            <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="h-32 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
