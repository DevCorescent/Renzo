// Streamed while the Server Component fetches. Mirrors the real layout — a hero
// band, a summary block and a tile grid — so the settle when data lands is calm.

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-16" aria-hidden="true">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gray-900/95 p-8 sm:flex-row sm:items-start">
        <div className="size-32 animate-pulse rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-56 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
          <div className="h-9 w-52 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-3">
        <Shimmer className="h-4 w-40" />
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Shimmer className="h-4 w-full max-w-2xl" />
          <Shimmer className="mt-2 h-4 w-3/4 max-w-xl" />
        </div>
      </div>

      {/* Tile grid */}
      <div className="space-y-3">
        <Shimmer className="h-4 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
