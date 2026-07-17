// Streamed while the Server Component fetches. Mirrors the real layout — header,
// a filter row and a table — so nothing shifts when the data lands.

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div>
        <Shimmer className="h-6 w-40" />
        <Shimmer className="mt-2 h-4 w-72" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Shimmer className="h-9 w-64" />
        <Shimmer className="h-9 w-32" />
        <Shimmer className="h-9 w-32" />
      </div>
      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <Shimmer className="h-4 w-28" />
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Shimmer className="size-8 rounded-full" />
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="ml-auto h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
