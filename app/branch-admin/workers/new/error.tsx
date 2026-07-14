"use client";

// Route-level boundary. Without one, ANY throw inside the Server Component —
// including one from a dependency the page did not need — renders a raw 500 with
// no way back. This is the last net under the admission form.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server stack, which is deliberately not
    // shipped to the browser.
    console.error("Add worker page failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded border border-gray-200 bg-white px-6 py-20 text-center">
      <p className="text-sm font-medium text-gray-900">Could not open the admission form</p>
      <p className="mt-1 max-w-sm text-xs text-gray-500">
        Something went wrong loading this page. No worker was created.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-gray-300">ref {error.digest}</p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Link
          href="/branch-admin/workers"
          className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          Back to workers
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
