"use client";

// Route-level error boundary. Without one, a failed Prisma read renders Next's raw
// error overlay in dev and a blank screen in production.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which is deliberately
    // not shipped to the browser.
    console.error("Workers directory failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded border border-gray-200 bg-white px-6 py-20 text-center">
      <p className="text-sm font-medium text-gray-900">Could not load workers</p>
      <p className="mt-1 max-w-sm text-xs text-gray-500">
        Something went wrong while loading the roster. This has been logged.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-gray-300">ref {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      >
        Try again
      </button>
    </div>
  );
}
