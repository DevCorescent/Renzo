// Streamed while the Server Component reads the profile. Mirrors the real layout —
// hero band then stacked section cards — so nothing shifts when data lands.

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12" aria-hidden="true">
      <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="size-[88px] shrink-0 animate-pulse rounded-full bg-gray-100" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-4 w-32" />
          <Shimmer className="mt-3 h-3 w-64" />
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <Shimmer className="h-4 w-40" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <Shimmer key={j} className="h-14 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
